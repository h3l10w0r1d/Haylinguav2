// src/screens/OnboardingScreen.js — ports src/Onboarding.jsx's 4-step
// personalization flow (name/age/country -> level/dialect/goal -> daily
// plan/reminder/voice -> summary+consent) to mobile. Same GET/POST
// /me/onboarding contract; RootNavigator routes here instead of Main
// whenever GET /me/onboarding returns completed:false.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, ScrollView, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';

const COUNTRY_OPTIONS = [
  '🇦🇲 Armenia', '🇷🇺 Russia', '🇺🇸 United States', '🇫🇷 France', '🇩🇪 Germany', '🇬🇧 United Kingdom',
  '🇪🇸 Spain', '🇮🇹 Italy', '🇨🇦 Canada', '🇦🇺 Australia', '🇬🇪 Georgia', '🇮🇷 Iran', '🇱🇧 Lebanon',
  '🇸🇾 Syria', '🇹🇷 Turkey', '🇺🇦 Ukraine', '🇧🇷 Brazil', '🇦🇷 Argentina', '🇮🇳 India', '🇯🇵 Japan',
  '🇨🇳 China', '🇳🇱 Netherlands', '🇸🇪 Sweden', '🇵🇱 Poland', '🇬🇷 Greece', '🇦🇪 United Arab Emirates',
  'Other',
];

const STEP_META = [
  { emoji: '👤', label: 'About you', title: "Let's personalize your path", subtitle: 'A few quick questions so we start you at the right level.' },
  { emoji: '📚', label: 'Curriculum', title: 'Curriculum calibration', subtitle: "Pick your level, dialect, and what you're learning for." },
  { emoji: '🎯', label: 'Daily plan', title: 'Set your daily plan', subtitle: 'Set a realistic goal — consistency beats intensity every time.' },
  { emoji: '✅', label: 'Confirm', title: 'Almost done', subtitle: 'Review your setup and confirm to start learning.' },
];

const AGE_OPTIONS = [
  { v: 'Under 13', e: '🧒' }, { v: '13–17', e: '🎒' }, { v: '18–24', e: '🎓' },
  { v: '25–34', e: '💼' }, { v: '35–44', e: '🏡' }, { v: '45+', e: '🌿' },
];

const LEVEL_OPTIONS = [
  { k: 'Total Beginner', e: '🌱', sub: "Don't know the alphabet yet" },
  { k: 'False Beginner', e: '🌿', sub: 'Know a few words or letters' },
  { k: 'Intermediate', e: '🌳', sub: 'Can hold basic conversations' },
  { k: 'Advanced', e: '🏆', sub: 'Strong grammar, wide vocabulary' },
];

const GOAL_OPTIONS = [
  { v: 'Connecting with heritage/family', e: '🫂', sub: 'Heritage & identity' },
  { v: 'Planning a trip to Armenia', e: '✈️', sub: 'Travel & tourism' },
  { v: 'Business/Work', e: '💼', sub: 'Professional use' },
  { v: 'Partner/Spouse', e: '💛', sub: 'For a loved one' },
  { v: 'Just for fun/Brain training', e: '🧠', sub: 'Curiosity & enjoyment' },
];

const DAILY_GOAL_OPTIONS = [
  { min: 5, label: '5 min', sub: 'Casual' },
  { min: 10, label: '10 min', sub: 'Regular' },
  { min: 15, label: '15 min', sub: 'Committed' },
  { min: 20, label: '20 min', sub: 'Serious' },
  { min: 30, label: '30 min', sub: 'Intensive' },
  { min: 45, label: '45 min', sub: 'Hardcore' },
];

const REMINDER_OPTIONS = [
  { t: 'Morning', sub: '08:00', v: '08:00' },
  { t: 'Lunch', sub: '13:00', v: '13:00' },
  { t: 'Evening', sub: '20:00', v: '20:00' },
  { t: 'No reminder', sub: "I'll open the app myself", v: null },
];

function OptionCard({ active, onPress, icon, label, sub, style }) {
  return (
    <Pressable3D
      onPress={onPress}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12 },
        active
          ? { backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }
          : { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e7e5e4' },
        style,
      ]}
    >
      {!!icon && <Text style={{ fontSize: 20 }}>{icon}</Text>}
      <View style={{ flex: 1 }}>
        <Text className="text-sm font-extrabold" style={{ color: active ? '#fff' : '#1c1917' }}>{label}</Text>
        {!!sub && <Text className="text-xs mt-0.5" style={{ color: active ? '#FFE4CC' : '#78716c' }}>{sub}</Text>}
      </View>
      {active && <Check size={16} color="#fff" />}
    </Pressable3D>
  );
}

function SectionLabel({ title, subtitle }) {
  return (
    <View className="mb-3">
      <Text className="text-base font-extrabold text-stone-900 font-display">{title}</Text>
      {!!subtitle && <Text className="mt-0.5 text-sm text-stone-500">{subtitle}</Text>}
    </View>
  );
}

function CountryPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  return (
    <View>
      <Pressable3D
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-3 rounded-2xl bg-white px-4 py-3.5"
        style={{ borderWidth: 2, borderColor: '#e7e5e4' }}
      >
        <Text className="flex-1 text-sm font-semibold text-stone-800">{value || 'Select country'}</Text>
        <ChevronDown size={16} color="#a8a29e" />
      </Pressable3D>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView className="flex-1 bg-[#f5f4f1]">
          <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
            <Text className="flex-1 text-lg font-extrabold text-stone-900 font-display">Select country</Text>
            <Pressable3D onPress={() => setOpen(false)} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
              <X size={18} color="#57534e" />
            </Pressable3D>
          </View>
          <View className="mx-4 mb-2 flex-row items-center gap-2 rounded-xl bg-white px-3 py-2.5">
            <Search size={16} color="#a8a29e" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries…"
              placeholderTextColor="#a8a29e"
              className="flex-1 text-sm font-semibold text-stone-800"
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            renderItem={({ item }) => (
              <Pressable3D
                onPress={() => { onChange(item); setOpen(false); }}
                hapticOnPress={false}
                className="flex-row items-center gap-3 rounded-xl px-3 py-3"
              >
                <Text className="flex-1 text-sm font-semibold text-stone-800">{item}</Text>
                {item === value && <Check size={16} color="#FF7A1A" />}
              </Pressable3D>
            )}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [displayName, setDisplayName] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [country, setCountry] = useState('🇦🇲 Armenia');
  const [planningVisit, setPlanningVisit] = useState(null);

  const [knowledgeLevel, setKnowledgeLevel] = useState('');
  const [dialect, setDialect] = useState('Eastern');
  const [primaryGoal, setPrimaryGoal] = useState('');

  const [dailyGoalMin, setDailyGoalMin] = useState(10);
  const [reminderTime, setReminderTime] = useState('20:00');
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [voicePref, setVoicePref] = useState('');

  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const totalSteps = 4;
  const showPlanningVisit = country && country !== '🇦🇲 Armenia';

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/me/onboarding');
        if (res?.completed) {
          navigation.replace('Main');
          return;
        }
        const d = res?.data;
        if (d) {
          if (d.age_range) setAgeRange(d.age_range);
          if (d.country) setCountry(d.country);
          if (typeof d.planning_visit_armenia === 'boolean') setPlanningVisit(d.planning_visit_armenia);
          if (d.knowledge_level) setKnowledgeLevel(d.knowledge_level);
          if (d.dialect) setDialect(d.dialect);
          if (d.primary_goal) setPrimaryGoal(d.primary_goal);
          if (typeof d.daily_goal_min === 'number') setDailyGoalMin(d.daily_goal_min);
          if (d.reminder_time) { setReminderTime(d.reminder_time); setRemindersEnabled(true); }
          if (d.voice_pref) setVoicePref(d.voice_pref);
          if (typeof d.marketing_opt_in === 'boolean') setMarketingOptIn(d.marketing_opt_in);
        }
      } catch {
        // non-fatal — start onboarding from scratch
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function canNext() {
    if (step === 1) {
      if (!displayName.trim()) return 'Please enter your name.';
      if (!ageRange) return 'Please select your age range.';
      if (!country) return 'Please select your country.';
      if (showPlanningVisit && planningVisit === null) return "Please tell us if you're planning to visit Armenia.";
      return '';
    }
    if (step === 2) {
      if (!knowledgeLevel) return 'Please select your current level.';
      if (!primaryGoal) return 'Please select your main goal.';
      return '';
    }
    if (step === 3) {
      if (!voicePref) return 'Please select at least one voice preference.';
      return '';
    }
    if (step === 4) {
      if (!acceptedTerms) return 'You must accept Terms & Conditions.';
      return '';
    }
    return '';
  }

  function next() {
    const msg = canNext();
    if (msg) { setError(msg); return; }
    setError('');
    setStep((s) => Math.min(totalSteps, s + 1));
  }
  function back() {
    setError('');
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    const msg = canNext();
    if (msg) { setError(msg); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/me/onboarding', {
        name: displayName.trim(),
        age_range: ageRange,
        country,
        planning_visit_armenia: showPlanningVisit ? Boolean(planningVisit) : null,
        knowledge_level: knowledgeLevel,
        dialect,
        primary_goal: primaryGoal,
        source_language: 'English',
        daily_goal_min: Number(dailyGoalMin),
        reminder_time: remindersEnabled ? reminderTime : null,
        voice_pref: voicePref,
        marketing_opt_in: Boolean(marketingOptIn),
        accepted_terms: Boolean(acceptedTerms),
      });
      navigation.replace('Main');
    } catch (e) {
      setError(e?.message || 'Could not save onboarding. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  const meta = STEP_META[step - 1];

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]">
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="mb-5 flex-row items-center justify-center" style={{ gap: 6 }}>
          {STEP_META.map((m, i) => {
            const idx = i + 1;
            const done = step > idx;
            const active = step === idx;
            return (
              <View key={idx} className="flex-row items-center" style={{ gap: 6 }}>
                <View
                  className="rounded-full px-2.5 py-1"
                  style={{ backgroundColor: active ? '#FF7A1A' : done ? '#EFFCE3' : '#f5f5f4' }}
                >
                  <Text className="text-xs font-extrabold" style={{ color: active ? '#fff' : done ? '#3A8A00' : '#a8a29e' }}>
                    {done ? '✓' : m.emoji}
                  </Text>
                </View>
                {idx < totalSteps && <View className="h-0.5 w-4 rounded-full" style={{ backgroundColor: done ? '#A5E86B' : '#e7e5e4' }} />}
              </View>
            );
          })}
        </View>

        <View className="rounded-3xl bg-white p-6" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
          <Text style={{ fontSize: 22 }}>{meta.emoji}</Text>
          <Text className="mt-1 text-xl font-extrabold text-stone-900 font-display">{meta.title}</Text>
          <Text className="mt-1 text-sm text-stone-500">{meta.subtitle}</Text>

          <View className="mt-5" style={{ gap: 20 }}>
            {!!error && (
              <View className="rounded-2xl bg-cardinal-50 px-4 py-3">
                <Text className="text-sm font-semibold text-cardinal-700">{error}</Text>
              </View>
            )}

            {step === 1 && (
              <>
                <View>
                  <SectionLabel title="What's your name?" subtitle="This is how we'll address you throughout the app." />
                  <TextInput
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="e.g. Armen"
                    placeholderTextColor="#a8a29e"
                    maxLength={50}
                    className="rounded-2xl bg-white px-4 py-3.5 text-base font-semibold text-stone-900"
                    style={{ borderWidth: 2, borderColor: '#e7e5e4' }}
                  />
                </View>
                <View>
                  <SectionLabel title="How old are you?" subtitle="We use this to tailor pacing and tone." />
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {AGE_OPTIONS.map(({ v, e }) => (
                      <View key={v} style={{ width: '31%' }}>
                        <OptionCard active={ageRange === v} onPress={() => setAgeRange(v)} icon={e} label={v} />
                      </View>
                    ))}
                  </View>
                </View>
                <View>
                  <SectionLabel title="Where are you located?" subtitle="Helps us optimize content and examples." />
                  <CountryPicker value={country} onChange={(c) => { setCountry(c); setPlanningVisit(null); }} />
                </View>
                {showPlanningVisit && (
                  <View>
                    <SectionLabel title="Planning to visit Armenia soon?" subtitle="If yes, we'll prioritize travel phrases earlier." />
                    <View className="flex-row" style={{ gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <OptionCard active={planningVisit === true} onPress={() => setPlanningVisit(true)} icon="✈️" label="Yes, a trip" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <OptionCard active={planningVisit === false} onPress={() => setPlanningVisit(false)} icon="🏠" label="Not right now" />
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <View>
                  <SectionLabel title="Your current level" subtitle="We don't want to start you too easy or too hard." />
                  <View style={{ gap: 8 }}>
                    {LEVEL_OPTIONS.map(({ k, e, sub }) => (
                      <OptionCard key={k} active={knowledgeLevel === k} onPress={() => setKnowledgeLevel(k)} icon={e} label={k} sub={sub} />
                    ))}
                  </View>
                </View>
                <View>
                  <SectionLabel title="Which dialect?" subtitle="Eastern is official in Armenia; Western is diaspora Armenian." />
                  <View className="flex-row" style={{ gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <OptionCard active={dialect === 'Eastern'} onPress={() => setDialect('Eastern')} icon="🇦🇲" label="Eastern" sub="Spoken in Armenia" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <OptionCard active={dialect === 'Western'} onPress={() => setDialect('Western')} icon="🌍" label="Western" sub="Diaspora Armenian" />
                    </View>
                  </View>
                </View>
                <View>
                  <SectionLabel title="Why are you learning?" subtitle="We'll prioritize vocabulary that matters to you." />
                  <View style={{ gap: 8 }}>
                    {GOAL_OPTIONS.map(({ v, e, sub }) => (
                      <OptionCard key={v} active={primaryGoal === v} onPress={() => setPrimaryGoal(v)} icon={e} label={v} sub={sub} />
                    ))}
                  </View>
                </View>
              </>
            )}

            {step === 3 && (
              <>
                <View>
                  <SectionLabel title="Daily goal" subtitle="Pick a target you can actually keep." />
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {DAILY_GOAL_OPTIONS.map(({ min, label, sub }) => (
                      <View key={min} style={{ width: '31%' }}>
                        <OptionCard active={dailyGoalMin === min} onPress={() => setDailyGoalMin(min)} label={label} sub={sub} />
                      </View>
                    ))}
                  </View>
                </View>
                <View>
                  <SectionLabel title="Study reminder" subtitle="A daily nudge is the single biggest retention lever." />
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {REMINDER_OPTIONS.map(({ t, sub, v }) => {
                      const active = v === null ? !remindersEnabled : remindersEnabled && reminderTime === v;
                      return (
                        <View key={t} style={{ width: '47%' }}>
                          <OptionCard
                            active={active}
                            onPress={() => (v === null ? setRemindersEnabled(false) : (setReminderTime(v), setRemindersEnabled(true)))}
                            label={t}
                            sub={sub}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
                <View>
                  <SectionLabel title="Voice preference" subtitle="Hearing multiple voices improves comprehension." />
                  <View style={{ gap: 8 }}>
                    <OptionCard active={voicePref === 'Male'} onPress={() => setVoicePref('Male')} label="Male voice" sub="Clear pronunciation & lower pitch" />
                    <OptionCard active={voicePref === 'Female'} onPress={() => setVoicePref('Female')} label="Female voice" sub="Natural pitch variation & clarity" />
                    <OptionCard active={voicePref === 'Random'} onPress={() => setVoicePref('Random')} label="Mix both voices" sub="Best for real-world listening variety" />
                  </View>
                </View>
              </>
            )}

            {step === 4 && (
              <>
                <View className="rounded-2xl bg-brand-50 p-5">
                  <Text className="text-base font-extrabold text-stone-900 font-display">Your plan</Text>
                  <View className="mt-3 flex-row flex-wrap" style={{ gap: 16 }}>
                    {[
                      ['Level', knowledgeLevel || '—'],
                      ['Dialect', dialect],
                      ['Goal', primaryGoal || '—'],
                      ['Daily', `${dailyGoalMin} min`],
                      ['Voice', voicePref || '—'],
                      ['Reminder', remindersEnabled ? reminderTime : 'Off'],
                    ].map(([k, v]) => (
                      <View key={k} style={{ minWidth: '40%' }}>
                        <Text className="text-xs font-bold uppercase tracking-wide text-stone-400">{k}</Text>
                        <Text className="text-sm font-semibold text-stone-900" numberOfLines={1}>{v}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <Pressable3D
                  onPress={() => setMarketingOptIn((v) => !v)}
                  hapticOnPress={false}
                  className="flex-row items-start gap-3 rounded-2xl p-4"
                  style={{ backgroundColor: marketingOptIn ? '#FFF5EC' : '#ffffff', borderWidth: 2, borderColor: marketingOptIn ? '#FFC99E' : '#e7e5e4' }}
                >
                  <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: marketingOptIn ? '#FF7A1A' : '#f5f5f4' }}>
                    {marketingOptIn && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-stone-900">Send me learning tips and product updates</Text>
                    <Text className="mt-0.5 text-xs text-stone-500">You can unsubscribe anytime.</Text>
                  </View>
                </Pressable3D>

                <Pressable3D
                  onPress={() => setAcceptedTerms((v) => !v)}
                  hapticOnPress={false}
                  className="flex-row items-start gap-3 rounded-2xl p-4"
                  style={{ backgroundColor: acceptedTerms ? '#FFF5EC' : '#ffffff', borderWidth: 2, borderColor: acceptedTerms ? '#FFC99E' : '#e7e5e4' }}
                >
                  <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-md" style={{ backgroundColor: acceptedTerms ? '#FF7A1A' : '#f5f5f4' }}>
                    {acceptedTerms && <Check size={12} color="#fff" strokeWidth={3} />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-stone-900">I accept the Terms &amp; Conditions</Text>
                    <Text className="mt-0.5 text-xs text-stone-500">Required to start learning.</Text>
                  </View>
                </Pressable3D>
              </>
            )}
          </View>

          <View className="mt-6 flex-row items-center justify-between">
            <Pressable3D
              onPress={back}
              disabled={step === 1 || saving}
              className="rounded-2xl bg-stone-100 px-5 py-3"
              style={{ opacity: step === 1 || saving ? 0.4 : 1 }}
            >
              <Text className="text-sm font-extrabold text-stone-700">Back</Text>
            </Pressable3D>

            {step < totalSteps ? (
              <Pressable3D
                onPress={next}
                disabled={saving}
                className="rounded-2xl px-6 py-3"
                style={{ backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }}
              >
                <Text className="text-sm font-extrabold uppercase text-white">Continue</Text>
              </Pressable3D>
            ) : (
              <Pressable3D
                onPress={submit}
                disabled={saving}
                className="flex-row items-center gap-2 rounded-2xl px-6 py-3"
                style={{ backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-extrabold uppercase text-white">Start learning</Text>}
              </Pressable3D>
            )}
          </View>
        </View>

        <Text className="mt-4 text-center text-xs text-stone-400">You can change all preferences later in your profile.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
