import { DirectItineraryInput } from "./itinerary.schema.js";

export interface ItineraryTemplateData {
    destination: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    budget?: number;
    currency: string;
    adults: number;
    children: number;
    rooms: number;
    accommodationType: "budget" | "standard" | "premium" | "luxury";
    accommodationBudgetRange: { min: number; max: number };
    preferredTransport: "flight" | "train" | "bus" | "self_drive";
    tripType: "solo" | "couple" | "family" | "friends";
    interests: string[];
    wheelchairAccessible: boolean;
    travelStyle: "relaxed" | "balanced" | "packed" | "adventure";
    specialRequests?: string;
    groupDescription: string;
    transportDescription: string;
    season: string;
}

function calculateDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function getSeason(dateStr: string): string {
    const month = new Date(dateStr).getMonth() + 1;
    if (month >= 3 && month <= 5) return "Spring";
    if (month >= 6 && month <= 8) return "Summer/Monsoon";
    if (month >= 9 && month <= 11) return "Autumn";
    return "Winter";
}

export function buildTemplateData(input: DirectItineraryInput): ItineraryTemplateData {
    const days = calculateDays(input.startDate, input.endDate);
    const season = getSeason(input.startDate);

    const accommodationBudgetMap = {
        budget: { min: 1000, max: 3000 },
        standard: { min: 3000, max: 7000 },
        premium: { min: 7000, max: 15000 },
        luxury: { min: 15000, max: 50000 },
    };

    const transportMap: Record<string, string> = {
        flight: "Flights for inter-city, local transport (cabs/auto) at destination",
        train: "Train for inter-city, local transport (cabs/auto) at destination",
        bus: "Bus for inter-city, local transport (cabs/auto) at destination",
        self_drive: "Self-drive rental car for entire trip including local travel",
    };

    const tripTypeMap = {
        solo: "Solo traveler",
        couple: "Couple (2 adults)",
        family: `Family (${input.adults} adults, ${input.children} children)`,
        friends: `Friends group (${input.adults} adults)`,
    };

    const preferredTransport = input.preferredTransport || "flight";

    return {
        destination: input.destination,
        startDate: input.startDate,
        endDate: input.endDate,
        totalDays: days,
        budget: input.budget,
        currency: "INR",
        adults: input.adults,
        children: input.children,
        rooms: input.rooms,
        accommodationType: input.accommodationType,
        accommodationBudgetRange: accommodationBudgetMap[input.accommodationType],
        preferredTransport,
        tripType: input.tripType,
        interests: input.interests,
        wheelchairAccessible: input.wheelchairAccessible,
        travelStyle: input.travelStyle,
        specialRequests: input.specialRequests,
        groupDescription: tripTypeMap[input.tripType] || "Travelers",
        transportDescription: transportMap[preferredTransport] || "Mixed transport",
        season,
    };
}

export function buildPrompt(data: ItineraryTemplateData): string {
    const interestsStr = data.interests.length > 0 ? data.interests.join(", ") : "General sightseeing";
    const accessibilityStr = data.wheelchairAccessible ? "Wheelchair-friendly required" : "Standard";
    const budgetStr = data.budget ? `Rs${data.budget.toLocaleString()} ${data.currency} total` : "Not specified";
    const specialReq = data.specialRequests || "None";

    return "You are a local travel planner. Create a practical " + data.totalDays + "-day itinerary for " + data.destination + ".\n\nTrip:\n" +
        "- Destination: " + data.destination + "\n" +
        "- Dates: " + data.startDate + " to " + data.endDate + " (" + data.totalDays + " days, " + data.season + ")\n" +
        "- Budget: " + budgetStr + "\n" +
        "- Group: " + data.groupDescription + " (" + data.adults + " adults, " + data.children + " children, " + data.rooms + " room(s))\n" +
        "- Accommodation: " + data.accommodationType + " (Rs" + data.accommodationBudgetRange.min.toLocaleString() + "-" + data.accommodationBudgetRange.max.toLocaleString() + "/night)\n" +
        "- Transport: " + data.transportDescription + "\n" +
        "- Trip type: " + data.tripType + "\n" +
        "- Travel style: " + data.travelStyle + "\n" +
        "- Interests: " + (data.interests.length > 0 ? data.interests.join(", ") : "General") + "\n" +
        "- Accessibility: " + accessibilityStr + "\n" +
        "- Special: " + specialReq + "\n\n" +
        "Return ONLY valid JSON matching this schema:\n\n" +
        "{\n" +
        '  "destination": "' + data.destination + '",\n' +
        '  "startDate": "' + data.startDate + '",\n' +
        '  "endDate": "' + data.endDate + '",\n' +
        '  "totalDays": ' + data.totalDays + ",\n" +
        '  "overview": "2-3 paragraphs, 100+ chars",\n' +
        '  "budgetBreakdown": {"accommodation": 0, "food": 0, "transport": 0, "activities": 0, "miscellaneous": 0, "total": 0, "currency": "INR"},\n' +
        '  "accommodations": [{"name": "", "type": "hotel|flat|hostel|resort|homestay", "pricePerNight": 0, "currency": "INR", "location": "", "amenities": [], "description": ""}], // 1-3\n' +
        '  "placesToVisit": [{"name": "", "description": "", "category": "", "location": "", "visitDurationHours": 1, "bestTimeToVisit": "", "priceRange": ""}], // 3-10\n' +
        '  "transportOptions": [{"type": "flight|train|bus|cab|metro|rental|walking", "from": "", "to": "", "durationMinutes": 0, "estimatedCost": 0, "currency": "INR", "frequency": ""}], // 1+\n' +
        '  "days": [{"day": 1, "date": "YYYY-MM-DD", "theme": "", "activities": [{"time": "HH:MM", "type": "visit|meal|transport|free_time|accommodation", "title": "", "description": "", "place": {"name": "", "category": "", "location": "", "visitDurationHours": 1}, "cost": 0}]}], // 1+ days, 3-6 activities/day\n' +
        '  "tips": [""], // 3-8\n' +
        '  "emergencyInfo": {"nearestHospital": "", "policeStation": "", "embassy": "", "emergencyNumber": "112"}\n' +
        "}\n\n" +
        "RULES:\n" +
        "1. ONLY real places in " + data.destination + ". NO hallucination.\n" +
        "2. Budget breakdown MUST sum to total exactly.\n" +
        "2. All dates sequential, totalDays = " + data.totalDays + ".\n" +
        "4. 3-6 activities per day, max 14 active hours.\n" +
        "5. Prices in INR, realistic for 2024-2025.\n" +
        "6. ONLY return JSON. No markdown, no explanations.";
}