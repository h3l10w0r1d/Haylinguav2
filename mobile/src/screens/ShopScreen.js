// src/screens/ShopScreen.js — ports the web's Shop.jsx: spend gems earned
// from chests on power-ups, streak protection, and cosmetics. Same
// GET /me/shop / POST /me/shop/buy contract, same section grouping by
// effect. Simplified from web's version: no full-screen SuccessBurst
// animation (a status badge + haptic + wallet refresh cover the same
// "you got it" moment) — a deliberate scope cut, not a silent omission.
import React, { useCallback, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, Modal, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Gem, Snowflake, Heart, Zap, Shield, ShieldCheck, TrendingUp, Award,
  Image as ImageIcon, Check, X, ArrowLeft,
} from 'lucide-react-native';
import { api, ApiError } from '../lib/api';
import { useStatsStore } from '../lib/statsStore';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

const ICONS = {
  snowflake: Snowflake,
  heart: Heart,
  zap: Zap,
  gem: Gem,
  shield: Shield,
  'shield-check': ShieldCheck,
  'trending-up': TrendingUp,
  award: Award,
  image: ImageIcon,
};

const TONE = {
  snowflake: { bg: '#E7F7FF', icon: '#1CB0F6' },
  heart: { bg: '#FFECEC', icon: '#FF4B4B' },
  zap: { bg: '#FFF8E1', icon: '#E0A800' },
  shield: { bg: '#E7F7FF', icon: '#1899D6' },
  'shield-check': { bg: '#EFFCE3', icon: '#58CC02' },
  'trending-up': { bg: '#FFF5EC', icon: '#FF7A1A' },
  award: { bg: '#FFF8E1', icon: '#E0A800' },
  image: { bg: '#FDECF3', icon: '#E11D48' },
};

const SECTIONS = [
  { key: 'power', title: 'Power-ups', effects: ['xp_boost', 'xp_multiplier', 'hearts_refill', 'heart_shield'] },
  { key: 'streak', title: 'Streak protection', effects: ['streak_freeze', 'streak_repair'] },
  { key: 'cosmetic', title: 'Cosmetics', effects: ['avatar_frame', 'profile_theme'] },
];

const STATUS_BADGE = {
  owned: { text: 'Owned', bg: '#EFFCE3', color: '#3A8A00' },
  active: { text: 'Active', bg: '#E7F7FF', color: '#1471A0' },
  maxed: { text: 'Max owned', bg: '#f5f5f4', color: '#78716c' },
  full: { text: 'Hearts full', bg: '#f5f5f4', color: '#78716c' },
  not_needed: { text: 'Premium ∞', bg: '#FFF8E1', color: '#9A7B00' },
};

function ItemCard({ item, onBuy }) {
  const Icon = ICONS[item.icon] || Gem;
  const tone = TONE[item.icon] || { bg: '#f5f5f4', icon: '#78716c' };
  const badge = STATUS_BADGE[item.status];
  const buyable = !badge;

  return (
    <View
      className="mb-4 rounded-3xl bg-white p-4"
      style={{ width: '48%', shadowColor: '#1c1917', shadowOpacity: 0.06, shadowRadius: 8, elevation: 1 }}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: tone.bg }}>
          <Icon size={20} color={tone.icon} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-extrabold text-stone-900 font-display" numberOfLines={1}>{item.title}</Text>
        </View>
      </View>
      <Text className="mt-2 text-xs font-semibold text-stone-500" numberOfLines={2}>{item.desc}</Text>

      {buyable ? (
        <Pressable3D
          onPress={() => onBuy(item)}
          disabled={!item.affordable}
          className="mt-3 flex-row items-center justify-center gap-1.5 rounded-2xl py-2.5"
          style={{
            backgroundColor: item.affordable ? '#1CB0F6' : '#f5f5f4',
            borderBottomWidth: item.affordable ? 3 : 0,
            borderBottomColor: '#0E86C4',
          }}
        >
          <Gem size={14} color={item.affordable ? '#fff' : '#a8a29e'} />
          <Text className="text-sm font-extrabold uppercase" style={{ color: item.affordable ? '#fff' : '#a8a29e' }}>
            {item.price}
          </Text>
        </Pressable3D>
      ) : (
        <View className="mt-3 flex-row items-center justify-center gap-1.5 rounded-2xl py-2.5" style={{ backgroundColor: badge.bg }}>
          {(item.status === 'owned' || item.status === 'active') && <Check size={14} color={badge.color} />}
          <Text className="text-sm font-extrabold" style={{ color: badge.color }}>{badge.text}</Text>
        </View>
      )}
    </View>
  );
}

function ConfirmSheet({ item, gems, busy, onConfirm, onCancel }) {
  if (!item) return null;
  const Icon = ICONS[item.icon] || Gem;
  const tone = TONE[item.icon] || { bg: '#f5f5f4', icon: '#78716c' };
  const after = gems - item.price;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 items-center justify-end bg-black/50">
        <View className="w-full rounded-t-3xl bg-white p-6">
          <Pressable3D onPress={onCancel} disabled={busy} pressDepth={2} className="absolute right-4 top-4 h-8 w-8 items-center justify-center rounded-full bg-stone-100">
            <X size={16} color="#78716c" />
          </Pressable3D>

          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: tone.bg }}>
              <Icon size={26} color={tone.icon} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-lg font-extrabold text-stone-900 font-display">{item.title}</Text>
              <Text className="text-sm font-semibold text-stone-500">{item.desc}</Text>
            </View>
          </View>

          <View className="mt-5 rounded-2xl bg-stone-50 p-4" style={{ gap: 8 }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-stone-500">Price</Text>
              <View className="flex-row items-center gap-1">
                <Gem size={14} color="#1CB0F6" />
                <Text className="text-sm font-bold text-feather-600">{item.price}</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-bold text-stone-500">Your balance</Text>
              <Text className="text-sm font-bold text-stone-700">{gems}</Text>
            </View>
            <View className="flex-row items-center justify-between border-t border-stone-200 pt-2">
              <Text className="text-sm font-bold text-stone-700">Balance after</Text>
              <Text className="text-sm font-bold text-stone-900">{after}</Text>
            </View>
          </View>

          <Pressable3D
            onPress={onConfirm}
            disabled={busy}
            className="mt-5 flex-row items-center justify-center gap-2 rounded-2xl py-4"
            style={{ backgroundColor: '#1CB0F6', borderBottomWidth: 4, borderBottomColor: '#0E86C4' }}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text className="text-base font-extrabold uppercase text-white">{`Buy for ${item.price}`}</Text>
                <Gem size={16} color="#fff" />
              </>
            )}
          </Pressable3D>
        </View>
      </View>
    </Modal>
  );
}

export default function ShopScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmItem, setConfirmItem] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/me/shop');
      setData(res);
    } catch {
      // non-fatal — keep showing whatever we last had
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function confirmBuy() {
    const item = confirmItem;
    if (!item) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.post('/me/shop/buy', { item: item.id });
      useStatsStore.getState().applyWallet(result);
      if (item.effect === 'hearts_refill') useStatsStore.getState().refresh();
      haptics.success();
      setConfirmItem(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? (typeof e.detail === 'string' ? e.detail : e.message) : 'Purchase failed');
      haptics.error();
      setConfirmItem(null);
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items || [];
  const sections = SECTIONS.map((s) => ({ ...s, items: items.filter((it) => s.effects.includes(it.effect)) })).filter((s) => s.items.length > 0);
  const known = new Set(SECTIONS.flatMap((s) => s.effects));
  const misc = items.filter((it) => !known.has(it.effect));

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-2">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="h-9 w-9 items-center justify-center rounded-full bg-stone-200">
          <ArrowLeft size={18} color="#57534e" />
        </Pressable3D>
        <Text className="flex-1 text-xl font-extrabold text-stone-900 font-display">Shop</Text>
        <View className="flex-row items-center gap-1.5 rounded-2xl bg-feather-50 px-3 py-2">
          <Gem size={16} color="#1CB0F6" />
          <Text className="text-base font-extrabold text-feather-600 font-display">{data?.gems ?? '–'}</Text>
        </View>
      </View>

      {!!error && (
        <View className="mx-4 mb-2 rounded-2xl bg-cardinal-50 px-4 py-2.5">
          <Text className="text-sm font-bold text-cardinal-600">{error}</Text>
        </View>
      )}

      {data === null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF7A1A" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {sections.map((s) => (
            <View key={s.key} className="mb-2">
              <Text className="mb-3 text-base font-extrabold text-stone-800 font-display">{s.title}</Text>
              <View className="flex-row flex-wrap justify-between">
                {s.items.map((item) => (
                  <ItemCard key={item.id} item={item} onBuy={setConfirmItem} />
                ))}
              </View>
            </View>
          ))}
          {misc.length > 0 && (
            <View className="mb-2">
              <Text className="mb-3 text-base font-extrabold text-stone-800 font-display">More</Text>
              <View className="flex-row flex-wrap justify-between">
                {misc.map((item) => (
                  <ItemCard key={item.id} item={item} onBuy={setConfirmItem} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <ConfirmSheet
        item={confirmItem}
        gems={data?.gems ?? 0}
        busy={busy}
        onConfirm={confirmBuy}
        onCancel={() => setConfirmItem(null)}
      />
    </SafeAreaView>
  );
}
