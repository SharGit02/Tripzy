import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Settings,
  MonitorSmartphone,
  LogOut,
  Loader2,
  Camera,
  MapPin,
  Clock,
  ShieldCheck,
  Laptop,
  Smartphone,
  CheckCircle2,
  X,
} from "lucide-react";
import UserNavbar from "../../components/layout/UserNavbar";
import Footer from "../../components/layout/Footer";
import defaultProfileImg from "../../assets/images/ProfileImg.jpeg";
import {
  fetchCurrentUser,
  fetchUserProfile,
  updateUserProfile,
  logoutUser,
} from "../../lib/authApi";

// ── Static config — change one place, updates the whole UI ──
const SUGGESTED_INTERESTS = [
  "Beaches", "Trekking", "Wildlife", "Heritage", "Adventure",
  "Food", "Nightlife", "Backpacking", "Luxury", "Family",
];

const TRAVEL_STYLE_OPTIONS = [
  { value: "", label: "Select style" },
  { value: "Budget", label: "Budget" },
  { value: "Mid-range", label: "Mid-range" },
  { value: "Luxury", label: "Luxury" },
  { value: "Backpacker", label: "Backpacker" },
  { value: "Family", label: "Family" },
  { value: "Solo", label: "Solo" },
];

const CURRENCY_OPTIONS = [
  { value: "INR", label: "Indian Rupee (₹)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GBP", label: "British Pound (£)" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "IST — Asia/Kolkata (+05:30)" },
  { value: "UTC", label: "UTC — Universal (+00:00)" },
  { value: "America/New_York", label: "EST — America/New_York (-05:00)" },
  { value: "America/Los_Angeles", label: "PST — America/Los_Angeles (-08:00)" },
  { value: "Europe/London", label: "GMT — Europe/London (+00:00)" },
  { value: "Asia/Dubai", label: "GST — Asia/Dubai (+04:00)" },
  { value: "Asia/Singapore", label: "SGT — Asia/Singapore (+08:00)" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

// ── Form field definitions — add/remove a field here, not in the JSX ──
// type: 'text' | 'tel' | 'email' | 'date' | 'select' | 'readonly'
// key: matches the form state key, or '__user__' for read-only user fields
const PROFILE_FIELDS = [
  { key: "__firstName", label: "First Name", type: "readonly", get: (u) => u?.name?.split(" ")[0] || "" },
  { key: "__lastName", label: "Last Name", type: "readonly", get: (u) => u?.name?.split(" ").slice(1).join(" ") || "" },
  { key: "username", label: "Username", type: "text" },
  { key: "phoneNumber", label: "Phone Number", type: "tel" },
  { key: "__email", label: "Email Address", type: "readonly", get: (u) => u?.email || "" },
  { key: "dateOfBirth", label: "Date of Birth", type: "date" },
  { key: "gender", label: "Gender", type: "select", options: () => GENDER_OPTIONS },
  { key: "homeCity", label: "Home City", type: "text" },
  { key: "homeCountry", label: "Home Country", type: "text" },
  { key: "budgetCurrency", label: "Default Currency", type: "select", options: () => CURRENCY_OPTIONS },
];

const emptyForm = {
  username: "",
  phoneNumber: "",
  dateOfBirth: "",
  gender: "",
  bio: "",
  homeCity: "",
  homeCountry: "",
  travelInterests: [],
  preferredTravelStyle: "",
  budgetMin: "",
  budgetMax: "",
  budgetCurrency: "INR",
  preferredLanguage: "",
  marketingOptIn: false,
};

const inputCls =
  "w-full px-3 py-2.5 rounded-md text-sm text-slate-800 placeholder-slate-400 bg-white border border-slate-300 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

const labelCls = "block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1";

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const [form, setForm] = useState(emptyForm);
  const [interestInput, setInterestInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [profilePic, setProfilePic] = useState(defaultProfileImg);

  // Preferences tab – loaded from localStorage
  const [prefs, setPrefs] = useState({ currency: "INR", timeZone: "Asia/Kolkata" });
  const [toggles, setToggles] = useState({ recommendations: true, dataCollection: false });
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");

  const devices = [
    { id: 1, type: "laptop", name: "Windows PC · Chrome", location: "Mumbai, India", time: "Active now", isCurrent: true },
    { id: 2, type: "smartphone", name: "iPhone 14 · Safari", location: "Pune, India", time: "Last active 2 hours ago", isCurrent: false },
  ];

  const TABS = [
    { id: "profile", label: "Account Settings", icon: User },
    { id: "prefs", label: "Preferences", icon: Settings },
    { id: "devices", label: "Login Activity", icon: MonitorSmartphone },
  ];

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [meRes, profileRes] = await Promise.all([fetchCurrentUser(), fetchUserProfile()]);
        if (!alive) return;
        setUser(meRes.user);

        // Load saved prefs from localStorage
        const stored = localStorage.getItem(`tripzy_prefs_${meRes.user?.id}`);
        if (stored) {
          try { const p = JSON.parse(stored); setPrefs(p.prefs ?? prefs); setToggles(p.toggles ?? toggles); }
          catch { /* ignore */ }
        }

        const p = profileRes.profile;
        if (p) {
          setForm({
            username: p.username || "",
            phoneNumber: p.phoneNumber || "",
            dateOfBirth: p.dateOfBirth || "",
            gender: p.gender || "",
            bio: p.bio || "",
            homeCity: p.homeCity || "",
            homeCountry: p.homeCountry || "",
            travelInterests: p.travelInterests || [],
            preferredTravelStyle: p.preferredTravelStyle || "",
            budgetMin: p.budgetMin ?? "",
            budgetMax: p.budgetMax ?? "",
            budgetCurrency: p.budgetCurrency || "INR",
            preferredLanguage: p.preferredLanguage || "",
            marketingOptIn: Boolean(p.marketingOptIn),
          });
        }
      } catch (e) {
        if (alive) setError(e.message || "Unable to load profile.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  const handleSignOut = async () => {
    setSigningOut(true);
    try { await logoutUser(); } finally { navigate("/", { replace: true }); }
  };

  const addInterest = (val) => {
    const v = val.trim().toLowerCase();
    if (!v || form.travelInterests.includes(v)) return;
    setForm({ ...form, travelInterests: [...form.travelInterests, v] });
    setInterestInput("");
  };

  const removeInterest = (val) =>
    setForm({ ...form, travelInterests: form.travelInterests.filter((i) => i !== val) });

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true); setSaveMsg(""); setSaveErr("");
    const payload = {
      username: form.username || undefined,
      phoneNumber: form.phoneNumber || undefined,
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined,
      bio: form.bio || undefined,
      homeCity: form.homeCity || undefined,
      homeCountry: form.homeCountry || undefined,
      travelInterests: form.travelInterests,
      preferredTravelStyle: form.preferredTravelStyle || undefined,
      budgetMin: form.budgetMin === "" ? undefined : Number(form.budgetMin),
      budgetMax: form.budgetMax === "" ? undefined : Number(form.budgetMax),
      budgetCurrency: form.budgetCurrency || undefined,
      preferredLanguage: form.preferredLanguage || undefined,
      marketingOptIn: form.marketingOptIn,
    };
    try {
      await updateUserProfile(payload);
      setSaveMsg("Changes saved successfully.");
    } catch (err) {
      setSaveErr(err.message || "Unable to save changes.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 5000);
    }
  };

  const savePrefs = (e) => {
    e.preventDefault();
    setPrefSaving(true);
    try {
      localStorage.setItem(`tripzy_prefs_${user?.id}`, JSON.stringify({ prefs, toggles }));
      setPrefMsg("Preferences saved.");
    } finally {
      setPrefSaving(false);
      setTimeout(() => setPrefMsg(""), 4000);
    }
  };

  const handleImageUpload = (e) => {
    const f = e.target.files[0];
    if (f) setProfilePic(URL.createObjectURL(f));
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col font-sans">
      <UserNavbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">

        {loading ? (
          <div className="flex items-center justify-center py-28 bg-white rounded-xl shadow border border-slate-200 mt-6">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 text-red-600 rounded-xl border border-red-200 text-sm mt-6">{error}</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 items-start">

            {/* ── Left sidebar ── */}
            <aside className="w-full lg:w-64 flex-shrink-0 space-y-4">

              {/* Profile card */}
              <div className="bg-white rounded-xl shadow border border-slate-200 pt-6 pb-5 px-5 flex flex-col items-center text-center">
                <div className="relative group mb-3">
                  <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-slate-400">
                    {profilePic
                      ? <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                      : <User size={36} />}
                  </div>
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera size={20} className="text-white" />
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">{user?.name}</h2>
                <p className="text-xs text-slate-500 capitalize mt-0.5">{user?.email}</p>

                <div className="w-full mt-4 space-y-1 text-sm">
                  {[
                    { label: "Travel style", value: form.preferredTravelStyle || "—" },
                    { label: "Home city", value: form.homeCity || "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1.5 border-t border-slate-100">
                      <span className="text-slate-400 text-xs">{label}</span>
                      <span className="text-slate-700 font-semibold text-xs capitalize truncate max-w-[100px]">{value}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {signingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                  {signingOut ? "Signing out…" : "Log out"}
                </button>
              </div>
            </aside>

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0 space-y-0">

              {/* Horizontal tabs */}
              <div className="bg-white rounded-t-xl border border-slate-200 border-b-0 shadow-sm px-6 pt-4 flex gap-1 overflow-x-auto">
                {TABS.map(({ id, label, icon: Icon }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors rounded-t-lg ${active
                        ? "text-blue-700 bg-blue-50/60"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                        }`}
                    >
                      <Icon size={15} />
                      {label}
                      {active && (
                        <motion.div
                          layoutId="tabUnderline"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-t"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">

                {/* Account Settings */}
                {activeTab === "profile" && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="bg-white border border-slate-200 border-t-0 rounded-b-xl shadow-sm p-6 lg:p-8"
                  >
                    <AnimatePresence>
                      {saveMsg && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-medium">
                            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" /> {saveMsg}
                          </div>
                        </motion.div>
                      )}
                      {saveErr && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 font-medium">
                            <X size={16} className="text-red-500 flex-shrink-0" /> {saveErr}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <form onSubmit={saveProfile} className="space-y-7">

                      {/* Basic info — rendered from PROFILE_FIELDS config */}
                      <section className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                        {PROFILE_FIELDS.map((field) => {
                          if (field.type === "readonly") {
                            return (
                              <Field key={field.key} label={field.label}>
                                <input
                                  type="text"
                                  readOnly
                                  value={field.get(user)}
                                  className={`${inputCls} bg-slate-50 cursor-not-allowed text-slate-400`}
                                />
                              </Field>
                            );
                          }
                          if (field.type === "select") {
                            return (
                              <Field key={field.key} label={field.label}>
                                <select
                                  className={inputCls}
                                  value={form[field.key]}
                                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                                >
                                  {field.options().map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </Field>
                            );
                          }
                          // text / tel / date / email
                          return (
                            <Field key={field.key} label={field.label}>
                              <input
                                type={field.type}
                                className={inputCls}
                                value={form[field.key]}
                                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                              />
                            </Field>
                          );
                        })}
                      </section>

                      <hr className="border-slate-100" />

                      {/* Travel preferences section */}
                      <section className="space-y-5">
                        <h3 className="text-sm font-bold text-slate-800">Travel Preferences</h3>

                        <Field label="Travel Style">
                          <select className={inputCls} value={form.preferredTravelStyle} onChange={(e) => setForm({ ...form, preferredTravelStyle: e.target.value })}>
                            {TRAVEL_STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </Field>

                        <div>
                          <label className={labelCls}>Interests</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {form.travelInterests.map((interest) => (
                              <span key={interest} className="inline-flex items-center gap-1 pl-3 pr-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                {interest.charAt(0).toUpperCase() + interest.slice(1)}
                                <button type="button" onClick={() => removeInterest(interest)} className="text-blue-400 hover:text-red-500 ml-0.5">
                                  <X size={11} strokeWidth={3} />
                                </button>
                              </span>
                            ))}
                          </div>
                          <input
                            type="text"
                            placeholder="Type and press Enter to add..."
                            value={interestInput}
                            onChange={(e) => setInterestInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addInterest(interestInput); } }}
                            className={`${inputCls} max-w-sm`}
                          />
                          <div className="flex flex-wrap gap-2 mt-2.5">
                            {SUGGESTED_INTERESTS
                              .filter((i) => !form.travelInterests.includes(i.toLowerCase()))
                              .map((i) => (
                                <button key={i} type="button" onClick={() => addInterest(i)}
                                  className="px-2.5 py-1 rounded-full text-xs font-medium border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50 transition-colors">
                                  + {i}
                                </button>
                              ))
                            }
                          </div>
                        </div>

                        <Field label="Bio">
                          <textarea rows={3} placeholder="A short description about yourself…" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={`${inputCls} resize-none`} />
                        </Field>
                      </section>

                      <div className="flex justify-start pt-1">
                        <button type="submit" disabled={saving} className="flex items-center gap-2 px-7 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-60">
                          {saving && <Loader2 size={15} className="animate-spin" />}
                          {saving ? "Saving…" : "Update"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* Preferences */}
                {activeTab === "prefs" && (
                  <motion.div
                    key="prefs"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="bg-white border border-slate-200 border-t-0 rounded-b-xl shadow-sm p-6 lg:p-8"
                  >
                    <AnimatePresence>
                      {prefMsg && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-5 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 font-medium">
                            <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" /> {prefMsg}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <form onSubmit={savePrefs} className="space-y-7">

                      <section className="space-y-5">
                        <h3 className="text-sm font-bold text-slate-800">Regional Defaults</h3>
                        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                          <Field label="Display Currency">
                            <select className={inputCls} value={prefs.currency} onChange={(e) => setPrefs({ ...prefs, currency: e.target.value })}>
                              {CURRENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </Field>
                          <Field label="Time Zone">
                            <select className={inputCls} value={prefs.timeZone} onChange={(e) => setPrefs({ ...prefs, timeZone: e.target.value })}>
                              {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </Field>
                        </div>
                      </section>

                      <hr className="border-slate-100" />

                      <section className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-800">Privacy & Intelligence</h3>

                        {[
                          { key: "recommendations", title: "Personalised Recommendations", desc: "Receive tailored destination and activity suggestions based on your profile." },
                          { key: "dataCollection", title: "Diagnostic Data", desc: "Help us improve by sharing anonymous crash reports and usage statistics." },
                        ].map(({ key, title, desc }) => (
                          <div key={key} className="flex items-start justify-between gap-6 py-3 border-b border-slate-100 last:border-0">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 max-w-md">{desc}</p>
                            </div>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={toggles[key]}
                              onClick={() => setToggles({ ...toggles, [key]: !toggles[key] })}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${toggles[key] ? "bg-blue-700" : "bg-slate-200"}`}
                            >
                              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${toggles[key] ? "translate-x-5" : "translate-x-0"}`} />
                            </button>
                          </div>
                        ))}
                      </section>

                      <div className="flex justify-start pt-1">
                        <button type="submit" disabled={prefSaving} className="flex items-center gap-2 px-7 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-60">
                          {prefSaving && <Loader2 size={15} className="animate-spin" />}
                          {prefSaving ? "Saving…" : "Update"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* Login Activity */}
                {activeTab === "devices" && (
                  <motion.div
                    key="devices"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="bg-white border border-slate-200 border-t-0 rounded-b-xl shadow-sm p-6 lg:p-8"
                  >
                    <div className="space-y-3">
                      {devices.map((d) => (
                        <div key={d.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors bg-white">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                              {d.type === "laptop" ? <Laptop size={18} /> : <Smartphone size={18} />}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                {d.name}
                                {d.isCurrent && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase tracking-wide">This device</span>}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                                <span className="flex items-center gap-1"><MapPin size={11} /> {d.location}</span>
                                <span className="flex items-center gap-1"><Clock size={11} /> {d.time}</span>
                              </div>
                            </div>
                          </div>
                          {!d.isCurrent && (
                            <button className="text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto">
                              Log Out
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex gap-3 items-start p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <ShieldCheck size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Account Security</p>
                        <p className="text-xs text-slate-500 mt-0.5">If you spot an unfamiliar device, log it out immediately. They'll need to re-authenticate next time.</p>
                      </div>
                    </div>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
