import PDFDocument from "pdfkit";
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from "node:dns";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";
import type {
    ItineraryOutput,
    ItineraryPlace,
    ItineraryAccommodation,
    ItineraryTransport,
    ItineraryDayActivity,
} from "../../features/itinerary/itinerary.schema.js";
import { computeLiveBudget } from "../../features/itinerary/itinerary.liveBudget.js";

type PDFDoc = PDFKit.PDFDocument;

const PAGE = {
    left: 48,
    right: 48,
    top: 48,
    bottom: 48,
    width: 499,
};

const COLORS = {
    navy: "#123B66",
    blue: "#2563EB",
    blueLight: "#EFF6FF",
    text: "#172033",
    muted: "#64748B",
    border: "#D9E2EC",
    soft: "#F8FAFC",
    green: "#059669",
    greenLight: "#ECFDF5",
    amber: "#D97706",
    amberLight: "#FFFBEB",
    white: "#FFFFFF",
};

function safeNumber(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

const IMAGE_FETCH_TIMEOUT_MS = 5000;
const IMAGE_FETCH_CONCURRENCY = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // a hotel/place photo has no business being bigger

/**
 * True for anything that isn't ordinary public unicast space — private,
 * loopback, link-local, carrier-NAT, documentation/reserved ranges, cloud
 * metadata (169.254.169.254) among them. Delegates to ipaddr.js rather than
 * a hand-rolled range list: it correctly unwraps IPv4-mapped, NAT64 and
 * 6to4 IPv6 forms before classifying (confirmed: `::ffff:169.254.169.254`
 * and `64:ff9b::169.254.169.254` both correctly land outside `unicast`),
 * which a hand-rolled list reliably gets wrong at exactly these edges — see
 * the `ip-address` package's own CVE history for that same class of bug.
 */
function isReservedIp(address: string): boolean {
    try {
        return ipaddr.process(address).range() !== "unicast";
    } catch {
        return true; // unparsable address — never trust it
    }
}

/**
 * Pins the DNS resolution used to actually CONNECT to the exact address
 * that was just validated, with no gap between the two. A plain
 * "resolve, validate, then fetch(url)" leaves a DNS-rebinding window: fetch
 * re-resolves the hostname itself moments later, so a server that answers a
 * safe address for the check and an internal one for the real connection
 * sails straight through. Passed as undici's `connect.lookup`, this becomes
 * the ONLY resolution that ever happens for the request — Node's net/tls
 * layer calls it both in "all candidates" mode (`options.all`, used for
 * Happy-Eyeballs dual-stack connects) and in single-address mode depending
 * on the code path, so both shapes are handled; either way, every candidate
 * is filtered through `isReservedIp` before it can be dialed, and nothing
 * safe-but-unreachable is silently followed into it.
 */
function safeLookup(
    hostname: string,
    options: LookupOptions,
    callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
): void {
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
        if (err) {
            callback(err, "");
            return;
        }
        const list = Array.isArray(addresses) ? addresses : [addresses];
        const safe = list.filter((entry) => !isReservedIp(entry.address));
        if (safe.length === 0) {
            callback(Object.assign(new Error(`No public address for ${hostname}`), { code: "ENOTFOUND" }), "");
            return;
        }
        if (options?.all) {
            callback(null, safe);
            return;
        }
        callback(null, safe[0].address, safe[0].family);
    });
}

// Scoped to just this file's fetches via the `dispatcher` option below —
// does not touch the global fetch dispatcher every other outbound call in
// this process uses.
const safeImageAgent = new Agent({ connect: { lookup: safeLookup } });

/**
 * https-only, and — for a URL whose host is already an IP literal — blocked
 * right here if that address is reserved. `safeLookup` above only runs when
 * Node's connector actually has a hostname to resolve; confirmed (by tracing
 * a custom lookup against an IP-literal URL) that an IP-literal host skips
 * DNS resolution entirely and is dialed directly, so it never reaches
 * `safeLookup` at all — this check is the only thing guarding that case.
 * IPv6 literals keep their brackets in `URL.hostname` (`"[::1]"`), which
 * `net.isIP` doesn't recognise, so they're stripped before classifying.
 */
function isFetchableImageUrl(url: string): boolean {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return false;
    }
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
    if (isIP(hostname) !== 0 && isReservedIp(hostname)) return false;

    return true;
}

/*
 * Exported for pdf.image-ssrf.test.ts only. An IP-literal URL bypassing
 * safeLookup entirely (Node's connector dials it directly without ever
 * calling a custom `lookup` — confirmed by tracing one) was a real, shipped
 * regression once already; this is the one part of the SSRF guard worth a
 * test that needs no network call to run.
 */
export const __ssrfInternals = { isReservedIp, isFetchableImageUrl };

/**
 * Fetches a single hotel/place photo for embedding via `doc.image()`, which
 * needs raw bytes, not a URL. These URLs can come from AI-generated
 * itinerary data, not only vetted SerpApi results, so the server cannot
 * trust them to point anywhere safe: `isFetchableImageUrl` rejects an
 * IP-literal URL pointing at a reserved address outright, `safeImageAgent`'s
 * pinned lookup closes the same gap (plus DNS rebinding) for a hostname URL
 * at the actual connection, `redirect: "manual"` (a 3xx response just fails
 * `.ok`) stops a redirect from reaching an unsafe target after the fact,
 * and the body is read as a stream with a running byte count — aborted the
 * moment it crosses the cap, rather than buffered in full and only checked
 * afterward, so an attacker can't force a large download just by lying
 * about Content-Length. Every failure mode (missing/non-https/unsafe URL,
 * 404, timeout, a redirect, a non-image response, an oversized one)
 * resolves to `null` rather than throwing, so a broken photo never takes
 * down the whole PDF — callers just render the card without a thumbnail.
 */
async function fetchImageBuffer(url: string | undefined): Promise<Buffer | null> {
    if (!url || !isFetchableImageUrl(url)) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

    try {
        const response = await undiciFetch(url, {
            dispatcher: safeImageAgent,
            signal: controller.signal,
            redirect: "manual",
        });
        if (!response.ok || !response.body) return null;

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) return null;

        const declaredLength = Number(response.headers.get("content-length") || 0);
        if (declaredLength > MAX_IMAGE_BYTES) return null;

        const chunks: Buffer[] = [];
        let total = 0;
        for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
            total += chunk.length;
            if (total > MAX_IMAGE_BYTES) {
                controller.abort();
                return null;
            }
            chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
    } catch {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Runs `fn` over `items` in batches of `limit` concurrent calls. A hand-rolled
 * loop rather than a dependency: itineraries cap at 8 hotel cards and 10 place
 * cards (see the `.slice()` calls below), so this never has more than a
 * couple of batches to run.
 */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    for (let i = 0; i < items.length; i += limit) {
        const batch = items.slice(i, i + limit);
        const batchResults = await Promise.all(batch.map((item, j) => fn(item, i + j)));
        batchResults.forEach((result, j) => {
            results[i + j] = result;
        });
    }
    return results;
}

/**
 * Draws a fetched photo into a square-ish box. `doc.image()` can throw on a
 * buffer it can't parse (corrupt data, an unsupported format) even after the
 * content-type check in `fetchImageBuffer` passed, so this is its own
 * try/catch and simply leaves the box blank on failure.
 */
function drawThumbnail(doc: PDFDoc, buffer: Buffer | null, x: number, y: number, size: number): void {
    if (!buffer) return;
    try {
        doc.image(buffer, x, y, { fit: [size, size], align: "center", valign: "center" });
    } catch {
        // Unsupported/corrupt image bytes: skip silently, card keeps its layout.
    }
}

/**
 * Reads `itinerary.selections` into a predicate for "did the traveler keep
 * this item?".
 *
 * Selections are stored as exclusions (see ItinerarySelectionsSchema), so an
 * itinerary with no selections — every one saved before this feature existed —
 * yields a predicate that keeps everything, and the PDF is byte-identical to
 * what it was. The key strings are built identically here and in
 * ItineraryResults.jsx; they are positional, which is sound because the PDF is
 * rendered from the same stored document the checkboxes were ticked against.
 */
export function buildSelectionFilter(itinerary: ItineraryOutput): (key: string) => boolean {
    const excluded = new Set(
        Array.isArray((itinerary as any)?.selections?.excluded)
            ? (itinerary as any).selections.excluded.map(String)
            : [],
    );

    if (excluded.size === 0) return () => true;
    return (key: string) => !excluded.has(key);
}

type SelectedFlight = {
    airline?: string;
    flightNumber?: string | number;
    date?: string;
    dayOfWeek?: string;
    predictedFare?: number;
    origin?: string;
    destination?: string;
};

function selectedFlights(itinerary: ItineraryOutput): SelectedFlight[] {
    const flights = (itinerary as any)?.selections?.flights;
    return Array.isArray(flights) ? flights : [];
}

type SelectedTrain = {
    origin?: string;
    destination?: string;
    date?: string;
    dayOfWeek?: string;
    predictedFare?: number;
};

function selectedTrains(itinerary: ItineraryOutput): SelectedTrain[] {
    const trains = (itinerary as any)?.selections?.trains;
    return Array.isArray(trains) ? trains : [];
}

type SelectedBus = {
    origin?: string;
    destination?: string;
    date?: string;
    dayOfWeek?: string;
    predictedFare?: number;
};

function selectedBuses(itinerary: ItineraryOutput): SelectedBus[] {
    const buses = (itinerary as any)?.selections?.buses;
    return Array.isArray(buses) ? buses : [];
}

type FareCard = {
    /** Airline for a flight, origin station for a train. */
    label: string;
    fare?: number;
    route: string;
    meta: (string | undefined)[];
};

/**
 * Shared by the flight and train sections. Both are INCLUSIONS (see
 * ItinerarySelectionsSchema): fares are predicted per request by the ML
 * service and never stored in the itinerary document, so only what the
 * traveler actually ticked was ever persisted.
 */
function addFareSection(doc: PDFDoc, title: string, subtitle: string, cards: FareCard[]): void {
    if (cards.length === 0) return;

    doc.addPage();
    drawPageHeader(doc);
    doc.y = 62;

    addTitle(doc, title, subtitle);

    cards.slice(0, 10).forEach((card) => {
        ensureSpace(doc, 82);

        const y = doc.y;
        roundedCard(doc, PAGE.left, y, PAGE.width, 66, COLORS.white);

        doc.fillColor(COLORS.blue)
            .font("Helvetica-Bold")
            .fontSize(8)
            .text(card.label.toUpperCase(), PAGE.left + 14, y + 12, { width: PAGE.width - 160 });

        if (card.fare !== undefined) {
            doc.fillColor(COLORS.navy)
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(formatCurrency(card.fare), PAGE.left + PAGE.width - 145, y + 12, {
                    width: 130,
                    align: "right",
                });
        }

        doc.fillColor(COLORS.navy)
            .font("Helvetica-Bold")
            .fontSize(10)
            .text(card.route, PAGE.left + 14, y + 28, { width: PAGE.width - 160 });

        doc.fillColor(COLORS.muted)
            .font("Helvetica")
            .fontSize(8)
            .text(card.meta.filter(Boolean).join("  |  "), PAGE.left + 14, y + 46, {
                width: PAGE.width - 28,
            });

        doc.y = y + 78;
    });

    doc.fillColor(COLORS.muted)
        .font("Helvetica-Oblique")
        .fontSize(7.5)
        .text(
            "Fares are model estimates for these dates, not quotes, and will differ at booking.",
            PAGE.left,
            doc.y + 4,
            { width: PAGE.width },
        );
}

/**
 * PDFKit's built-in Helvetica does not reliably render the INR glyph.
 * Use "INR" in generated PDFs instead of producing tofu/square characters.
 */
function formatCurrency(amount: unknown, currency = "INR"): string {
    const value = safeNumber(amount);
    if (currency === "INR") {
        return `INR ${new Intl.NumberFormat("en-IN", {
            maximumFractionDigits: 0,
        }).format(value)}`;
    }

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency} ${Math.round(value).toLocaleString("en-IN")}`;
    }
}

function formatDate(date: string): string {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return date;

    return new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(parsed);
}

function formatTime(time: string): string {
    if (!time) return "";
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return time;

    let hour = Number(match[1]);
    const minute = match[2];
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${suffix}`;
}

function typeLabel(type: string): string {
    return ({
        visit: "VISIT",
        meal: "MEAL",
        transport: "TRANSPORT",
        free_time: "FREE TIME",
        accommodation: "STAY",
    } as Record<string, string>)[type] || type.toUpperCase();
}

function truncate(text: string, max: number): string {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max - 1).trim()}...` : text;
}

function ensureSpace(doc: PDFDoc, needed = 80): void {
    if (doc.y + needed > doc.page.height - PAGE.bottom) {
        doc.addPage();
        drawPageHeader(doc);
    }
}

function drawPageHeader(doc: PDFDoc): void {
    doc.save();
    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("TRIPZY", PAGE.left, 24);

    doc.fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text("PERSONALIZED TRAVEL ITINERARY", PAGE.left + 48, 25, {
            width: PAGE.width - 48,
            align: "right",
        });

    doc.strokeColor(COLORS.border)
        .lineWidth(0.7)
        .moveTo(PAGE.left, 39)
        .lineTo(PAGE.left + PAGE.width, 39)
        .stroke();
    doc.restore();
}

function drawFooter(doc: PDFDoc, destination: string): void {
    const range = doc.bufferedPageRange();
    const pageCount = range.count;

    for (let i = 0; i < pageCount; i++) {
        const pageNumber = range.start + i;
        doc.switchToPage(pageNumber);

        doc.save();
        doc.strokeColor(COLORS.border)
            .lineWidth(0.7)
            .moveTo(PAGE.left, doc.page.height - 34)
            .lineTo(PAGE.left + PAGE.width, doc.page.height - 34)
            .stroke();

        doc.fillColor(COLORS.muted)
            .font("Helvetica")
            .fontSize(7.5)
            .text(
                `Tripzy  |  ${truncate(destination, 45)}  |  Page ${pageNumber} of ${pageCount}`,
                PAGE.left,
                doc.page.height - 25,
                { width: PAGE.width, align: "center" },
            );
        doc.restore();
    }
}

function addTitle(doc: PDFDoc, title: string, subtitle?: string): void {
    ensureSpace(doc, 70);

    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(20)
        .text(title, PAGE.left, doc.y, { width: PAGE.width });

    if (subtitle) {
        doc.moveDown(0.3);
        doc.fillColor(COLORS.muted)
            .font("Helvetica")
            .fontSize(9)
            .text(subtitle, { width: PAGE.width });
    }

    doc.moveDown(0.7);
    doc.strokeColor(COLORS.blue)
        .lineWidth(2)
        .moveTo(PAGE.left, doc.y)
        .lineTo(PAGE.left + 52, doc.y)
        .stroke();
    doc.moveDown(0.8);
}

function addBody(doc: PDFDoc, text: string, size = 9.5): void {
    if (!text) return;
    ensureSpace(doc, 45);

    doc.fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(size)
        .text(text, PAGE.left, doc.y, {
            width: PAGE.width,
            lineGap: 2,
        });
    doc.moveDown(0.45);
}

function addSectionLabel(doc: PDFDoc, text: string): void {
    ensureSpace(doc, 35);
    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(text, PAGE.left, doc.y);
    doc.moveDown(0.35);
}

function roundedCard(
    doc: PDFDoc,
    x: number,
    y: number,
    width: number,
    height: number,
    fill = COLORS.white,
): void {
    doc.save();
    doc.roundedRect(x, y, width, height, 7)
        .fillAndStroke(fill, COLORS.border);
    doc.restore();
}

function addBudgetCards(doc: PDFDoc, b: ItineraryOutput["budgetBreakdown"]): void {
    // Recalculate total from categories to ensure consistency
    const total = Number(b.accommodation || 0) + Number(b.food || 0) + Number(b.transport || 0) + Number(b.activities || 0) + Number(b.miscellaneous || 0);

    const items = [
        ["TOTAL", total, COLORS.navy],
        ["STAY", b.accommodation, COLORS.blue],
        ["FOOD", b.food, COLORS.green],
        ["TRANSPORT", b.transport, COLORS.amber],
        ["ACTIVITIES", b.activities, COLORS.blue],
        ["MISC", b.miscellaneous, COLORS.muted],
    ] as const;

    // 6 cards need 5 gaps between them, not 4 - a card list missing
    // Miscellaneous used to leave the 5 visible cards under-adding to the
    // TOTAL card beside them by exactly that category's amount.
    const gap = 8;
    const cardWidth = (PAGE.width - gap * 5) / 6;
    const y = doc.y;

    items.forEach(([label, amount, accent], index) => {
        const x = PAGE.left + index * (cardWidth + gap);

        roundedCard(doc, x, y, cardWidth, 58, COLORS.soft);

        doc.fillColor(accent)
            .font("Helvetica-Bold")
            .fontSize(index === 0 ? 11 : 10)
            .text(formatCurrency(amount, b.currency), x + 8, y + 13, {
                width: cardWidth - 16,
                align: "center",
            });

        doc.fillColor(COLORS.muted)
            .font("Helvetica-Bold")
            .fontSize(6.5)
            .text(label, x + 8, y + 36, {
                width: cardWidth - 16,
                align: "center",
            });
    });

    doc.y = y + 72;
}

function addBudgetTable(doc: PDFDoc, b: ItineraryOutput["budgetBreakdown"]): void {
    const rows = [
        ["Accommodation", b.accommodation],
        ["Food & Dining", b.food],
        ["Transport", b.transport],
        ["Activities", b.activities],
        ["Miscellaneous", b.miscellaneous],
    ] as const;

    const x = PAGE.left;
    const width = PAGE.width;
    const rowHeight = 28;
    const totalHeight = rowHeight * (rows.length + 1);

    ensureSpace(doc, totalHeight + 10);
    const y = doc.y;

    doc.roundedRect(x, y, width, totalHeight, 6).fillAndStroke(COLORS.white, COLORS.border);

    doc.rect(x, y, width, rowHeight).fill(COLORS.blueLight);

    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .text("CATEGORY", x + 14, y + 9);

    doc.text("ESTIMATED COST", x + width - 155, y + 9, {
        width: 140,
        align: "right",
    });

    rows.forEach(([label, amount], i) => {
        const rowY = y + rowHeight * (i + 1);

        if (i % 2 === 1) {
            doc.rect(x + 1, rowY, width - 2, rowHeight).fill(COLORS.soft);
        }

        doc.fillColor(COLORS.text)
            .font("Helvetica")
            .fontSize(9)
            .text(label, x + 14, rowY + 9);

        doc.fillColor(COLORS.text)
            .font("Helvetica-Bold")
            .text(formatCurrency(amount, b.currency), x + width - 155, rowY + 9, {
                width: 140,
                align: "right",
            });
    });

    const totalY = y + totalHeight - rowHeight;

    doc.fillColor(COLORS.greenLight)
        .rect(x + 1, totalY, width - 2, rowHeight)
        .fill();

    doc.fillColor(COLORS.green)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("TOTAL", x + 14, totalY + 9);

    doc.text(formatCurrency(b.total, b.currency), x + width - 155, totalY + 9, {
        width: 140,
        align: "right",
    });

    doc.y = y + totalHeight + 14;
}

const THUMB_SIZE = 72;

function addAccommodationCard(
    doc: PDFDoc,
    acc: ItineraryAccommodation,
    index: number,
    thumbnail: Buffer | null = null,
): void {
    ensureSpace(doc, 125);

    const x = PAGE.left;
    const y = doc.y;
    const width = PAGE.width;
    const amenities = Array.isArray(acc.amenities) ? acc.amenities.slice(0, 6) : [];

    // A real SerpApi listing has a rating, a star class and a review count
    // worth printing; an AI-suggested stay has none of them and the line is
    // skipped rather than printed empty.
    const ratingBits = [
        acc.rating ? `${acc.rating}/5` : "",
        acc.reviewsCount ? `${acc.reviewsCount.toLocaleString("en-IN")} reviews` : "",
        acc.hotelClass ? `${acc.hotelClass}-star` : "",
        acc.locationRating ? `Location ${acc.locationRating}/5` : "",
    ].filter(Boolean).join("  |  ");

    let height = 105;
    if (amenities.length > 0) height += 18;
    if (ratingBits) height += 15;
    if ((acc.description || "").length > 260) height += 20;
    if (thumbnail) height = Math.max(height, THUMB_SIZE + 38);

    roundedCard(doc, x, y, width, height, COLORS.white);

    // A thumbnail, when fetched, reserves a square on the left and pushes
    // every text line right by the same amount; no thumbnail keeps the
    // original full-width layout byte-for-byte.
    const textX = thumbnail ? x + 14 + THUMB_SIZE + 14 : x + 14;
    const textWidth = thumbnail ? width - 28 - THUMB_SIZE - 14 : width - 28;

    if (thumbnail) {
        drawThumbnail(doc, thumbnail, x + 14, y + 13, THUMB_SIZE);
    }

    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`${index + 1}. ${acc.name}`, textX, y + 13, {
            width: textWidth - 132,
        });

    doc.fillColor(COLORS.blue)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(formatCurrency(acc.pricePerNight, acc.currency) + "/night", x + width - 145, y + 14, {
            width: 130,
            align: "right",
        });

    doc.fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text(`${acc.type || "hotel"}  |  ${acc.location || "Location not specified"}`, textX, y + 34, {
            width: textWidth,
        });

    let cursorY = y + 51;

    if (ratingBits) {
        doc.fillColor(COLORS.green)
            .font("Helvetica-Bold")
            .fontSize(8)
            .text(ratingBits, textX, cursorY, { width: textWidth });
        cursorY += 15;
    }

    if (amenities.length > 0) {
        doc.fillColor(COLORS.text)
            .font("Helvetica")
            .fontSize(8)
            .text(`Amenities: ${amenities.join("  |  ")}`, textX, cursorY, {
                width: textWidth,
            });
        cursorY += 19;
    }

    doc.fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(8.5)
        .text(truncate(acc.description || "", 430), textX, cursorY, {
            width: textWidth,
            lineGap: 1.5,
        });

    const highlights = Array.isArray(acc.reviewHighlights)
        ? acc.reviewHighlights.slice(0, 4)
        : [];

    if (highlights.length > 0) {
        doc.fillColor(COLORS.muted)
            .font("Helvetica-Oblique")
            .fontSize(7.5)
            .text(`Guests liked: ${highlights.join(", ")}`, x + 14, y + height - 16, {
                width: width - 28,
            });
    }

    doc.y = y + height + 12;
}

function addPlaceCard(
    doc: PDFDoc,
    place: ItineraryPlace,
    index: number,
    thumbnail: Buffer | null = null,
): void {
    ensureSpace(doc, 105);

    const x = PAGE.left;
    const y = doc.y;
    const width = PAGE.width;
    const height = 92;

    roundedCard(doc, x, y, width, height, COLORS.white);

    // Same left-thumbnail layout as the accommodation card: reserve a square
    // and shift text right only when a photo was actually fetched.
    const textX = thumbnail ? x + 14 + THUMB_SIZE + 14 : x + 14;
    const textWidth = thumbnail ? width - 28 - THUMB_SIZE - 14 : width - 28;

    if (thumbnail) {
        drawThumbnail(doc, thumbnail, x + 14, y + (height - THUMB_SIZE) / 2, THUMB_SIZE);
    }

    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`${index + 1}. ${place.name}`, textX, y + 12, {
            width: textWidth,
        });

    doc.fillColor(COLORS.blue)
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text(
            `${place.category || "Attraction"}  |  ${place.location || "Location not specified"}`,
            textX,
            y + 30,
            { width: textWidth },
        );

    const details = [
        place.visitDurationHours ? `Visit: ${place.visitDurationHours} hrs` : "",
        place.bestTimeToVisit ? `Best time: ${place.bestTimeToVisit}` : "",
        place.priceRange ? `Cost: ${place.priceRange}` : "",
    ].filter(Boolean).join("  |  ");

    if (details) {
        doc.fillColor(COLORS.muted)
            .font("Helvetica")
            .fontSize(7.5)
            .text(details, textX, y + 45, { width: textWidth });
    }

    doc.fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(8)
        .text(truncate(place.description || "", 390), textX, y + 61, {
            width: textWidth,
            lineGap: 1,
        });

    doc.y = y + height + 10;
}

function addActivity(doc: PDFDoc, activity: ItineraryDayActivity): void {
    const x = PAGE.left;
    const width = PAGE.width;
    const title = activity.title || "Activity";
    const description = activity.description || "";
    const place = activity.place?.location ? ` | ${activity.place.location}` : "";
    const cost = activity.cost !== undefined
        ? `  |  ${formatCurrency(activity.cost)}`
        : "";

    // Let PDFKit calculate the description height approximately.
    const descHeight = Math.max(22, Math.ceil(description.length / 88) * 11);
    const height = 62 + descHeight;

    ensureSpace(doc, Math.min(height, 150));

    const y = doc.y;
    roundedCard(doc, x, y, width, height, COLORS.soft);

    doc.fillColor(COLORS.blue)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text(formatTime(activity.time), x + 12, y + 12, {
            width: 65,
        });

    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(title, x + 82, y + 11, {
            width: width - 96,
        });

    doc.fillColor(COLORS.blue)
        .font("Helvetica-Bold")
        .fontSize(6.5)
        .text(typeLabel(activity.type), x + 82, y + 28, {
            width: 90,
        });

    doc.fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(8)
        .text(truncate(description, 470), x + 82, y + 39, {
            width: width - 96,
            lineGap: 1.5,
        });

    if (place || cost) {
        doc.fillColor(COLORS.muted)
            .font("Helvetica")
            .fontSize(7)
            .text(`${place.replace(/^ \| /, "")}${cost}`, x + 82, y + height - 13, {
                width: width - 96,
            });
    }

    doc.y = y + height + 7;
}

function addDay(
    doc: PDFDoc,
    day: ItineraryOutput["days"][number],
    isSelected: (key: string) => boolean = () => true,
): void {
    // Keep one day together where possible, but allow it to span pages naturally.
    ensureSpace(doc, 95);

    const x = PAGE.left;
    const width = PAGE.width;

    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(15)
        .text(`DAY ${day.day}`, x, doc.y, { continued: true });

    doc.fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(9)
        .text(`  ${formatDate(day.date)}`);

    if (day.theme) {
        doc.moveDown(0.25);
        doc.fillColor(COLORS.blue)
            .font("Helvetica-Bold")
            .fontSize(9)
            .text(day.theme, x, doc.y, { width });
    }

    doc.moveDown(0.6);

    const activities = (Array.isArray(day.activities) ? day.activities : []).filter(
        (_activity, index) => isSelected(`activity:${day.day}:${index}`),
    );

    activities.forEach((activity) => {
        addActivity(doc, activity);
    });

    if (day.dailyBudget !== undefined) {
        ensureSpace(doc, 34);
        roundedCard(doc, x, doc.y, width, 30, COLORS.greenLight);

        doc.fillColor(COLORS.green)
            .font("Helvetica-Bold")
            .fontSize(8.5)
            .text(`Daily estimated spend: ${formatCurrency(day.dailyBudget)}`, x + 12, doc.y + 9);

        doc.y += 42;
    }

    doc.moveDown(0.35);
}

export async function generateItineraryPdf(itinerary: ItineraryOutput): Promise<Buffer> {
    // Selection filtering and image fetching both have to happen before the
    // synchronous pdfkit drawing pass below, so they're hoisted out of the
    // Promise executor that used to be this whole function body.
    const isSelected = buildSelectionFilter(itinerary);

    const accommodations = (Array.isArray(itinerary.accommodations) ? itinerary.accommodations : [])
        .filter((_acc, index) => isSelected(`hotel:${index}`))
        .slice(0, 8);
    const places = (Array.isArray(itinerary.placesToVisit) ? itinerary.placesToVisit : [])
        .filter((_place, index) => isSelected(`place:${index}`))
        .slice(0, 10);

    // One photo per card, fetched with bounded concurrency so a long
    // itinerary never fires 18 simultaneous requests. A failed/missing fetch
    // resolves to null and the card renders exactly as it did with no image.
    const [accommodationThumbs, placeThumbs] = await Promise.all([
        mapWithConcurrency(accommodations, IMAGE_FETCH_CONCURRENCY, (acc) =>
            fetchImageBuffer(acc.thumbnailUrl || acc.imageUrl)),
        mapWithConcurrency(places, IMAGE_FETCH_CONCURRENCY, (place) =>
            fetchImageBuffer(place.imageUrl)),
    ]);

    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: "A4",
                margin: 0,
                autoFirstPage: true,
                bufferPages: true,
                info: {
                    Title: `${itinerary.destination} - Tripzy Itinerary`,
                    Author: "Tripzy",
                    Subject: "Personalized travel itinerary",
                },
            });

            const chunks: Buffer[] = [];

            doc.on("data", (chunk: Buffer) => chunks.push(chunk));
            doc.on("end", () => resolve(Buffer.concat(chunks)));
            doc.on("error", reject);

            /*
             * Recomputed from the stored selections, NOT itinerary
             * .budgetBreakdown: that figure is fixed at generation time, so a
             * PDF exported after the traveler swapped the hotel or ticked a
             * predicted fare used to disagree with the total on screen. Same
             * rules as the results page - see itinerary.liveBudget.ts.
             */
            const b = computeLiveBudget(itinerary);

            // Everything the traveler ticked off in the UI is dropped here, so
            // the PDF is the chosen trip rather than the whole menu. Filtering
            // by original index keeps the keys stable regardless of how many
            // items each section later slices for layout.
            const flights = selectedFlights(itinerary);
            const trains = selectedTrains(itinerary);
            const buses = selectedBuses(itinerary);

            // `accommodations`/`places` and their fetched thumbnails were
            // already computed above, outside the Promise executor, since
            // fetching needed to be awaited before this synchronous drawing
            // pass starts.
            const transport = (Array.isArray(itinerary.transportOptions) ? itinerary.transportOptions : [])
                .filter((_t, index) => isSelected(`transport:${index}`));
            const days = (Array.isArray(itinerary.days) ? itinerary.days : [])
                // A day whose every activity was unticked would otherwise print
                // as a bare heading, so it drops out entirely.
                .filter((day) =>
                    (Array.isArray(day.activities) ? day.activities : []).some(
                        (_activity, index) => isSelected(`activity:${day.day}:${index}`),
                    ),
                );
            const tips = Array.isArray(itinerary.tips) ? itinerary.tips : [];

            // =========================================================
            // COVER
            // =========================================================
            doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.soft);

            doc.roundedRect(48, 72, 499, 600, 18)
                .fillAndStroke(COLORS.white, COLORS.border);

            doc.fillColor(COLORS.blue)
                .font("Helvetica-Bold")
                .fontSize(11)
                .text("TRIPZY", 80, 110);

            doc.fillColor(COLORS.navy)
                .font("Helvetica-Bold")
                .fontSize(34)
                .text(itinerary.destination, 80, 180, {
                    width: 435,
                    align: "left",
                });

            doc.fillColor(COLORS.muted)
                .font("Helvetica")
                .fontSize(13)
                .text(
                    `${formatDate(itinerary.startDate)}  -  ${formatDate(itinerary.endDate)}`,
                    80,
                    doc.y + 14,
                );

            doc.fillColor(COLORS.blue)
                .font("Helvetica-Bold")
                .fontSize(11)
                .text(`${itinerary.totalDays} DAYS`, 80, doc.y + 20);

            doc.fillColor(COLORS.muted)
                .font("Helvetica")
                .fontSize(10)
                .text("PERSONALIZED TRAVEL ITINERARY", 80, doc.y + 28);

            doc.fillColor(COLORS.text)
                .font("Helvetica")
                .fontSize(10)
                .text(truncate(itinerary.overview, 520), 80, 360, {
                    width: 435,
                    lineGap: 3,
                });

            roundedCard(doc, 80, 455, 435, 105, COLORS.blueLight);

            doc.fillColor(COLORS.muted)
                .font("Helvetica-Bold")
                .fontSize(8)
                .text("ESTIMATED TOTAL BUDGET", 100, 477);

            doc.fillColor(COLORS.navy)
                .font("Helvetica-Bold")
                .fontSize(25)
                .text(formatCurrency(b.total, b.currency), 100, 495);

            doc.fillColor(COLORS.muted)
                .font("Helvetica")
                .fontSize(8)
                .text(
                    `Stay ${formatCurrency(b.accommodation)}  |  Food ${formatCurrency(b.food)}  |  Transport ${formatCurrency(b.transport)}`,
                    100,
                    533,
                    { width: 395 },
                );

            doc.fillColor(COLORS.muted)
                .font("Helvetica")
                .fontSize(8)
                .text(
                    `Generated ${formatDate(new Date().toISOString().slice(0, 10))}`,
                    80,
                    635,
                );

            // =========================================================
            // CONTENT
            // =========================================================
            doc.addPage();
            drawPageHeader(doc);
            doc.y = 62;

            addTitle(doc, "Trip Overview", `${formatDate(itinerary.startDate)} to ${formatDate(itinerary.endDate)}  |  ${itinerary.totalDays} days`);
            addBody(doc, itinerary.overview, 10);

            addSectionLabel(doc, "Budget at a glance");
            addBudgetCards(doc, b);

            addSectionLabel(doc, "Budget breakdown");
            addBudgetTable(doc, b);

            // Accommodation
            if (accommodations.length > 0) {
                doc.addPage();
                drawPageHeader(doc);
                doc.y = 62;

                addTitle(
                    doc,
                    "Where to Stay",
                    accommodations.some((acc) => (acc as any).source === "serpapi")
                        ? "Live availability and rates for your dates"
                        : "Recommended accommodation options",
                );

                accommodations.forEach((acc, index) => {
                    addAccommodationCard(doc, acc, index, accommodationThumbs[index] ?? null);
                });
            }

            // Places
            if (places.length > 0) {
                doc.addPage();
                drawPageHeader(doc);
                doc.y = 62;

                addTitle(doc, "Places to Visit", "Highlights selected for your trip");

                places.forEach((place, index) => {
                    addPlaceCard(doc, place, index, placeThumbs[index] ?? null);
                });
            }

            // Daily itinerary
            doc.addPage();
            drawPageHeader(doc);
            doc.y = 62;

            addTitle(doc, "Day-by-Day Itinerary", `${days.length} planned days`);

            days.forEach((day, index) => {
                if (index > 0) {
                    // A modest separator, not a forced new page.
                    doc.strokeColor(COLORS.border)
                        .lineWidth(0.8)
                        .moveTo(PAGE.left, doc.y)
                        .lineTo(PAGE.left + PAGE.width, doc.y)
                        .stroke();
                    doc.y += 14;
                }
                addDay(doc, day, isSelected);
            });

            addFareSection(
                doc,
                "Your Flights",
                "Selected from predicted fares",
                flights.map((flight) => ({
                    label: String(flight.airline || "Flight"),
                    fare: flight.predictedFare,
                    route: `${flight.origin || ""}  ->  ${flight.destination || ""}`,
                    meta: [
                        flight.flightNumber ? `Flight ${flight.flightNumber}` : "",
                        flight.date ? formatDate(String(flight.date)) : "",
                        flight.dayOfWeek || "",
                    ],
                })),
            );

            // Trains carry no service name or number: the rail model predicts a
            // fare for a route and a date, nothing more (see ADR 0007).
            addFareSection(
                doc,
                "Your Trains",
                "Selected from predicted rail fares",
                trains.map((train) => ({
                    label: String(train.origin || "Train"),
                    fare: train.predictedFare,
                    route: `${train.origin || ""}  ->  ${train.destination || ""}`,
                    meta: [
                        train.date ? formatDate(String(train.date)) : "",
                        train.dayOfWeek || "",
                    ],
                })),
            );

            // Buses carry no operator or service identity either - same
            // route+date+fare shape as trains (see bus_predictor.py).
            addFareSection(
                doc,
                "Your Buses",
                "Selected from predicted bus fares",
                buses.map((bus) => ({
                    label: String(bus.origin || "Bus"),
                    fare: bus.predictedFare,
                    route: `${bus.origin || ""}  ->  ${bus.destination || ""}`,
                    meta: [
                        bus.date ? formatDate(String(bus.date)) : "",
                        bus.dayOfWeek || "",
                    ],
                })),
            );

            // Transport
            if (transport.length > 0) {
                doc.addPage();
                drawPageHeader(doc);
                doc.y = 62;

                addTitle(doc, "Getting Around", "Suggested transport options");

                transport.slice(0, 10).forEach((t: ItineraryTransport) => {
                    ensureSpace(doc, 82);

                    const y = doc.y;
                    roundedCard(doc, PAGE.left, y, PAGE.width, 66, COLORS.white);

                    doc.fillColor(COLORS.blue)
                        .font("Helvetica-Bold")
                        .fontSize(8)
                        .text((t.type || "transport").toUpperCase(), PAGE.left + 14, y + 12);

                    doc.fillColor(COLORS.navy)
                        .font("Helvetica-Bold")
                        .fontSize(10)
                        .text(`${t.from}  ->  ${t.to}`, PAGE.left + 14, y + 28);

                    doc.fillColor(COLORS.muted)
                        .font("Helvetica")
                        .fontSize(8)
                        .text(
                            `${Math.floor(safeNumber(t.durationMinutes) / 60)}h ${safeNumber(t.durationMinutes) % 60}m  |  ${formatCurrency(t.estimatedCost, t.currency)}${t.frequency ? `  |  ${t.frequency}` : ""}`,
                            PAGE.left + 14,
                            y + 46,
                        );

                    doc.y = y + 78;
                });
            }

            // Tips + emergency
            if (tips.length > 0 || itinerary.emergencyInfo) {
                doc.addPage();
                drawPageHeader(doc);
                doc.y = 62;

                addTitle(doc, "Travel Tips & Emergency Information");

                if (tips.length > 0) {
                    addSectionLabel(doc, "Practical tips");

                    tips.slice(0, 8).forEach((tip) => {
                        ensureSpace(doc, 28);

                        doc.fillColor(COLORS.green)
                            .font("Helvetica-Bold")
                            .fontSize(9)
                            .text("OK", PAGE.left, doc.y);

                        doc.fillColor(COLORS.text)
                            .font("Helvetica")
                            .fontSize(9)
                            .text(tip, PAGE.left + 25, doc.y, {
                                width: PAGE.width - 25,
                            });

                        doc.moveDown(0.45);
                    });
                }

                if (itinerary.emergencyInfo) {
                    doc.moveDown(0.8);
                    addSectionLabel(doc, "Emergency information");

                    const e = itinerary.emergencyInfo;

                    const emergencyRows: Array<[string, string]> = [
                        ["Emergency number", e.emergencyNumber || "112"],
                        ["Nearest hospital", e.nearestHospital || "Not specified"],
                        ["Police station", e.policeStation || "Not specified"],
                    ];

                    if (e.embassy) {
                        emergencyRows.push(["Embassy / Consulate", e.embassy]);
                    }

                    emergencyRows.forEach(([label, value]) => {
                        const cardX = PAGE.left;
                        const cardWidth = PAGE.width;

                        const labelX = cardX + 14;
                        const valueX = cardX + 14;

                        const labelWidth = cardWidth - 28;
                        const valueWidth = cardWidth - 28;

                        // Calculate required height for the value dynamically.
                        doc.font("Helvetica")
                            .fontSize(9);

                        const valueHeight = doc.heightOfString(String(value), {
                            width: valueWidth,
                            lineGap: 2,
                        });

                        const cardHeight = Math.max(
                            58,
                            30 + valueHeight
                        );

                        // Keep the complete card together.
                        ensureSpace(doc, cardHeight + 12);

                        const y = doc.y;

                        // Card background
                        roundedCard(
                            doc,
                            cardX,
                            y,
                            cardWidth,
                            cardHeight,
                            COLORS.soft
                        );

                        // Label
                        doc.fillColor(COLORS.muted)
                            .font("Helvetica-Bold")
                            .fontSize(8.5)
                            .text(label, labelX, y + 10, {
                                width: labelWidth,
                            });

                        // Value
                        doc.fillColor(COLORS.text)
                            .font("Helvetica")
                            .fontSize(9)
                            .text(String(value), valueX, y + 27, {
                                width: valueWidth,
                                lineGap: 2,
                            });

                        // Move below the actual card height
                        doc.y = y + cardHeight + 10;
                    });
                }
            }

            drawFooter(doc, itinerary.destination);
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}