import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../../components/layout/Navbar";
import HeroSection from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import HowItWorksSection from "./HowItWorksSection";
import FaqSection from "./FaqSection";
import FinalCtaSection from "./FinalCtaSection";
import Footer from "../../components/layout/Footer";
import AuthModal from "../../components/ui/AuthModal";

export default function LandingPage() {
  const [authModal, setAuthModal] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

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
        <FeaturesSection />
        <HowItWorksSection />
        <FaqSection />
        <FinalCtaSection onOpenAuth={(tab) => setAuthModal(tab)} />
      </main>
      <Footer onOpenAuth={(tab) => setAuthModal(tab)} />

      {authModal && (
        <AuthModal
          defaultTab={authModal}
          onClose={() => setAuthModal(null)}
        />
      )}
    </div>
  );
}
