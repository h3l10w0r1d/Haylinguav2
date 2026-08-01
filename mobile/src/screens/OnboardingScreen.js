// src/screens/OnboardingScreen.js — one-question-per-page onboarding
// (Typeform-style), not web's 4-bundled-questions-per-step Onboarding.jsx.
// Each question answers -> auto-advances with a slide+spring transition;
// free-text/summary pages keep an explicit Continue/Start button. Same
// GET/POST /me/onboarding contract as before — only the pacing changed.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import Animated, {
  FadeIn,
  SlideInRight,
  SlideInLeft,
  SlideOutLeft,
  SlideOutRight,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';

const COUNTRY_OPTIONS = [
  '🇦🇲 Armenia', '🇷🇺 Russia', '🇺🇸 United States', '🇫🇷 France', '🇩🇪 Germany', '🇬🇧 United Kingdom',
  '🇪🇸 Spain', '🇮🇹 Italy', '🇨🇦 Canada', '🇦🇺 Australia', '🇬🇪 Georgia', '🇮🇷 Iran', '🇱🇧 Lebanon',
  '🇸🇾 Syria', '🇹🇷 Turkey', '🇺🇦 Ukraine', '🇧🇷 Brazil', '🇦🇷 Argentina', '🇮🇳 India', '🇯🇵 Japan',
  '🇨🇳 China', '🇳🇱 Netherlands', '🇸🇪 Sweden', '🇵🇱 Poland', '🇬🇷 Greece', '🇦🇪 United Arab Emirates',
  'Other',
];

const CATEGORY_META = {
  about: { emoji: '👤', label: 'About you' },
  curriculum: { emoji: '📚', label: 'Curriculum' },
  plan: { emoji: '🎯', label: 'Daily plan' },
  confirm: { emoji: '✅', label: 'Confirm' },
};

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
        { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 16 },
        active
          ? { backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }
          : { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e7e5e4' },
        style,
      ]}
    >
      {!!icon && <Text style={{ fontSize: 24 }}>{icon}</Text>}
      <View style={{ flex: 1 }}>
        <Text className="text-base font-extrabold" style={{ color: active ? '#fff' : '#1c1917' }}>{label}</Text>
        {!!sub && <Text className="mt-0.5 text-sm" style={{ color: active ? '#FFE4CC' : '#78716c' }}>{sub}</Text>}
      </View>
      {active && <Check size={18} color="#fff" />}
    </Pressable3D>
  );
}

// Vertical icon-on-top card for narrow 3-column grids (age range, daily
// goal) — a horizontal icon+label row doesn't fit a 31%-wide cell without
// wrapping mid-word ("18–24" broke into "1 8 / – / 2 4"). Centering
// everything and allowing a genuine 2-line label fixes that.
function GridOptionCard({ active, onPress, icon, label, sub }) {
  return (
    <Pressable3D
      onPress={onPress}
      style={[
        { alignItems: 'center', justifyContent: 'center', borderRadius: 18, paddingHorizontal: 6, paddingVertical: 18, minHeight: 96 },
        active
          ? { backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }
          : { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e7e5e4' },
      ]}
    >
      {!!icon && <Text style={{ fontSize: 26, marginBottom: 6 }}>{icon}</Text>}
      <Text numberOfLines={2} className="text-center text-sm font-extrabold" style={{ color: active ? '#fff' : '#1c1917' }}>
        {label}
      </Text>
      {!!sub && (
        <Text className="mt-0.5 text-center text-[11px] font-semibold" style={{ color: active ? '#FFE4CC' : '#a8a29e' }}>
          {sub}
        </Text>
      )}
    </Pressable3D>
  );
}

function CountryPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // RN's Modal renders its content in a separate native view hierarchy (a
  // detached UIViewController on iOS), which doesn't reliably inherit the
  // outer SafeAreaProvider's context — SafeAreaView here fell back to a
  // zero top inset, so the header collided with the status bar/notch and
  // the close button landed under it, unreachable. useSafeAreaInsets()
  // queries the device's real insets directly instead of relying on that
  // inherited context.
  const insets = useSafeAreaInsets();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRY_OPTIONS;
    return COUNTRY_OPTIONS.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  return (
    <View>
      <Pressable3D
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-3 rounded-2xl bg-white px-4 py-4"
        style={{ borderWidth: 2, borderColor: '#e7e5e4' }}
      >
        <Text className="flex-1 text-base font-semibold text-stone-800">{value || 'Select country'}</Text>
        <ChevronDown size={18} color="#a8a29e" />
      </Pressable3D>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 bg-[#f5f4f1]" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
          <View className="flex-row items-center gap-3 px-4 pb-3 pt-3">
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
        </View>
      </Modal>
    </View>
  );
}

export default function OnboardingScreen({ navigation }) {
  const [qIndex, setQIndex] = useState(0);
  const [dir, setDir] = useState(1); // 1 = advancing (slide from right), -1 = going back
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

  const showPlanningVisit = country && country !== '🇦🇲 Armenia';
  const autoAdvanceTimer = useRef(null);

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

  useEffect(() => () => clearTimeout(autoAdvanceTimer.current), []);

  function goTo(nextIndex, direction) {
    clearTimeout(autoAdvanceTimer.current);
    setError('');
    setDir(direction);
    setQIndex(nextIndex);
  }

  // Selecting an answer for a single-choice question feels like the "next"
  // affordance itself — a brief pause lets the selected state register
  // before the page slides away, then goTo() fires the transition.
  function selectAndAdvance(setter, value, nextIndex) {
    setter(value);
    clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => goTo(nextIndex, 1), 320);
  }

  const questions = useMemo(() => {
    const list = [
      {
        key: 'name',
        category: 'about',
        title: "What's your name?",
        subtitle: "This is how we'll address you throughout the app.",
        autoAdvance: false,
        isValid: () => !!displayName.trim(),
        errorMsg: 'Please enter your name.',
        render: (onNext) => (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Armen"
            placeholderTextColor="#a8a29e"
            maxLength={50}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={onNext}
            className="rounded-2xl bg-white px-5 py-5 text-lg font-semibold text-stone-900"
            style={{ borderWidth: 2, borderColor: '#e7e5e4' }}
          />
        ),
      },
      {
        key: 'age',
        category: 'about',
        title: 'How old are you?',
        subtitle: 'We use this to tailor pacing and tone.',
        autoAdvance: true,
        isValid: () => !!ageRange,
        errorMsg: 'Please select your age range.',
        render: (_onNext, advance) => (
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {AGE_OPTIONS.map(({ v, e }) => (
              <View key={v} style={{ width: '31%' }}>
                <GridOptionCard active={ageRange === v} onPress={() => selectAndAdvance(setAgeRange, v, advance)} icon={e} label={v} />
              </View>
            ))}
          </View>
        ),
      },
      {
        key: 'country',
        category: 'about',
        title: 'Where are you located?',
        subtitle: 'Helps us optimize content and examples.',
        autoAdvance: false,
        isValid: () => !!country,
        errorMsg: 'Please select your country.',
        render: (onNext) => (
          <CountryPicker
            value={country}
            onChange={(c) => {
              setCountry(c);
              setPlanningVisit(null);
              clearTimeout(autoAdvanceTimer.current);
              autoAdvanceTimer.current = setTimeout(onNext, 250);
            }}
          />
        ),
      },
      ...(showPlanningVisit
        ? [
            {
              key: 'visiting',
              category: 'about',
              title: 'Planning to visit Armenia soon?',
              subtitle: "If yes, we'll prioritize travel phrases earlier.",
              autoAdvance: true,
              isValid: () => planningVisit !== null,
              errorMsg: "Please tell us if you're planning to visit Armenia.",
              render: (_onNext, advance) => (
                <View className="flex-row" style={{ gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <OptionCard active={planningVisit === true} onPress={() => selectAndAdvance(setPlanningVisit, true, advance)} icon="✈️" label="Yes, a trip" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <OptionCard active={planningVisit === false} onPress={() => selectAndAdvance(setPlanningVisit, false, advance)} icon="🏠" label="Not right now" />
                  </View>
                </View>
              ),
            },
          ]
        : []),
      {
        key: 'level',
        category: 'curriculum',
        title: 'Your current level',
        subtitle: "We don't want to start you too easy or too hard.",
        autoAdvance: true,
        isValid: () => !!knowledgeLevel,
        errorMsg: 'Please select your current level.',
        render: (_onNext, advance) => (
          <View style={{ gap: 10 }}>
            {LEVEL_OPTIONS.map(({ k, e, sub }) => (
              <OptionCard key={k} active={knowledgeLevel === k} onPress={() => selectAndAdvance(setKnowledgeLevel, k, advance)} icon={e} label={k} sub={sub} />
            ))}
          </View>
        ),
      },
      {
        key: 'dialect',
        category: 'curriculum',
        title: 'Which dialect?',
        subtitle: 'Eastern is official in Armenia; Western is diaspora Armenian.',
        autoAdvance: true,
        isValid: () => !!dialect,
        errorMsg: 'Please select a dialect.',
        render: (_onNext, advance) => (
          <View className="flex-row" style={{ gap: 12 }}>
            <View style={{ flex: 1 }}>
              <OptionCard active={dialect === 'Eastern'} onPress={() => selectAndAdvance(setDialect, 'Eastern', advance)} icon="🇦🇲" label="Eastern" sub="Spoken in Armenia" />
            </View>
            <View style={{ flex: 1 }}>
              <OptionCard active={dialect === 'Western'} onPress={() => selectAndAdvance(setDialect, 'Western', advance)} icon="🌍" label="Western" sub="Diaspora Armenian" />
            </View>
          </View>
        ),
      },
      {
        key: 'goal',
        category: 'curriculum',
        title: 'Why are you learning?',
        subtitle: "We'll prioritize vocabulary that matters to you.",
        autoAdvance: true,
        isValid: () => !!primaryGoal,
        errorMsg: 'Please select your main goal.',
        render: (_onNext, advance) => (
          <View style={{ gap: 10 }}>
            {GOAL_OPTIONS.map(({ v, e, sub }) => (
              <OptionCard key={v} active={primaryGoal === v} onPress={() => selectAndAdvance(setPrimaryGoal, v, advance)} icon={e} label={v} sub={sub} />
            ))}
          </View>
        ),
      },
      {
        key: 'dailyGoal',
        category: 'plan',
        title: 'Daily goal',
        subtitle: 'Pick a target you can actually keep.',
        autoAdvance: true,
        isValid: () => !!dailyGoalMin,
        errorMsg: 'Please pick a daily goal.',
        render: (_onNext, advance) => (
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {DAILY_GOAL_OPTIONS.map(({ min, label, sub }) => (
              <View key={min} style={{ width: '31%' }}>
                <GridOptionCard active={dailyGoalMin === min} onPress={() => selectAndAdvance(setDailyGoalMin, min, advance)} label={label} sub={sub} />
              </View>
            ))}
          </View>
        ),
      },
      {
        key: 'reminder',
        category: 'plan',
        title: 'Study reminder',
        subtitle: 'A daily nudge is the single biggest retention lever.',
        autoAdvance: true,
        isValid: () => true,
        errorMsg: '',
        render: (_onNext, advance) => (
          <View className="flex-row flex-wrap" style={{ gap: 10 }}>
            {REMINDER_OPTIONS.map(({ t, sub, v }) => {
              const active = v === null ? !remindersEnabled : remindersEnabled && reminderTime === v;
              return (
                <View key={t} style={{ width: '47%' }}>
                  <OptionCard
                    active={active}
                    onPress={() => {
                      if (v === null) selectAndAdvance(setRemindersEnabled, false, advance);
                      else {
                        setReminderTime(v);
                        selectAndAdvance(setRemindersEnabled, true, advance);
                      }
                    }}
                    label={t}
                    sub={sub}
                  />
                </View>
              );
            })}
          </View>
        ),
      },
      {
        key: 'voice',
        category: 'plan',
        title: 'Voice preference',
        subtitle: 'Hearing multiple voices improves comprehension.',
        autoAdvance: true,
        isValid: () => !!voicePref,
        errorMsg: 'Please select at least one voice preference.',
        render: (_onNext, advance) => (
          <View style={{ gap: 10 }}>
            <OptionCard active={voicePref === 'Male'} onPress={() => selectAndAdvance(setVoicePref, 'Male', advance)} label="Male voice" sub="Clear pronunciation & lower pitch" />
            <OptionCard active={voicePref === 'Female'} onPress={() => selectAndAdvance(setVoicePref, 'Female', advance)} label="Female voice" sub="Natural pitch variation & clarity" />
            <OptionCard active={voicePref === 'Random'} onPress={() => selectAndAdvance(setVoicePref, 'Random', advance)} label="Mix both voices" sub="Best for real-world listening variety" />
          </View>
        ),
      },
      {
        key: 'summary',
        category: 'confirm',
        title: 'Almost done',
        subtitle: 'Review your setup and confirm to start learning.',
        autoAdvance: false,
        isValid: () => acceptedTerms,
        errorMsg: 'You must accept Terms & Conditions.',
        render: () => (
          <View style={{ gap: 16 }}>
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
          </View>
        ),
      },
    ];
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    displayName, ageRange, country, planningVisit, showPlanningVisit,
    knowledgeLevel, dialect, primaryGoal, dailyGoalMin, reminderTime, remindersEnabled, voicePref,
    marketingOptIn, acceptedTerms,
  ]);

  // Country selection can remove/re-add the "visiting" question mid-flow —
  // clamp so an in-progress index never points past the (possibly shorter) list.
  const clampedIndex = Math.min(qIndex, questions.length - 1);
  const q = questions[clampedIndex];
  const isLast = clampedIndex === questions.length - 1;

  function handleNext() {
    if (!q.isValid()) {
      setError(q.errorMsg);
      return;
    }
    if (isLast) {
      submit();
      return;
    }
    goTo(clampedIndex + 1, 1);
  }

  function handleBack() {
    if (clampedIndex === 0) return;
    goTo(clampedIndex - 1, -1);
  }

  async function submit() {
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

  // Animated progress bar — smoothly eases to the new fraction whenever the
  // question index changes, instead of a hard jump.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming((clampedIndex + 1) / questions.length, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [clampedIndex, questions.length, progress]);
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  const cat = CATEGORY_META[q.category];
  const EnterAnim = (dir === 1 ? SlideInRight : SlideInLeft).duration(360).springify().damping(19).mass(0.7);
  const ExitAnim = (dir === 1 ? SlideOutLeft : SlideOutRight).duration(200);

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <View className="px-5 pt-3">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Text style={{ fontSize: 15 }}>{cat.emoji}</Text>
              <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">{cat.label}</Text>
            </View>
            <Text className="text-xs font-bold text-stone-400">{clampedIndex + 1} / {questions.length}</Text>
          </View>
          <View className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
            <Animated.View className="h-full rounded-full bg-brand-500" style={progressStyle} />
          </View>
        </View>

        <View className="flex-1 px-5 pt-6" style={{ overflow: 'hidden' }}>
          <Animated.View key={q.key} entering={EnterAnim} exiting={ExitAnim} style={{ flex: 1 }}>
            <Animated.View entering={FadeIn.delay(60).duration(260)}>
              <Text className="text-2xl font-extrabold text-stone-900 font-display">{q.title}</Text>
              <Text className="mt-1.5 text-sm text-stone-500">{q.subtitle}</Text>
            </Animated.View>

            {!!error && (
              <View className="mt-4 rounded-2xl bg-cardinal-50 px-4 py-3">
                <Text className="text-sm font-semibold text-cardinal-700">{error}</Text>
              </View>
            )}

            <View className="mt-6">{q.render(handleNext, clampedIndex + 1)}</View>
          </Animated.View>
        </View>

        <View className="flex-row items-center justify-between px-5 pb-6 pt-3">
          <Pressable3D
            onPress={handleBack}
            disabled={clampedIndex === 0 || saving}
            className="rounded-2xl bg-stone-100 px-5 py-3.5"
            style={{ opacity: clampedIndex === 0 || saving ? 0.4 : 1 }}
          >
            <Text className="text-sm font-extrabold text-stone-700">Back</Text>
          </Pressable3D>

          {!q.autoAdvance && (
            <Pressable3D
              onPress={handleNext}
              disabled={saving}
              className="flex-row items-center gap-2 rounded-2xl px-7 py-3.5"
              style={{ backgroundColor: '#FF7A1A', borderBottomWidth: 4, borderBottomColor: '#C2410C' }}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text className="text-sm font-extrabold uppercase text-white">{isLast ? 'Start learning' : 'Continue'}</Text>
              )}
            </Pressable3D>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
