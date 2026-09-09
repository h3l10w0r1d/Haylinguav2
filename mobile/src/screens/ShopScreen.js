// src/screens/ShopScreen.js — port of src/Shop.jsx. Items are CMS-editable
// (fetched from the backend, not hardcoded), grouped into fixed sections by
// effect exactly like web. Buying reuses the same wallet-snapshot pattern
// ChestReveal.js already established (applyWallet patches the shared
// statsStore directly instead of a full refetch).
//
// Category tabs (All/Power-ups/Streak/Cosmetics/Avatar/Emotes/More) mirror
// web's 2026-09 "sidebar-era" redesign (commit 3a2eda8), which replaced the
// old one-long-page-of-stacked-sections layout with the same icon+label tab
// pattern the rest of this app's own screens (Friends/Forum/Vocabulary)
// already use — the backend contract itself didn't change, only web's UI.
import React, { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, Modal, ActivityIndicator as Spinner } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft, Gem, Zap, Heart, Shield, Snowflake, Frame, Palette, Tag,
  Shirt, Scissors, Smile, Gift, Check, LayoutGrid, Sparkles,
} from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { useStatsStore } from '../lib/statsStore';
import Pressable3D from '../components/Pressable3D';
import ClaimPulse from '../components/ClaimPulse';
import ScreenFadeIn from '../components/ScreenFadeIn';
import { haptics } from '../lib/haptics';

const EFFECT_ICONS = {
  xp_boost: Zap, xp_multiplier: Zap,
  hearts_refill: Heart, heart_shield: Shield,
  streak_freeze: Snowflake, streak_repair: Snowflake,
  avatar_frame: Frame, profile_theme: Palette, name_tag_effect: Tag,
  avatar_clothing_graphic: Shirt, avatar_hairstyle: Scissors, avatar_eyebrows: Smile,
  emote: Smile,
};

const SECTIONS = [
  { key: 'power', title: 'Power-ups', tabLabel: 'Power-ups', tabIcon: Zap, effects: ['xp_boost', 'xp_multiplier', 'hearts_refill', 'heart_shield'] },
  { key: 'streak', title: 'Streak protection', tabLabel: 'Streak', tabIcon: Snowflake, effects: ['streak_freeze', 'streak_repair'] },
  { key: 'cosmetic', title: 'Cosmetics', tabLabel: 'Cosmetics', tabIcon: Sparkles, effects: ['avatar_frame', 'profile_theme', 'name_tag_effect'] },
  { key: 'avatar_unlocks', title: 'Avatar builder unlocks', tabLabel: 'Avatar', tabIcon: Shirt, effects: ['avatar_clothing_graphic', 'avatar_hairstyle', 'avatar_eyebrows'] },
  { key: 'emotes', title: 'Emotes', tabLabel: 'Emotes', tabIcon: Smile, effects: ['emote'] },
];

const STATUS_LABELS = {
  owned: 'Owned', active: 'Active', maxed: 'Max owned', full: 'Hearts full', not_needed: 'Premium ∞',
};

function TabPill({ active, onPress, icon: Icon, label, count }) {
  return (
    <Pressable3D
      onPress={onPress}
      pressDepth={1}
      hapticOnPress={false}
      className={'mr-2 flex-row items-center gap-1.5 rounded-xl px-3.5 py-2 ' + (active ? 'bg-brand-500' : 'bg-white')}
      style={active ? undefined : { borderWidth: 1, borderColor: '#f0efec' }}
    >
      <Icon size={14} color={active ? '#fff' : '#78716c'} />
      <Text className={'text-xs font-extrabold ' + (active ? 'text-white' : 'text-stone-600')}>{label}</Text>
      {count > 0 && (
        <View className={'rounded-full px-1.5 ' + (active ? 'bg-white/25' : 'bg-stone-100')}>
          <Text className={'text-[10px] font-extrabold ' + (active ? 'text-white' : 'text-stone-500')}>{count}</Text>
        </View>
      )}
    </Pressable3D>
  );
}

function ItemCard({ item, onBuy, pulseKey }) {
  const Icon = EFFECT_ICONS[item.effect] || Gift;
  const hasStatus = item.status && item.status !== 'available';
  return (
    <ClaimPulse pulseKey={pulseKey} style={{ width: '48%', marginBottom: 12 }}>
      <View className="rounded-2xl bg-white p-3.5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1, minHeight: 168 }}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand-50">
          <Icon size={19} color="#FF7A1A" />
        </View>
        <Text className="mt-2 text-sm font-extrabold text-stone-900" numberOfLines={1}>{item.title}</Text>
        <Text className="mt-0.5 text-xs font-semibold text-stone-400" numberOfLines={2} style={{ minHeight: 30 }}>{item.desc}</Text>

        {hasStatus ? (
          <View className="mt-2 flex-row items-center gap-1 self-start rounded-lg bg-grass-50 px-2 py-1">
            {(item.status === 'owned' || item.status === 'active') && <Check size={11} color="#3A8A00" />}
            <Text className="text-[11px] font-extrabold text-grass-700">{STATUS_LABELS[item.status] || item.status}</Text>
          </View>
        ) : (
          <Pressable3D
            onPress={() => onBuy(item)}
            disabled={!item.affordable}
            pressDepth={2}
            className={'mt-2 flex-row items-center justify-center gap-1.5 rounded-xl py-2 ' + (item.affordable ? 'bg-brand-500' : 'bg-stone-200')}
          >
            <Gem size={13} color={item.affordable ? '#fff' : '#a8a29e'} />
            <Text className={'text-xs font-extrabold ' + (item.affordable ? 'text-white' : 'text-stone-400')}>{item.price}</Text>
          </Pressable3D>
        )}
      </View>
    </ClaimPulse>
  );
}

function BuyConfirmModal({ item, gems, buying, onCancel, onConfirm }) {
  if (!item) return null;
  const after = gems - item.price;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-center bg-black/50 px-8">
        <View className="w-full rounded-3xl bg-white p-6">
          <Text className="text-lg font-extrabold text-stone-900">{item.title}</Text>
          <Text className="mt-1 text-sm font-semibold text-stone-500">{item.desc}</Text>

          <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-stone-100 px-4 py-3">
            <Text className="text-sm font-bold text-stone-600">Price</Text>
            <View className="flex-row items-center gap-1">
              <Gem size={14} color="#1CB0F6" />
              <Text className="text-sm font-extrabold text-stone-900">{item.price}</Text>
            </View>
          </View>
          <View className="mt-2 flex-row items-center justify-between px-1">
            <Text className="text-xs font-semibold text-stone-400">Balance after purchase</Text>
            <Text className="text-xs font-bold text-stone-500">{after} gems</Text>
          </View>

          <View className="mt-5 flex-row" style={{ gap: 10 }}>
            <Pressable3D onPress={onCancel} pressDepth={2} className="flex-1 items-center rounded-2xl bg-stone-100 py-3.5">
              <Text className="text-sm font-extrabold text-stone-600">Cancel</Text>
            </Pressable3D>
            <Pressable3D
              onPress={onConfirm}
              disabled={buying || after < 0}
              pressDepth={2}
              className={'flex-1 items-center rounded-2xl py-3.5 ' + (after >= 0 ? 'bg-brand-500' : 'bg-stone-200')}
            >
              {buying ? <Spinner color="#fff" /> : <Text className="text-sm font-extrabold text-white">Buy for {item.price}</Text>}
            </Pressable3D>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ShopScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [confirming, setConfirming] = useState(null);
  const [buying, setBuying] = useState(false);
  const [justBoughtId, setJustBoughtId] = useState(null);
  const [pulseToken, setPulseToken] = useState(0);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api.get('/me/shop').catch(() => null);
    setData(res);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function confirmBuy() {
    const item = confirming;
    if (!item) return;
    setBuying(true);
    setError('');
    try {
      const res = await api.post('/me/shop/buy', { item: item.id });
      haptics.success();
      useStatsStore.getState().applyWallet(res);
      setConfirming(null);
      setJustBoughtId(item.id);
      setPulseToken((t) => t + 1);
      await load();
    } catch (e) {
      haptics.error();
      setError(e instanceof ApiError ? e.message : 'Purchase failed. Please try again.');
    } finally {
      setBuying(false);
    }
  }

  const items = Array.isArray(data?.items) ? data.items : [];
  const knownEffects = SECTIONS.flatMap((s) => s.effects);
  const sections = SECTIONS.map((s) => ({ ...s, items: items.filter((i) => s.effects.includes(i.effect)) })).filter((s) => s.items.length > 0);
  const misc = items.filter((i) => !knownEffects.includes(i.effect));

  const tabs = [
    { key: 'all', tabLabel: 'All', tabIcon: LayoutGrid, count: items.length },
    ...sections.map((s) => ({ key: s.key, tabLabel: s.tabLabel, tabIcon: s.tabIcon, count: s.items.length })),
    ...(misc.length > 0 ? [{ key: 'more', tabLabel: 'More', tabIcon: LayoutGrid, count: misc.length }] : []),
  ];
  const visibleSections =
    activeTab === 'all'
      ? [...sections, ...(misc.length > 0 ? [{ key: 'misc', title: 'More', items: misc }] : [])]
      : activeTab === 'more'
      ? [{ key: 'misc', title: 'More', items: misc }]
      : sections.filter((s) => s.key === activeTab);

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-3">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-white">
          <ArrowLeft size={18} color="#57534e" />
        </Pressable3D>
        <Text className="flex-1 text-xl font-extrabold text-stone-900 font-display">Shop</Text>
        {!!data && (
          <View className="flex-row items-center gap-1.5 rounded-xl bg-white px-3 py-1.5" style={{ borderWidth: 1, borderColor: '#f0efec' }}>
            <Gem size={15} color="#1CB0F6" />
            <Text className="text-sm font-extrabold text-stone-900">{data.gems}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF7A1A" />
        </View>
      ) : (
        <>
          {tabs.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="pb-1" contentContainerStyle={{ paddingHorizontal: 16 }}>
              {tabs.map((t) => (
                <TabPill key={t.key} active={activeTab === t.key} onPress={() => setActiveTab(t.key)} icon={t.tabIcon} label={t.tabLabel} count={t.count} />
              ))}
            </ScrollView>
          )}
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8 }}>
            <ScreenFadeIn>
              {!!error && (
                <View className="mb-3 rounded-2xl bg-cardinal-50 px-4 py-3">
                  <Text className="text-sm font-semibold text-cardinal-700">{error}</Text>
                </View>
              )}
              {visibleSections.map((section) => (
                <View key={section.key || section.title} className="mb-5">
                  <Text className="mb-2.5 text-xs font-extrabold uppercase tracking-wide text-stone-400">{section.title}</Text>
                  <View className="flex-row flex-wrap justify-between">
                    {section.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        onBuy={setConfirming}
                        pulseKey={justBoughtId === item.id ? pulseToken : 0}
                      />
                    ))}
                  </View>
                </View>
              ))}
              {items.length === 0 && (
                <View className="items-center py-16">
                  <Gift size={28} color="#d6d3d1" />
                  <Text className="mt-2 text-base font-bold text-stone-400">Nothing in the shop right now.</Text>
                </View>
              )}
            </ScreenFadeIn>
          </ScrollView>
        </>
      )}

      {confirming && (
        <BuyConfirmModal
          item={confirming}
          gems={data?.gems ?? 0}
          buying={buying}
          onCancel={() => setConfirming(null)}
          onConfirm={confirmBuy}
        />
      )}
    </SafeAreaView>
  );
}
