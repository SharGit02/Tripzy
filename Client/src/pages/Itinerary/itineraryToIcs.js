function pad(value) {
  return String(value).padStart(2, "0");
}

function toIcsDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function addOneDay(value) {
  const date = value ? new Date(value) : new Date();
  date.setDate(date.getDate() + 1);
  return toIcsDate(date);
}

function escapeText(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function itineraryToIcs(itinerary) {
  const destination = itinerary?.destination || "Trip";
  const days = itinerary?.days || [];
  const events = days.map((day) => {
    const date = day.date || itinerary.startDate;
    const titles = (day.activities || [])
      .map((activity) => `${activity.time || ""} ${activity.title || ""}`.trim())
      .filter(Boolean)
      .join("\\n");
    const summary = `${destination} — Day ${day.day}${day.theme ? `: ${day.theme}` : ""}`;
    return [
      "BEGIN:VEVENT",
      `UID:${itinerary.id || "trip"}-day-${day.day}@tripzy`,
      `DTSTAMP:${toIcsDate(new Date())}T000000Z`,
      `DTSTART;VALUE=DATE:${toIcsDate(date)}`,
      `DTEND;VALUE=DATE:${addOneDay(date)}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(titles || itinerary.overview || "")}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tripzy//Itinerary//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadItineraryIcs(itinerary) {
  const blob = new Blob([itineraryToIcs(itinerary)], { type: "text/calendar;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${String(itinerary?.destination || "trip").replace(/\s+/g, "-")}-itinerary.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
