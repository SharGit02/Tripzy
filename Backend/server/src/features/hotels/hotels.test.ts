import { describe, expect, it } from "vitest";

import { normalizeProperty } from "./hotels.service.js";
import { buildSelectionFilter } from "../../services/pdf/pdf.service.js";
import { ItineraryAccommodationSchema } from "../itinerary/itinerary.schema.js";

/*
 * Two things here can break silently rather than loudly.
 *
 * 1. The SerpApi mapping: a renamed upstream field doesn't throw, it just makes
 *    every hotel free and unrated.
 * 2. The selection key contract: the keys are built in ItineraryResults.jsx and
 *    re-derived in pdf.service.ts. If the two ever drift, the PDF exports the
 *    wrong items with no error anywhere. The literal strings below are the
 *    contract — if you change one side, this fails.
 */

// Trimmed from a real google_hotels response.
const serpProperty = {
    type: "hotel",
    name: "Moustache Goa Luxuria",
    description: "Bright quarters in a casual resort with a rooftop bar.",
    link: "https://example.test/book",
    gps_coordinates: { latitude: 15.6, longitude: 73.7 },
    check_in_time: "2:00 PM",
    check_out_time: "11:00 AM",
    rate_per_night: { lowest: "₹3,200", extracted_lowest: 3200 },
    total_rate: { lowest: "₹9,600", extracted_lowest: 9600 },
    nearby_places: [{ name: "Anjuna Beach" }],
    hotel_class: "4-star hotel",
    extracted_hotel_class: 4,
    images: [{ thumbnail: "https://example.test/thumb.jpg", original_image: "https://example.test/full.jpg" }],
    overall_rating: 4.4,
    reviews: 4024,
    location_rating: 3.3,
    reviews_breakdown: [
        { name: "Rooms", positive: 900, negative: 100 },
        { name: "Service", positive: 50, negative: 400 },
    ],
    amenities: ["Free Wi-Fi", "Outdoor pool"],
};

describe("normalizeProperty", () => {
    it("maps a SerpApi hotel onto the itinerary shape", () => {
        const hotel = normalizeProperty(serpProperty, "Goa", 3)!;

        expect(hotel.name).toBe("Moustache Goa Luxuria");
        expect(hotel.type).toBe("hotel");
        expect(hotel.pricePerNight).toBe(3200);
        expect(hotel.totalPrice).toBe(9600);
        expect(hotel.rating).toBe(4.4);
        expect(hotel.reviewsCount).toBe(4024);
        expect(hotel.hotelClass).toBe(4);
        expect(hotel.thumbnailUrl).toBe("https://example.test/thumb.jpg");
        expect(hotel.bookingLink).toBe("https://example.test/book");
        expect(hotel.location).toBe("Near Anjuna Beach, Goa");
        // Only the topics guests actually liked are kept.
        expect(hotel.reviewHighlights).toEqual(["Rooms"]);
    });

    it("derives a nightly rate for a rental that only quotes a window total", () => {
        const hotel = normalizeProperty(
            {
                type: "vacation rental",
                name: "Beach Bungalow",
                total_rate: { extracted_lowest: 3000 },
            },
            "Goa",
            3,
        )!;

        expect(hotel.type).toBe("vacation_rental");
        expect(hotel.pricePerNight).toBe(1000);
    });

    it("drops a property with no name", () => {
        expect(normalizeProperty({ rate_per_night: { extracted_lowest: 100 } }, "Goa", 1)).toBeNull();
    });
});

describe("buildSelectionFilter", () => {
    it("keeps everything when an itinerary has no selections", () => {
        const isSelected = buildSelectionFilter({} as any);

        expect(isSelected("hotel:0")).toBe(true);
        expect(isSelected("activity:3:2")).toBe(true);
    });

    it("drops exactly the excluded keys, in the client's key format", () => {
        const isSelected = buildSelectionFilter({
            selections: { excluded: ["hotel:1", "place:0", "activity:2:1"], flights: [] },
        } as any);

        expect(isSelected("hotel:1")).toBe(false);
        expect(isSelected("place:0")).toBe(false);
        expect(isSelected("activity:2:1")).toBe(false);

        // Neighbours must survive — an off-by-one in the key would take these.
        expect(isSelected("hotel:0")).toBe(true);
        expect(isSelected("place:1")).toBe(true);
        expect(isSelected("activity:2:0")).toBe(true);
        expect(isSelected("activity:1:1")).toBe(true);
    });
});

describe("accommodation URL fields", () => {
    const base = {
        name: "Some Hotel",
        type: "hotel" as const,
        pricePerNight: 1000,
        currency: "INR",
        location: "Goa",
        amenities: [],
        description: "A stay.",
    };

    it("accepts http(s) links", () => {
        const parsed = ItineraryAccommodationSchema.parse({
            ...base,
            bookingLink: "https://example.test/book",
            thumbnailUrl: "http://example.test/t.jpg",
        });
        expect(parsed.bookingLink).toBe("https://example.test/book");
    });

    /*
     * itineraryData is user-patchable and an itinerary is publicly shareable,
     * so these schemes are a stored-XSS vector, not a theoretical one.
     */
    it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox", "/relative/path"])(
        "rejects %s",
        (bookingLink) => {
            expect(() => ItineraryAccommodationSchema.parse({ ...base, bookingLink })).toThrow();
        },
    );
});
