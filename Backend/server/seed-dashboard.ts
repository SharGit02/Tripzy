import { db } from "./src/db/client.js";
import { users, bookings, itineraries, flightFarePredictions } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
    const email = "varadraut19@gmail.com";
    const userList = await db.select().from(users).where(eq(users.email, email));
    if (userList.length === 0) {
        console.error(`User with email ${email} not found.`);
        process.exit(1);
    }
    const user = userList[0];
    console.log(`Found user: ${user.name} (${user.id})`);

    // Insert dummy bookings
    await db.insert(bookings).values([
        {
            userId: user.id,
            type: "flight",
            status: "confirmed",
            title: "Flight to Paris",
            destination: "Paris",
            origin: "New York",
            startDate: "2026-10-10",
            endDate: "2026-10-20",
            guests: 2,
            totalAmount: "1200.00",
            currency: "USD",
            bookingReference: "FL-PAR-123",
        },
        {
            userId: user.id,
            type: "hotel",
            status: "confirmed",
            title: "Hotel in Tokyo",
            destination: "Tokyo",
            startDate: "2026-11-05",
            endDate: "2026-11-15",
            guests: 2,
            totalAmount: "850.50",
            currency: "USD",
            bookingReference: "HT-TOK-456",
        },
        {
            userId: user.id,
            type: "activity",
            status: "pending",
            title: "Scuba Diving in Bali",
            destination: "Bali",
            startDate: "2026-12-01",
            endDate: "2026-12-01",
            guests: 1,
            totalAmount: "150.00",
            currency: "USD",
            bookingReference: "AC-BAL-789",
        }
    ]);
    console.log("Inserted dummy bookings.");

    // Insert dummy itineraries
    await db.insert(itineraries).values([
        {
            userId: user.id,
            title: "European Adventure",
            destination: "Europe",
            startDate: "2026-10-10",
            endDate: "2026-10-30",
            totalDays: 20,
            totalBudget: "5000.00",
            currency: "USD",
            itineraryData: { days: [] }, // Minimal dummy data
            status: "published",
        },
        {
            userId: user.id,
            title: "Japan Explorer",
            destination: "Japan",
            startDate: "2026-11-05",
            endDate: "2026-11-20",
            totalDays: 15,
            totalBudget: "3500.00",
            currency: "USD",
            itineraryData: { days: [] },
            status: "published",
        }
    ]);
    console.log("Inserted dummy itineraries.");

    // Insert dummy flight fare predictions (good for graphs)
    // We'll insert a few data points representing past predictions
    await db.insert(flightFarePredictions).values([
        {
            userId: user.id,
            origin: "JFK",
            destination: "CDG",
            searchStartDate: "2026-09-01",
            windowDays: 30,
            bestDate: "2026-10-10",
            bestAirline: "Air France",
            bestPredictedFare: "450.00",
            results: { dummy: true },
        },
        {
            userId: user.id,
            origin: "LAX",
            destination: "NRT",
            searchStartDate: "2026-09-10",
            windowDays: 30,
            bestDate: "2026-11-05",
            bestAirline: "JAL",
            bestPredictedFare: "600.00",
            results: { dummy: true },
        }
    ]);
    console.log("Inserted dummy flight fare predictions.");

    console.log("Successfully seeded dummy data!");
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
