import { useState } from "react";
import { Link } from "react-router-dom";
import logoImg from "../../../assets/images/logo.png";

const InstagramIcon = ({ size }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>);
const FacebookIcon = ({ size }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>);
const TwitterIcon = ({ size }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>);
const YoutubeIcon = ({ size }) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" /></svg>);

const COMPANY_LINKS = ["About Us", "Careers", "Press", "Blog"];
const SUPPORT_LINKS = ["Help Center", "Contact Us", "FAQs", "Privacy Policy"];
const SOCIALS = [
    { icon: InstagramIcon, label: "Instagram", href: "#" },
    { icon: FacebookIcon, label: "Facebook", href: "#" },
    { icon: TwitterIcon, label: "Twitter / X", href: "#" },
    { icon: YoutubeIcon, label: "YouTube", href: "#" },
];

export default function DashboardFooter() {
    const [email, setEmail] = useState("");
    const [subscribed, setSubscribed] = useState(false);

    const handleSubscribe = (e) => {
        e.preventDefault();
        if (email.trim()) {
            setSubscribed(true);
            setEmail("");
        }
    };

    return (
        <footer className="bg-white border-t border-slate-100 mt-4 px-6 pt-10 pb-6">
            <div className="max-w-6xl mx-auto">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-8 border-b border-slate-100">

                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1">
                        <Link to="/dashboard">
                            <img src={logoImg} alt="Tripzy" className="h-9 w-auto object-contain mb-3" />
                        </Link>
                        <p className="text-xs text-slate-500 leading-relaxed max-w-[180px]">
                            Tripzy is your smart travel companion to plan, explore and experience unforgettable journeys.
                        </p>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 className="text-xs font-bold text-[#0f2442] uppercase tracking-wider mb-3">Company</h4>
                        <ul className="space-y-2">
                            {COMPANY_LINKS.map((l) => (
                                <li key={l}>
                                    <a href="#" className="text-xs text-slate-500 hover:text-[#2563EB] transition-colors">
                                        {l}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="text-xs font-bold text-[#0f2442] uppercase tracking-wider mb-3">Support</h4>
                        <ul className="space-y-2">
                            {SUPPORT_LINKS.map((l) => (
                                <li key={l}>
                                    <a href="#" className="text-xs text-slate-500 hover:text-[#2563EB] transition-colors">
                                        {l}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Social + Newsletter */}
                    <div>
                        <h4 className="text-xs font-bold text-[#0f2442] uppercase tracking-wider mb-3">Follow Us</h4>
                        <div className="flex gap-2 mb-5">
                            {SOCIALS.map(({ icon: Icon, label, href }) => (
                                <a
                                    key={label}
                                    href={href}
                                    aria-label={label}
                                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-[#2563EB] hover:text-white transition-all"
                                >
                                    <Icon size={14} />
                                </a>
                            ))}
                        </div>
                        <p className="text-xs font-bold text-[#0f2442] mb-2">Subscribe to our newsletter</p>
                        {subscribed ? (
                            <p className="text-xs text-emerald-600 font-semibold">✓ You're subscribed!</p>
                        ) : (
                            <form onSubmit={handleSubscribe} className="flex gap-2">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    className="flex-1 min-w-0 text-xs border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-[#2563EB] transition-colors"
                                />
                                <button
                                    type="submit"
                                    className="bg-[#0f2442] text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#1a3a60] transition-colors whitespace-nowrap"
                                >
                                    Subscribe
                                </button>
                            </form>
                        )}
                    </div>
                </div>

                {/* Bottom bar */}
                <div className="pt-5 text-center text-[11px] text-slate-400">
                    © 2026 Tripzy. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
