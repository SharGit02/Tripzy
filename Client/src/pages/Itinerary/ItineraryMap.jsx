import { useEffect, useState } from "react";
import { Plane, MapPin, ExternalLink, Navigation } from "lucide-react";
import { CITY_COORDS } from "../../context/LocationContext";

const EXTRA_CITY_COORDS = {
  Guwahati: [26.1445, 91.7362],
  Shillong: [25.5788, 91.8933],
  Cherrapunji: [25.2702, 91.7323],
  Alleppey: [9.4981, 76.3388],
  Varkala: [8.7379, 76.7163],
  Gulmarg: [34.0484, 74.3805],
  Pahalgam: [34.0163, 75.315],
  Sonamarg: [34.3045, 75.2933],
  Pangong: [33.7595, 78.6674],
  Nubra: [34.6863, 77.5673],
  Dharamsala: [32.219, 76.3234],
  Dharamshala: [32.219, 76.3234],
  Spiti: [32.2461, 78.0349],
  Jaisalmer: [26.9157, 70.9083],
  Dawki: [25.1916, 92.0194],
  Mawlynnong: [25.2014, 91.9056],
  Calangute: [15.5439, 73.7553],
  Anjuna: [15.5828, 73.7431],
  Panjim: [15.4909, 73.8278],
  Palolem: [15.01, 74.0232],
};

const ALL_COORDS = { ...CITY_COORDS, ...EXTRA_CITY_COORDS };

function coordsForName(name) {
  if (!name) return null;
  const lower = String(name).toLowerCase().trim();
  const match = Object.keys(ALL_COORDS).find(
    (city) => lower.includes(city.toLowerCase()) || city.toLowerCase().includes(lower),
  );
  return match ? ALL_COORDS[match] : null;
}

export default function ItineraryMap({ source, destination, origin, places = [] }) {
  const sourceName = source || origin || "Delhi";
  const destName = destination || "Goa";

  const [sourceCoords, setSourceCoords] = useState(() => coordsForName(sourceName) || [28.6139, 77.209]);
  const [destCoords, setDestCoords] = useState(() => coordsForName(destName) || [15.4909, 73.8278]);
  const [activeFocus, setActiveFocus] = useState("both"); // "both" | "source" | "dest"

  useEffect(() => {
    const sKnown = coordsForName(sourceName);
    if (sKnown) {
      setSourceCoords(sKnown);
    } else if (sourceName) {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(sourceName)}`,
        { headers: { Accept: "application/json" } },
      )
        .then((res) => res.json())
        .then((rows) => {
          if (Array.isArray(rows) && rows[0]) {
            setSourceCoords([Number(rows[0].lat), Number(rows[0].lon)]);
          }
        })
        .catch(() => {});
    }

    const dKnown = coordsForName(destName);
    if (dKnown) {
      setDestCoords(dKnown);
    } else if (destName) {
      fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(destName)}`,
        { headers: { Accept: "application/json" } },
      )
        .then((res) => res.json())
        .then((rows) => {
          if (Array.isArray(rows) && rows[0]) {
            setDestCoords([Number(rows[0].lat), Number(rows[0].lon)]);
          }
        })
        .catch(() => {});
    }
  }, [sourceName, destName]);

  const [sLat, sLng] = sourceCoords;
  const [dLat, dLng] = destCoords;

  // Generate interactive Leaflet HTML inside srcDoc with custom markers for Source and Destination
  const leafletSrcDoc = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .custom-pin {
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: white;
      font-weight: bold;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 3px solid white;
      font-size: 15px;
    }
    .source-pin {
      background: linear-gradient(135deg, #10B981, #059669);
    }
    .dest-pin {
      background: linear-gradient(135deg, #EF4444, #DC2626);
    }
    .place-pin {
      background: #3B82F6;
      font-size: 11px;
    }
    .custom-popup .leaflet-popup-content-wrapper {
      border-radius: 12px;
      padding: 4px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.15);
    }
    .custom-popup .leaflet-popup-content {
      margin: 8px 12px;
      line-height: 1.4;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
    }).addTo(map);

    const sCoords = [${sLat}, ${sLng}];
    const dCoords = [${dLat}, ${dLng}];

    // 1. Source Marker (Green Pin with Airplane)
    const sourceIcon = L.divIcon({
      className: 'custom-pin source-pin',
      html: '🛫',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
    const sMarker = L.marker(sCoords, { icon: sourceIcon })
      .addTo(map)
      .bindPopup('<div class="custom-popup"><span style="color:#059669;font-weight:700;text-transform:uppercase;font-size:11px;">Source Departure</span><br><b style="font-size:14px;color:#1e293b;">${sourceName}</b></div>');

    // 2. Destination Marker (Red Pin with Destination Mark)
    const destIcon = L.divIcon({
      className: 'custom-pin dest-pin',
      html: '📍',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    });
    const dMarker = L.marker(dCoords, { icon: destIcon })
      .addTo(map)
      .bindPopup('<div class="custom-popup"><span style="color:#dc2626;font-weight:700;text-transform:uppercase;font-size:11px;">Destination Arrival</span><br><b style="font-size:14px;color:#1e293b;">${destName}</b></div>');

    // 3. Curved or Dashed Polyline Route Connecting Source and Destination
    const route = L.polyline([sCoords, dCoords], {
      color: '#2563EB',
      weight: 4,
      dashArray: '8, 10',
      opacity: 0.85
    }).addTo(map);

    // Initial View / Bounds
    const mode = "${activeFocus}";
    if (mode === "source") {
      map.setView(sCoords, 11);
      sMarker.openPopup();
    } else if (mode === "dest") {
      map.setView(dCoords, 11);
      dMarker.openPopup();
    } else {
      const bounds = L.latLngBounds([sCoords, dCoords]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  </script>
</body>
</html>
  `;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(sourceName)}&destination=${encodeURIComponent(destName)}`;
  const osmUrl = `https://www.openstreetmap.org/directions?from=${sLat}%2C${sLng}&to=${dLat}%2C${dLng}#map=7/${(sLat + dLat) / 2}/${(sLng + dLng) / 2}`;

  return (
    <div className="my-8">
      {/* Header with Title and External Links */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-[#2563EB]" />
            <h2 className="text-xl font-bold text-slate-800">Trip Route Map</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Interactive route displaying departure source and arrival destination markers
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[#2563EB] hover:text-blue-800 transition"
          >
            <span>Google Directions</span>
            <ExternalLink size={12} />
          </a>
          <span className="text-slate-300">|</span>
          <a
            href={osmUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 transition"
          >
            <span>OpenStreetMap</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Route Badges & Quick-Focus Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Source Marker Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <Plane size={13} className="text-emerald-600" />
            <span>Source: {sourceName}</span>
          </div>

          <span className="text-slate-400 font-bold">&rarr;</span>

          {/* Destination Marker Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 text-red-800 border border-red-200 font-semibold shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <MapPin size={13} className="text-red-600" />
            <span>Destination: {destName}</span>
          </div>
        </div>

        {/* Focus Mode Toggles */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium text-slate-600 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveFocus("both")}
            className={`px-2.5 py-1 rounded-md transition ${
              activeFocus === "both" ? "bg-[#2563EB] text-white font-semibold shadow-xs" : "hover:text-slate-900"
            }`}
          >
            Full Route
          </button>
          <button
            type="button"
            onClick={() => setActiveFocus("source")}
            className={`px-2.5 py-1 rounded-md transition ${
              activeFocus === "source" ? "bg-emerald-600 text-white font-semibold shadow-xs" : "hover:text-slate-900"
            }`}
          >
            Source
          </button>
          <button
            type="button"
            onClick={() => setActiveFocus("dest")}
            className={`px-2.5 py-1 rounded-md transition ${
              activeFocus === "dest" ? "bg-red-600 text-white font-semibold shadow-xs" : "hover:text-slate-900"
            }`}
          >
            Destination
          </button>
        </div>
      </div>

      {/* Leaflet Iframe Map */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-100">
        <iframe
          key={`${sourceName}-${destName}-${activeFocus}-${sLat}-${dLat}`}
          title={`Route from ${sourceName} to ${destName}`}
          srcDoc={leafletSrcDoc}
          className="w-full border-0"
          style={{ height: "380px" }}
          loading="lazy"
        />
      </div>

      {/* Places to visit pills */}
      {places.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Key Attractions in {destName}
          </p>
          <div className="flex flex-wrap gap-2">
            {places.slice(0, 8).map((place) => (
              <a
                key={place.name}
                href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${place.name} ${destName}`)}`}
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
