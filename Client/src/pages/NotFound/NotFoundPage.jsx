import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Compass, Home } from "lucide-react";
import logoImg from "../../assets/images/logo.png";

export default function NotFoundPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F4F9FD] text-[#0f2442]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(56,111,164,0.22) 1px, transparent 0)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full opacity-40"
        style={{
          background: "radial-gradient(ellipse, rgba(89,165,216,0.35), transparent 70%)",
          filter: "blur(8px)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
        <Link to="/" className="inline-flex w-fit items-center">
          <motion.img
            whileHover={{ scale: 1.04 }}
            src={logoImg}
            alt="Tripzy"
            className="h-10 w-auto object-contain md:h-12"
          />
        </Link>

        <main className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center"
          >
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#386FA4]/20 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#386FA4]">
              <Compass size={13} strokeWidth={2.4} />
              Lost route
            </span>

            <h1 className="font-display leading-none font-black tracking-tight text-[#0f2442] select-none">
              <span className="block text-[clamp(7.5rem,22vw,14rem)]">404</span>
            </h1>

            <p className="font-display mt-2 text-3xl font-semibold tracking-tight text-[#133C55] sm:text-4xl">
              Off the map.
            </p>
            <p className="font-sans-secondary mt-4 max-w-md text-lg font-medium text-[#133C55]/70 sm:text-xl">
              This page is not on the itinerary. Head home, or start planning the next trip.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link to="/">
                <motion.span
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#133C55]/15 bg-white px-6 py-3 text-sm font-bold text-[#133C55] shadow-[0_8px_24px_rgba(19,60,85,0.06)]"
                >
                  <Home size={16} />
                  Go home
                </motion.span>
              </Link>
              <Link to="/plan">
                <motion.span
                  whileHover={{
                    scale: 1.04,
                    boxShadow: "0 12px 32px rgba(56, 111, 164, 0.4)",
                  }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #386FA4 0%, #133C55 100%)",
                  }}
                >
                  Plan a trip
                  <ArrowRight size={16} />
                </motion.span>
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
