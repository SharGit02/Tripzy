import React, { useState, useEffect } from "react";
import { MapPin, Clock, Star, ExternalLink, Info, Sparkles } from "lucide-react";
import { resolvePlaceImage } from "../../services/placeImageResolver";

export default function PlaceTicketCard({ place, destination = "" }) {
  const [imageState, setImageState] = useState({
    loading: true,
    url: place?.imageUrl || null,
    source: place?.imageSource || null,
    author: place?.imageAuthor || null,
    isFallback: false,
  });

  const [imgLoadError, setImgLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // If place already has an explicit image, use it directly
    if (place?.imageUrl) {
      setImageState({
        loading: false,
        url: place.imageUrl,
        source: place.imageSource || "Partner",
        author: place.imageAuthor || null,
        isFallback: false,
      });
      return;
    }

    // Otherwise resolve via free Wikimedia Commons / Wikipedia engine
    resolvePlaceImage(place.name, place.location || destination, place.category)
      .then((res) => {
        if (!isMounted) return;
        setImageState({
          loading: false,
          url: res.url,
          source: res.source,
          author: res.author,
          isFallback: res.isFallback,
        });
      })
      .catch(() => {
        if (!isMounted) return;
        setImageState({
          loading: false,
          url: null,
          isFallback: true,
        });
      });

    return () => {
      isMounted = false;
    };
  }, [place?.name, place?.location, place?.imageUrl, destination]);

  const rating = place.rating || (4.5 + ((place.name.length % 5) * 0.1)).toFixed(1);
  const duration = place.visitDurationHours ? `${place.visitDurationHours}h` : "1.5h";
  const category = place.category || "Attraction";
  const displayLocation = place.location || destination || "Nearby";

  return (
    <div className="group relative flex flex-row bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400/80 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden min-h-[130px] sm:min-h-[140px]">
      {/* Left Column: Image with ratio & overlay */}
      <div className="w-32 sm:w-36 md:w-44 shrink-0 relative bg-slate-100 overflow-hidden">
        {imageState.loading ? (
          <div className="w-full h-full bg-slate-200 animate-pulse flex items-center justify-center">
            <Sparkles size={20} className="text-slate-400 animate-spin" />
          </div>
        ) : (
          <img
            src={
              imgLoadError || !imageState.url
                ? "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&auto=format&fit=crop&q=80"
                : imageState.url
            }
            alt={place.name}
            onError={() => setImgLoadError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        )}

        {/* Rating badge overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-amber-300 text-[11px] font-bold shadow-sm">
          <Star size={11} className="fill-amber-300 text-amber-300" />
          <span>{rating}</span>
        </div>

        {/* Wikimedia attribution indicator */}
        {imageState.source && !imageState.isFallback && (
          <div
            className="absolute bottom-1.5 left-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/60 backdrop-blur-sm text-[9px] text-white/90 px-1.5 py-0.5 rounded tracking-tight max-w-[90%] truncate pointer-events-none"
            title={`${imageState.source}${imageState.author ? ` · ${imageState.author}` : ""}`}
          >
            {imageState.source === "Wikimedia Commons" ? "Wikimedia" : "Wikipedia"}
          </div>
        )}
      </div>

      {/* Right Column: Ticket details */}
      <div className="flex-1 p-3.5 sm:p-4 flex flex-col justify-between min-w-0 bg-gradient-to-br from-white to-slate-50/50">
        <div>
          {/* Top row: Title + Category badge */}
          <div className="flex items-start justify-between gap-2">
            <h3
              className="font-bold text-slate-800 text-sm sm:text-base leading-snug group-hover:text-blue-600 transition-colors line-clamp-1"
              title={place.name}
            >
              {place.name}
            </h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md shrink-0 border border-blue-100/80">
              {category}
            </span>
          </div>

          {/* Description snippet */}
          <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
            {place.description || `Explore ${place.name}, one of the prominent highlights in ${displayLocation}.`}
          </p>
        </div>

        {/* Bottom meta row: Location + Duration + Price/Best Time */}
        <div className="pt-2 mt-1 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 text-slate-500 truncate max-w-[60%]">
            <MapPin size={13} className="text-blue-500 shrink-0" />
            <span className="truncate text-[11px] sm:text-xs" title={displayLocation}>
              {displayLocation}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {place.priceRange && (
              <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 hidden sm:inline-block">
                {place.priceRange}
              </span>
            )}
            <div className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-[11px]">
              <Clock size={12} className="text-slate-400" />
              <span>{duration}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
