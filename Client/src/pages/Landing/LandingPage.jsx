import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import HeroSection from "./HeroSection";
import DestinationsSection from "./DestinationsSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import FarePreviewSection from "./FarePreviewSection";
import FaqSection from "./FaqSection";
import FinalCtaSection from "./FinalCtaSection";
import Footer from "../../components/layout/Footer";
import AuthModal from "../../components/ui/AuthModal";
import { request } from "../../lib/authApi";

export default function LandingPage() {
  const [authModal, setAuthModal] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Render spins the API down when idle, so the first real request (usually a
  // login) pays a ~30-50s cold start. Ping /health as soon as anyone lands so
  // the instance is already awake by the time they sign in. Fire-and-forget:
  // a failure here is not the visitor's problem.
  useEffect(() => {
    request("/health").catch(() => {});
  }, []);

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "login" || auth === "signup") {
      setAuthModal(auth);
      const next = new URLSearchParams(searchParams);
      next.delete("auth");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="min-h-screen bg-[#F4F9FD]">
      <Navbar onOpenAuth={setAuthModal} />
      <main>
        <HeroSection onOpenAuth={setAuthModal} />
        <DestinationsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <FarePreviewSection />
        <FaqSection />
        <FinalCtaSection onOpenAuth={(tab) => setAuthModal(tab)} />
      </main>
      <Footer onOpenAuth={(tab) => setAuthModal(tab)} />

      {authModal && (
        <AuthModal defaultTab={authModal} onClose={() => setAuthModal(null)} />
      )}
    </div>
  );
}
