import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import AuroraCanvas from "../../components/ui/AuroraCanvas";

export default function FinalCtaSection({ onOpenAuth }) {
  return (
    <section
      id="final-cta"
      className="relative px-6 py-24 overflow-hidden bg-[#F4F9FD]"
    >
      <div className="relative max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[2rem] overflow-hidden px-8 py-16 sm:px-16 sm:py-20 text-center"
          style={{
            background:
              "linear-gradient(140deg, #133C55 0%, #0D324D 50%, #050D1A 100%)",
            boxShadow: "0 30px 70px rgba(5,13,26,0.35)",
          }}
        >
          <AuroraCanvas className="opacity-80" density={0.00013} linkDistance={130} />

          {/* Dashed passport-stamp ring */}
          <svg
            className="absolute -bottom-12 -right-12 opacity-[0.07] pointer-events-none"
            width="260"
            height="260"
            viewBox="0 0 72 72"
            aria-hidden="true"
          >
            <circle
              cx="36"
              cy="36"
              r="33"
              fill="none"
              stroke="#91E5F6"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <text
              x="50%"
              y="45%"
              textAnchor="middle"
              fill="#91E5F6"
              fontSize="8"
              fontWeight="bold"
            >
              TRIPZY
            </text>
            <text x="50%" y="66%" textAnchor="middle" fill="#91E5F6" fontSize="12">
              &#9992;
            </text>
          </svg>

          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.18em] text-[#91E5F6] bg-white/10 border border-[#91E5F6]/30 uppercase mb-6">
              <Sparkles size={13} strokeWidth={2.6} />
              Free to plan
            </span>

            <h2 className="font-display font-black text-white text-3xl sm:text-5xl lg:text-6xl leading-[1.04] tracking-tight mb-5">
              Your next journey
              <br className="hidden sm:block" /> starts here.
            </h2>
            <p className="text-white/70 text-base sm:text-xl font-sans-dm font-medium mb-10 max-w-xl mx-auto">
              Plan smarter, compare honestly, and leave with an itinerary you actually
              want to follow.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                id="plan-trip-final-cta"
                onClick={() => onOpenAuth?.("signup")}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-9 py-4 rounded-full text-base font-bold text-[#0D324D] tracking-wide shadow-lg transition-shadow hover:shadow-[0_14px_40px_rgba(145,229,246,0.45)]"
                style={{
                  background: "linear-gradient(135deg, #91E5F6 0%, #59A5D8 100%)",
                }}
              >
                <span>Plan a Trip</span>
                <ArrowRight size={18} strokeWidth={2.6} />
              </motion.button>

              <motion.button
                onClick={() => onOpenAuth?.("login")}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-full text-base font-bold text-white border border-white/25 bg-white/5 hover:bg-white/10 transition-colors"
              >
                I already have an account
              </motion.button>
            </div>

            <p className="text-white/40 text-xs font-sans-dm font-medium mt-7">
              No payments, no bookings &mdash; Tripzy only plans the trip.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
