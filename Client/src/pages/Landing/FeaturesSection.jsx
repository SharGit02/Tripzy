import { motion } from "framer-motion";
import {
  Tag,
  TrendingUp,
  MapPin,
  Sparkles,
  Sun,
  Bookmark,
  Layers,
} from "lucide-react";
import AuroraCanvas from "../../components/ui/AuroraCanvas";

const features = [
  {
    id: "prices",
    title: "Smart travel prices",
    description:
      "Flights, trains and buses side by side, so the cheapest way to get there is obvious at a glance.",
    icon: Tag,
    badge: "Multi-modal",
    span: "md:col-span-2",
    tone: "deep",
  },
  {
    id: "prediction",
    title: "Fare prediction",
    description: "ML-powered airfare estimates built from historical travel patterns.",
    icon: TrendingUp,
    badge: "ML powered",
    span: "md:col-span-1",
    tone: "light",
  },
  {
    id: "discover",
    title: "Discover places",
    description: "Curated attractions and experiences for every region we cover.",
    icon: MapPin,
    badge: "Curated",
    span: "md:col-span-1",
    tone: "light",
  },
  {
    id: "itinerary",
    title: "AI itinerary",
    description:
      "Turn the places you picked into a day-by-day plan that respects your dates and pace.",
    icon: Sparkles,
    badge: "Smart generator",
    span: "md:col-span-2",
    tone: "accent",
  },
  {
    id: "weather",
    title: "Weather insights",
    description: "Know the conditions to expect before you commit to the dates.",
    icon: Sun,
    badge: "Live forecast",
    span: "md:col-span-1",
    tone: "light",
  },
  {
    id: "saved",
    title: "Saved trips",
    description: "Save, download as PDF and revisit any plan you have generated.",
    icon: Bookmark,
    badge: "Export ready",
    span: "md:col-span-2",
    tone: "light",
  },
];

/* Three card treatments keyed off the hero palette. */
const TONES = {
  deep: {
    card: "text-white border-transparent",
    style: {
      background: "linear-gradient(135deg, #133C55 0%, #0D324D 55%, #050D1A 100%)",
      boxShadow: "0 18px 44px rgba(5,13,26,0.28)",
    },
    title: "text-white",
    body: "text-white/75",
    iconWrap: "bg-white/10 border-white/25 text-[#91E5F6]",
    badge: "text-[#91E5F6] bg-white/10 border-white/20",
    rule: "linear-gradient(90deg, #59A5D8, #91E5F6)",
  },
  accent: {
    card: "border-transparent text-white",
    style: {
      background: "linear-gradient(135deg, #386FA4 0%, #59A5D8 100%)",
      boxShadow: "0 18px 44px rgba(56,111,164,0.32)",
    },
    title: "text-white",
    body: "text-white/85",
    iconWrap: "bg-white/18 border-white/35 text-white",
    badge: "text-white bg-white/18 border-white/30",
    rule: "linear-gradient(90deg, #ffffff, #91E5F6)",
  },
  light: {
    card: "border-[#386FA4]/18 text-[#0D324D]",
    style: {
      background: "linear-gradient(160deg, #ffffff 0%, #F4F9FD 100%)",
      boxShadow: "0 10px 30px rgba(56,111,164,0.12)",
    },
    title: "text-[#0D324D]",
    body: "text-[#133C55]/75",
    iconWrap: "bg-[#91E5F6]/25 border-[#59A5D8]/40 text-[#133C55]",
    badge: "text-[#386FA4] bg-[#386FA4]/10 border-[#386FA4]/25",
    rule: "linear-gradient(90deg, #59A5D8, #91E5F6)",
  },
};

export default function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative py-24 px-6 overflow-hidden"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #F4F9FD 100%)" }}
    >
      <AuroraCanvas className="opacity-50" density={0.00006} blobs={false} />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.18em] text-[#133C55] bg-white/70 backdrop-blur border border-[#59A5D8]/40 uppercase mb-5">
            <Layers size={13} strokeWidth={2.6} />
            Core features
          </span>
          <h2 className="font-display font-black text-[#050D1A] text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight mb-4">
            Everything you need for the journey ahead.
          </h2>
          <p className="text-[#133C55]/75 text-base sm:text-lg leading-relaxed font-sans-dm font-medium">
            From discovering places to understanding travel prices and building the
            itinerary, Tripzy keeps the essentials in one place.
          </p>
        </motion.div>

        {/* ── Bento grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const tone = TONES[feature.tone];
            return (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -6 }}
                className={`group relative rounded-3xl border p-7 flex flex-col justify-between min-h-[210px] overflow-hidden ${feature.span} ${tone.card}`}
                style={tone.style}
              >
                {/* Sheen on hover */}
                <span className="pointer-events-none absolute -inset-x-10 -top-20 h-40 rotate-12 bg-white/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />

                <div className="relative flex items-start justify-between gap-3 mb-8">
                  <span
                    className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${tone.iconWrap}`}
                  >
                    <Icon size={20} strokeWidth={2.4} />
                  </span>
                  <span
                    className={`text-[10px] font-extrabold tracking-[0.14em] px-2.5 py-1 rounded-full uppercase border font-sans-dm ${tone.badge}`}
                  >
                    {feature.badge}
                  </span>
                </div>

                <div className="relative">
                  <h3
                    className={`font-display font-bold text-xl sm:text-2xl mb-2 ${tone.title}`}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className={`text-sm sm:text-[15px] leading-relaxed font-sans-dm font-medium max-w-xl ${tone.body}`}
                  >
                    {feature.description}
                  </p>
                  <span
                    className="block h-[3px] w-10 rounded-full mt-5 transition-all duration-500 group-hover:w-24"
                    style={{ background: tone.rule }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
