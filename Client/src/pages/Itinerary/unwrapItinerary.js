export function unwrapItineraryRecord(record) {
  if (!record) return null;
  const nested =
    record.itineraryData && typeof record.itineraryData === "object"
      ? record.itineraryData
      : record;
  return {
    ...nested,
    id: record.id || nested.id,
    destination: nested.destination || record.destination,
    origin: nested.origin || record.origin || record.fromCity || record.userAnswers?.fromCity || record.userAnswers?.origin,
    fromCity: nested.fromCity || record.fromCity || record.origin || record.userAnswers?.fromCity || record.userAnswers?.origin,
    startDate: nested.startDate || record.startDate,
    endDate: nested.endDate || record.endDate,
    totalDays: nested.totalDays || record.totalDays,
    overview: nested.overview || record.overview,
  };
}
