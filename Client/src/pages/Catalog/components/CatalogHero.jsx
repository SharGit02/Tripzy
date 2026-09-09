import { motion } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import airplaneImg from "../../../assets/images/Airplane.png";
import BoardingPassSearch from "./BoardingPassSearch";

export default function CatalogHero({ onSearch, submitting = false, searchError = "" }) {
  return (
    <section className="relative overflow-x-clip bg-gradient-to-b from-[#EBF3FF] via-[#F4F8FF] to-[#F7F9FC] pt-32 md:pt-36 pb-12 px-4 sm:px-8 lg:px-12 rounded-b-[40px] shadow-sm">
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <svg
          className="w-full h-full text-[#1C3F94] opacity-25"
          viewBox="0 0 1200 400"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M 120 160 Q 380 40 750 180 T 1150 100"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="6 8"
            strokeLinecap="round"
          />
          <circle cx="120" cy="160" r="5" fill="currentColor" />
          <circle
            cx="120"
            cy="160"
            r="9"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            opacity="0.6"
          />
          <circle cx="580" cy="120" r="3.5" fill="currentColor" />
          <circle cx="1150" cy="100" r="4" fill="currentColor" />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto flex flex-col relative z-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
            className="flex-1 flex flex-col items-start justify-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#133C55] tracking-tight leading-tight">
              Ready to{" "}
              <span className="font-['Playfair_Display'] italic font-normal text-[#1C3F94] ml-1">
                Explore?
              </span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg font-medium text-slate-600 mt-3 max-w-md leading-relaxed">
              Tell us where you want to go and we will build a day-by-day itinerary.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="flex-1 flex justify-center md:justify-end pointer-events-none"
          >
            <motion.img
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              src={airplaneImg}
              alt="Commercial Flight Booking Services Airplane"
              className="w-auto max-h-[260px] sm:max-h-[320px] md:max-h-[380px] lg:max-h-[420px] object-contain drop-shadow-2xl translate-x-1 md:translate-x-3 lg:translate-x-4 xl:translate-x-12 2xl:translate-x-16"
            />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-center mt-8 md:mt-10 mb-5"
        >
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#133C55] tracking-tight">
            Where Would You Like to Go?
          </h2>
          <p className="text-xs sm:text-sm md:text-base font-medium text-slate-500 mt-1 max-w-xl mx-auto">
            Fill in your travel plans, then tap Proceed to generate your itinerary.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full"
        >
          <BoardingPassSearch onSearch={onSearch} disabled={submitting} />
          {searchError && (
            <p className="flex items-center justify-center gap-1.5 text-center text-sm font-medium text-red-600 mt-4 px-2 max-w-3xl mx-auto">
              <TriangleAlert size={14} />
              {searchError}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}
