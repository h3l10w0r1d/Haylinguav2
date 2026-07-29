// src/adventures/adventures.js
// Data-driven "Adventures" (Duolingo-style walk-through-a-scene mini quests).
//
// Each adventure describes a small top-down tile world the learner walks a
// character around, plus NPCs they walk up to and talk with. Art is Kenney's
// CC0 "Tiny Town" (map) + "Tiny Dungeon" (characters) — public domain, so no
// attribution or licensing strings attached. Both sheets are 12×11 grids of
// 16×16 tiles served from /adventures/kenney/*/Tilemap/tilemap_packed.png.
//
// The map is authored as ASCII art with a per-adventure legend so scenes stay
// readable and editable. expandMap() turns that into two numeric tile layers:
//   ground — always drawn, never collides (grass / cobble / paths)
//   decor  — solid props drawn on top (trees / walls / counters); -1 = empty
//
// Dialogue is a lightweight self-contained script (no server grading — this is
// a practice mode): a list of steps, each either a `line` (someone speaks) or a
// `choose` task (learner picks the right Armenian reply). Finishing an NPC's
// script fires its `completes` goal; all goals done → the adventure is won.

// ── Tiny Town tile indices (row-major, 12 cols) ──────────────────────────────
export const TOWN = {
  grass: 0,
  grassFlower: 1,
  grassSpark: 2,
  cobble: 43,        // light stone plaza floor
  dirt: 25,          // dirt patch centre
  treeGreen: 4,
  treeGreenSm: 6,
  treeOrange: 3,
  bush: 5,
  roofL: 48, roofM: 49, roofR: 50,
  wallWindow: 84, wallDoor: 85, wallPlain: 86,
  fenceH: 45, fenceL: 44, fenceR: 46,
  signpost: 82,
  crate: 107,
  barrel: 106,
};

// Solid tiles the player cannot walk through (everything placed on `decor`
// collides by default; this set is a readability aid / future-proofing).
export const SOLID = new Set([
  TOWN.treeGreen, TOWN.treeGreenSm, TOWN.treeOrange, TOWN.bush,
  TOWN.roofL, TOWN.roofM, TOWN.roofR,
  TOWN.wallWindow, TOWN.wallDoor, TOWN.wallPlain,
  TOWN.fenceH, TOWN.fenceL, TOWN.fenceR,
  TOWN.signpost, TOWN.crate, TOWN.barrel,
]);

// ── Tiny Dungeon character frames (12 cols) ──────────────────────────────────
export const CHAR = {
  adventurer: 98,   // brown-haired traveller — the player
  warrior: 85,
  woman: 88,        // villager — barista
  princess: 99,     // long-haired — a café guest
  elder: 100,       // grey-bearded mage — a guest
  greenElf: 112,
  knight: 96,
};

// Expand ASCII rows + legend into { width, height, ground[], decor[] }.
// Each legend entry: { g: groundIdx, d?: decorIdx }. Missing d ⇒ -1 (empty).
export function expandMap(rows, legend) {
  const height = rows.length;
  const width = Math.max(...rows.map((r) => r.length));
  const ground = [];
  const decor = [];
  for (let y = 0; y < height; y++) {
    const grow = [];
    const drow = [];
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x] ?? ' ';
      const spec = legend[ch] || legend['.'];
      grow.push(spec.g ?? TOWN.grass);
      drow.push(spec.d ?? -1);
    }
    ground.push(grow);
    decor.push(drow);
  }
  return { width, height, ground, decor };
}

// ── Adventure 1: At the Café ─────────────────────────────────────────────────
// Legend:
//   . grass   , flower grass   c cobble plaza
//   T tree    b bush           # fence
//   Q W E house roof           A wall+window  D wall+door  P wall plain
//   H counter (crate)          s signpost
const cafeLegend = {
  '.': { g: TOWN.grass },
  ',': { g: TOWN.grassFlower },
  'c': { g: TOWN.cobble },
  'T': { g: TOWN.grass, d: TOWN.treeGreen },
  't': { g: TOWN.grass, d: TOWN.treeGreenSm },
  'b': { g: TOWN.grass, d: TOWN.bush },
  '#': { g: TOWN.grass, d: TOWN.fenceH },
  'Q': { g: TOWN.grass, d: TOWN.roofL },
  'W': { g: TOWN.grass, d: TOWN.roofM },
  'E': { g: TOWN.grass, d: TOWN.roofR },
  'A': { g: TOWN.grass, d: TOWN.wallWindow },
  'D': { g: TOWN.grass, d: TOWN.wallDoor },
  'P': { g: TOWN.grass, d: TOWN.wallPlain },
  'H': { g: TOWN.cobble, d: TOWN.crate },
  's': { g: TOWN.grass, d: TOWN.signpost },
};

const cafeRows = [
  'TTTTTTTTTTTTTTTT',
  'T..QWE....QWE..T',
  'T..ADP....APD..T',
  'T.....cccc.....T',
  'T....cccccc....T',
  'T...cccHHccc...T',
  'T...cccccccc...T',
  'T...cccccccc...T',
  'T...cccccccc...T',
  'T...cccccccc...T',
  'T....cccccc....T',
  'T,....cccc....,T',
  'T.b..cccccc..b.T',
  'T....cccccc....T',
  'T,...cccccc...,T',
  'TT...cccccc..sTT',
  'TTTTTTT..TTTTTTT',
];

const cafe = {
  id: 'cafe',
  title: 'At the Café',
  emoji: '☕',
  blurb: 'Walk into the village café and order a coffee — in Armenian.',
  cefr: 'A1',
  tileset: 'town',
  map: expandMap(cafeRows, cafeLegend),
  player: { frame: CHAR.adventurer, tx: 8, ty: 14 },  // spawns at the entrance
  goals: [{ id: 'order', label: 'Order a coffee' }],
  npcs: [
    {
      id: 'barista',
      name: 'Անի',        // "Ani", the barista
      frame: CHAR.woman,
      tx: 7, ty: 4,        // behind the counter
      completes: 'order',
      dialogue: [
        { line: 'Բարև ձեզ! Ի՞նչ կցանկանաք։', by: 'npc', tr: 'Hello! What would you like?' },
        {
          choose: 'How do you politely ask for a coffee?',
          options: [
            { text: 'Մեկ սուրճ, խնդրում եմ։', tr: 'One coffee, please.', correct: true },
            { text: 'Ես շուն եմ։', tr: 'I am a dog.' },
            { text: 'Ժամը քանի՞սն է։', tr: 'What time is it?' },
          ],
        },
        { line: 'Իհարկե՜։ Ահա Ձեր սուրճը։', by: 'npc', tr: 'Of course! Here is your coffee.' },
        {
          choose: 'She hands you the coffee. What do you say?',
          options: [
            { text: 'Շնորհակալությո՛ւն։', tr: 'Thank you!', correct: true },
            { text: 'Ցտեսությո՛ւն։', tr: 'Goodbye!' },
            { text: 'Ո՛չ։', tr: 'No!' },
          ],
        },
        { line: 'Բարի ախորժակ։ 😊', by: 'npc', tr: 'Enjoy! / Bon appétit.' },
      ],
    },
    {
      id: 'guest',
      name: 'Արամ',
      frame: CHAR.elder,
      tx: 10, ty: 8,
      optional: true,
      dialogue: [
        { line: 'Բարև՜։ Գեղեցիկ օր է, չէ՞։', by: 'npc', tr: 'Hello! Beautiful day, isn’t it?' },
        {
          choose: 'Greet him back.',
          options: [
            { text: 'Բարև՜, այո՛, շատ գեղեցիկ։', tr: 'Hello, yes, very beautiful.', correct: true },
            { text: 'Կաթը սեղանին է։', tr: 'The milk is on the table.' },
          ],
        },
        { line: 'Հաճելի օր անցկացրու։', by: 'npc', tr: 'Have a nice day.' },
      ],
    },
  ],
};

export const ADVENTURES = [cafe];

export function getAdventure(id) {
  return ADVENTURES.find((a) => a.id === id) || null;
}

// ── CMS overrides (Tier-1 authoring) ─────────────────────────────────────────
// The map, NPC positions/sprites, player spawn and grading structure stay in
// code (above). Editors can override only the *language content* via the CMS:
// titles/blurbs, goal labels, NPC names, and the text of each dialogue step.
// An override is stored per adventure id as this (all-optional) shape:
//
//   { title?, blurb?,
//     goals?: { [goalId]: label },
//     npcs?:  { [npcId]: { name?, dialogue?: [ perStep ] } } }
//
// where perStep is { line?, tr? } for a spoken line or
// { choose?, options?: [{ text?, tr? }] } for a choice. Anything missing falls
// back to the code default, and step COUNT/TYPE and which option is `correct`
// always come from code — so a CMS edit can reword content but never break the
// scene layout or the grading. Merge is index-aligned and defensive: a step
// whose type doesn't match the code (e.g. after a code change) just falls back.
export function mergeAdventure(base, override) {
  if (!base || !override) return base;
  const mergedGoals = base.goals.map((g) => ({
    ...g,
    label: override.goals?.[g.id] ?? g.label,
  }));
  const mergedNpcs = base.npcs.map((n) => {
    const o = override.npcs?.[n.id];
    if (!o) return n;
    const dialogue = n.dialogue.map((step, i) => {
      const os = o.dialogue?.[i];
      if (!os) return step;
      if (step.line != null) {
        return { ...step, line: os.line ?? step.line, tr: os.tr ?? step.tr };
      }
      if (step.options) {
        return {
          ...step,
          choose: os.choose ?? step.choose,
          options: step.options.map((opt, j) => ({
            ...opt,                                    // keeps `correct` from code
            text: os.options?.[j]?.text ?? opt.text,
            tr: os.options?.[j]?.tr ?? opt.tr,
          })),
        };
      }
      return step;
    });
    return { ...n, name: o.name ?? n.name, dialogue };
  });
  return {
    ...base,
    title: override.title ?? base.title,
    blurb: override.blurb ?? base.blurb,
    goals: mergedGoals,
    npcs: mergedNpcs,
  };
}

// Fetch all overrides ({ [adventureId]: override }) from the backend. Best-effort:
// any failure yields {} so adventures always fall back to their code defaults.
export async function fetchAdventureOverrides(apiBase) {
  try {
    const res = await fetch(`${apiBase}/adventures/overrides`);
    if (!res.ok) return {};
    const data = await res.json();
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}
