import { useState } from "react";
import { Link } from "react-router-dom";
import logoImg from "../../assets/images/logo.png";

const GithubIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></svg>
);
const MailIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
);

const COMPANY_LINKS = [
  { label: "About Us", href: "#" },
  { label: "Careers", href: "#" },
  { label: "Press", href: "#" },
  { label: "Blog", href: "#" }
];

const SUPPORT_LINKS = [
  { label: "Help Center", href: "#" },
  { label: "Contact Us", href: "#" },
  { label: "FAQs", href: "#" },
  { label: "Privacy Policy", href: "#" }
];

const SOCIALS = [
  { icon: GithubIcon, label: "GitHub", href: "#" },
  { icon: MailIcon, label: "Email", href: "#" },
];

export default function Footer({ onOpenAuth }) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
    }
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <footer className="relative border-t py-12 px-6 overflow-hidden bg-[#0f2442] text-white border-white/10 mt-auto">
      {/* Background subtle glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-32 opacity-15 pointer-events-none"
        style={{ background: "#59A5D8", filter: "blur(80px)" }}
      />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-white/10">

          {/* Brand */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="inline-block mb-3">
              <img src={logoImg} alt="Tripzy" className="h-9 w-auto object-contain" />
            </Link>
            <p className="text-xs text-white/70 leading-relaxed max-w-[220px]">
              Tripzy is your smart travel companion to plan, explore and experience unforgettable journeys.
            </p>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-xs font-bold text-[#91E5F6] uppercase tracking-wider mb-3.5">
              Company
            </h4>
            <ul className="space-y-2 text-xs text-white/70">
              {COMPANY_LINKS.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="hover:text-[#91E5F6] transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
              {onOpenAuth && (
                <>
                  <li>
                    <button
                      type="button"
                      onClick={() => onOpenAuth("login")}
                      className="hover:text-[#91E5F6] transition-colors text-left"
                    >
                      Login
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => onOpenAuth("signup")}
                      className="hover:text-[#91E5F6] transition-colors text-left"
                    >
                      Sign Up
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="text-xs font-bold text-[#91E5F6] uppercase tracking-wider mb-3.5">
              Support
            </h4>
            <ul className="space-y-2 text-xs text-white/70">
              {SUPPORT_LINKS.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="hover:text-[#91E5F6] transition-colors">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Follow Us & Newsletter */}
          <div>
            <h4 className="text-xs font-bold text-[#91E5F6] uppercase tracking-wider mb-3.5">
              Follow Us
            </h4>
            <div className="flex gap-2 mb-5">
              {SOCIALS.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/80 hover:bg-[#91E5F6] hover:text-[#0f2442] transition-all"
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
            <p className="text-xs font-bold text-white mb-2">Subscribe to our newsletter</p>
            {subscribed ? (
              <p className="text-xs text-emerald-400 font-semibold">✓ You're subscribed!</p>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 min-w-0 text-xs bg-white/10 border border-white/20 text-white placeholder-white/40 rounded-lg px-3 py-2 outline-none focus:border-[#91E5F6] transition-colors"
                />
                <button
                  type="submit"
                  className="bg-[#91E5F6] text-[#0f2442] text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#6edbf0] transition-colors whitespace-nowrap"
                >
                  Subscribe
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 text-xs text-white/50 font-medium">
          <p>© 2026 Tripzy. All rights reserved.</p>
          <p>Made in India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}
