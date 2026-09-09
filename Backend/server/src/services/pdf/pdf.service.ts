import PDFDocument from "pdfkit";
import type {
    ItineraryOutput,
    ItineraryPlace,
    ItineraryAccommodation,
    ItineraryTransport,
    ItineraryDayActivity,
} from "../../features/itinerary/itinerary.schema.js";

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
    ] as const;

    const gap = 8;
    const cardWidth = (PAGE.width - gap * 4) / 5;
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

function addAccommodationCard(doc: PDFDoc, acc: ItineraryAccommodation, index: number): void {
    ensureSpace(doc, 125);

    const x = PAGE.left;
    const y = doc.y;
    const width = PAGE.width;
    const amenities = Array.isArray(acc.amenities) ? acc.amenities.slice(0, 6) : [];

    let height = 105;
    if (amenities.length > 0) height += 18;
    if ((acc.description || "").length > 260) height += 20;

    roundedCard(doc, x, y, width, height, COLORS.white);

    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(`${index + 1}. ${acc.name}`, x + 14, y + 13, {
            width: width - 160,
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
        .text(`${acc.type || "hotel"}  |  ${acc.location || "Location not specified"}`, x + 14, y + 34, {
            width: width - 28,
        });

    let cursorY = y + 51;

    if (amenities.length > 0) {
        doc.fillColor(COLORS.text)
            .font("Helvetica")
            .fontSize(8)
            .text(`Amenities: ${amenities.join("  |  ")}`, x + 14, cursorY, {
                width: width - 28,
            });
        cursorY += 19;
    }

    doc.fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(8.5)
        .text(truncate(acc.description || "", 430), x + 14, cursorY, {
            width: width - 28,
            lineGap: 1.5,
        });

    doc.y = y + height + 12;
}

function addPlaceCard(doc: PDFDoc, place: ItineraryPlace, index: number): void {
    ensureSpace(doc, 105);

    const x = PAGE.left;
    const y = doc.y;
    const width = PAGE.width;
    const height = 92;

    roundedCard(doc, x, y, width, height, COLORS.white);

    doc.fillColor(COLORS.navy)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`${index + 1}. ${place.name}`, x + 14, y + 12, {
            width: width - 28,
        });

    doc.fillColor(COLORS.blue)
        .font("Helvetica-Bold")
        .fontSize(7.5)
        .text(
            `${place.category || "Attraction"}  |  ${place.location || "Location not specified"}`,
            x + 14,
            y + 30,
            { width: width - 28 },
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
            .text(details, x + 14, y + 45, { width: width - 28 });
    }

    doc.fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(8)
        .text(truncate(place.description || "", 390), x + 14, y + 61, {
            width: width - 28,
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

function addDay(doc: PDFDoc, day: ItineraryOutput["days"][number]): void {
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

    const activities = Array.isArray(day.activities) ? day.activities : [];

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

            const b = itinerary.budgetBreakdown;
            const accommodations = Array.isArray(itinerary.accommodations) ? itinerary.accommodations : [];
            const places = Array.isArray(itinerary.placesToVisit) ? itinerary.placesToVisit : [];
            const transport = Array.isArray(itinerary.transportOptions) ? itinerary.transportOptions : [];
            const days = Array.isArray(itinerary.days) ? itinerary.days : [];
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

                addTitle(doc, "Where to Stay", "Recommended accommodation options");

                accommodations.slice(0, 3).forEach((acc, index) => {
                    addAccommodationCard(doc, acc, index);
                });
            }

            // Places
            if (places.length > 0) {
                doc.addPage();
                drawPageHeader(doc);
                doc.y = 62;

                addTitle(doc, "Places to Visit", "Highlights selected for your trip");

                places.slice(0, 10).forEach((place, index) => {
                    addPlaceCard(doc, place, index);
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
                addDay(doc, day);
            });

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