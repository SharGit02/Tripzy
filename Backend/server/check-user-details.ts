import { db } from "./src/db/client.js";
import { users, bookings, itineraries, flightFarePredictions } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
    const targetEmails = ["varadraut19@gmail.com", "varadraut191@gmail.com", "varadisthedev@gmail.com", "izglitchwastaken@gmail.com"];
    
    for (const email of targetEmails) {
        const uList = await db.select().from(users).where(eq(users.email, email));
        if (uList.length === 0) {
            console.log(`User ${email} NOT FOUND`);
            continue;
        }
        const u = uList[0];
        const b = await db.select().from(bookings).where(eq(bookings.userId, u.id));
        const i = await db.select().from(itineraries).where(eq(itineraries.userId, u.id));
        const p = await db.select().from(flightFarePredictions).where(eq(flightFarePredictions.userId, u.id));
        console.log(`User [${email}] (id: ${u.id}): Bookings=${b.length}, Itineraries=${i.length}, Predictions=${p.length}`);
    }
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
