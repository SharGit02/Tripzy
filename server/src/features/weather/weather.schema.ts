import { z } from "zod";

// The city is whatever the user typed / has saved on their profile, so it is
// kept permissive (OpenWeather accepts "Nagpur", "Nagpur,IN", "Paris,FR").
export const weatherQuerySchema = z.object({
    city: z
        .string()
        .trim()
        .min(1, "City is required.")
        .max(100)
        // Guard against the query string being used to smuggle extra params
        // into the upstream URL, and against obvious junk input.
        .regex(/^[\p{L}\p{M}\s'.,-]+$/u, "City contains unsupported characters."),
});

export type WeatherQuery = z.infer<typeof weatherQuerySchema>;
