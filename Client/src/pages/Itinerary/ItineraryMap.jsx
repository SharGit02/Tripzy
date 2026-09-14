import { useEffect, useState } from "react";
import { CITY_COORDS } from "../../context/LocationContext";

function coordsForName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  const match = Object.keys(CITY_COORDS).find(
    (city) => lower.includes(city.toLowerCase()) || city.toLowerCase().includes(lower),
  );
  return match ? CITY_COORDS[match] : null;
}

export default function ItineraryMap({ destination, places = [] }) {
  const [coords, setCoords] = useState(() => coordsForName(destination));

  useEffect(() => {
    const known = coordsForName(destination);
    if (known) {
      setCoords(known);
      return undefined;
    }
    if (!destination) return undefined;
    const controller = new AbortController();
    fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(destination)}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    )
      .then((res) => res.json())
      .then((rows) => {
        if (controller.signal.aborted || !Array.isArray(rows) || !rows[0]) return;
        setCoords([Number(rows[0].lat), Number(rows[0].lon)]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [destination]);

  const [lat, lng] = coords || [20.5937, 78.9629];
  const pad = 0.22;
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - pad}%2C${lat - pad}%2C${lng + pad}%2C${lat + pad}&layer=mapnik&marker=${lat}%2C${lng}`;
  const openUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=12/${lat}/${lng}`;

  return (
    <div className="my-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold">Destination Map</h2>
        <a
          href={openUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-[#2563EB] hover:underline"
        >
          Open full map ↗
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <iframe
          title={`Map of ${destination || "destination"}`}
          src={embed}
          className="w-full border-0"
          style={{ height: "320px" }}
          loading="lazy"
        />
      </div>

      {places.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Places on this trip
          </p>
          <div className="flex flex-wrap gap-2">
            {places.slice(0, 10).map((place) => (
              <a
                key={place.name}
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${place.name} ${destination || ""}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
              >
                📍 {place.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
