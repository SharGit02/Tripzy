import { generateJson } from "../../services/ai/ai.service.js";
import { userRepository } from "../users/user.repository.js";
import type {
    DirectItineraryInput,
} from "./itinerary.schema.js";

const ITINERARY_SYSTEM_PROMPT = `
You are Tripzy's AI travel planner.

Your job is to create a high-quality, realistic, practical travel itinerary.

IMPORTANT:
- Return ONLY valid JSON.
- Do NOT return markdown.
- Do NOT wrap JSON in code fences.
- Do NOT include explanations outside JSON.
- The USER'S dates are authoritative.
- The USER'S requested number of days is authoritative.
- Do NOT add extra days.
- Do NOT remove days.
- Create exactly one itinerary entry for every requested calendar day.
- Use realistic activity sequencing.
- Avoid impossible travel schedules.
- Avoid scheduling distant locations back-to-back without allowing travel time.
- Include arrival/check-in on the first day when appropriate.
- Include checkout/airport transfer on the final day when appropriate.
- Do not invent prices that are obviously unrealistic.
- Costs should be approximate and expressed as strings such as "INR 1500".
- "Free" is acceptable where appropriate.
- Prefer well-known/common destinations and attractions.
- Personalize around interests, travel style, group type and accommodation preference.

RETURN EXACTLY THIS JSON STRUCTURE:

{
  "destination": "string",
  "tripDurationDays": number,
  "groupSize": {
    "adults": number,
    "children": number,
    "rooms": number
  },
  "accommodationType": "budget | standard | premium | luxury",
  "transportType": {
    "interCity": "string",
    "local": "string"
  },
  "travelStyle": "relaxed | balanced | packed | adventure",
  "interests": ["string"],
  "overview": "string with at least 100 characters",
  "accommodation": {
    "name": "string",
    "type": "hotel | flat | hostel | resort | homestay",
    "pricePerNight": "string",
    "location": "string",
    "amenities": ["string"],
    "description": "string"
  },
  "itinerary": [
    {
      "day": number,
      "theme": "string",
      "activities": [
        {
          "time": "string such as 09:00 AM, Morning, Afternoon, Evening",
          "activity": "string",
          "location": "string",
          "description": "string",
          "costEstimate": "string"
        }
      ]
    }
  ],
  "tips": ["string"],
  "emergencyInfo": {
    "nearestHospital": "string",
    "policeStation": "string",
    "emergencyNumber": "string"
  }
}

RULES FOR ITINERARY:
- Exactly the requested number of itinerary days.
- Each day should contain 3-5 meaningful activities whenever possible.
- Maximum 6 activities per day.
- First activity should generally start around 08:00-10:00 unless arrival timing requires otherwise.
- Include realistic meal breaks.
- Include transport when moving between areas.
- Don't make every activity a generic "Free Time".
- Don't fill missing days with placeholder activities.
- Avoid repeating the same attraction.
- Keep activities geographically sensible.
- Use the user's interests heavily.
- For couples, include a reasonable balance of sightseeing, food and relaxed experiences.
- For families, consider child-friendly pacing.
- For wheelchair accessibility, avoid inaccessible venues/routes and mention accessibility where relevant.
- If the budget is provided, respect it.
- If budget is not provided, produce sensible mid-range estimates.

COST RULES:
- Use numeric-looking cost strings where possible, e.g. "INR 1500".
- Use "Free" for genuinely free activities.
- Do not use negative costs.
- Do not use ranges unless useful, e.g. "INR 1500-2000".
`;

function calculateDays(startDate: string, endDate: string): number {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);

    const diff = Math.floor(
        (end.getTime() - start.getTime()) / 86400000
    );

    return Math.max(1, diff + 1);
}

function buildItineraryPrompt(
    input: DirectItineraryInput,
    userProfile?: any
): string {
    const totalDays = calculateDays(
        input.startDate,
        input.endDate
    );

    const accommodationBudgetMap: Record<string, string> = {
        budget: "₹1,000-₹3,000 per night",
        standard: "₹3,000-₹7,000 per night",
        premium: "₹7,000-₹15,000 per night",
        luxury: "₹15,000-₹50,000+ per night",
    };

    const transportMap: Record<string, string> = {
        flight: "Flights for inter-city travel; local cabs, autos or rentals at destination",
        train: "Train for inter-city travel; local transport at destination",
        bus: "Bus for inter-city travel; local transport at destination",
        self_drive: "Self-drive rental vehicle",
    };

    const tripTypeMap: Record<string, string> = {
        solo: "Solo traveler",
        couple: "Couple",
        family: `Family with ${input.adults} adults and ${input.children} children`,
        friends: `Friends group with ${input.adults} adults`,
    };

    const profile = userProfile
        ? `
USER PROFILE:
${JSON.stringify(
    {
        travelInterests: userProfile.travelInterests,
        preferredTravelStyle: userProfile.preferredTravelStyle,
        budgetMin: userProfile.budgetMin,
        budgetMax: userProfile.budgetMax,
        budgetCurrency: userProfile.budgetCurrency,
        homeCity: userProfile.homeCity,
        homeCountry: userProfile.homeCountry,
    },
    null,
    2
)}
`
        : "";

    return `
TRIP REQUEST

Destination:
${input.destination}

Dates:
${input.startDate} to ${input.endDate}

EXACT NUMBER OF DAYS:
${totalDays}

Group:
${tripTypeMap[input.tripType] || input.tripType}

Adults:
${input.adults}

Children:
${input.children}

Rooms:
${input.rooms}

Accommodation:
${input.accommodationType}

Accommodation budget:
${accommodationBudgetMap[input.accommodationType]}

Preferred transport:
${
    input.preferredTransport
        ? transportMap[input.preferredTransport]
        : "Choose the most practical option"
}

Travel style:
${input.travelStyle}

Interests:
${input.interests.join(", ") || "General sightseeing, food and local experiences"}

Wheelchair accessible:
${input.wheelchairAccessible ? "Yes" : "No"}

Special requests:
${input.specialRequests || "None"}

Total budget:
${input.budget ? `INR ${input.budget}` : "Not specified"}

${profile}

CREATE EXACTLY ${totalDays} DAYS.

DATE RULE:
The first day is ${input.startDate}.
The last day is ${input.endDate}.
There must be exactly ${totalDays} itinerary objects.

Do not output fewer or more days.

Make the itinerary practical and geographically sensible.
`;
}

export const itineraryAI = {
    async generateQuestions(
        input: any,
        userId: string
    ): Promise<{ questions: any[] }> {
        const userProfile =
            await userRepository.findProfileByUserId(userId);

        const prompt = `
You are Tripzy's travel planning assistant.

Generate 5-7 useful questions for a trip to ${input.destination}
from ${input.startDate} to ${input.endDate}.

${input.userPreferences
    ? `User Preferences:
${JSON.stringify(input.userPreferences, null, 2)}`
    : ""}

${
    input.previousAnswers
        ? `Previous Answers:
${JSON.stringify(input.previousAnswers, null, 2)}`
        : ""
}

Return ONLY a valid JSON array.

Each question must contain:
- step
- question
- questionType
- options
- isRequired

questionType must be one of:
single_choice
multi_choice
text
number
budget_range
`;

        const result = await generateJson<any>({
            prompt,
            system:
                "You are a travel planner. Return only valid JSON.",
            temperature: 0.4,
            maxOutputTokens: 1500,
            validate: (value) => value,
        });

        return {
            questions: result.output,
        };
    },

    async generateDirectItinerary(
        input: DirectItineraryInput,
        userId: string
    ): Promise<any> {
        const userProfile =
            await userRepository.findProfileByUserId(userId);

        const requestedDays = calculateDays(
            input.startDate,
            input.endDate
        );

        console.log(
            "[ITINERARY AI] Generating:",
            {
                destination: input.destination,
                startDate: input.startDate,
                endDate: input.endDate,
                requestedDays,
                adults: input.adults,
                children: input.children,
                rooms: input.rooms,
                accommodationType: input.accommodationType,
                preferredTransport: input.preferredTransport,
                tripType: input.tripType,
                travelStyle: input.travelStyle,
                interests: input.interests,
            }
        );

        const result = await generateJson<any>({
            prompt: buildItineraryPrompt(
                input,
                userProfile
            ),
            system: ITINERARY_SYSTEM_PROMPT,
            temperature: 0.35,
            maxOutputTokens: 4500,
            validate: (value) => {
                if (!value || typeof value !== "object") {
                    throw new Error(
                        "AI returned an invalid itinerary object."
                    );
                }

                return value;
            },
        });

        const itinerary = result.output;

        console.log(
            "[ITINERARY AI] Output keys:",
            Object.keys(itinerary || {})
        );

        console.log(
            "[ITINERARY AI] itinerary length:",
            Array.isArray(itinerary?.itinerary)
                ? itinerary.itinerary.length
                : 0
        );

        console.log(
            "[ITINERARY AI] requested days:",
            requestedDays
        );

        return {
            ...itinerary,
            generatedAt: new Date().toISOString(),
            version: "1.0",
        };
    },

    async regenerateItinerary(
        existingItinerary: any,
        modifications: string,
        userId: string
    ): Promise<any> {
        const userProfile =
            await userRepository.findProfileByUserId(userId);

        const existingDays = Array.isArray(
            existingItinerary?.days
        )
            ? existingItinerary.days.length
            : Number(existingItinerary?.totalDays || 1);

        const prompt = `
You are modifying an existing Tripzy itinerary.

EXISTING ITINERARY:
${JSON.stringify(existingItinerary, null, 2)}

USER MODIFICATION:
${modifications}

IMPORTANT:
- Preserve the existing dates.
- Preserve the existing number of days: ${existingDays}.
- Do not add or remove days.
- Improve only what the user requested.
- Keep all existing useful information.
- Return the SAME normalized application structure.
- Return ONLY valid JSON.

Required structure:

{
  "destination": "string",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "totalDays": number,
  "overview": "string",
  "budgetBreakdown": {
    "accommodation": number,
    "food": number,
    "transport": number,
    "activities": number,
    "miscellaneous": number,
    "total": number,
    "currency": "INR"
  },
  "accommodations": [],
  "placesToVisit": [],
  "transportOptions": [],
  "days": [],
  "tips": [],
  "emergencyInfo": {}
}

Every day must contain 3-6 activities.
`;

        const result = await generateJson<any>({
            prompt,
            system:
                "You are Tripzy's travel planner. Return only valid JSON.",
            temperature: 0.35,
            maxOutputTokens: 4500,
            validate: (value) => value,
        });

        return {
            ...result.output,
            generatedAt: new Date().toISOString(),
            version: (
                parseFloat(existingItinerary?.version || "1.0") +
                0.1
            ).toFixed(1),
        };
    },
};

export function validateItineraryIntegrity(
    itinerary: any
): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!itinerary.budgetBreakdown) {
        issues.push(
            "Missing budgetBreakdown - generated from normalized data"
        );

        itinerary.budgetBreakdown = {
            accommodation: 0,
            food: 0,
            transport: 0,
            activities: 0,
            miscellaneous: 0,
            total: 0,
            currency: "INR",
        };
    }

    if (!itinerary.placesToVisit) {
        itinerary.placesToVisit = [];
    }

    if (!itinerary.accommodations) {
        itinerary.accommodations = [];
    }

    if (!itinerary.days) {
        itinerary.days = [];
    }

    const breakdown = itinerary.budgetBreakdown;

    const calculatedTotal =
        Number(breakdown.accommodation || 0) +
        Number(breakdown.food || 0) +
        Number(breakdown.transport || 0) +
        Number(breakdown.activities || 0) +
        Number(breakdown.miscellaneous || 0);

    if (
        Math.abs(
            calculatedTotal -
            Number(breakdown.total || 0)
        ) > 1
    ) {
        issues.push(
            `Budget mismatch: calculated ${calculatedTotal}, total ${breakdown.total}`
        );
    }

    const scheduleDays = Array.isArray(itinerary.days)
        ? itinerary.days.length
        : 0;

    if (
        Number(itinerary.totalDays) !== scheduleDays
    ) {
        issues.push(
            `Day count mismatch: ${scheduleDays} days vs ${itinerary.totalDays} totalDays`
        );
    }

    for (let i = 1; i < itinerary.days.length; i++) {
        const previous = new Date(
            itinerary.days[i - 1].date
        );

        const current = new Date(
            itinerary.days[i].date
        );

        const difference =
            (current.getTime() -
                previous.getTime()) /
            86400000;

        if (difference !== 1) {
            issues.push(
                `Non-sequential dates between Day ${i} and Day ${i + 1}`
            );
        }
    }

    for (const day of itinerary.days) {
        const activities =
            Array.isArray(day.activities)
                ? day.activities
                : [];

        if (activities.length < 3) {
            issues.push(
                `Day ${day.day} has only ${activities.length} activities`
            );
        }

        if (activities.length > 6) {
            issues.push(
                `Day ${day.day} has ${activities.length} activities`
            );
        }
    }

    return {
        valid: issues.length === 0,
        issues,
    };
}