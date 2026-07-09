import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, Search, Sun, Moon, Coffee, BellOff, Volume2, Shuffle, User, Users } from "lucide-react";
import grandma from "./assets/character-grandma.png";

const API_BASE = "https://haylinguav2.onrender.com";

const COUNTRY_OPTIONS = [
  "🇦🇲 Armenia","🇷🇺 Russia","🇺🇸 United States","🇫🇷 France","🇩🇪 Germany","🇬🇧 United Kingdom",
  "🇪🇸 Spain","🇮🇹 Italy","🇨🇦 Canada","🇦🇺 Australia","🇦🇫 Afghanistan","🇦🇽 Åland Islands",
  "🇦🇱 Albania","🇩🇿 Algeria","🇦🇸 American Samoa","🇦🇩 Andorra","🇦🇴 Angola","🇦🇮 Anguilla",
  "🇦🇶 Antarctica","🇦🇬 Antigua and Barbuda","🇦🇷 Argentina","🇦🇼 Aruba","🇦🇹 Austria",
  "🇦🇿 Azerbaijan","🇧🇸 Bahamas","🇧🇭 Bahrain","🇧🇩 Bangladesh","🇧🇧 Barbados","🇧🇾 Belarus",
  "🇧🇪 Belgium","🇧🇿 Belize","🇧🇯 Benin","🇧🇲 Bermuda","🇧🇹 Bhutan","🇧🇴 Bolivia",
  "🇧🇦 Bosnia and Herzegovina","🇧🇼 Botswana","🇧🇷 Brazil","🇻🇬 British Virgin Islands",
  "🇧🇳 Brunei","🇧🇬 Bulgaria","🇧🇫 Burkina Faso","🇧🇮 Burundi","🇰🇭 Cambodia","🇨🇲 Cameroon",
  "🇨🇻 Cape Verde","🇰🇾 Cayman Islands","🇨🇫 Central African Republic","🇹🇩 Chad","🇨🇱 Chile",
  "🇨🇳 China","🇨🇴 Colombia","🇰🇲 Comoros","🇨🇬 Congo - Brazzaville","🇨🇩 Congo - Kinshasa",
  "🇨🇰 Cook Islands","🇨🇷 Costa Rica","🇨🇮 Côte d'Ivoire","🇭🇷 Croatia","🇨🇺 Cuba","🇨🇼 Curaçao",
  "🇨🇾 Cyprus","🇨🇿 Czechia","🇩🇰 Denmark","🇩🇯 Djibouti","🇩🇲 Dominica","🇩🇴 Dominican Republic",
  "🇪🇨 Ecuador","🇪🇬 Egypt","🇸🇻 El Salvador","🇬🇶 Equatorial Guinea","🇪🇷 Eritrea","🇪🇪 Estonia",
  "🇸🇿 Eswatini","🇪🇹 Ethiopia","🇫🇯 Fiji","🇫🇮 Finland","🇬🇫 French Guiana","🇵🇫 French Polynesia",
  "🇬🇦 Gabon","🇬🇲 Gambia","🇬🇪 Georgia","🇬🇭 Ghana","🇬🇮 Gibraltar","🇬🇷 Greece","🇬🇱 Greenland",
  "🇬🇩 Grenada","🇬🇵 Guadeloupe","🇬🇺 Guam","🇬🇹 Guatemala","🇬🇬 Guernsey","🇬🇳 Guinea",
  "🇬🇼 Guinea-Bissau","🇬🇾 Guyana","🇭🇹 Haiti","🇭🇳 Honduras","🇭🇰 Hong Kong","🇭🇺 Hungary",
  "🇮🇸 Iceland","🇮🇳 India","🇮🇩 Indonesia","🇮🇷 Iran","🇮🇶 Iraq","🇮🇪 Ireland","🇮🇲 Isle of Man",
  "🇮🇱 Israel","🇯🇲 Jamaica","🇯🇵 Japan","🇯🇪 Jersey","🇯🇴 Jordan","🇰🇿 Kazakhstan","🇰🇪 Kenya",
  "🇰🇮 Kiribati","🇰🇼 Kuwait","🇰🇬 Kyrgyzstan","🇱🇦 Laos","🇱🇻 Latvia","🇱🇧 Lebanon","🇱🇸 Lesotho",
  "🇱🇷 Liberia","🇱🇾 Libya","🇱🇮 Liechtenstein","🇱🇹 Lithuania","🇱🇺 Luxembourg","🇲🇴 Macao",
  "🇲🇬 Madagascar","🇲🇼 Malawi","🇲🇾 Malaysia","🇲🇻 Maldives","🇲🇱 Mali","🇲🇹 Malta",
  "🇲🇭 Marshall Islands","🇲🇶 Martinique","🇲🇷 Mauritania","🇲🇺 Mauritius","🇾🇹 Mayotte","🇲🇽 Mexico",
  "🇫🇲 Micronesia","🇲🇩 Moldova","🇲🇨 Monaco","🇲🇳 Mongolia","🇲🇪 Montenegro","🇲🇸 Montserrat",
  "🇲🇦 Morocco","🇲🇿 Mozambique","🇲🇲 Myanmar","🇳🇦 Namibia","🇳🇷 Nauru","🇳🇵 Nepal",
  "🇳🇱 Netherlands","🇳🇨 New Caledonia","🇳🇿 New Zealand","🇳🇮 Nicaragua","🇳🇪 Niger","🇳🇬 Nigeria",
  "🇰🇵 North Korea","🇲🇰 North Macedonia","🇳🇴 Norway","🇴🇲 Oman","🇵🇰 Pakistan","🇵🇼 Palau",
  "🇵🇸 Palestine","🇵🇦 Panama","🇵🇬 Papua New Guinea","🇵🇾 Paraguay","🇵🇪 Peru","🇵🇭 Philippines",
  "🇵🇱 Poland","🇵🇹 Portugal","🇵🇷 Puerto Rico","🇶🇦 Qatar","🇷🇪 Réunion","🇷🇴 Romania","🇷🇼 Rwanda",
  "🇼🇸 Samoa","🇸🇲 San Marino","🇸🇦 Saudi Arabia","🇸🇳 Senegal","🇷🇸 Serbia","🇸🇨 Seychelles",
  "🇸🇱 Sierra Leone","🇸🇬 Singapore","🇸🇰 Slovakia","🇸🇮 Slovenia","🇸🇧 Solomon Islands","🇸🇴 Somalia",
  "🇿🇦 South Africa","🇰🇷 South Korea","🇸🇸 South Sudan","🇱🇰 Sri Lanka","🇸🇩 Sudan","🇸🇷 Suriname",
  "🇸🇪 Sweden","🇨🇭 Switzerland","🇸🇾 Syria","🇹🇼 Taiwan","🇹🇯 Tajikistan","🇹🇿 Tanzania",
  "🇹🇭 Thailand","🇹🇱 Timor-Leste","🇹🇬 Togo","🇹🇴 Tonga","🇹🇹 Trinidad and Tobago","🇹🇳 Tunisia",
  "🇹🇷 Turkey","🇹🇲 Turkmenistan","🇹🇻 Tuvalu","🇺🇬 Uganda","🇺🇦 Ukraine","🇦🇪 United Arab Emirates",
  "🇺🇾 Uruguay","🇺🇿 Uzbekistan","🇻🇺 Vanuatu","🇻🇦 Vatican City","🇻🇪 Venezuela","🇻🇳 Vietnam",
  "🇾🇪 Yemen","🇿🇲 Zambia","🇿🇼 Zimbabwe","Other",
];

function splitCountry(opt) {
  if (!opt || opt === "Other") return { flag: "🌐", name: opt || "" };
  const firstChar = opt.codePointAt(0);
  const isRegionalIndicator = firstChar >= 0x1f1e6 && firstChar <= 0x1f1ff;
  if (isRegionalIndicator) return { flag: opt.slice(0, 4), name: opt.slice(5) };
  const match = COUNTRY_OPTIONS.find((c) => c !== "Other" && c.slice(5) === opt);
  if (match) return { flag: match.slice(0, 4), name: opt };
  return { flag: "🌐", name: opt };
}

// Large selectable card
function OptionCard({ active, onClick, icon, label, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group relative flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-all w-full ring-2 " +
        (active
          ? "bg-brand-500 ring-brand-500 shadow-[0_4px_0_0_#c2430a] text-white"
          : "bg-white ring-slate-200 hover:ring-brand-300 hover:bg-brand-50/40 text-slate-800")
      }
    >
      {icon ? (
        <span className={
          "text-xl leading-none shrink-0 grid place-items-center w-9 h-9 rounded-xl " +
          (active ? "bg-white/20" : "bg-slate-100 group-hover:bg-brand-100/60")
        }>{icon}</span>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className={"font-display font-extrabold text-sm leading-tight " + (active ? "text-white" : "text-slate-900")}>{label}</div>
        {sub ? <div className={"text-xs mt-0.5 " + (active ? "text-brand-100" : "text-slate-500")}>{sub}</div> : null}
      </div>
      {active ? <Check className="h-4 w-4 shrink-0 text-white" /> : null}
    </button>
  );
}

function SectionLabel({ title, subtitle }) {
  return (
    <div className="mb-4">
      <div className="font-display text-base font-extrabold text-slate-900">{title}</div>
      {subtitle ? <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div> : null}
    </div>
  );
}

function CountryPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  const { flag, name } = splitCountry(value);

  return (
    <div ref={wrapRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "w-full flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 font-semibold text-slate-800 ring-2 transition-all text-left shadow-sm " +
          (open ? "ring-brand-400" : "ring-slate-200 hover:ring-brand-300")
        }
      >
        <span className="text-2xl leading-none w-8 text-center shrink-0">{flag}</span>
        <span className="flex-1 truncate text-sm">{name || "Select country"}</span>
        <ChevronDown className={"h-4 w-4 text-slate-400 transition-transform shrink-0 " + (open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-full rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200 overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200 focus-within:ring-brand-400 focus-within:bg-white transition-all">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries…"
                className="flex-1 bg-transparent text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                  if (e.key === "Enter" && filtered.length === 1) { onChange(filtered[0]); setOpen(false); }
                }}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-400 text-center">No countries found</div>
            ) : (
              filtered.map((c) => {
                const { flag: f, name: n } = splitCountry(c);
                const selected = c === value;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { onChange(c); setOpen(false); }}
                    className={
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-semibold text-left transition-colors " +
                      (selected ? "bg-brand-50 text-brand-700" : "text-slate-800 hover:bg-slate-50")
                    }
                  >
                    <span className="text-xl leading-none w-7 text-center shrink-0">{f}</span>
                    <span className="flex-1">{n}</span>
                    {selected && <Check className="h-4 w-4 text-brand-500 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const STEP_META = [
  { emoji: "👤", label: "About you" },
  { emoji: "📚", label: "Curriculum" },
  { emoji: "🎯", label: "Daily plan" },
  { emoji: "✅", label: "Confirm" },
];

const GOAL_OPTIONS = [
  { min: 5,  label: "5 min",  sub: "Casual" },
  { min: 10, label: "10 min", sub: "Regular" },
  { min: 15, label: "15 min", sub: "Committed" },
  { min: 20, label: "20 min", sub: "Serious" },
  { min: 30, label: "30 min", sub: "Intensive" },
  { min: 45, label: "45 min", sub: "Hardcore" },
  { min: 60, label: "60 min", sub: "Mastery" },
];

export default function Onboarding({ token, onCompleted }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [country, setCountry] = useState("🇦🇲 Armenia");
  const [planningVisit, setPlanningVisit] = useState(null);

  const [knowledgeLevel, setKnowledgeLevel] = useState("");
  const [dialect, setDialect] = useState("Eastern");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [sourceLanguage] = useState("English");

  const [dailyGoalMin, setDailyGoalMin] = useState(10);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [voiceRandom, setVoiceRandom] = useState(false);
  const [voiceMale, setVoiceMale] = useState(false);
  const [voiceFemale, setVoiceFemale] = useState(false);

  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const totalSteps = 4;
  const showPlanningVisit = (country || "").trim() !== "" && country !== "Armenia";

  const computedVoicePref = useMemo(() => {
    if (voiceRandom) return "Random";
    if (voiceMale && voiceFemale) return "Random";
    if (voiceMale) return "Male";
    if (voiceFemale) return "Female";
    return "";
  }, [voiceRandom, voiceMale, voiceFemale]);

  useEffect(() => {
    const run = async () => {
      if (!token) { navigate("/", { replace: true }); return; }
      try {
        const res = await fetch(`${API_BASE}/me/onboarding`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.completed) { onCompleted?.(data); navigate("/dashboard", { replace: true }); return; }
        if (res.ok && data?.data) {
          const d = data.data;
          if (d.age_range) setAgeRange(d.age_range);
          if (d.country) setCountry(d.country);
          if (typeof d.planning_visit_armenia === "boolean") setPlanningVisit(d.planning_visit_armenia);
          if (d.knowledge_level) setKnowledgeLevel(d.knowledge_level);
          if (d.dialect) setDialect(d.dialect);
          if (d.primary_goal) setPrimaryGoal(d.primary_goal);
          if (typeof d.daily_goal_min === "number") setDailyGoalMin(d.daily_goal_min);
          if (d.reminder_time) { setReminderTime(d.reminder_time); setRemindersEnabled(true); }
          if (d.voice_pref) {
            const v = String(d.voice_pref);
            if (v === "Random" || v === "Both") { setVoiceRandom(true); setVoiceMale(true); setVoiceFemale(true); }
            else if (v === "Male") { setVoiceRandom(false); setVoiceMale(true); setVoiceFemale(false); }
            else if (v === "Female") { setVoiceRandom(false); setVoiceMale(false); setVoiceFemale(true); }
          }
          if (typeof d.marketing_opt_in === "boolean") setMarketingOptIn(d.marketing_opt_in);
          if (typeof d.accepted_terms === "boolean") setAcceptedTerms(d.accepted_terms);
        }
      } catch {}
      finally { setLoading(false); }
    };
    run();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const canNext = () => {
    setError("");
    if (step === 1) {
      if (!displayName.trim()) return "Please enter your name.";
      if (!ageRange) return "Please select your age range.";
      if (!country) return "Please select your country.";
      if (showPlanningVisit && planningVisit === null) return "Please tell us if you're planning to visit Armenia.";
      return "";
    }
    if (step === 2) {
      if (!knowledgeLevel) return "Please select your current level.";
      if (!dialect) return "Please select a dialect.";
      if (!primaryGoal) return "Please select your main goal.";
      return "";
    }
    if (step === 3) {
      if (!computedVoicePref) return "Please select at least one voice preference.";
      return "";
    }
    if (step === 4) {
      if (!acceptedTerms) return "You must accept Terms & Conditions.";
      return "";
    }
    return "";
  };

  const next = () => { const msg = canNext(); if (msg) { setError(msg); return; } setStep((s) => Math.min(totalSteps, s + 1)); };
  const back = () => { setError(""); setStep((s) => Math.max(1, s - 1)); };

  const submit = async () => {
    const msg = canNext();
    if (msg) { setError(msg); return; }
    setSaving(true); setError("");
    try {
      const payload = {
        name: displayName.trim(),
        age_range: ageRange, country,
        planning_visit_armenia: showPlanningVisit ? Boolean(planningVisit) : null,
        knowledge_level: knowledgeLevel, dialect, primary_goal: primaryGoal,
        source_language: sourceLanguage, daily_goal_min: Number(dailyGoalMin),
        reminder_time: remindersEnabled ? reminderTime : null,
        voice_pref: computedVoicePref, marketing_opt_in: Boolean(marketingOptIn),
        accepted_terms: Boolean(acceptedTerms),
      };
      const res = await fetch(`${API_BASE}/me/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail || "Could not save onboarding";
        setError(typeof detail === "string" ? detail : JSON.stringify(detail));
        setSaving(false); return;
      }
      try { localStorage.setItem("hay_voice_pref", computedVoicePref || "Random"); } catch {}
      onCompleted?.(data);
      navigate("/dashboard", { replace: true });
    } catch { setError("Network error. Please try again."); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50/50 to-white">
        <div className="font-semibold text-slate-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/60 via-white to-feather-50/40 flex flex-col items-center justify-start py-8 px-4">
      {/* Logo mark */}
      <div className="mb-6 flex items-center gap-2.5">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-brand-500 text-white shadow-[0_4px_0_0_#c2430a]">
          <span className="font-display text-xl font-extrabold leading-none">Հ</span>
        </div>
        <span className="font-display text-lg font-extrabold text-slate-900">Haylingua</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_META.map((m, i) => {
          const idx = i + 1;
          const done = step > idx;
          const active = step === idx;
          return (
            <React.Fragment key={idx}>
              <div className={
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all text-xs font-bold " +
                (active ? "bg-brand-500 text-white shadow-sm" :
                  done ? "bg-grass-100 text-grass-700" :
                    "bg-slate-100 text-slate-400")
              }>
                {done ? <Check className="h-3 w-3" /> : <span>{m.emoji}</span>}
                <span className="hidden sm:inline">{m.label}</span>
                {!done && !active && <span className="sm:hidden">{idx}</span>}
              </div>
              {idx < totalSteps && (
                <div className={"h-0.5 w-6 rounded-full transition-all " + (done ? "bg-grass-400" : "bg-slate-200")} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Card */}
      <div className="w-full max-w-lg">
        <div className="rounded-3xl bg-white shadow-xl ring-1 ring-slate-200/80 overflow-hidden">
          {/* Card header */}
          <div className="px-6 pt-6 pb-5 border-b border-slate-100">
            <div className="text-2xl mb-1">{STEP_META[step - 1].emoji}</div>
            <h1 className="font-display text-xl font-extrabold text-slate-900 leading-snug">
              {step === 1 && "Let's personalize your path"}
              {step === 2 && "Curriculum calibration"}
              {step === 3 && "Set your daily plan"}
              {step === 4 && "Almost done"}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {step === 1 && "A few quick questions so we start you at the right level."}
              {step === 2 && "Pick your level, dialect, and what you're learning for."}
              {step === 3 && "Set a realistic goal — consistency beats intensity every time."}
              {step === 4 && "Review your setup and confirm to start learning."}
            </p>
          </div>

          {/* Card body */}
          <div className="p-6 space-y-7">
            {error && (
              <div className="rounded-2xl bg-cardinal-50 ring-1 ring-cardinal-200 px-4 py-3 text-sm font-semibold text-cardinal-700">
                {error}
              </div>
            )}

            {/* ── STEP 1 ── */}
            {step === 1 && (
              <>
                <div>
                  <SectionLabel title="What's your name?" subtitle="This is how we'll address you throughout the app." />
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Armen"
                      autoComplete="given-name"
                      maxLength={50}
                      className="w-full rounded-2xl bg-slate-50 py-3 pl-10 pr-4 font-semibold text-slate-800 ring-2 ring-slate-200 transition focus:bg-white focus:outline-none focus:ring-brand-400 placeholder:text-slate-400 placeholder:font-normal"
                    />
                  </div>
                </div>

                <div>
                  <SectionLabel title="How old are you?" subtitle="We use this to tailor pacing and tone." />
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: "Under 13", e: "🧒" },
                      { v: "13–17", e: "🎒" },
                      { v: "18–24", e: "🎓" },
                      { v: "25–34", e: "💼" },
                      { v: "35–44", e: "🏡" },
                      { v: "45+", e: "🌿" },
                    ].map(({ v, e }) => (
                      <OptionCard key={v} active={ageRange === v} onClick={() => setAgeRange(v)} icon={e} label={v} />
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel title="Where are you located?" subtitle="Helps us optimize content and examples." />
                  <CountryPicker value={country} onChange={(c) => { setCountry(c); setPlanningVisit(null); }} />
                </div>

                {showPlanningVisit && (
                  <div>
                    <SectionLabel title="Planning to visit Armenia soon?" subtitle="If yes, we'll prioritize travel phrases earlier." />
                    <div className="grid grid-cols-2 gap-3">
                      <OptionCard active={planningVisit === true} onClick={() => setPlanningVisit(true)} icon="✈️" label="Yes, planning a trip" />
                      <OptionCard active={planningVisit === false} onClick={() => setPlanningVisit(false)} icon="🏠" label="Not right now" />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <>
                <div>
                  <SectionLabel title="Your current level" subtitle="We don't want to start you too easy or too hard." />
                  <div className="space-y-2">
                    {[
                      { k: "Total Beginner", e: "🌱", sub: "Don't know the alphabet yet" },
                      { k: "False Beginner", e: "🌿", sub: "Know a few words or letters" },
                      { k: "Intermediate", e: "🌳", sub: "Can hold basic conversations" },
                      { k: "Advanced", e: "🏆", sub: "Strong grammar, wide vocabulary" },
                    ].map(({ k, e, sub }) => (
                      <OptionCard key={k} active={knowledgeLevel === k} onClick={() => setKnowledgeLevel(k)} icon={e} label={k} sub={sub} />
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel title="Which dialect?" subtitle="Eastern is official in Armenia; Western is diaspora Armenian." />
                  <div className="grid grid-cols-2 gap-3">
                    <OptionCard active={dialect === "Eastern"} onClick={() => setDialect("Eastern")} icon="🇦🇲" label="Eastern Armenian" sub="Spoken in Armenia" />
                    <OptionCard active={dialect === "Western"} onClick={() => setDialect("Western")} icon="🌍" label="Western Armenian" sub="Diaspora Armenian" />
                  </div>
                </div>

                <div>
                  <SectionLabel title="Why are you learning?" subtitle="We'll prioritize vocabulary that matters to you." />
                  <div className="space-y-2">
                    {[
                      { v: "Connecting with heritage/family", e: "🫂", sub: "Heritage & identity" },
                      { v: "Planning a trip to Armenia", e: "✈️", sub: "Travel & tourism" },
                      { v: "Business/Work", e: "💼", sub: "Professional use" },
                      { v: "Partner/Spouse", e: "💛", sub: "For a loved one" },
                      { v: "Just for fun/Brain training", e: "🧠", sub: "Curiosity & enjoyment" },
                    ].map(({ v, e, sub }) => (
                      <OptionCard key={v} active={primaryGoal === v} onClick={() => setPrimaryGoal(v)} icon={e} label={v} sub={sub} />
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <>
                <div>
                  <SectionLabel title="Daily goal" subtitle="Pick a target you can actually keep — small habits beat big bursts." />
                  <div className="grid grid-cols-4 gap-2">
                    {GOAL_OPTIONS.map(({ min, label, sub }) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setDailyGoalMin(min)}
                        className={
                          "flex flex-col items-center justify-center rounded-2xl py-3 px-2 transition-all ring-2 font-display font-extrabold " +
                          (dailyGoalMin === min
                            ? "bg-brand-500 ring-brand-500 shadow-[0_4px_0_0_#c2430a] text-white"
                            : "bg-white ring-slate-200 hover:ring-brand-300 text-slate-800")
                        }
                      >
                        <span className="text-base leading-none">{label}</span>
                        <span className={"text-[10px] mt-1 font-semibold " + (dailyGoalMin === min ? "text-brand-100" : "text-slate-400")}>{sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <SectionLabel title="Study reminder" subtitle="A daily nudge is the single biggest retention lever." />
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { t: "Morning", sub: "08:00", v: "08:00", Icon: Sun },
                      { t: "Lunch", sub: "13:00", v: "13:00", Icon: Coffee },
                      { t: "Evening", sub: "20:00", v: "20:00", Icon: Moon },
                      { t: "No reminder", sub: "I'll open the app myself", v: null, Icon: BellOff },
                    ].map(({ t, sub, v, Icon }) => {
                      const active = v === null ? !remindersEnabled : (remindersEnabled && reminderTime === v);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            if (v === null) { setRemindersEnabled(false); }
                            else { setReminderTime(v); setRemindersEnabled(true); }
                          }}
                          className={
                            "flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all ring-2 " +
                            (active
                              ? "bg-brand-500 ring-brand-500 shadow-[0_3px_0_0_#c2430a] text-white"
                              : "bg-white ring-slate-200 hover:ring-brand-300 text-slate-800")
                          }
                        >
                          <Icon className={"h-4 w-4 shrink-0 " + (active ? "text-white" : "text-slate-400")} />
                          <div>
                            <div className={"font-display font-extrabold text-sm " + (active ? "text-white" : "text-slate-900")}>{t}</div>
                            <div className={"text-xs " + (active ? "text-brand-100" : "text-slate-400")}>{sub}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <SectionLabel title="Voice preference" subtitle="Hearing multiple voices improves comprehension." />
                  <div className="space-y-2">
                    {[
                      { key: "male", Icon: User, label: "Male voice", sub: "Clear pronunciation & lower pitch",
                        active: !voiceRandom && voiceMale && !voiceFemale,
                        onSelect: () => { setVoiceRandom(false); setVoiceMale(true); setVoiceFemale(false); } },
                      { key: "female", Icon: User, label: "Female voice", sub: "Natural pitch variation & clarity",
                        active: !voiceRandom && voiceFemale && !voiceMale,
                        onSelect: () => { setVoiceRandom(false); setVoiceMale(false); setVoiceFemale(true); } },
                      { key: "random", Icon: Shuffle, label: "Mix both voices", sub: "Best for real-world listening variety",
                        active: voiceRandom || (voiceMale && voiceFemale),
                        onSelect: () => { setVoiceRandom(true); setVoiceMale(true); setVoiceFemale(true); } },
                    ].map(({ key, Icon, label, sub, active, onSelect }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={onSelect}
                        className={
                          "w-full flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition-all ring-2 " +
                          (active
                            ? "bg-brand-500 ring-brand-500 shadow-[0_3px_0_0_#c2430a] text-white"
                            : "bg-white ring-slate-200 hover:ring-brand-300 text-slate-800")
                        }
                      >
                        <span className={"grid place-items-center w-9 h-9 rounded-xl shrink-0 " + (active ? "bg-white/20" : "bg-slate-100")}>
                          <Icon className={"h-4 w-4 " + (active ? "text-white" : "text-slate-500")} />
                        </span>
                        <div className="flex-1">
                          <div className={"font-display font-extrabold text-sm " + (active ? "text-white" : "text-slate-900")}>{label}</div>
                          <div className={"text-xs " + (active ? "text-brand-100" : "text-slate-500")}>{sub}</div>
                        </div>
                        {active && <Check className="h-4 w-4 shrink-0 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 4 ── */}
            {step === 4 && (
              <>
                {/* Summary card */}
                <div className="rounded-2xl bg-brand-50 ring-1 ring-brand-200 p-5">
                  <div className="flex items-start gap-4">
                    <img src={grandma} alt="" className="hidden sm:block w-16 h-16 object-contain shrink-0 drop-shadow-sm" />
                    <div className="flex-1">
                      <div className="font-display text-base font-extrabold text-slate-900 mb-3">Your plan</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        {[
                          ["Level", knowledgeLevel || "—"],
                          ["Dialect", dialect],
                          ["Goal", primaryGoal || "—"],
                          ["Daily", `${dailyGoalMin} min`],
                          ["Voice", computedVoicePref],
                          ["Reminder", remindersEnabled ? reminderTime : "Off"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex flex-col">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{k}</span>
                            <span className="font-semibold text-slate-900 text-sm leading-snug">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3">
                  {[
                    { id: "mkt", checked: marketingOptIn, onChange: setMarketingOptIn,
                      label: "Send me learning tips and product updates", sub: "You can unsubscribe anytime." },
                    { id: "terms", checked: acceptedTerms, onChange: setAcceptedTerms,
                      label: "I accept the Terms & Conditions", sub: "Required to start learning." },
                  ].map(({ id, checked, onChange, label, sub }) => (
                    <label key={id} className={
                      "flex items-start gap-3 rounded-2xl p-4 cursor-pointer transition-all ring-2 " +
                      (checked ? "bg-brand-50 ring-brand-300" : "bg-white ring-slate-200 hover:ring-brand-200")
                    }>
                      <div className={
                        "mt-0.5 h-5 w-5 shrink-0 rounded-lg grid place-items-center transition-all " +
                        (checked ? "bg-brand-500" : "bg-slate-100 ring-1 ring-slate-300")
                      }>
                        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </div>
                      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 p-4">
                  <div className="font-display text-sm font-bold text-slate-900 mb-1">Why we ask these questions</div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Haylingua calibrates your starting point and vocabulary priorities. A diaspora Armenian who already speaks the language shouldn't grind the alphabet — and a total beginner shouldn't be overwhelmed.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer nav */}
          <div className="px-6 pb-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={back}
              disabled={step === 1 || saving}
              className={
                "rounded-2xl bg-slate-100 px-5 py-2.5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-200 " +
                (step === 1 || saving ? "opacity-40 cursor-not-allowed" : "")
              }
            >
              Back
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div key={i} className={"h-1.5 rounded-full transition-all " + (i + 1 === step ? "w-6 bg-brand-500" : i + 1 < step ? "w-3 bg-grass-400" : "w-3 bg-slate-200")} />
              ))}
            </div>

            {step < totalSteps ? (
              <button type="button" onClick={next} disabled={saving} className="btn3d btn3d-brand text-sm uppercase tracking-wide">
                Continue →
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={saving} className={"btn3d btn3d-brand text-sm uppercase tracking-wide " + (saving ? "opacity-70" : "")}>
                {saving ? "Saving…" : "Start learning →"}
              </button>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">You can change all preferences later in your profile.</p>
      </div>
    </div>
  );
}
