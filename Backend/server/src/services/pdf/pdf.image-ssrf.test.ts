import { describe, expect, it } from "vitest";

import { __ssrfInternals } from "./pdf.service.js";

const { isReservedIp, isFetchableImageUrl } = __ssrfInternals;

/*
 * A hotel/place image URL can come from AI-generated itinerary data, not
 * only vetted SerpApi results, so the server fetching it to embed in a PDF
 * is a real SSRF surface. The guard has two layers - `safeLookup` (a pinned
 * DNS resolution, tested by its effect on real fetches, not here) for a
 * hostname URL, and `isFetchableImageUrl` for everything else, including
 * the one case `safeLookup` cannot reach at all: an IP-literal host. Node's
 * connector dials an IP literal directly without ever calling a custom
 * `lookup` (confirmed by tracing one against a real undici Agent) - a URL
 * like `https://169.254.169.254/x.jpg` shipped once bypassing every check
 * in this file for exactly that reason. This file is the regression test
 * for that bypass, run at the unit level (no network call) so it can't
 * silently pass for the wrong reason the way an end-to-end PDF-generation
 * test did the first time (the "attack" URL just happened to fail to
 * connect in that sandbox, which looks identical to "the guard blocked it"
 * from the outside).
 */

describe("isReservedIp", () => {
    it("rejects the cloud metadata address and other IPv4 private/reserved ranges", () => {
        for (const ip of [
            "169.254.169.254", // cloud metadata
            "127.0.0.1", // loopback
            "10.0.0.5", // private
            "172.16.0.1", // private
            "172.31.255.255", // private (upper boundary)
            "192.168.1.1", // private
            "100.64.0.1", // carrier-grade NAT
            "0.0.0.0", // unspecified
            "203.0.113.5", // documentation/reserved (TEST-NET-3)
        ]) {
            expect(isReservedIp(ip), ip).toBe(true);
        }
    });

    it("rejects IPv6 loopback, link-local, unique-local, and IPv4-mapped/NAT64 forms", () => {
        for (const ip of [
            "::1", // loopback
            "::", // unspecified
            "fe80::1", // link-local
            "fc00::1", // unique local
            "fd12:3456::1", // unique local
            "::ffff:169.254.169.254", // IPv4-mapped IPv6, metadata address underneath
            "64:ff9b::169.254.169.254", // NAT64, metadata address underneath
        ]) {
            expect(isReservedIp(ip), ip).toBe(true);
        }
    });

    it("allows ordinary public unicast addresses", () => {
        for (const ip of ["8.8.8.8", "172.32.0.1", "172.15.255.255"]) {
            expect(isReservedIp(ip), ip).toBe(false);
        }
    });
});

describe("isFetchableImageUrl", () => {
    it("rejects every reserved IPv4-literal https URL directly, with no network call", () => {
        for (const url of [
            "https://169.254.169.254/latest/meta-data/",
            "https://127.0.0.1/x.jpg",
            "https://10.0.0.5/x.jpg",
            "https://192.168.1.1:8443/x.jpg",
            "https://0.0.0.0/x.jpg",
        ]) {
            expect(isFetchableImageUrl(url), url).toBe(false);
        }
    });

    it("rejects a bracketed IPv6-literal https URL pointing at a reserved address", () => {
        for (const url of ["https://[::1]/x.jpg", "https://[fe80::1]:8443/x.jpg", "https://[fc00::1]/x.jpg"]) {
            expect(isFetchableImageUrl(url), url).toBe(false);
        }
    });

    it("rejects non-https schemes outright, even for an otherwise-public host", () => {
        expect(isFetchableImageUrl("http://upload.wikimedia.org/x.jpg")).toBe(false);
        expect(isFetchableImageUrl("file:///etc/passwd")).toBe(false);
    });

    it("rejects an unparsable URL", () => {
        expect(isFetchableImageUrl("not a url")).toBe(false);
    });

    it("allows an https URL to a hostname or a public IP literal", () => {
        expect(isFetchableImageUrl("https://upload.wikimedia.org/wikipedia/commons/x.jpg")).toBe(true);
        expect(isFetchableImageUrl("https://8.8.8.8/x.jpg")).toBe(true);
    });
});
