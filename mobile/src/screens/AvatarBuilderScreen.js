// src/screens/AvatarBuilderScreen.js — Duolingo-style "Pick your look"
// avatar builder. Full-screen modal (see RootNavigator.js), styled after
// the reference: a light preview panel up top (tinted by the chosen
// background color) and a dark bottom sheet with an icon-tab strip, color
// swatches, and a thumbnail grid per category.
//
// Mobile has no <canvas>, so unlike the web builder this can't rasterize
// the SVG to a PNG on-device before uploading — it POSTs the raw SVG text
// to POST /me/avatar/from-svg and the backend rasterizes it server-side
// (see backend/routes.py's me_avatar_from_svg), then returns the same
// {avatar_url} shape as a normal photo upload.
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { X, Shuffle, Scissors, Smile, Sparkles, Shirt, Glasses, Palette } from 'lucide-react-native';
import Pressable3D from '../components/Pressable3D';
import { api } from '../lib/api';
import { haptics } from '../lib/haptics';
import {
  DEFAULT_TRAITS,
  TOP_OPTIONS,
  EYES_OPTIONS,
  EYEBROW_OPTIONS,
  MOUTH_OPTIONS,
  FACIAL_HAIR_OPTIONS,
  CLOTHING_OPTIONS,
  ACCESSORY_OPTIONS,
  SKIN_COLORS,
  HAIR_COLORS,
  CLOTHES_COLORS,
  BG_COLORS,
  randomTraits,
  buildAvatarSvg,
} from '../lib/avatarBuilder';

const CATEGORIES = [
  { key: 'hair', label: 'Hair', icon: Scissors },
  { key: 'face', label: 'Face', icon: Smile },
  { key: 'facialHair', label: 'Facial hair', icon: Sparkles },
  { key: 'outfit', label: 'Outfit', icon: Shirt },
  { key: 'extras', label: 'Glasses', icon: Glasses },
  { key: 'background', label: 'Background', icon: Palette },
];

function humanize(value) {
  if (value === 'none') return 'None';
  return value.replace(/([A-Z0-9]+)/g, ' $1').trim();
}

function OptionThumb({ traits, field, value, active, onPress }) {
  const xml = useMemo(() => buildAvatarSvg({ ...traits, [field]: value }, 96), [traits, field, value]);
  return (
    <Pressable3D onPress={onPress} pressDepth={2}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: active ? '#FF7A1A' : 'transparent',
          backgroundColor: '#292524',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {value === 'none' ? (
          <Text style={{ fontSize: 9, fontWeight: '800', color: '#a8a29e', textTransform: 'uppercase' }}>None</Text>
        ) : (
          <SvgXml xml={xml} width={64} height={64} />
        )}
      </View>
    </Pressable3D>
  );
}

function ColorDot({ hex, active, onPress }) {
  return (
    <Pressable3D onPress={onPress} pressDepth={2}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: `#${hex}`,
          borderWidth: active ? 3 : 0,
          borderColor: '#FF7A1A',
        }}
      />
    </Pressable3D>
  );
}

function SectionLabel({ children }) {
  return <Text style={{ marginBottom: 8, marginTop: 16, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: '#78716c' }}>{children}</Text>;
}

export default function AvatarBuilderScreen({ navigation }) {
  const [traits, setTraits] = useState(DEFAULT_TRAITS);
  const [category, setCategory] = useState('hair');
  const [saving, setSaving] = useState(false);

  const previewXml = useMemo(() => buildAvatarSvg(traits, 320), [traits]);
  const previewBg = `#${traits.backgroundColor}`;

  function set(field, value) {
    setTraits((t) => ({ ...t, [field]: value }));
  }

  function randomize() {
    haptics.impact();
    setTraits(randomTraits());
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const svg = buildAvatarSvg(traits, 320);
      await api.post('/me/avatar/from-svg', { svg });
      haptics.success();
      navigation.goBack();
    } catch (e) {
      haptics.error();
      setSaving(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#151517' }}>
      {/* Preview panel */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: previewBg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <X size={26} color="#292524" />
          </Pressable>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#292524' }}>Pick your look</Text>
          <Pressable3D onPress={handleSave} disabled={saving} pressDepth={2} style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}>
            {saving ? <ActivityIndicator size="small" color="#292524" /> : <Text style={{ fontSize: 13, fontWeight: '800', color: '#292524' }}>SAVE</Text>}
          </Pressable3D>
        </View>
        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
          <View style={{ width: 200, height: 200, borderRadius: 100, overflow: 'hidden' }}>
            <SvgXml xml={previewXml} width={200} height={200} />
          </View>
        </View>
      </SafeAreaView>

      {/* Dark sheet */}
      <View style={{ flex: 1, backgroundColor: '#1c1917', paddingTop: 16 }}>
        <View style={{ paddingHorizontal: 16 }}>
          <Pressable3D onPress={randomize} pressDepth={2} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#292524', borderRadius: 14, paddingVertical: 10, marginBottom: 12 }}>
            <Shuffle size={15} color="#fff" />
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>Surprise me</Text>
          </Pressable3D>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }} style={{ flexGrow: 0 }}>
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = category === c.key;
            return (
              <Pressable3D
                key={c.key}
                onPress={() => setCategory(c.key)}
                pressDepth={2}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? '#FF7A1A' : '#292524',
                }}
              >
                <Icon size={20} color={active ? '#fff' : '#a8a29e'} />
              </Pressable3D>
            );
          })}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {category === 'hair' && (
            <>
              <SectionLabel>Hair color</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {HAIR_COLORS.map((hex) => (
                  <ColorDot key={hex} hex={hex} active={traits.hairColor === hex} onPress={() => set('hairColor', hex)} />
                ))}
              </View>
              <SectionLabel>Style</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {TOP_OPTIONS.map((v) => (
                  <OptionThumb key={v} traits={traits} field="top" value={v} active={traits.top === v} onPress={() => set('top', v)} />
                ))}
              </View>
            </>
          )}

          {category === 'face' && (
            <>
              <SectionLabel>Skin tone</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {SKIN_COLORS.map((hex) => (
                  <ColorDot key={hex} hex={hex} active={traits.skinColor === hex} onPress={() => set('skinColor', hex)} />
                ))}
              </View>
              <SectionLabel>Eyes</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {EYES_OPTIONS.map((v) => (
                  <OptionThumb key={v} traits={traits} field="eyes" value={v} active={traits.eyes === v} onPress={() => set('eyes', v)} />
                ))}
              </View>
              <SectionLabel>Eyebrows</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {EYEBROW_OPTIONS.map((v) => (
                  <OptionThumb key={v} traits={traits} field="eyebrows" value={v} active={traits.eyebrows === v} onPress={() => set('eyebrows', v)} />
                ))}
              </View>
              <SectionLabel>Mouth</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {MOUTH_OPTIONS.map((v) => (
                  <OptionThumb key={v} traits={traits} field="mouth" value={v} active={traits.mouth === v} onPress={() => set('mouth', v)} />
                ))}
              </View>
            </>
          )}

          {category === 'facialHair' && (
            <>
              <SectionLabel>Facial hair</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {FACIAL_HAIR_OPTIONS.map((v) => (
                  <OptionThumb key={v} traits={traits} field="facialHair" value={v} active={traits.facialHair === v} onPress={() => set('facialHair', v)} />
                ))}
              </View>
            </>
          )}

          {category === 'outfit' && (
            <>
              <SectionLabel>Color</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CLOTHES_COLORS.map((hex, i) => (
                  <ColorDot key={hex + i} hex={hex} active={traits.clothesColor === hex} onPress={() => set('clothesColor', hex)} />
                ))}
              </View>
              <SectionLabel>Clothing</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {CLOTHING_OPTIONS.map((v) => (
                  <OptionThumb key={v} traits={traits} field="clothing" value={v} active={traits.clothing === v} onPress={() => set('clothing', v)} />
                ))}
              </View>
            </>
          )}

          {category === 'extras' && (
            <>
              <SectionLabel>Glasses</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {ACCESSORY_OPTIONS.map((v) => (
                  <OptionThumb key={v} traits={traits} field="accessories" value={v} active={traits.accessories === v} onPress={() => set('accessories', v)} />
                ))}
              </View>
            </>
          )}

          {category === 'background' && (
            <>
              <SectionLabel>Background</SectionLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {BG_COLORS.map((hex) => (
                  <ColorDot key={hex} hex={hex} active={traits.backgroundColor === hex} onPress={() => set('backgroundColor', hex)} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
