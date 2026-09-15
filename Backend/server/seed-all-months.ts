import { db } from "./src/db/client.js";
import { users, bookings, itineraries, flightFarePredictions } from "./src/db/schema.js";
import { eq } from "drizzle-orm";

async function main() {
    const targetEmails = ["varadraut19@gmail.com", "varadraut191@gmail.com", "varadisthedev@gmail.com"];
    
    for (const email of targetEmails) {
        let uList = await db.select().from(users).where(eq(users.email, email));
        if (uList.length === 0) continue;
        const u = uList[0];
        console.log(`\nSeeding rich dashboard data for ${email} (${u.id})...`);

        // Insert monthly bookings for 2026
        const monthsData = [
            { month: "01", amount: "12000.00", type: "flight", title: "Flight to Goa", dest: "Goa" },
            { month: "02", amount: "8500.00", type: "hotel", title: "Resort in Kerala", dest: "Kochi" },
            { month: "03", amount: "15000.00", type: "package", title: "Manali Tour Package", dest: "Manali" },
            { month: "04", amount: "9200.00", type: "flight", title: "Flight to Mumbai", dest: "Mumbai" },
            { month: "05", amount: "11000.00", type: "hotel", title: "Hotel in Jaipur", dest: "Jaipur" },
            { month: "06", amount: "14000.00", type: "activity", title: "Scuba Diving in Andaman", dest: "Andaman" },
            { month: "07", amount: "18000.00", type: "package", title: "Kashmir Valley Trip", dest: "Srinagar" },
            { month: "08", amount: "10500.00", type: "flight", title: "Flight to Leh", dest: "Leh" },
            { month: "09", amount: "16000.00", type: "hotel", title: "Luxury Stay in Udaipur", dest: "Udaipur" },
        ];

        for (const item of monthsData) {
            await db.insert(bookings).values({
                userId: u.id,
                type: item.type as any,
                status: "confirmed",
                title: item.title,
                destination: item.dest,
                origin: "Delhi",
                startDate: `2026-${item.month}-10`,
                endDate: `2026-${item.month}-15`,
                guests: 2,
                totalAmount: item.amount,
                currency: "INR",
                bookingReference: `BK-${email.slice(0,3)}-2026-${item.month}`,
            }).catch(() => {});

            await db.insert(itineraries).values({
                userId: u.id,
                title: `${item.dest} Exploration`,
                destination: item.dest,
                startDate: `2026-${item.month}-10`,
                endDate: `2026-${item.month}-15`,
                totalDays: 5,
                totalBudget: (Number(item.amount) * 1.2).toFixed(2),
                currency: "INR",
                itineraryData: { days: [], overview: `Trip to ${item.dest}` },
                status: "published",
            }).catch(() => {});

            await db.insert(flightFarePredictions).values({
                userId: u.id,
                origin: "DEL",
                destination: item.dest,
                searchStartDate: `2026-${item.month}-01`,
                windowDays: 30,
                bestDate: `2026-${item.month}-10`,
                bestAirline: "IndiGo",
                bestPredictedFare: (Number(item.amount) * 0.4).toFixed(2),
                results: { dummy: true },
            }).catch(() => {});
        }
        console.log(`Done seeding for ${email}!`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
