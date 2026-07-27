// src/lib/avatarBuilder.js — shared trait data + DiceBear generation for the
// mobile avatar builder. Mirrors src/AvatarBuilder.jsx on web (same trait
// option lists, so a "shortFlat" hairstyle looks identical on both
// platforms) but returns raw SVG strings instead of data URIs — mobile
// renders them via react-native-svg's <SvgXml>, which has no <canvas> to
// rasterize with, so saving POSTs the SVG text to POST /me/avatar/from-svg
// and the backend rasterizes it server-side (see backend/routes.py).
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

export const SKIN_COLORS = ['614335', 'd08b5b', 'ae5d29', 'edb98a', 'ffdbb4', 'fd9841', 'f8d25c'];
export const HAIR_COLORS = ['2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370', 'ecdcbf', 'c93305', 'f59797', 'e8e1e1'];
export const CLOTHES_COLORS = ['262e33', '3c4f5c', '5199e4', '65c9ff', 'b1e2ff', '929598', 'e6e6e6', 'ffffff', 'a7ffc4', 'ffafb9', 'ff488e', 'ff5c5c', '25557c'];
export const BG_COLORS = ['b6e3f4', 'ffd5dc', 'ffdfbf', 'c0f0c8', 'd1d4f9', 'f4d9b6', 'e0e0e0', 'ffe0f0'];

export const TOP_OPTIONS = [
  'shortFlat', 'shortRound', 'shortWaved', 'shortCurly', 'theCaesar', 'sides', 'shaggy', 'shaggyMullet',
  'curly', 'curvy', 'straight01', 'straight02', 'straightAndStrand', 'dreads01', 'dreads02', 'frizzle',
  'bob', 'bun', 'fro', 'froBand', 'bigHair', 'miaWallace', 'longButNotTooLong',
  'hat', 'hijab', 'turban', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04',
];
export const EYES_OPTIONS = ['default', 'happy', 'side', 'squint', 'wink', 'winkWacky', 'surprised', 'hearts', 'closed', 'cry', 'eyeRoll', 'xDizzy'];
export const EYEBROW_OPTIONS = ['defaultNatural', 'angryNatural', 'flatNatural', 'raisedExcitedNatural', 'sadConcernedNatural', 'unibrowNatural', 'upDownNatural'];
export const MOUTH_OPTIONS = ['smile', 'default', 'twinkle', 'serious', 'concerned', 'disbelief', 'sad', 'tongue', 'eating', 'grimace', 'screamOpen'];
export const FACIAL_HAIR_OPTIONS = ['none', 'beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'];
export const CLOTHING_OPTIONS = ['hoodie', 'shirtCrewNeck', 'shirtVNeck', 'shirtScoopNeck', 'collarAndSweater', 'overall', 'blazerAndShirt', 'blazerAndSweater', 'graphicShirt'];
export const ACCESSORY_OPTIONS = ['none', 'round', 'wayfarers', 'prescription01', 'prescription02', 'sunglasses', 'kurt', 'eyepatch'];

export const DEFAULT_TRAITS = {
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

export function randomTraits() {
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

export function buildAvatarSvg(traits, size = 200) {
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
