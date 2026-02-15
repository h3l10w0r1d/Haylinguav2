import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = "https://haylinguav2.onrender.com";

const COUNTRY_OPTIONS = [
  "🇦🇲 Armenia",
  "🇷🇺 Russia",
  "🇺🇸 United States",
  "🇫🇷 France",
  "🇩🇪 Germany",
  "🇬🇧 United Kingdom",
  "🇪🇸 Spain",
  "🇮🇹 Italy",
  "🇨🇦 Canada",
  "🇦🇺 Australia",
  "🇦🇫 Afghanistan",
  "🇦🇽 Åland Islands",
  "🇦🇱 Albania",
  "🇩🇿 Algeria",
  "🇦🇸 American Samoa",
  "🇦🇩 Andorra",
  "🇦🇴 Angola",
  "🇦🇮 Anguilla",
  "🇦🇶 Antarctica",
  "🇦🇬 Antigua and Barbuda",
  "🇦🇷 Argentina",
  "🇦🇼 Aruba",
  "🇦🇹 Austria",
  "🇦🇿 Azerbaijan",
  "🇧🇸 Bahamas",
  "🇧🇭 Bahrain",
  "🇧🇩 Bangladesh",
  "🇧🇧 Barbados",
  "🇧🇾 Belarus",
  "🇧🇪 Belgium",
  "🇧🇿 Belize",
  "🇧🇯 Benin",
  "🇧🇲 Bermuda",
  "🇧🇹 Bhutan",
  "🇧🇴 Bolivia",
  "🇧🇦 Bosnia and Herzegovina",
  "🇧🇼 Botswana",
  "🇧🇷 Brazil",
  "🇻🇬 British Virgin Islands",
  "🇧🇳 Brunei",
  "🇧🇬 Bulgaria",
  "🇧🇫 Burkina Faso",
  "🇧🇮 Burundi",
  "🇰🇭 Cambodia",
  "🇨🇲 Cameroon",
  "🇨🇻 Cape Verde",
  "🇰🇾 Cayman Islands",
  "🇨🇫 Central African Republic",
  "🇹🇩 Chad",
  "🇨🇱 Chile",
  "🇨🇳 China",
  "🇨🇴 Colombia",
  "🇰🇲 Comoros",
  "🇨🇬 Congo - Brazzaville",
  "🇨🇩 Congo - Kinshasa",
  "🇨🇰 Cook Islands",
  "🇨🇷 Costa Rica",
  "🇨🇮 Côte d’Ivoire",
  "🇭🇷 Croatia",
  "🇨🇺 Cuba",
  "🇨🇼 Curaçao",
  "🇨🇾 Cyprus",
  "🇨🇿 Czechia",
  "🇩🇰 Denmark",
  "🇩🇯 Djibouti",
  "🇩🇲 Dominica",
  "🇩🇴 Dominican Republic",
  "🇪🇨 Ecuador",
  "🇪🇬 Egypt",
  "🇸🇻 El Salvador",
  "🇬🇶 Equatorial Guinea",
  "🇪🇷 Eritrea",
  "🇪🇪 Estonia",
  "🇸🇿 Eswatini",
  "🇪🇹 Ethiopia",
  "🇫🇯 Fiji",
  "🇫🇮 Finland",
  "🇬🇫 French Guiana",
  "🇵🇫 French Polynesia",
  "🇬🇦 Gabon",
  "🇬🇲 Gambia",
  "🇬🇪 Georgia",
  "🇬🇭 Ghana",
  "🇬🇮 Gibraltar",
  "🇬🇷 Greece",
  "🇬🇱 Greenland",
  "🇬🇩 Grenada",
  "🇬🇵 Guadeloupe",
  "🇬🇺 Guam",
  "🇬🇹 Guatemala",
  "🇬🇬 Guernsey",
  "🇬🇳 Guinea",
  "🇬🇼 Guinea-Bissau",
  "🇬🇾 Guyana",
  "🇭🇹 Haiti",
  "🇭🇳 Honduras",
  "🇭🇰 Hong Kong",
  "🇭🇺 Hungary",
  "🇮🇸 Iceland",
  "🇮🇳 India",
  "🇮🇩 Indonesia",
  "🇮🇷 Iran",
  "🇮🇶 Iraq",
  "🇮🇪 Ireland",
  "🇮🇲 Isle of Man",
  "🇮🇱 Israel",
  "🇯🇲 Jamaica",
  "🇯🇵 Japan",
  "🇯🇪 Jersey",
  "🇯🇴 Jordan",
  "🇰🇿 Kazakhstan",
  "🇰🇪 Kenya",
  "🇰🇮 Kiribati",
  "🇰🇼 Kuwait",
  "🇰🇬 Kyrgyzstan",
  "🇱🇦 Laos",
  "🇱🇻 Latvia",
  "🇱🇧 Lebanon",
  "🇱🇸 Lesotho",
  "🇱🇷 Liberia",
  "🇱🇾 Libya",
  "🇱🇮 Liechtenstein",
  "🇱🇹 Lithuania",
  "🇱🇺 Luxembourg",
  "🇲🇴 Macao",
  "🇲🇬 Madagascar",
  "🇲🇼 Malawi",
  "🇲🇾 Malaysia",
  "🇲🇻 Maldives",
  "🇲🇱 Mali",
  "🇲🇹 Malta",
  "🇲🇭 Marshall Islands",
  "🇲🇶 Martinique",
  "🇲🇷 Mauritania",
  "🇲🇺 Mauritius",
  "🇾🇹 Mayotte",
  "🇲🇽 Mexico",
  "🇫🇲 Micronesia",
  "🇲🇩 Moldova",
  "🇲🇨 Monaco",
  "🇲🇳 Mongolia",
  "🇲🇪 Montenegro",
  "🇲🇸 Montserrat",
  "🇲🇦 Morocco",
  "🇲🇿 Mozambique",
  "🇲🇲 Myanmar",
  "🇳🇦 Namibia",
  "🇳🇷 Nauru",
  "🇳🇵 Nepal",
  "🇳🇱 Netherlands",
  "🇳🇨 New Caledonia",
  "🇳🇿 New Zealand",
  "🇳🇮 Nicaragua",
  "🇳🇪 Niger",
  "🇳🇬 Nigeria",
  "🇰🇵 North Korea",
  "🇲🇰 North Macedonia",
  "🇳🇴 Norway",
  "🇴🇲 Oman",
  "🇵🇰 Pakistan",
  "🇵🇼 Palau",
  "🇵🇸 Palestine",
  "🇵🇦 Panama",
  "🇵🇬 Papua New Guinea",
  "🇵🇾 Paraguay",
  "🇵🇪 Peru",
  "🇵🇭 Philippines",
  "🇵🇱 Poland",
  "🇵🇹 Portugal",
  "🇵🇷 Puerto Rico",
  "🇶🇦 Qatar",
  "🇷🇪 Réunion",
  "🇷🇴 Romania",
  "🇷🇼 Rwanda",
  "🇼🇸 Samoa",
  "🇸🇲 San Marino",
  "🇸🇦 Saudi Arabia",
  "🇸🇳 Senegal",
  "🇷🇸 Serbia",
  "🇸🇨 Seychelles",
  "🇸🇱 Sierra Leone",
  "🇸🇬 Singapore",
  "🇸🇰 Slovakia",
  "🇸🇮 Slovenia",
  "🇸🇧 Solomon Islands",
  "🇸🇴 Somalia",
  "🇿🇦 South Africa",
  "🇰🇷 South Korea",
  "🇸🇸 South Sudan",
  "🇱🇰 Sri Lanka",
  "🇸🇩 Sudan",
  "🇸🇷 Suriname",
  "🇸🇪 Sweden",
  "🇨🇭 Switzerland",
  "🇸🇾 Syria",
  "🇹🇼 Taiwan",
  "🇹🇯 Tajikistan",
  "🇹🇿 Tanzania",
  "🇹🇭 Thailand",
  "🇹🇱 Timor-Leste",
  "🇹🇬 Togo",
  "🇹🇴 Tonga",
  "🇹🇹 Trinidad and Tobago",
  "🇹🇳 Tunisia",
  "🇹🇷 Turkey",
  "🇹🇲 Turkmenistan",
  "🇹🇻 Tuvalu",
  "🇺🇬 Uganda",
  "🇺🇦 Ukraine",
  "🇦🇪 United Arab Emirates",
  "🇺🇾 Uruguay",
  "🇺🇿 Uzbekistan",
  "🇻🇺 Vanuatu",
  "🇻🇦 Vatican City",
  "🇻🇪 Venezuela",
  "🇻🇳 Vietnam",
  "🇾🇪 Yemen",
  "🇿🇲 Zambia",
  "🇿🇼 Zimbabwe",
  "Other",
];

function Pill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-4 py-2 rounded-full text-sm border transition-all " +
        (active
          ? "bg-orange-600 text-white border-orange-600 shadow"
          : "bg-white/60 text-gray-800 border-white/50 hover:bg-white")
      }
    >
      {children}
    </button>
  );
}

function FieldLabel({ title, subtitle }) {
  return (
    <div className="mb-3">
      <div className="text-lg font-semibold text-gray-900">{title}</div>
      {subtitle ? <div className="text-sm text-gray-600 mt-1">{subtitle}</div> : null}
    </div>
  );
}

export default function Onboarding({ token, onCompleted }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Screen 1
  const [ageRange, setAgeRange] = useState("");
  const [country, setCountry] = useState("Armenia");
  const [planningVisit, setPlanningVisit] = useState(null); // bool | null

  // Screen 2
  const [knowledgeLevel, setKnowledgeLevel] = useState("");
  const [dialect, setDialect] = useState("Eastern");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("English");

  // Screen 3
  const [dailyGoalMin, setDailyGoalMin] = useState(10);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [voicePref, setVoicePref] = useState("Both");

  // Screen 4
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const totalSteps = 4;
  const progressPct = Math.round((step / totalSteps) * 100);
  const showPlanningVisit = (country || "").trim() !== "" && country !== "Armenia";

  const headerText = useMemo(() => {
    if (step === 1) return { h: "Let’s personalize your path", p: "A few quick questions so we start you at the right level." };
    if (step === 2) return { h: "Curriculum calibration", p: "Pick the level, dialect, and what you’re learning for." };
    if (step === 3) return { h: "Daily setup", p: "Set a realistic goal and how you want to study." };
    return { h: "Almost done", p: "Confirm preferences and you’re in." };
  }, [step]);

  useEffect(() => {
    // If we already have onboarding saved, we can skip.
    const run = async () => {
      if (!token) {
        navigate("/", { replace: true });
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/me/onboarding`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.completed) {
          onCompleted?.(data);
          navigate("/dashboard", { replace: true });
          return;
        }
        // Prefill if any partial exists
        if (res.ok && data?.data) {
          const d = data.data;
          if (d.age_range) setAgeRange(d.age_range);
          if (d.country) setCountry(d.country);
          if (typeof d.planning_visit_armenia === "boolean") setPlanningVisit(d.planning_visit_armenia);
          if (d.knowledge_level) setKnowledgeLevel(d.knowledge_level);
          if (d.dialect) setDialect(d.dialect);
          if (d.primary_goal) setPrimaryGoal(d.primary_goal);
          if (d.source_language) setSourceLanguage(d.source_language);
          if (typeof d.daily_goal_min === "number") setDailyGoalMin(d.daily_goal_min);
          if (d.reminder_time) {
            setReminderTime(d.reminder_time);
            setRemindersEnabled(true);
          }
          if (d.voice_pref) setVoicePref(d.voice_pref);
          if (typeof d.marketing_opt_in === "boolean") setMarketingOptIn(d.marketing_opt_in);
          if (typeof d.accepted_terms === "boolean") setAcceptedTerms(d.accepted_terms);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const canNext = () => {
    setError("");
    if (step === 1) {
      if (!ageRange) return "Please select your age range.";
      if (!country) return "Please select your country.";
      if (showPlanningVisit && planningVisit === null) return "Please tell us if you’re planning to visit Armenia.";
      return "";
    }
    if (step === 2) {
      if (!knowledgeLevel) return "Please select your current level.";
      if (!dialect) return "Please select a dialect.";
      if (!primaryGoal) return "Please select your main goal.";
      if (!sourceLanguage) return "Please select your source language.";
      return "";
    }
    if (step === 3) {
      if (!voicePref) return "Please select voice preference.";
      if (dailyGoalMin < 5 || dailyGoalMin > 60) return "Daily goal must be between 5 and 60 minutes.";
      if (remindersEnabled && !reminderTime) return "Select a reminder time or disable reminders.";
      return "";
    }
    if (step === 4) {
      if (!acceptedTerms) return "You must accept Terms & Conditions.";
      return "";
    }
    return "";
  };

  const next = () => {
    const msg = canNext();
    if (msg) {
      setError(msg);
      return;
    }
    setStep((s) => Math.min(totalSteps, s + 1));
  };

  const back = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const submit = async () => {
    const msg = canNext();
    if (msg) {
      setError(msg);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        age_range: ageRange,
        country,
        planning_visit_armenia: showPlanningVisit ? Boolean(planningVisit) : null,
        knowledge_level: knowledgeLevel,
        dialect,
        primary_goal: primaryGoal,
        source_language: sourceLanguage,
        daily_goal_min: Number(dailyGoalMin),
        reminder_time: remindersEnabled ? reminderTime : null,
        voice_pref: voicePref,
        marketing_opt_in: Boolean(marketingOptIn),
        accepted_terms: Boolean(acceptedTerms),
      };

      const res = await fetch(`${API_BASE}/me/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data?.detail || "Could not save onboarding";
        setError(typeof detail === "string" ? detail : JSON.stringify(detail));
        setSaving(false);
        return;
      }

      onCompleted?.(data);
      navigate("/dashboard", { replace: true });
    } catch (e) {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="text-gray-700">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-orange-50 via-white to-orange-50">
      {/* animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="lp-orb lp-orb-a" />
        <div className="lp-orb lp-orb-b" />
        <div className="lp-orb lp-orb-c" />
        <div className="lp-grid" />
        <div className="lp-grain" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <div className="text-sm text-orange-700 font-medium">Haylingua • Onboarding</div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 mt-1">
              {headerText.h}
            </h1>
            <p className="text-gray-600 mt-2 max-w-2xl">{headerText.p}</p>
          </div>
          <a
            href="https://blog.haylingua.am"
            target="_blank"
            rel="noreferrer"
            className="hidden md:inline-flex px-4 py-2 rounded-full bg-white/60 border border-white/50 text-gray-800 hover:bg-white transition"
          >
            Visit blog
          </a>
        </div>

        <div className="bg-white/70 backdrop-blur-md border border-white/60 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 pt-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-600">Step {step} of {totalSteps}</div>
              <div className="text-sm font-medium text-gray-800">{progressPct}%</div>
            </div>
            <div className="mt-3 h-2 bg-orange-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-600 transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="p-6">
            {error ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-7">
                <div>
                  <FieldLabel title="How old are you?" subtitle="We use this to tailor pacing and tone." />
                  <div className="flex flex-wrap gap-2">
                    {["Under 13", "13–17", "18–24", "25–34", "35–44", "45+"].map((x) => (
                      <Pill key={x} active={ageRange === x} onClick={() => setAgeRange(x)}>
                        {x}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel title="Where are you located?" subtitle="Helps us optimize content and examples." />
                  <div className="flex flex-col md:flex-row gap-3">
                    <select
                      value={country}
                      onChange={(e) => {
                        setCountry(e.target.value);
                        setPlanningVisit(null);
                      }}
                      className="w-full md:w-80 px-4 py-3 rounded-xl bg-white border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-200"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="text-sm text-gray-600 flex-1 flex items-center">
                      If you’re outside Armenia, we’ll adapt travel and culture vocabulary.
                    </div>
                  </div>
                </div>

                {showPlanningVisit ? (
                  <div>
                    <FieldLabel
                      title="Are you planning to visit Armenia soon?"
                      subtitle="If yes, we’ll prioritize travel phrases earlier."
                    />
                    <div className="flex gap-2">
                      <Pill active={planningVisit === true} onClick={() => setPlanningVisit(true)}>Yes</Pill>
                      <Pill active={planningVisit === false} onClick={() => setPlanningVisit(false)}>No</Pill>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-7">
                <div>
                  <FieldLabel
                    title="How much Armenian do you already know?"
                    subtitle="We don’t want to start you too easy or too hard."
                  />
                  <div className="flex flex-wrap gap-2">
                    {[
                      { k: "Total Beginner", t: "Total Beginner (I don't know the alphabet)" },
                      { k: "False Beginner", t: "False Beginner (I know a few words/letters)" },
                      { k: "Intermediate", t: "Intermediate (basic conversations)" },
                      { k: "Advanced", t: "Advanced (perfect grammar)" },
                    ].map((x) => (
                      <Pill key={x.k} active={knowledgeLevel === x.k} onClick={() => setKnowledgeLevel(x.k)}>
                        {x.t}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel
                    title="Which dialect do you want to learn?"
                    subtitle="Eastern is official in Armenia; Western is common in the diaspora."
                  />
                  <div className="flex flex-wrap gap-2">
                    {["Eastern", "Western"].map((x) => (
                      <Pill key={x} active={dialect === x} onClick={() => setDialect(x)}>
                        {x === "Eastern" ? "Eastern Armenian" : "Western Armenian"}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel title="Why are you learning Armenian?" subtitle="We’ll prioritize the vocabulary that matters to you." />
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Connecting with heritage/family",
                      "Planning a trip to Armenia",
                      "Business/Work",
                      "Partner/Spouse",
                      "Just for fun/Brain training",
                    ].map((x) => (
                      <Pill key={x} active={primaryGoal === x} onClick={() => setPrimaryGoal(x)}>
                        {x}
                      </Pill>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel
                    title="Which language would you like to learn from?"
                    subtitle="Learning Armenian through your strongest language reduces friction."
                  />
                  <div className="flex flex-wrap gap-2">
                    {["English", "Russian", "French", "Spanish", "German"].map((x) => (
                      <Pill key={x} active={sourceLanguage === x} onClick={() => setSourceLanguage(x)}>
                        {x}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-7">
                <div>
                  <FieldLabel title="Daily goal" subtitle="Choose a target you can actually keep — consistency wins." />
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min={5}
                      max={60}
                      step={5}
                      value={dailyGoalMin}
                      onChange={(e) => setDailyGoalMin(Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="min-w-[72px] text-center px-3 py-2 rounded-xl bg-orange-50 border border-orange-100 font-semibold text-orange-800">
                      {dailyGoalMin} min
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel title="Reminders" subtitle="A study reminder is the single best retention lever." />
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        id="rem"
                        type="checkbox"
                        checked={remindersEnabled}
                        onChange={(e) => setRemindersEnabled(e.target.checked)}
                      />
                      <label htmlFor="rem" className="text-sm text-gray-800">Enable reminders</label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { t: "Morning (08:00)", v: "08:00" },
                        { t: "Lunch (13:00)", v: "13:00" },
                        { t: "Evening (20:00)", v: "20:00" },
                      ].map((x) => (
                        <Pill
                          key={x.v}
                          active={reminderTime === x.v && remindersEnabled}
                          onClick={() => {
                            setReminderTime(x.v);
                            setRemindersEnabled(true);
                          }}
                        >
                          {x.t}
                        </Pill>
                      ))}
                      <Pill
                        active={!remindersEnabled}
                        onClick={() => setRemindersEnabled(false)}
                      >
                        No reminders
                      </Pill>
                    </div>
                  </div>
                </div>

                <div>
                  <FieldLabel title="Voice preference" subtitle="Hearing multiple voices improves comprehension." />
                  <div className="flex flex-wrap gap-2">
                    {["Male", "Female", "Both", "Random"].map((x) => (
                      <Pill key={x} active={voicePref === x} onClick={() => setVoicePref(x)}>
                        {x}
                      </Pill>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-6">
                <div className="rounded-2xl bg-orange-50 border border-orange-100 p-5">
                  <div className="text-base font-semibold text-gray-900">Your plan</div>
                  <div className="mt-2 text-sm text-gray-700 grid md:grid-cols-2 gap-2">
                    <div><span className="font-medium">Level:</span> {knowledgeLevel || "—"}</div>
                    <div><span className="font-medium">Dialect:</span> {dialect}</div>
                    <div><span className="font-medium">Goal:</span> {primaryGoal || "—"}</div>
                    <div><span className="font-medium">Daily:</span> {dailyGoalMin} minutes</div>
                    <div><span className="font-medium">Voice:</span> {voicePref}</div>
                    <div><span className="font-medium">Reminders:</span> {remindersEnabled ? reminderTime : "Off"}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={marketingOptIn}
                      onChange={(e) => setMarketingOptIn(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900">Send me product updates and learning tips</div>
                      <div className="text-sm text-gray-600">You can unsubscribe anytime.</div>
                    </div>
                  </label>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium text-gray-900">I accept the Terms & Conditions</div>
                      <div className="text-sm text-gray-600">Required to start learning.</div>
                    </div>
                  </label>
                </div>

                <div className="rounded-2xl bg-white border border-gray-200 p-5">
                  <div className="text-sm font-semibold text-gray-900">Why we ask these questions</div>
                  <p className="text-sm text-gray-600 mt-2">
                    Haylingua calibrates your starting point and vocabulary priorities. A diaspora Armenian who already speaks
                    the language shouldn’t be forced to grind the alphabet — and a total beginner shouldn’t be overwhelmed.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-6 pb-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={back}
              disabled={step === 1 || saving}
              className={
                "px-5 py-3 rounded-xl border transition " +
                (step === 1 || saving
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-gray-800 border-gray-200 hover:bg-gray-50")
              }
            >
              Back
            </button>

            {step < totalSteps ? (
              <button
                type="button"
                onClick={next}
                disabled={saving}
                className="px-6 py-3 rounded-xl bg-orange-600 text-white font-semibold hover:bg-orange-700 shadow"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className={
                  "px-6 py-3 rounded-xl font-semibold shadow " +
                  (saving ? "bg-orange-300 text-white" : "bg-orange-600 text-white hover:bg-orange-700")
                }
              >
                {saving ? "Saving…" : "Start learning"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: You can change most preferences later in your profile.
        </div>
      </div>
    </div>
  );
}
