import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, ArrowUpRight, Compass } from "lucide-react";
import { destinations } from "../../data/destinations";
import AuroraCanvas from "../../components/ui/AuroraCanvas";

const totalPlaces = destinations.reduce((sum, d) => sum + d.places.length, 0);

const stats = [
  { value: String(destinations.length), label: "Regions mapped" },
  { value: String(totalPlaces), label: "Curated places" },
  { value: "3", label: "Travel modes compared" },
  { value: "AI", label: "Day-by-day itineraries" },
];

export default function DestinationsSection() {
  const [activeId, setActiveId] = useState(destinations[0].id);
  const active = destinations.find((d) => d.id === activeId) ?? destinations[0];

  return (
    <section
      id="destinations"
      className="relative py-24 px-6 overflow-hidden bg-[#F4F9FD]"
    >
      {/* The hero's "Explore India" link lands here. */}
      <div id="explore-section" className="absolute -top-20 left-0" />

      <AuroraCanvas className="opacity-70" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl mb-12"
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.18em] text-[#133C55] bg-white/70 backdrop-blur border border-[#59A5D8]/40 uppercase mb-5">
            <Compass size={13} strokeWidth={2.6} />
            Explore India
          </span>
          <h2 className="font-display font-black text-[#050D1A] text-3xl sm:text-4xl lg:text-5xl leading-[1.05] tracking-tight mb-4">
            {destinations.length} regions.{" "}
            <span className="relative inline-block">
              <span className="relative z-10">One planner.</span>
              <span className="absolute left-0 right-0 bottom-1 h-3 bg-[#91E5F6]/60 rounded-sm" />
            </span>
          </h2>
          <p className="text-[#133C55]/80 text-base sm:text-lg leading-relaxed font-sans-dm font-medium">
            Pick a region to see the places Tripzy already knows &mdash; every one of
            them ready to drop straight into an itinerary.
          </p>
        </motion.div>

        {/* ── Region tabs ── */}
        <div className="flex flex-wrap gap-2 mb-8">
          {destinations.map((d) => {
            const isActive = d.id === activeId;
            return (
              <button
                key={d.id}
                onClick={() => setActiveId(d.id)}
                className={`relative px-4 py-2 rounded-full text-sm font-bold transition-colors duration-300 ${
                  isActive
                    ? "text-white"
                    : "text-[#133C55] bg-white/70 border border-[#386FA4]/20 hover:border-[#386FA4]/50"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="region-pill"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "linear-gradient(135deg, #386FA4 0%, #133C55 100%)",
                      boxShadow: "0 6px 18px rgba(19,60,85,0.28)",
                    }}
                  />
                )}
                <span className="relative z-10">{d.name}</span>
              </button>
            );
          })}
        </div>

        {/* ── Active region: feature panel + place cards ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-5"
          >
            {/* Region panel */}
            <div className="lg:col-span-5 relative rounded-3xl overflow-hidden min-h-[320px] border border-white/60 shadow-[0_18px_50px_rgba(19,60,85,0.18)]">
              <img
                src={active.bgImage}
                alt={active.name}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(5,13,26,0.92) 0%, rgba(5,13,26,0.45) 45%, rgba(5,13,26,0.05) 100%)",
                }}
              />
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{
                  background: `linear-gradient(90deg, ${active.accent || "#59A5D8"}, #91E5F6)`,
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-7">
                <h3 className="font-display font-black text-white text-3xl mb-2">
                  {active.name}
                </h3>
                <p className="font-display italic text-[#91E5F6] text-base font-bold mb-3">
                  &ldquo;{active.tagline}&rdquo;
                </p>
                <p className="text-white/85 text-sm leading-relaxed font-sans-dm font-medium">
                  {active.description}
                </p>
              </div>
            </div>

            {/* Place cards */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-5">
              {active.places.map((place, i) => (
                <motion.article
                  key={place.name}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.06 * i }}
                  whileHover={{ y: -6 }}
                  className="group relative rounded-2xl overflow-hidden bg-white border border-[#386FA4]/15 shadow-sm hover:shadow-[0_16px_36px_rgba(56,111,164,0.22)] transition-shadow"
                >
                  <div className="relative h-32 sm:h-36 overflow-hidden">
                    <img
                      src={place.image}
                      alt={place.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050D1A]/55 to-transparent" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-display font-bold text-[#0D324D] text-sm sm:text-base leading-tight">
                          {place.name}
                        </h4>
                        <p className="flex items-center gap-1 text-[#386FA4] text-[11px] font-semibold mt-1 font-sans-dm">
                          <MapPin size={11} strokeWidth={2.6} />
                          {place.tag}
                        </p>
                      </div>
                      <ArrowUpRight
                        size={16}
                        className="text-[#59A5D8] opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all flex-shrink-0"
                      />
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* ── Stat strip ── */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-[#386FA4]/20 bg-[#386FA4]/20">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="bg-white/85 backdrop-blur px-5 py-6 text-center"
            >
              <p className="font-display font-black text-[#133C55] text-3xl sm:text-4xl tracking-tight">
                {stat.value}
              </p>
              <p className="text-[#386FA4] text-[11px] font-bold tracking-[0.12em] uppercase mt-1.5 font-sans-dm">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
