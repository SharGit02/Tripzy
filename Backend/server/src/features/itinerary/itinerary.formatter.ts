export function formatItineraryForDisplay(itinerary: any): string {
    const lines: string[] = [];
    const currency = itinerary.budgetBreakdown?.currency || "INR";

    // Header
    lines.push("═".repeat(64));
    lines.push(`  🌟 ${itinerary.destination?.toUpperCase() || "TRIP"} - ${itinerary.totalDays || "N"}-DAY ITINERARY  🌟`);
    lines.push("═".repeat(64));
    lines.push("");
    lines.push(`  📅 ${formatDateRange(itinerary.startDate, itinerary.endDate)}`);
    lines.push(`  💰 Budget: ${formatCurrency(itinerary.budgetBreakdown?.total || 0, currency)}`);
    lines.push(`  🎒 Style: ${capitalize(itinerary.travelStyle || "balanced")}`);
    lines.push("");

    // Overview
    if (itinerary.overview) {
        lines.push("┌─ OVERVIEW " + "─".repeat(51));
        lines.push("");
        wrapText(itinerary.overview, 60).forEach(l => lines.push(`  ${l}`));
        lines.push("");
    }

    // Budget
    const b = itinerary.budgetBreakdown;
    if (b) {
        lines.push("┌─ BUDGET BREAKDOWN " + "─".repeat(43));
        lines.push("");
        lines.push(`  🏨 Accommodation: ${formatCurrency(b.accommodation || 0, currency)}`);
        lines.push(`  🍽️  Food & Dining: ${formatCurrency(b.food || 0, currency)}`);
        lines.push(`  🚌 Transport: ${formatCurrency(b.transport || 0, currency)}`);
        lines.push(`  🎯 Activities: ${formatCurrency(b.activities || 0, currency)}`);
        lines.push(`  📦 Miscellaneous: ${formatCurrency(b.miscellaneous || 0, currency)}`);
        lines.push(`  ┌${"─".repeat(55)}`);
        lines.push(`  ▶ TOTAL: ${formatCurrency(b.total || 0, currency)}`);
        lines.push("");
    }

    // Accommodations
    if (itinerary.accommodations?.length) {
        lines.push("┌─ WHERE TO STAY " + "─".repeat(46));
        lines.push("");
        itinerary.accommodations.forEach((acc: any, i: number) => {
            lines.push(`  ${i+1}. ${acc.name}`);
            lines.push(`     📍 ${acc.location || "?"}  |  💰 ${formatCurrency(acc.pricePerNight || 0, acc.currency || currency)}/night`);
            if (acc.amenities?.length) {
                lines.push(`     ${acc.amenities.slice(0, 5).join(" • ")}`);
            }
            lines.push("");
        });
    }

    // Places to Visit
    if (itinerary.placesToVisit?.length) {
        lines.push("┌─ PLACES TO VISIT " + "─".repeat(44));
        lines.push("");
        itinerary.placesToVisit.forEach((place: any, i: number) => {
            lines.push(`  ${i+1}. ${place.name}`);
            lines.push(`     📂 ${place.category || "?"}  |  📍 ${place.location || "?"}`);
            lines.push(`     ⏱️ ${place.visitDurationHours || "?"}h  |  🕐 Best: ${place.bestTimeToVisit || "?"}`);
            lines.push(`     💰 ${place.priceRange || "Free"}`);
            if (place.description) {
                lines.push(`     ${truncate(place.description, 120)}`);
            }
            lines.push("");
        });
    }

    // Daily Schedule
    if (itinerary.days?.length) {
        lines.push("┌─ DAILY SCHEDULE " + "─".repeat(45));
        lines.push("");
        itinerary.days.forEach((day: any) => {
            lines.push(`  ┌── DAY ${day.day} • ${formatDate(day.date)}${day.theme ? ` • ${day.theme}` : ""} ${"─".repeat(Math.max(0, 48 - String(day.day).length - day.date.length - (day.theme?.length || 0)))}┐`);
            day.activities?.forEach((act: any) => {
                const icon = getActivityIcon(act.type);
                lines.push(`  │ ${act.time || "??:??"}  ${icon}  ${act.title || "Activity"}`);
                if (act.description) lines.push(`  │      ${truncate(act.description, 100)}`);
                if (act.cost) lines.push(`  │      💰 ${formatCurrency(act.cost, currency)}`);
            });
            lines.push(`  └${"─".repeat(62)}`);
            lines.push("");
        });
    }

    // Transport
    if (itinerary.transportOptions?.length) {
        lines.push("┌─ TRANSPORT OPTIONS " + "─".repeat(42));
        lines.push("");
        itinerary.transportOptions.forEach((t: any) => {
            lines.push(`  🚌 ${t.from || "?"} → ${t.to || "?"}  (${t.type || "?"})`);
            lines.push(`     ⏱️ ${Math.floor((t.durationMinutes || 0)/60)}h${(t.durationMinutes || 0)%60}m  |  💰 ${formatCurrency(t.estimatedCost || 0, t.currency || currency)}`);
            if (t.frequency) lines.push(`     🔄 ${t.frequency}`);
            lines.push("");
        });
    }

    // Tips
    if (itinerary.tips?.length) {
        lines.push("┌─ PRO TIPS " + "─".repeat(49));
        lines.push("");
        itinerary.tips.forEach((tip: string, i: number) => {
            lines.push(`  ${i+1}. ${tip}`);
        });
        lines.push("");
    }

    // Emergency
    if (itinerary.emergencyInfo) {
        lines.push("┌─ EMERGENCY CONTACTS " + "─".repeat(41));
        lines.push("");
        lines.push(`  🏥 Hospital: ${itinerary.emergencyInfo.nearestHospital || "N/A"}`);
        lines.push(`  👮 Police: ${itinerary.emergencyInfo.policeStation || "N/A"}`);
        if (itinerary.emergencyInfo.embassy) lines.push(`  🏛️ Embassy: ${itinerary.emergencyInfo.embassy}`);
        lines.push(`  📞 Emergency: ${itinerary.emergencyInfo.emergencyNumber || "112"}`);
        lines.push("");
    }

    lines.push("═".repeat(64));
    lines.push("  Generated by Tripzy AI  •  Have a wonderful trip! 🌈");
    lines.push("═".repeat(64));

    return lines.join("\n");
}

function wrapText(text: string, width: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
        if ((current + " " + word).length > width) {
            lines.push(current);
            current = word;
        } else {
            current += (current ? " " : "") + word;
        }
    }
    if (current) lines.push(current);
    return lines;
}

function truncate(text: string, max: number): string {
    return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatDateRange(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} - ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
}

function formatDate(date: string): string {
    return new Date(date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

function getActivityIcon(type: string): string {
    const icons: Record<string, string> = {
        visit: "🏛️",
        meal: "🍽️",
        transport: "🚌",
        free_time: "🆓",
        accommodation: "🏨",
    };
    return icons[type] || "📍";
}