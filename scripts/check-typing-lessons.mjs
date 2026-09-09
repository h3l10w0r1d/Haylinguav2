#!/usr/bin/env node
// scripts/check-typing-lessons.mjs — guards the touch-typing curriculum in
// src/lib/armenianKeyboard.js.
//
//   node scripts/check-typing-lessons.mjs
//
// Two invariants, both of which have already caught real bugs:
//
//   1. A lesson may only drill keys it has actually taught. Introducing a
//      letter in a drill before its lesson means asking a learner to hunt
//      for a key nobody has shown them.
//   2. No two physical keys may claim the same Armenian character. When
//      that happened it meant a key had been misread off the keyboard
//      screenshot — the duplicate is the tell.
//
// It also reports which characters are still flagged `unsure`, so the
// quarantine in the final lesson stays visible rather than being forgotten.
import { LAYOUT, ROW_ORDER, LESSONS } from "../src/lib/armenianKeyboard.js";

let failures = 0;
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++; };
const ok = (msg) => console.log(`  ✓ ${msg}`);

// ── 1. layout sanity ──────────────────────────────────────────────────────
console.log("\nLayout");
const seen = new Map();          // char -> [keys]
const unsure = new Set();
let unknown = 0;
for (const row of ROW_ORDER) {
  for (const [key, ch, isUnsure] of LAYOUT[row]) {
    if (!ch) { unknown++; continue; }
    if (!seen.has(ch)) seen.set(ch, []);
    seen.get(ch).push(key);
    if (isUnsure) unsure.add(ch);
  }
}
const dupes = [...seen.entries()].filter(([, keys]) => keys.length > 1);
if (dupes.length) {
  for (const [ch, keys] of dupes) fail(`"${ch}" is claimed by more than one key: ${keys.join(", ")} — one of those reads is wrong`);
} else {
  ok(`${seen.size} characters mapped, no duplicates`);
}
ok(`${unknown} key(s) marked unknown, ${unsure.size} flagged unsure: ${[...unsure].join(" ") || "none"}`);

// ── 2. curriculum scope ───────────────────────────────────────────────────
console.log("\nCurriculum");
const trusted = new Set([...seen.keys()].filter((c) => !unsure.has(c)));
for (const lesson of LESSONS) {
  const allowed = lesson.keys ? new Set(lesson.keys) : trusted;
  const outOfScope = new Set();
  for (const drill of lesson.drills) {
    for (const ch of drill.replace(/\s/g, "")) if (!allowed.has(ch)) outOfScope.add(ch);
  }
  if (outOfScope.size) {
    fail(`L${lesson.id} "${lesson.name}" drills use untaught keys: ${[...outOfScope].join(" ")}`);
  } else {
    ok(`L${lesson.id} ${lesson.name} — ${lesson.drills.length} drills, all in scope`);
  }
  // An unverified lesson must say so, since that's what keeps a learner from
  // drilling a key position we aren't sure about.
  const usesUnsure = lesson.drills.some((d) => [...d].some((c) => unsure.has(c)));
  if (usesUnsure && !lesson.unverified) {
    fail(`L${lesson.id} uses unsure keys but isn't flagged unverified`);
  }
}

console.log(
  failures ? `\n${failures} problem(s) found\n` : `\nAll checks passed\n`
);
process.exit(failures ? 1 : 0);
