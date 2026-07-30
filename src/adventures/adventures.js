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
  cobble: 43,        // light stone plaza floor (grassy — reads as a patio)
  stoneFloor: 109,   // solid grey stone floor (reads as paved / indoor)
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
        // Produce it as a full sentence (word-bank) after recognising it above.
        { wordbank: 'Now build the sentence: “I would like one coffee.”', answer: ['Ես', 'ուզում', 'եմ', 'մեկ', 'սուրճ'], tr: 'I would like one coffee.' },
        { line: 'Իհարկե՜։ Ահա Ձեր սուրճը։', by: 'npc', tr: 'Of course! Here is your coffee.' },
        {
          choose: 'She hands you the coffee. What do you say?',
          options: [
            { text: 'Շնորհակալությո՛ւն։', tr: 'Thank you!', correct: true },
            { text: 'Ցտեսությո՛ւն։', tr: 'Goodbye!' },
            { text: 'Ո՛չ։', tr: 'No!' },
          ],
        },
        // Scripted part done — now a short, free SPOKEN conversation with Անի
        // (real AI, Azure female voice). Finishes when she wraps up the chat.
        {
          ai: {
            personaDesc: 'a warm café barista in Yerevan',
            goal: 'Open by asking if the customer would like anything else (a pastry, water, the bill…). Let THEM tell you what they need and help with it naturally over a few turns. Once they are set, warmly wish them a nice day and say goodbye.',
            voice: 'female',
          },
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

// ── Adventure 2: At the Airport ──────────────────────────────────────────────
// A paved terminal (cobble apron + a building facade at the top). Three
// stations the traveller walks between: check-in desk → passport control →
// boarding gate, each its own goal. Dialogue is polite/formal register (Ձեր/Ձեզ)
// throughout, as you'd actually hear at Zvartnots.
const airportLegend = {
  '.': { g: TOWN.grass },
  'c': { g: TOWN.stoneFloor },
  'F': { g: TOWN.stoneFloor, d: TOWN.fenceH },   // barrier / queue rail on paved ground
  'T': { g: TOWN.grass, d: TOWN.treeGreen },
  'b': { g: TOWN.grass, d: TOWN.bush },
  'Q': { g: TOWN.stoneFloor, d: TOWN.roofL },
  'W': { g: TOWN.stoneFloor, d: TOWN.roofM },
  'E': { g: TOWN.stoneFloor, d: TOWN.roofR },
  'A': { g: TOWN.stoneFloor, d: TOWN.wallWindow },
  'D': { g: TOWN.stoneFloor, d: TOWN.wallDoor },
  'P': { g: TOWN.stoneFloor, d: TOWN.wallPlain },
  'H': { g: TOWN.stoneFloor, d: TOWN.crate },    // check-in / gate counter
  'L': { g: TOWN.stoneFloor, d: TOWN.barrel },   // luggage
  's': { g: TOWN.stoneFloor, d: TOWN.signpost }, // gate sign
};

const airportRows = [
  'QWWWWWWWWWWWWWWE',   // terminal roof
  'PPPPPPPDDPPPPPPP',   // terminal facade (boarding doors, centre)
  'FcccccccccsccccF',   // gate hall + a gate signpost
  'FccccccccccccccF',
  'FccccccccccccccF',
  'FccccccccccccccF',
  'FccccccccccccccF',   // passport officer stands here…
  'FccFFFFccFFFFccF',   // …behind a security barrier (gap in the middle)
  'FccccccccccccccF',
  'FccccccccccccccF',
  'FccccccccccccccF',
  'FcccccccccccLccF',   // luggage
  'FcccHHHccccccccF',   // check-in counter
  'FccccccccccccccF',
  'FccccccccccccccF',
  'FccccccccccccccF',
  'FccccccccccccccF',
  'FFFFFFFccFFFFFFF',   // perimeter fence + entrance gap
];

const airport = {
  id: 'airport',
  title: 'At the Airport',
  emoji: '🛫',
  blurb: 'Fly out of the country: check in, clear passport control, and board — all in Armenian.',
  cefr: 'A2',
  tileset: 'town',
  map: expandMap(airportRows, airportLegend),
  player: { frame: CHAR.adventurer, tx: 8, ty: 16 },   // enters at the bottom
  // You arrive holding a passport + ticket; you earn the boarding pass at
  // check-in and must present it at the gate. Presenting the right document is
  // part of the challenge, so the order (check-in → gate) is enforced naturally.
  startItems: [
    { id: 'passport', label: 'Անձնագիր', icon: '📘' },
    { id: 'ticket', label: 'Տոմս', icon: '🎫' },
  ],
  goals: [
    { id: 'checkin', label: 'Check in for your flight' },
    { id: 'passport', label: 'Clear passport control' },
    { id: 'board', label: 'Board your flight' },
  ],
  npcs: [
    {
      id: 'checkin',
      name: 'Լիլիթ',            // check-in agent
      frame: CHAR.woman,
      tx: 5, ty: 11,
      completes: 'checkin',
      dialogue: [
        { line: 'Բարև Ձեզ։ Ձեր տոմսն ու անձնագիրը, խնդրե՛մ։', by: 'npc', tr: 'Hello. Your ticket and passport, please.' },
        // Listen-and-pick: what did she ask for?
        {
          listen: 'Listen — what did Լիլիթ ask for?',
          audioText: 'Ձեր տոմսն ու անձնագիրը',
          options: [
            { text: 'Ձեր տոմսն ու անձնագիրը', tr: 'Your ticket and passport', correct: true },
            { text: 'Ձեր սուրճը', tr: 'Your coffee' },
            { text: 'Ձեր անունը', tr: 'Your name' },
          ],
        },
        { give: 'Present your ticket.', itemId: 'ticket', tr: 'Ձեր տոմսը' },
        { give: 'Now present your passport.', itemId: 'passport', tr: 'Ձեր անձնագիրը' },
        { line: 'Շնորհակալ եմ։ Ուղեբեռ ունե՞ք։', by: 'npc', tr: 'Thank you. Do you have any luggage?' },
        {
          choose: 'Say you have one suitcase.',
          options: [
            { text: 'Այո՛, մեկ ճամպրուկ։', tr: 'Yes, one suitcase.', correct: true },
            { text: 'Ո՛չ, ես կատու ունեմ։', tr: 'No, I have a cat.' },
            { text: 'Ժամը ե՞րբ է։', tr: 'What time is it?' },
          ],
        },
        {
          receive: { id: 'boarding', label: 'Նստ. կտրոն', icon: '🎟️' },
          line: 'Հիանալի՜։ Ահա Ձեր նստեցման կտրոնը։ Ձեր ելքը՝ հինգ։',
          by: 'npc', tr: 'Great! Here is your boarding pass. Your gate is five.',
        },
      ],
    },
    {
      id: 'passport',
      name: 'Դավիթ',            // passport control officer
      frame: CHAR.knight,
      tx: 8, ty: 6,
      completes: 'passport',
      dialogue: [
        { line: 'Բարև։ Անձնագի՛րը, խնդրե՛մ։', by: 'npc', tr: 'Hello. Passport, please.' },
        { give: 'Show your passport.', itemId: 'passport', tr: 'Ձեր անձնագիրը' },
        // Fill the blank — where are you going?
        {
          blank: 'Complete the sentence:', before: 'Ես մեկնում եմ', after: '։',
          options: [{ text: 'Երևան', correct: true }, { text: 'սուրճ' }, { text: 'շուն' }],
          tr: 'I am traveling to Yerevan.',
        },
        { line: 'Ո՞ւր եք մեկնում։', by: 'npc', tr: 'Where are you traveling to?' },
        {
          choose: 'Say you are flying to Yerevan.',
          options: [
            { text: 'Ես մեկնում եմ Երևան։', tr: 'I am traveling to Yerevan.', correct: true },
            { text: 'Ես սիրում եմ ձյունը։', tr: 'I like the snow.' },
            { text: 'Սա իմ շունն է։', tr: 'This is my dog.' },
          ],
        },
        { line: 'Ամեն ինչ կարգին է։ Բարի ճանապարհ։', by: 'npc', tr: 'Everything is in order. Have a good trip.' },
      ],
    },
    {
      id: 'gate',
      name: 'Անահիտ',           // boarding-gate agent
      frame: CHAR.princess,
      tx: 5, ty: 3,
      completes: 'board',
      dialogue: [
        { line: 'Բարև Ձեզ։ Ձեր նստեցման կտրո՛նը, խնդրե՛մ։', by: 'npc', tr: 'Hello. Your boarding pass, please.' },
        { give: 'Hand over your boarding pass.', itemId: 'boarding', tr: 'Ձեր նստեցման կտրոնը' },
        { line: 'Շնորհակալություն։ Բարի թռի՛չք։', by: 'npc', tr: 'Thank you. Have a good flight.' },
      ],
    },
  ],
};

// ── Roguelike/RPG pack tile indices (57 cols, 16px + 1px spacing) ────────────
// A much richer sheet than Tiny Town: grand "tufa" buildings, a fountain,
// market stalls, benches, lampposts. Used by rogue-tileset adventures.
export const ROGUE = {
  grass: 5, plaza: 120, plazaTan: 122, dirt: 6,
  treeG: 640, treeO: 641, hedge: 646, bush: 651,
  bench: 304, lamp: 416, flower: 469,
  awningO: 10, awningG: 11, stallL: 357, stallM: 358, stallR: 359,
  // grand tan building facade (top / mid / door rows)
  bTL: 697, bT: 698, bTR: 699,
  bML: 754, bM: 755, bMR: 756,
  bBL: 811, bDoor: 814, bBR: 817,
  // fountain (3×3)
  fTL: 409, fT: 410, fTR: 411,
  fML: 466, fM: 467, fMR: 468,
  fBL: 523, fB: 524, fBR: 525,
};

const sqLegend = {
  '.': { g: ROGUE.grass },
  'p': { g: ROGUE.plaza },
  'P': { g: ROGUE.plazaTan },
  'T': { g: ROGUE.grass, d: ROGUE.treeG },
  'o': { g: ROGUE.grass, d: ROGUE.treeO },
  'h': { g: ROGUE.plaza, d: ROGUE.hedge },
  'b': { g: ROGUE.plaza, d: ROGUE.bench },
  'l': { g: ROGUE.plaza, d: ROGUE.lamp },
  'f': { g: ROGUE.grass, d: ROGUE.flower },
  // grand building
  'Q': { g: ROGUE.grass, d: ROGUE.bTL }, 'W': { g: ROGUE.grass, d: ROGUE.bT }, 'E': { g: ROGUE.grass, d: ROGUE.bTR },
  'A': { g: ROGUE.grass, d: ROGUE.bML }, 'S': { g: ROGUE.grass, d: ROGUE.bM }, 'D': { g: ROGUE.grass, d: ROGUE.bMR },
  'Z': { g: ROGUE.plaza, d: ROGUE.bBL }, 'G': { g: ROGUE.plaza, d: ROGUE.bDoor }, 'C': { g: ROGUE.plaza, d: ROGUE.bBR },
  // fountain
  '1': { g: ROGUE.plaza, d: ROGUE.fTL }, '2': { g: ROGUE.plaza, d: ROGUE.fT }, '3': { g: ROGUE.plaza, d: ROGUE.fTR },
  '4': { g: ROGUE.plaza, d: ROGUE.fML }, '5': { g: ROGUE.plaza, d: ROGUE.fM }, '6': { g: ROGUE.plaza, d: ROGUE.fMR },
  '7': { g: ROGUE.plaza, d: ROGUE.fBL }, '8': { g: ROGUE.plaza, d: ROGUE.fB }, '9': { g: ROGUE.plaza, d: ROGUE.fBR },
  // market stalls
  'm': { g: ROGUE.plaza, d: ROGUE.awningO }, 'n': { g: ROGUE.plaza, d: ROGUE.awningG },
  'x': { g: ROGUE.plaza, d: ROGUE.stallM },
};

const sqRows = [
  '..QWEQWEQWEQWE....',
  '..ASDASDASDASD....',
  '..ZGCZGCZGCZGC....',
  '..pppppppppppp....',
  '.TpppppppppppppT..',
  '.lpmmnppppppppl...',
  '.bpxxxpppppppb....',
  '.ppppppppppppp....',
  '.pppppp123ppppp...',
  '.pppppp456ppppp...',
  '.TppppP789Pppph...',
  '.ppppppppppppp....',
  '.bpppppppppppb....',
  '.lppppTppTpppl....',
  '.pppppppppppp.....',
  '.oppppppppppo.....',
  '.pppppppppppp.....',
  '.hpppbppppbppph...',
  '.ppppppppppppp....',
  '.TppppppppppppT...',
  '..pppppp.ppppp....',
  '..TTTTT...TTTTT...',
];

// ── Adventure 3: A Day in Yerevan ────────────────────────────────────────────
// The big one: a city square with three "stops" — a bakery (top-left), a taxi
// stand (right), and Republic Square with its monument (bottom). It exercises
// every mechanic: speech bubbles, glossary, items + a shopping checklist,
// listen / word-bank / fill-blank / match / speaking exercises, cultural notes,
// and a free AI voice conversation. Authentic Eastern Armenian throughout.
const cityLegend = {
  '.': { g: TOWN.grass },
  ',': { g: TOWN.grassFlower },
  'c': { g: TOWN.cobble },
  'r': { g: TOWN.stoneFloor },
  'T': { g: TOWN.grass, d: TOWN.treeGreen },
  't': { g: TOWN.grass, d: TOWN.treeGreenSm },
  'b': { g: TOWN.grass, d: TOWN.bush },
  'Q': { g: TOWN.grass, d: TOWN.roofL },
  'W': { g: TOWN.grass, d: TOWN.roofM },
  'E': { g: TOWN.grass, d: TOWN.roofR },
  'A': { g: TOWN.grass, d: TOWN.wallWindow },
  'D': { g: TOWN.grass, d: TOWN.wallDoor },
  'P': { g: TOWN.grass, d: TOWN.wallPlain },
  'H': { g: TOWN.cobble, d: TOWN.crate },
  's': { g: TOWN.cobble, d: TOWN.signpost },
  'S': { g: TOWN.stoneFloor, d: TOWN.signpost },
};

const cityRows = [
  'TTTTTTTTTTTTTTTT',
  'T.QWE......QWE.T',
  'T.ADP......APD.T',
  'T.....cccc.....T',
  'T.HHH.cccccc...T',
  'T....cccccccc..T',
  'T....cccccccc..T',
  'T....cccccccc.ST',
  'T....cccccccc..T',
  'T.....cccccc...T',
  'T......cccc....T',
  'T......rrrr....T',
  'T......rrrr....T',
  'T.....rrrrrr...T',
  'T....cccccccc..T',
  'T...cccccccccc.T',
  'T...cccsscccc..T',
  'T...cccccccccc.T',
  'T...cccccccccc.T',
  'T....cccccccc..T',
  'TT...cccccc...TT',
  'TTTTTT.cc.TTTTTT',
];

const yerevan = {
  id: 'yerevan',
  title: 'A Day in Yerevan',
  emoji: '🏙️',
  blurb: 'Buy fresh lavash, hail a taxi, and reach Republic Square — a day out in Armenian.',
  cefr: 'A2',
  tileset: 'rogue',
  map: expandMap(sqRows, sqLegend),
  player: { frame: CHAR.adventurer, tx: 9, ty: 19 },
  startItems: [{ id: 'dram', label: 'Դրամ', icon: '💵' }],
  checklist: [
    { id: 'lavash', label: 'Լավաշ', icon: '🫓' },
    { id: 'gata', label: 'Գաթա', icon: '🥮' },
  ],
  goals: [
    { id: 'bakery', label: 'Buy lavash & gata' },
    { id: 'taxi', label: 'Take a taxi downtown' },
    { id: 'square', label: 'Reach Republic Square' },
  ],
  npcs: [
    {
      id: 'baker',
      name: 'Անուշ',
      frame: CHAR.woman,
      tx: 4, ty: 7,
      completes: 'bakery',
      dialogue: [
        { line: 'Բարև ձեզ։ Բարի՜ գալուստ մեր հացատուն։', by: 'npc', tr: 'Hello. Welcome to our bakery!' },
        { note: { emoji: '🫓', title: 'Լավաշ', body: 'Lavash — Armenia’s thin traditional flatbread — is on UNESCO’s heritage list. It’s baked against the wall of a clay oven called a թոնիր (tonir).' } },
        {
          listen: 'Listen — what does Անուշ have today?',
          audioText: 'Թարմ լավաշ և գաթա',
          options: [
            { text: 'Թարմ լավաշ և գաթա', tr: 'Fresh lavash and gata', correct: true },
            { text: 'Սառը սուրճ', tr: 'Cold coffee' },
            { text: 'Կարմիր գինի', tr: 'Red wine' },
          ],
        },
        { wordbank: 'Ask for bread: “I would like lavash.”', answer: ['Ես', 'ուզում', 'եմ', 'լավաշ'], tr: 'I would like lavash.' },
        { give: 'Pay with your dram.', itemId: 'dram', tr: 'Ձեր դրամը' },
        { receive: { id: 'lavash', label: 'Լավաշ', icon: '🫓' }, line: 'Ահա Ձեր թարմ լավաշը։', by: 'npc', tr: 'Here is your fresh lavash.' },
        { receive: { id: 'gata', label: 'Գաթա', icon: '🥮' }, line: 'Եւ մի կտոր գաթա՝ նվեր։', by: 'npc', tr: 'And a piece of gata — a gift.' },
      ],
    },
    {
      id: 'taxi',
      name: 'Գագիկ',
      frame: CHAR.warrior,
      tx: 13, ty: 7,
      completes: 'taxi',
      dialogue: [
        { line: 'Բարև։ Ո՞ւր ենք գնում։', by: 'npc', tr: 'Hello. Where are we going?' },
        { speak: 'Tell the driver where to go — say it out loud:', phrase: 'Հանրապետության հրապարակ, խնդրե՛մ', tr: 'To Republic Square, please.' },
        {
          blank: 'Tell him to go straight:', before: 'Գնացե՛ք', after: '։',
          options: [{ text: 'ուղիղ', correct: true }, { text: 'կաթ' }, { text: 'շուն' }],
          tr: 'Go straight.',
        },
        { line: 'Լավ, տա՛սը րոպեից տեղում կլինենք։', by: 'npc', tr: 'Alright, we’ll be there in ten minutes.' },
      ],
    },
    {
      id: 'local',
      name: 'Մարիամ',
      frame: CHAR.princess,
      tx: 8, ty: 11,
      completes: 'square',
      dialogue: [
        { line: 'Բարև՜։ Գեղեցի՛կ հրապարակ է, չէ՞։', by: 'npc', tr: 'Hello! Beautiful square, isn’t it?' },
        { note: { emoji: '⛲', title: 'Հանրապետության հրապարակ', body: 'Republic Square is the heart of Yerevan — famous for its “singing fountains” and buildings of pink volcanic tufa stone.' } },
        {
          match: 'Match the Armenian with its meaning:',
          pairs: [
            { a: 'ջրվեժ', b: 'fountain' },
            { a: 'հրապարակ', b: 'square' },
            { a: 'քաղաք', b: 'city' },
            { a: 'շենք', b: 'building' },
          ],
        },
        {
          ai: {
            personaDesc: 'a warm Yerevan local chatting with a visitor at Republic Square',
            goal: 'Chat warmly about Yerevan — ask the visitor if they like the city and suggest one thing to see or a food to try — then wish them a nice day.',
            voice: 'female',
          },
        },
        { line: 'Հաճելի զբոսանք։ Բարի ճանապարհ։', by: 'npc', tr: 'Enjoy your walk. Safe travels!' },
      ],
    },
  ],
};

export const ADVENTURES = [cafe, airport, yerevan];

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
