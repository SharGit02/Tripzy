import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "What is Tripzy?",
    a: "Tripzy is a travel planning platform that combines destination discovery, travel price insight and AI-generated itineraries in one place.",
  },
  {
    q: "Does Tripzy book my tickets?",
    a: "No. Tripzy is a planning and comparison tool only. We generate itineraries and show predicted fares, but we do not sell tickets, handle payments or make bookings of any kind.",
  },
  {
    q: "Are the predicted prices exact?",
    a: "No. Predicted prices are machine-learning estimates built from historical travel data and will differ from the fare you are actually quoted.",
  },
  {
    q: "Can I customise my itinerary?",
    a: "Yes. You choose the places you want to visit, and Tripzy builds the itinerary around those selections, your dates and your trip length. You can regenerate it with changes afterwards.",
  },
  {
    q: "Can I save and export my trips?",
    a: "Yes. Generated itineraries are saved to your profile, and you can download them as a PDF or have one emailed to you.",
  },
];

export default function FaqSection() {
  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section id="faq" className="relative py-24 px-6 overflow-hidden bg-white">
      <div
        className="absolute bottom-0 left-1/4 w-[420px] h-[320px] rounded-full pointer-events-none opacity-15"
        style={{ background: "#59A5D8", filter: "blur(140px)" }}
      />

      <div className="relative z-10 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
        {/* ── Sticky header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start"
        >
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.18em] text-[#133C55] bg-[#F4F9FD] border border-[#59A5D8]/40 uppercase mb-5">
            <HelpCircle size={13} strokeWidth={2.6} />
            FAQ
          </span>
          <h2 className="font-display font-black text-[#050D1A] text-3xl sm:text-4xl leading-[1.08] tracking-tight mb-3">
            Questions, answered.
          </h2>
          <p className="text-[#133C55]/75 text-base leading-relaxed font-sans-dm font-medium">
            What Tripzy does, what it does not do, and what the numbers mean.
          </p>
        </motion.div>

        {/* ── Accordion ── */}
        <div className="lg:col-span-8 divide-y divide-[#386FA4]/15 border-y border-[#386FA4]/15">
          {faqs.map((faq, index) => {
            const isOpen = openIdx === index;
            return (
              <motion.div
                key={faq.q}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <button
                  onClick={() => setOpenIdx(isOpen ? null : index)}
                  className="w-full py-6 flex items-start justify-between gap-5 text-left group focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-start gap-4">
                    <span
                      className={`font-mono text-xs font-bold pt-1 transition-colors ${
                        isOpen ? "text-[#386FA4]" : "text-[#386FA4]/50"
                      }`}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`font-display font-bold text-base sm:text-lg transition-colors ${
                        isOpen ? "text-[#133C55]" : "text-[#0D324D] group-hover:text-[#386FA4]"
                      }`}
                    >
                      {faq.q}
                    </span>
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.25 }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                      isOpen
                        ? "bg-[#133C55] border-[#133C55] text-white"
                        : "bg-[#F4F9FD] border-[#386FA4]/20 text-[#133C55]"
                    }`}
                  >
                    <Plus size={16} strokeWidth={2.6} />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <p className="pb-6 pl-10 pr-12 text-[#133C55]/80 text-sm sm:text-[15px] leading-relaxed font-sans-dm font-medium">
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
