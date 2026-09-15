import { db } from "./src/db/client.js";
import { users, bookings, itineraries, flightFarePredictions } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
    const allUsers = await db.select().from(users);
    const year = new Date().getFullYear();
    console.log(`Current system year: ${year}`);

    for (const u of allUsers) {
        const uItin = await db.select().from(itineraries).where(eq(itineraries.userId, u.id));
        const uBook = await db.select().from(bookings).where(eq(bookings.userId, u.id));
        const uFare = await db.select().from(flightFarePredictions).where(eq(flightFarePredictions.userId, u.id));
        
        console.log(`\n=== USER: ${u.email} (${u.name}) ===`);
        console.log("Itineraries:", uItin.map(i => ({ id: i.id, title: i.title, startDate: i.startDate, budget: i.totalBudget, createdAt: i.createdAt })));
        console.log("Bookings:", uBook.map(b => ({ id: b.id, title: b.title, startDate: b.startDate, amount: b.totalAmount, createdAt: b.createdAt })));
        console.log("Fare Predictions:", uFare.map(f => ({ id: f.id, dest: f.destination, startDate: f.searchStartDate, fare: f.bestPredictedFare, createdAt: f.createdAt })));
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
