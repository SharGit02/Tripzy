import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { MapPin, Compass, Calendar, LineChart, Plane, Route } from "lucide-react";

const steps = [
  {
    num: "01",
    tag: "Choose",
    title: "Tell us where you want to go.",
    description:
      "Pick any region across India's heritage circuits, coastlines and mountain valleys.",
    icon: MapPin,
  },
  {
    num: "02",
    tag: "Discover",
    title: "Pick the places you actually want to see.",
    description:
      "Browse curated attractions for the region and keep the ones that fit your trip.",
    icon: Compass,
  },
  {
    num: "03",
    tag: "Plan",
    title: "Set your dates and duration.",
    description: "Say when you are travelling and how many days you have to explore.",
    icon: Calendar,
  },
  {
    num: "04",
    tag: "Compare",
    title: "See travel options and predicted fares.",
    description:
      "Compare flight, train and bus options against ML fare estimates before you commit.",
    icon: LineChart,
  },
  {
    num: "05",
    tag: "Go",
    title: "Take your itinerary with you.",
    description: "Get a day-by-day plan you can save, export as PDF or email yourself.",
    icon: Plane,
  },
];

export default function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const progress = ((activeStep + 1) / steps.length) * 100;

  return (
    <section
      id="how-it-works"
      className="relative py-24 px-6 overflow-hidden"
      style={{
        background: "linear-gradient(165deg, #0D324D 0%, #133C55 45%, #050D1A 100%)",
      }}
    >
      {/* Ambient glows */}
      <div
        className="absolute -top-24 -left-20 w-[480px] h-[480px] rounded-full pointer-events-none opacity-30"
        style={{ background: "#386FA4", filter: "blur(150px)" }}
      />
      <div
        className="absolute -bottom-32 right-0 w-[420px] h-[420px] rounded-full pointer-events-none opacity-25"
        style={{ background: "#14b8a6", filter: "blur(150px)" }}
      />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl mb-14"
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.18em] text-[#91E5F6] bg-white/10 border border-[#91E5F6]/30 uppercase mb-5">
            <Route size={13} strokeWidth={2.6} />
            How it works
          </span>
          <h2 className="font-display font-black text-white text-3xl sm:text-4xl lg:text-5xl leading-[1.08] tracking-tight mb-4">
            From destination to departure, in five steps.
          </h2>
          <p className="text-white/70 text-base sm:text-lg leading-relaxed font-sans-dm font-medium">
            Tell us where you are going. We will help you work out the rest.
          </p>
        </motion.div>

        {/* ── Rail + steps ── */}
        <div className="relative">
          {/* Horizontal rail (desktop) */}
          <div className="hidden lg:block absolute left-0 right-0 top-[38px] h-px bg-white/15">
            <motion.div
              className="h-px origin-left"
              style={{
                background: "linear-gradient(90deg, #59A5D8, #91E5F6, #14b8a6)",
                boxShadow: "0 0 12px rgba(145,229,246,0.8)",
              }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;
              const isPast = index < activeStep;

              return (
                <motion.button
                  key={step.num}
                  type="button"
                  onClick={() => setActiveStep(index)}
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative text-left group focus:outline-none"
                  aria-current={isActive ? "step" : undefined}
                >
                  {/* Node on the rail */}
                  <span
                    className={`relative z-10 flex items-center justify-center w-[76px] h-[76px] rounded-2xl border transition-all duration-500 ${
                      isActive
                        ? "border-[#91E5F6] bg-[#91E5F6] text-[#0D324D] shadow-[0_0_30px_rgba(145,229,246,0.45)] scale-105"
                        : isPast
                          ? "border-[#59A5D8]/60 bg-[#133C55] text-[#91E5F6]"
                          : "border-white/15 bg-white/5 text-white/60 group-hover:border-white/40"
                    }`}
                  >
                    <Icon size={24} strokeWidth={2.2} />
                    <span
                      className={`absolute -top-2 -right-2 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition-colors ${
                        isActive
                          ? "bg-[#0D324D] text-[#91E5F6]"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {step.num}
                    </span>
                  </span>

                  <p
                    className={`mt-5 text-[10px] font-extrabold tracking-[0.2em] uppercase font-sans-dm transition-colors ${
                      isActive ? "text-[#91E5F6]" : "text-white/45"
                    }`}
                  >
                    {step.tag}
                  </p>
                  <h3 className="font-display font-bold text-white text-base leading-snug mt-1.5 mb-2">
                    {step.title}
                  </h3>
                  <p
                    className={`text-[13px] leading-relaxed font-sans-dm font-medium transition-colors ${
                      isActive ? "text-white/80" : "text-white/55"
                    }`}
                  >
                    {step.description}
                  </p>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
