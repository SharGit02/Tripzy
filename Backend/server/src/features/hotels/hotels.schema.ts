import { z } from "zod";

export const HotelSearchQuerySchema = z
    .object({
        destination: z.string().trim().min(2, "Enter a destination of at least 2 characters.").max(150),
        checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid check-in date."),
        checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid check-out date."),
        adults: z.coerce.number().int().positive().max(10).default(2),
    })
    // Google Hotels prices a stay, not a day: an identical check-in and
    // check-out returns nothing useful, so it is rejected here rather than
    // spending a metered search to find out.
    .refine((data) => data.checkOut > data.checkIn, {
        message: "Check-out must be after check-in.",
        path: ["checkOut"],
    });

export type HotelSearchQuery = z.infer<typeof HotelSearchQuerySchema>;
