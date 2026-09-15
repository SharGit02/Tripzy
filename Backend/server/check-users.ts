import { db } from "./src/db/client.js";
import { users, bookings, itineraries, flightFarePredictions } from "./src/db/schema.js";

async function main() {
    const allUsers = await db.select().from(users);
    console.log("Users in DB:", allUsers.map(u => ({ id: u.id, email: u.email, name: u.name })));

    for (const u of allUsers) {
        const userBookings = await db.select().from(bookings);
        const userItin = await db.select().from(itineraries);
        const userPredictions = await db.select().from(flightFarePredictions);
        console.log(`User ${u.email}: Bookings count=${userBookings.length}, Itineraries count=${userItin.length}, Predictions count=${userPredictions.length}`);
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
