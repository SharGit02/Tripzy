import { z } from "zod";

const INTERESTS = new Set([
  "nature",
  "adventure",
  "beaches",
  "spiritual",
  "shopping",
  "food",
  "wildlife",
  "history",
]);

const ACCOMMODATION = {
  Budget: "budget",
  Standard: "standard",
  Premium: "premium",
  Luxury: "luxury",
};

const TRANSPORT = {
  Flight: "flight",
  Train: "train",
  Bus: "bus",
  "Self Drive": "self_drive",
};

const TRIP_TYPE = {
  Solo: "solo",
  Couple: "couple",
  Family: "family",
  Friends: "friends",
};

const TRAVEL_STYLE = {
  Relaxed: "relaxed",
  Balanced: "balanced",
  "Fast-paced": "packed",
  "Off-beat": "adventure",
};

export const MAX_ITINERARY_DAYS = 14;

export function toIsoDate(date) {
  if (!date) return "";
  if (typeof date === "string") return date.slice(0, 10);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const PlanTripPayloadSchema = z
  .object({
    fromCity: z
      .string()
      .trim()
      .min(2, "Choose a departure city in the From field."),
    destination: z
      .string()
      .trim()
      .min(2, "Enter a destination of at least 2 characters.")
      .max(150, "Destination can be at most 150 characters."),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a start date."),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a return date."),
    adults: z
      .number()
      .int("Adults must be a whole number.")
      .min(1, "Add at least 1 adult.")
      .max(10, "Adults can be at most 10."),
    children: z
      .number()
      .int("Children must be a whole number.")
      .min(0, "Children cannot be negative.")
      .max(10, "Children can be at most 10."),
    rooms: z
      .number()
      .int("Rooms must be a whole number.")
      .min(1, "Add at least 1 room.")
      .max(10, "Rooms can be at most 10."),
    accommodationType: z
      .enum(["budget", "standard", "premium", "luxury"])
      .default("standard"),
    preferredTransport: z
      .enum(["flight", "train", "bus", "self_drive"])
      .default("flight"),
    tripType: z.enum(["solo", "couple", "family", "friends"]).default("couple"),
    interests: z
      .array(
        z.enum(["nature", "adventure", "beaches", "spiritual", "shopping", "food", "wildlife", "history"]),
      )
      .default([]),
    wheelchairAccessible: z.boolean().default(false),
    travelStyle: z
      .enum(["relaxed", "balanced", "packed", "adventure"])
      .default("balanced"),
    specialRequests: z
      .string()
      .max(2000, "Special requests can be at most 2000 characters.")
      .optional(),
    budget: z
      .number()
      .positive("Enter a budget greater than 0, or leave it blank.")
      .optional(),
  })
  .refine((data) => data.fromCity.toLowerCase() !== data.destination.toLowerCase(), {
    message: "Departure and destination must be different cities.",
    path: ["destination"],
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Return date must be on or after the start date.",
    path: ["endDate"],
  })
  .refine((data) => {
    const start = new Date(`${data.startDate}T00:00:00`);
    const end = new Date(`${data.endDate}T00:00:00`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    return days <= MAX_ITINERARY_DAYS;
  }, {
    message: `Trips can be at most ${MAX_ITINERARY_DAYS} days so we can build a complete itinerary.`,
    path: ["endDate"],
  });

function firstZodMessage(error) {
  const { formErrors, fieldErrors } = error.flatten();
  const fromFields = Object.values(fieldErrors)
    .flat()
    .filter((msg) => typeof msg === "string" && msg.trim());
  return [...formErrors, ...fromFields].filter(Boolean)[0] || "Please check your trip details and try again.";
}

export function boardingPassToItineraryPayload(search) {
  const filters = search.filters || {};
  const budgetRaw = String(search.budget || "").replace(/[^\d.]/g, "");
  const budget = budgetRaw ? Number(budgetRaw) : undefined;

  return {
    fromCity: String(search.fromCity || "").trim(),
    destination: String(search.whereTo || "").trim(),
    startDate: toIsoDate(search.startDate),
    endDate: toIsoDate(search.endDate),
    adults: Number(filters.adults) || 2,
    children: Number(filters.children) || 0,
    rooms: Number(filters.rooms) || 1,
    accommodationType: ACCOMMODATION[filters.accommodation] || "standard",
    preferredTransport: TRANSPORT[filters.transport] || "flight",
    tripType: TRIP_TYPE[filters.tripType] || "couple",
    interests: (filters.selectedInterests || [])
      .map((item) => String(item).toLowerCase())
      .filter((item) => INTERESTS.has(item)),
    wheelchairAccessible: Boolean(filters.wheelchair),
    travelStyle: TRAVEL_STYLE[filters.travelStyle] || "balanced",
    ...(String(filters.specialRequests || "").trim()
      ? { specialRequests: String(filters.specialRequests).trim() }
      : {}),
    budget: Number.isFinite(budget) && budget > 0 ? budget : undefined,
  };
}

export function parsePlanTripSearch(search) {
  const payload = boardingPassToItineraryPayload(search);
  const parsed = PlanTripPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: firstZodMessage(parsed.error), payload: null };
  }

  const { fromCity, ...apiPayload } = parsed.data;
  return { success: true, error: "", payload: apiPayload, fromCity };
}
