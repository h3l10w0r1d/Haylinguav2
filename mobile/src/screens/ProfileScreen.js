// src/screens/ProfileScreen.js — full port of src/ProfilePage.jsx's 4-tab
// shape (Overview/Edit/Appearance/Security) with a persistent hero above
// the tabs. Owns all the shared data fetching; each tab is a thin renderer
// driven by props so state stays in one place instead of re-fetched per tab.
//
// One deliberate simplification vs. the web: avatar/banner uploads go
// through their own dedicated endpoints (POST /me/avatar, POST /me/banner)
// and persist immediately on pick, same as the web's own autosave behavior
// for those two fields — so there's no need for web's "touched" ref
// bookkeeping to decide whether to include avatar_url/banner_url in the
// PUT /me/profile body; those two fields never go through that call here.
import React, { useCallback, useState } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import { Camera, Globe, EyeOff, Star, Zap, Flame, User, Pencil, Palette, ShieldCheck } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { api, resolveUrl } from '../lib/api';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';
import OverviewTab from './profile/OverviewTab';
import EditTab from './profile/EditTab';
import AppearanceTab from './profile/AppearanceTab';
import SecurityTab from './profile/SecurityTab';

const TABS = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'edit', label: 'Edit', icon: Pencil },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'security', label: 'Security', icon: ShieldCheck },
];

async function pickAndUpload(endpoint, onDone) {
  const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85, includeBase64: false });
  if (result.didCancel || !result.assets?.[0]) return;
  const asset = result.assets[0];
  const form = new FormData();
  form.append('file', {
    uri: asset.uri,
    type: asset.type || 'image/jpeg',
    name: asset.fileName || 'upload.jpg',
  });
  try {
    const res = await api.upload(endpoint, form);
    haptics.success();
    onDone(res);
  } catch (e) {
    haptics.error();
    onDone(null, e);
  }
}

export default function ProfileScreen({ navigation }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [activityDays, setActivityDays] = useState([]);
  const [learningSummary, setLearningSummary] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('overview');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    const [me, st, ach, act, summary, w] = await Promise.all([
      api.get('/me/profile').catch(() => null),
      api.get('/me/stats').catch(() => null),
      api.get('/me/achievements').catch(() => null),
      api.get('/me/activity?days=30').catch(() => null),
      api.get('/me/learning/summary?days=14').catch(() => null),
      api.get('/me/wallet').catch(() => null),
    ]);
    if (me) setProfile(me);
    if (st) setStats(st);
    if (ach?.achievements) setAchievements(ach.achievements.filter((a) => a.earned));
    if (act?.days) setActivityDays(act.days);
    if (summary) setLearningSummary(summary);
    if (w) setWallet(w);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  function patchProfile(patch) {
    setProfile((p) => (p ? { ...p, ...patch } : p));
  }

  async function pickAvatar() {
    if (uploadingAvatar) return;
    setUploadingAvatar(true);
    await pickAndUpload('/me/avatar', (res) => {
      if (res?.avatar_url) patchProfile({ avatar_url: res.avatar_url });
      setUploadingAvatar(false);
    });
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-[#f5f4f1]">
        <ActivityIndicator size="large" color="#FF7A1A" />
      </SafeAreaView>
    );
  }

  const displayName = profile?.name || profile?.username || 'You';
  const bannerUrl = resolveUrl(profile?.banner_url);
  const theme = profile?.profile_theme || {};
  const avatarUrl = resolveUrl(profile?.avatar_url);

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero */}
        <View className="mx-4 mt-3 overflow-hidden rounded-3xl">
          <View style={{ height: 90 }}>
            {bannerUrl ? (
              <Image source={{ uri: bannerUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : theme.gradient ? (
              <LinearGradient colors={parseGradientColors(theme.gradient, theme.background)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ width: '100%', height: '100%', backgroundColor: theme.background || '#FFF7ED' }} />
            )}
          </View>
          <View className="items-center bg-white px-4 pb-4" style={{ marginTop: -32 }}>
            <Pressable3D onPress={pickAvatar} pressDepth={2} className="items-center justify-center rounded-full" style={{ width: 76, height: 76, borderWidth: 4, borderColor: '#fff', backgroundColor: '#f5f5f4' }}>
              {uploadingAvatar ? (
                <ActivityIndicator color="#FF7A1A" />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={{ width: 68, height: 68, borderRadius: 34 }} />
              ) : (
                <Text className="text-2xl font-extrabold text-brand-600">{displayName[0]?.toUpperCase()}</Text>
              )}
              <View className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full bg-stone-800">
                <Camera size={12} color="#fff" />
              </View>
            </Pressable3D>
            <Text className="mt-2 text-lg font-extrabold text-stone-900 font-display">{displayName}</Text>
            {!!profile?.username && <Text className="text-sm font-semibold text-stone-400">@{profile.username}</Text>}
            {!!profile?.bio && <Text className="mt-1 text-center text-sm font-medium text-stone-500">{profile.bio}</Text>}
            <View className="mt-2 flex-row items-center gap-2">
              {profile?.friends_public === false && (
                <View className="flex-row items-center gap-1 rounded-full bg-stone-100 px-2 py-1">
                  <EyeOff size={11} color="#a8a29e" />
                  <Text className="text-[10px] font-bold text-stone-500">Friends list hidden</Text>
                </View>
              )}
              {profile?.is_hidden && (
                <View className="flex-row items-center gap-1 rounded-full bg-stone-100 px-2 py-1">
                  <Globe size={11} color="#a8a29e" />
                  <Text className="text-[10px] font-bold text-stone-500">Profile hidden</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Stat tiles */}
        <View className="mx-4 mt-3 flex-row gap-3">
          <StatTile icon={Star} tint="#FFF8E1" color="#E0A800" label="Level" value={Math.max(1, Math.floor((profile?.total_xp ?? 0) / 500) + 1)} />
          <StatTile icon={Zap} tint="#E7F7FF" color="#1899D6" label="Total XP" value={profile?.total_xp ?? 0} />
          <StatTile icon={Flame} tint="#FFF5EC" color="#FF7A1A" label="Streak" value={profile?.streak ?? 0} />
        </View>

        {/* Tab bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mx-4 mt-4">
          <View className="flex-row rounded-2xl bg-stone-200 p-1" style={{ gap: 2 }}>
            {TABS.map((t) => (
              <Pressable3D
                key={t.key}
                onPress={() => setTab(t.key)}
                pressDepth={2}
                className={'flex-row items-center gap-1.5 rounded-xl px-4 py-2 ' + (tab === t.key ? 'bg-white' : '')}
              >
                <t.icon size={14} color={tab === t.key ? '#FF7A1A' : '#a8a29e'} />
                <Text className={'text-sm font-bold ' + (tab === t.key ? 'text-stone-900' : 'text-stone-500')}>{t.label}</Text>
              </Pressable3D>
            ))}
          </View>
        </ScrollView>

        <View className="px-4 pt-4">
          {tab === 'overview' && (
            <OverviewTab profile={profile} stats={stats} achievements={achievements} activityDays={activityDays} learningSummary={learningSummary} />
          )}
          {tab === 'edit' && <EditTab profile={profile} onSaved={patchProfile} />}
          {tab === 'appearance' && (
            <AppearanceTab
              profile={profile}
              wallet={wallet}
              onThemeSaved={patchProfile}
              onBannerChanged={(url) => patchProfile({ banner_url: url })}
              onFrameChanged={(w) => setWallet(w)}
            />
          )}
          {tab === 'security' && <SecurityTab profile={profile} navigation={navigation} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ icon: Icon, tint, color, label, value }) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-white px-3 py-4" style={{ shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}>
      <View className="mb-1.5 h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: tint }}>
        <Icon size={16} color={color} />
      </View>
      <Text className="text-xl font-extrabold text-stone-900 font-display">{value}</Text>
      <Text className="mt-1 text-[11px] font-bold uppercase tracking-wide text-stone-400">{label}</Text>
    </View>
  );
}

// The stored `gradient` field is the same CSS `linear-gradient(...)` string
// the web writes (kept for cross-platform back-compat) — pull the two hex
// stops out of it for react-native-linear-gradient rather than parsing full
// CSS. Falls back to a solid-color two-stop gradient if parsing fails.
function parseGradientColors(cssGradient, fallbackBg) {
  const hexes = String(cssGradient).match(/#[0-9a-fA-F]{3,8}/g);
  if (hexes && hexes.length >= 2) return [hexes[0], hexes[1]];
  return [fallbackBg || '#FFF7ED', fallbackBg || '#FFF7ED'];
}
