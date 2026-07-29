// src/screens/AvatarBuilderScreen.js — mobile port of src/AvatarBuilder.jsx.
// Renders the exact same DiceBear "avataaars" trait set as the web builder
// (same option lists, same colors) so avatar creation is consistent across
// platforms, then rasterizes the final SVG to a PNG and uploads it through
// the same /me/avatar endpoint the native-photo picker already uses.
//
// Rasterization uses react-native-svg's built-in `toDataURL` (native on
// both iOS/Android, already linked — no extra native module needed) rather
// than a canvas, since RN has no DOM/canvas. A ref is obtained from the
// underlying <Svg> rendered by <SvgXml> by passing it through SvgXml's
// `override` prop — SvgXml forwards `{...override}` onto the <Svg> it
// renders internally, and `ref` is a key React always extracts specially
// from that merged config object even when it arrives via spread.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { X, Shuffle, Check } from 'lucide-react-native';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';
import { api } from '../lib/api';
import Pressable3D from '../components/Pressable3D';
import { haptics } from '../lib/haptics';

const SKIN_COLORS = ['614335', 'd08b5b', 'ae5d29', 'edb98a', 'ffdbb4', 'fd9841', 'f8d25c'];
const HAIR_COLORS = ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'ecdcbf', 'c93305', 'f59797', 'e8e1e1'];
const CLOTHES_COLORS = ['262e33', '3c4f5c', '5199e4', '65c9ff', 'b1e2ff', '929598', 'e6e6e6', 'ffffff', 'a7ffc4', 'ffafb9', 'ff488e', 'ff5c5c', 'ffffff', '25557c'];
const BG_COLORS = ['b6e3f4', 'ffd5dc', 'ffdfbf', 'c0f0c8', 'd1d4f9', 'f4d9b6', 'e0e0e0', 'ffe0f0'];

const TOP_OPTIONS = [
  'shortFlat', 'shortRound', 'shortWaved', 'shortCurly', 'theCaesar', 'sides', 'shaggy', 'shaggyMullet',
  'curly', 'curvy', 'straight01', 'straight02', 'straightAndStrand', 'dreads01', 'dreads02', 'frizzle',
  'bob', 'bun', 'fro', 'froBand', 'bigHair', 'miaWallace', 'longButNotTooLong',
  'hat', 'hijab', 'turban', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04',
];
const EYES_OPTIONS = ['default', 'happy', 'side', 'squint', 'wink', 'winkWacky', 'surprised', 'hearts', 'closed', 'cry', 'eyeRoll', 'xDizzy'];
const EYEBROW_OPTIONS = ['defaultNatural', 'angryNatural', 'flatNatural', 'raisedExcitedNatural', 'sadConcernedNatural', 'unibrowNatural', 'upDownNatural'];
const MOUTH_OPTIONS = ['smile', 'default', 'twinkle', 'serious', 'concerned', 'disbelief', 'sad', 'tongue', 'eating', 'grimace', 'screamOpen'];
const FACIAL_HAIR_OPTIONS = ['none', 'beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'];
const CLOTHING_OPTIONS = ['hoodie', 'shirtCrewNeck', 'shirtVNeck', 'shirtScoopNeck', 'collarAndSweater', 'overall', 'blazerAndShirt', 'blazerAndSweater', 'graphicShirt'];
const ACCESSORY_OPTIONS = ['none', 'round', 'wayfarers', 'prescription01', 'prescription02', 'sunglasses', 'kurt', 'eyepatch'];

const DEFAULT_TRAITS = {
  top: 'shortFlat',
  hairColor: HAIR_COLORS[1],
  skinColor: SKIN_COLORS[3],
  eyes: 'default',
  eyebrows: 'defaultNatural',
  mouth: 'smile',
  facialHair: 'none',
  clothing: 'hoodie',
  clothesColor: CLOTHES_COLORS[3],
  accessories: 'none',
  backgroundColor: BG_COLORS[0],
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomTraits() {
  return {
    top: pick(TOP_OPTIONS),
    hairColor: pick(HAIR_COLORS),
    skinColor: pick(SKIN_COLORS),
    eyes: pick(EYES_OPTIONS),
    eyebrows: pick(EYEBROW_OPTIONS),
    mouth: pick(MOUTH_OPTIONS),
    facialHair: Math.random() < 0.3 ? pick(FACIAL_HAIR_OPTIONS.slice(1)) : 'none',
    clothing: pick(CLOTHING_OPTIONS),
    clothesColor: pick(CLOTHES_COLORS),
    accessories: Math.random() < 0.35 ? pick(ACCESSORY_OPTIONS.slice(1)) : 'none',
    backgroundColor: pick(BG_COLORS),
  };
}

function buildSvgMarkup(traits, size = 200) {
  const avatar = createAvatar(avataaars, {
    seed: 'haylingua',
    size,
    top: [traits.top],
    hairColor: [traits.hairColor],
    skinColor: [traits.skinColor],
    eyes: [traits.eyes],
    eyebrows: [traits.eyebrows],
    mouth: [traits.mouth],
    facialHair: traits.facialHair === 'none' ? [] : [traits.facialHair],
    facialHairProbability: traits.facialHair === 'none' ? 0 : 100,
    clothing: [traits.clothing],
    clothesColor: [traits.clothesColor],
    accessories: traits.accessories === 'none' ? [] : [traits.accessories],
    accessoriesProbability: traits.accessories === 'none' ? 0 : 100,
    backgroundColor: [traits.backgroundColor],
  });
  return avatar.toString();
}

const TABS = [
  { key: 'hair', label: 'Hair' },
  { key: 'face', label: 'Face' },
  { key: 'facialHair', label: 'Facial hair' },
  { key: 'outfit', label: 'Outfit' },
  { key: 'extras', label: 'Extras' },
  { key: 'background', label: 'Background' },
];

// Same idle-life effect as the web builder: occasionally swap in a second
// render with eyes closed / mouth open, purely cosmetic while building.
const BLINKABLE_EYES = new Set(['default', 'happy', 'side', 'squint', 'wink', 'winkWacky', 'surprised']);
const TALKABLE_MOUTHS = new Set(['default', 'smile', 'twinkle', 'serious']);

function useFlicker(enabled, minDelay, maxDelay, holdMs) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setActive(false);
      return;
    }
    let offTimer;
    let onTimer;
    function schedule() {
      const delay = minDelay + Math.random() * (maxDelay - minDelay);
      offTimer = setTimeout(() => {
        setActive(true);
        onTimer = setTimeout(() => {
          setActive(false);
          schedule();
        }, holdMs);
      }, delay);
    }
    schedule();
    return () => {
      clearTimeout(offTimer);
      clearTimeout(onTimer);
    };
  }, [enabled, minDelay, maxDelay, holdMs]);
  return active;
}

function SectionLabel({ children, style }) {
  return (
    <Text style={[{ fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, color: '#a8a29e', marginBottom: 8 }, style]}>
      {children}
    </Text>
  );
}

// Rendered at its actual display size (56) rather than oversampling — RN
// bridges every SVG path/group into a real native view, so avoiding
// unnecessary geometry on ~29 simultaneously-mounted thumbnails (the Hair
// tab) matters a lot more here than it does for a browser <img>.
function OptionThumb({ traits, field, value, active, onPress }) {
  const xml = useMemo(() => buildSvgMarkup({ ...traits, [field]: value }, 56), [traits, field, value]);
  return (
    <Pressable3D onPress={onPress} pressDepth={2}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: active ? '#FF7A1A' : '#e7e5e4',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafaf9',
        }}
      >
        {value === 'none' ? (
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#a8a29e', textTransform: 'uppercase' }}>None</Text>
        ) : (
          <SvgXml xml={xml} width={56} height={56} />
        )}
      </View>
    </Pressable3D>
  );
}

function ColorDot({ hex, active, onPress }) {
  return (
    <Pressable3D onPress={onPress} pressDepth={2}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#' + hex, borderWidth: 2, borderColor: active ? '#FF7A1A' : '#e7e5e4' }} />
    </Pressable3D>
  );
}

export default function AvatarBuilderScreen({ navigation }) {
  const [traits, setTraits] = useState(DEFAULT_TRAITS);
  const [tab, setTab] = useState('hair');
  const [saving, setSaving] = useState(false);
  const svgRef = useRef(null);

  const blinking = useFlicker(BLINKABLE_EYES.has(traits.eyes), 2200, 5400, 130);
  const talking = useFlicker(TALKABLE_MOUTHS.has(traits.mouth), 3000, 6500, 220);

  const previewTraits = useMemo(
    () => ({ ...traits, eyes: blinking ? 'closed' : traits.eyes, mouth: talking ? 'screamOpen' : traits.mouth }),
    [traits, blinking, talking]
  );
  const previewXml = useMemo(() => buildSvgMarkup(previewTraits, 320), [previewTraits]);
  const exportXml = useMemo(() => buildSvgMarkup(traits, 320), [traits]);

  function set(field, value) {
    setTraits((t) => ({ ...t, [field]: value }));
  }

  function randomize() {
    haptics.impact();
    setTraits(randomTraits());
  }

  async function handleUse() {
    if (saving) return;
    setSaving(true);
    svgRef.current?.toDataURL(async (base64) => {
      try {
        const form = new FormData();
        form.append('file', { uri: `data:image/png;base64,${base64}`, type: 'image/png', name: 'avatar.png' });
        await api.upload('/me/avatar', form);
        haptics.success();
        navigation.goBack();
      } catch (e) {
        haptics.error();
        setSaving(false);
        Alert.alert('Couldn’t save avatar', e?.message || 'Please try again.');
      }
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f5f4f1]">
      <View className="flex-row items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
        <Text className="font-display text-lg font-extrabold text-stone-900">Build your avatar</Text>
        <Pressable onPress={() => navigation.goBack()} className="h-8 w-8 items-center justify-center rounded-full">
          <X size={20} color="#78716c" />
        </Pressable>
      </View>

      <View className="items-center gap-3 border-b border-stone-200 bg-white px-5 py-4">
        <View style={{ width: 128, height: 128, borderRadius: 28, overflow: 'hidden', backgroundColor: '#f5f5f4' }}>
          <SvgXml xml={previewXml} width={128} height={128} />
        </View>
        <Pressable3D onPress={randomize} pressDepth={2} className="flex-row items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2">
          <Shuffle size={14} color="#57534e" />
          <Text className="text-xs font-extrabold text-stone-700">Surprise me</Text>
        </Pressable3D>
      </View>

      {/* Offscreen full-quality render — export source for "Use this avatar",
          kept separate from the live preview so blink/talk flicker frames
          never get saved. */}
      <View style={{ position: 'absolute', left: -9999, top: 0, width: 320, height: 320 }} pointerEvents="none">
        <SvgXml xml={exportXml} override={{ ref: svgRef, width: 320, height: 320 }} />
      </View>

      <View style={{ height: 52, borderBottomWidth: 1, borderBottomColor: '#e7e5e4', backgroundColor: '#fff' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 12, gap: 4 }}
        >
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                height: 32,
                justifyContent: 'center',
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: tab === t.key ? '#FF7A1A' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: tab === t.key ? '#fff' : '#78716c' }}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        {tab === 'hair' && (
          <>
            <SectionLabel>Style</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {TOP_OPTIONS.map((v) => (
                <OptionThumb key={v} traits={traits} field="top" value={v} active={traits.top === v} onPress={() => set('top', v)} />
              ))}
            </View>
            <SectionLabel style={{ marginTop: 16 }}>Color</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {HAIR_COLORS.map((hex) => (
                <ColorDot key={hex} hex={hex} active={traits.hairColor === hex} onPress={() => set('hairColor', hex)} />
              ))}
            </View>
          </>
        )}

        {tab === 'face' && (
          <>
            <SectionLabel>Skin tone</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {SKIN_COLORS.map((hex) => (
                <ColorDot key={hex} hex={hex} active={traits.skinColor === hex} onPress={() => set('skinColor', hex)} />
              ))}
            </View>
            <SectionLabel style={{ marginTop: 16 }}>Eyes</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {EYES_OPTIONS.map((v) => (
                <OptionThumb key={v} traits={traits} field="eyes" value={v} active={traits.eyes === v} onPress={() => set('eyes', v)} />
              ))}
            </View>
            <SectionLabel style={{ marginTop: 16 }}>Eyebrows</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {EYEBROW_OPTIONS.map((v) => (
                <OptionThumb key={v} traits={traits} field="eyebrows" value={v} active={traits.eyebrows === v} onPress={() => set('eyebrows', v)} />
              ))}
            </View>
            <SectionLabel style={{ marginTop: 16 }}>Mouth</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {MOUTH_OPTIONS.map((v) => (
                <OptionThumb key={v} traits={traits} field="mouth" value={v} active={traits.mouth === v} onPress={() => set('mouth', v)} />
              ))}
            </View>
          </>
        )}

        {tab === 'facialHair' && (
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {FACIAL_HAIR_OPTIONS.map((v) => (
              <OptionThumb key={v} traits={traits} field="facialHair" value={v} active={traits.facialHair === v} onPress={() => set('facialHair', v)} />
            ))}
          </View>
        )}

        {tab === 'outfit' && (
          <>
            <SectionLabel>Clothing</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {CLOTHING_OPTIONS.map((v) => (
                <OptionThumb key={v} traits={traits} field="clothing" value={v} active={traits.clothing === v} onPress={() => set('clothing', v)} />
              ))}
            </View>
            <SectionLabel style={{ marginTop: 16 }}>Color</SectionLabel>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {CLOTHES_COLORS.map((hex, i) => (
                <ColorDot key={hex + i} hex={hex} active={traits.clothesColor === hex} onPress={() => set('clothesColor', hex)} />
              ))}
            </View>
          </>
        )}

        {tab === 'extras' && (
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {ACCESSORY_OPTIONS.map((v) => (
              <OptionThumb key={v} traits={traits} field="accessories" value={v} active={traits.accessories === v} onPress={() => set('accessories', v)} />
            ))}
          </View>
        )}

        {tab === 'background' && (
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {BG_COLORS.map((hex) => (
              <ColorDot key={hex} hex={hex} active={traits.backgroundColor === hex} onPress={() => set('backgroundColor', hex)} />
            ))}
          </View>
        )}
      </ScrollView>

      <View className="flex-row gap-2 border-t border-stone-200 bg-white px-4 py-3">
        <Pressable3D onPress={() => navigation.goBack()} pressDepth={2} className="flex-1 items-center rounded-xl bg-stone-100 py-3">
          <Text className="text-sm font-extrabold text-stone-700">Cancel</Text>
        </Pressable3D>
        <Pressable3D onPress={handleUse} disabled={saving} pressDepth={2} className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-3">
          {saving ? <ActivityIndicator color="#fff" /> : <Check size={16} color="#fff" />}
          <Text className="text-sm font-extrabold text-white">Use this avatar</Text>
        </Pressable3D>
      </View>
    </SafeAreaView>
  );
}
