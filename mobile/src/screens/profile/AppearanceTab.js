// src/screens/profile/AppearanceTab.js — profile theme (debounced
// autosave), avatar frame equipping, and the banner picker (presets +
// custom upload + remove). Mirrors src/ProfilePage.jsx's Appearance tab +
// its Hero-triggered banner modal, merged into one screen since mobile
// doesn't need a separate modal for it.
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { Check, Palette, Image as ImageIcon, Sparkles } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { api, resolveUrl } from '../../lib/api';
import Pressable3D from '../../components/Pressable3D';
import { haptics } from '../../lib/haptics';

const PRESET_THEMES = [
  { id: 'cream', label: 'Cream', bg: '#FFF7ED', gradient: null },
  { id: 'apricot', label: 'Apricot', bg: '#E85F00', gradient: 'linear-gradient(135deg,#FFB066,#E85F00)', colors: ['#FFB066', '#E85F00'] },
  { id: 'pomegranate', label: 'Pomegranate', bg: '#E11D48', gradient: 'linear-gradient(135deg,#FF7A1A,#E11D48)', colors: ['#FF7A1A', '#E11D48'] },
  { id: 'gold', label: 'Golden hour', bg: '#F59E0B', gradient: 'linear-gradient(135deg,#FCD34D,#F59E0B)', colors: ['#FCD34D', '#F59E0B'] },
  { id: 'mint', label: 'Mint', bg: '#10B981', gradient: 'linear-gradient(135deg,#34D399,#059669)', colors: ['#34D399', '#059669'] },
  { id: 'sky', label: 'Sky', bg: '#0EA5E9', gradient: 'linear-gradient(135deg,#38BDF8,#0284C7)', colors: ['#38BDF8', '#0284C7'] },
  { id: 'lavender', label: 'Lavender', bg: '#8B5CF6', gradient: 'linear-gradient(135deg,#C4B5FD,#7C3AED)', colors: ['#C4B5FD', '#7C3AED'] },
  { id: 'rose', label: 'Rose', bg: '#F43F5E', gradient: 'linear-gradient(135deg,#FDA4AF,#E11D48)', colors: ['#FDA4AF', '#E11D48'] },
  { id: 'teal', label: 'Teal', bg: '#0D9488', gradient: 'linear-gradient(135deg,#5EEAD4,#0D9488)', colors: ['#5EEAD4', '#0D9488'] },
  { id: 'midnight', label: 'Midnight', bg: '#1E293B', gradient: 'linear-gradient(135deg,#475569,#0F172A)', colors: ['#475569', '#0F172A'] },
];

const PRESET_BANNERS = Array.from({ length: 8 }).map((_, i) => `/banners/banner-${i + 1}.png`);

export default function AppearanceTab({ profile, wallet, onThemeSaved, onBannerChanged, onFrameChanged }) {
  const theme = profile?.profile_theme || {};
  const [themeBg, setThemeBg] = useState(theme.background || '#FFF7ED');
  const [themeGradient, setThemeGradient] = useState(theme.gradient || '');
  const [saveState, setSaveState] = useState(''); // '' | 'saving' | 'saved'
  const touchedTheme = useRef(false);
  const saveTimer = useRef(null);

  const [shopItems, setShopItems] = useState(null);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [equipping, setEquipping] = useState(null);

  useEffect(() => {
    api.get('/me/shop').then((res) => setShopItems(res?.items || [])).catch(() => setShopItems([]));
  }, []);

  useEffect(() => {
    if (!touchedTheme.current) return;
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await api.put('/me/profile', { profile_theme: { background: themeBg, gradient: themeGradient } });
        onThemeSaved(res);
        setSaveState('saved');
      } catch {
        setSaveState('');
      }
    }, 650);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeBg, themeGradient]);

  function pickTheme(preset) {
    touchedTheme.current = true;
    haptics.impact();
    setThemeBg(preset.bg);
    setThemeGradient(preset.gradient || '');
  }

  async function pickBannerFile() {
    if (uploadingBanner) return;
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.85 });
    if (result.didCancel || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append('file', { uri: asset.uri, type: asset.type || 'image/jpeg', name: asset.fileName || 'banner.jpg' });
    setUploadingBanner(true);
    try {
      const res = await api.upload('/me/banner', form);
      if (res?.banner_url) {
        onBannerChanged(res.banner_url);
        haptics.success();
      }
    } catch {
      haptics.error();
    } finally {
      setUploadingBanner(false);
    }
  }

  async function pickBannerPreset(url) {
    try {
      const res = await api.put('/me/profile', { banner_url: url });
      onBannerChanged(res.banner_url);
      haptics.impact();
    } catch {
      haptics.error();
    }
  }

  async function removeBanner() {
    try {
      await api.put('/me/profile', { banner_url: '' });
      onBannerChanged('');
    } catch {
      haptics.error();
    }
  }

  async function equipFrame(frameId) {
    setEquipping(frameId ?? 'none');
    try {
      const w = await api.put('/me/active-frame', { frame_id: frameId });
      onFrameChanged(w);
      haptics.impact();
    } catch {
      haptics.error();
    } finally {
      setEquipping(null);
    }
  }

  const ownedFrames = (wallet?.owned_frames || []).map((id) => {
    const item = shopItems?.find((it) => String(it.id) === String(id) && it.effect === 'avatar_frame');
    return { id, title: item?.title || id };
  });

  return (
    <View>
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Palette size={14} color="#a8a29e" />
          <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Profile theme</Text>
        </View>
        {!!saveState && (
          <Text className="text-xs font-semibold text-stone-400">{saveState === 'saving' ? 'Saving…' : 'Auto-saved'}</Text>
        )}
      </View>
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {PRESET_THEMES.map((t) => {
          const active = t.gradient ? themeGradient === t.gradient : !themeGradient && themeBg === t.bg;
          return (
            <Pressable3D key={t.id} onPress={() => pickTheme(t)} pressDepth={2}>
              <View style={{ width: 52, height: 52, borderRadius: 14, borderWidth: active ? 3 : 0, borderColor: '#1c1917', overflow: 'hidden' }}>
                {t.colors ? (
                  <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    {active && <Check size={18} color="#fff" />}
                  </LinearGradient>
                ) : (
                  <View style={{ width: '100%', height: '100%', backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
                    {active && <Check size={18} color="#1c1917" />}
                  </View>
                )}
              </View>
            </Pressable3D>
          );
        })}
      </View>

      <View className="mb-2 mt-6 flex-row items-center gap-2">
        <ImageIcon size={14} color="#a8a29e" />
        <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Banner</Text>
      </View>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {PRESET_BANNERS.map((url) => (
          <Pressable3D key={url} onPress={() => pickBannerPreset(url)} pressDepth={2}>
            <Image source={{ uri: resolveUrl(url) }} style={{ width: 84, height: 48, borderRadius: 10 }} resizeMode="cover" />
          </Pressable3D>
        ))}
      </View>
      <View className="mt-3 flex-row" style={{ gap: 8 }}>
        <Pressable3D onPress={pickBannerFile} disabled={uploadingBanner} className="flex-1 items-center rounded-xl bg-white py-2.5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
          {uploadingBanner ? <ActivityIndicator color="#FF7A1A" /> : <Text className="text-xs font-bold text-stone-700">Upload from photos</Text>}
        </Pressable3D>
        <Pressable3D onPress={removeBanner} className="flex-1 items-center rounded-xl bg-white py-2.5" style={{ shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 }}>
          <Text className="text-xs font-bold text-cardinal-600">Remove</Text>
        </Pressable3D>
      </View>

      <View className="mb-2 mt-6 flex-row items-center gap-2">
        <Sparkles size={14} color="#a8a29e" />
        <Text className="text-xs font-extrabold uppercase tracking-wide text-stone-400">Avatar frame</Text>
      </View>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        <Pressable3D onPress={() => equipFrame(null)} disabled={!!equipping} pressDepth={2} className={'rounded-xl px-4 py-2.5 ' + (!wallet?.active_frame ? 'bg-brand-500' : 'bg-white')} style={wallet?.active_frame ? { shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 } : undefined}>
          {equipping === 'none' ? <ActivityIndicator size="small" color={!wallet?.active_frame ? '#fff' : '#FF7A1A'} /> : (
            <Text className={'text-xs font-bold ' + (!wallet?.active_frame ? 'text-white' : 'text-stone-700')}>None</Text>
          )}
        </Pressable3D>
        {ownedFrames.map((f) => {
          const active = wallet?.active_frame === String(f.id);
          return (
            <Pressable3D key={f.id} onPress={() => equipFrame(f.id)} disabled={!!equipping} pressDepth={2} className={'rounded-xl px-4 py-2.5 ' + (active ? 'bg-brand-500' : 'bg-white')} style={!active ? { shadowColor: '#1c1917', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 } : undefined}>
              {equipping === f.id ? <ActivityIndicator size="small" color={active ? '#fff' : '#FF7A1A'} /> : (
                <Text className={'text-xs font-bold ' + (active ? 'text-white' : 'text-stone-700')}>{f.title}</Text>
              )}
            </Pressable3D>
          );
        })}
        {ownedFrames.length === 0 && (
          <Text className="text-sm font-semibold text-stone-400">No frames owned yet.</Text>
        )}
      </View>
    </View>
  );
}
