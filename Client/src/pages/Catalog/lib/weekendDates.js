export function startOfLocalDay(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Coming Saturday. If today is Saturday, use next week's Saturday so there is time to book. */
export function nextSaturday(from = new Date()) {
  const start = startOfLocalDay(from);
  const day = start.getDay();
  const add = day === 6 ? 7 : 6 - day;
  start.setDate(start.getDate() + add);
  return start;
}

export function addDays(date, days) {
  const next = startOfLocalDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toIsoDate(date) {
  const d = startOfLocalDay(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatTripRange(start, end) {
  const opts = { weekday: "short", day: "numeric", month: "short" };
  return `${start.toLocaleDateString("en-IN", opts)} – ${end.toLocaleDateString("en-IN", opts)}`;
}
