#!/usr/bin/env node
// scripts/verify.mjs — one-command verification harness for Haylingua.
//
//   npm run verify                 → full check against prod API
//   API_BASE=http://localhost:8000 npm run verify
//   SKIP_BUILD=1 npm run verify    → skip the vite build (faster)
//   TEST_EMAIL=… TEST_PASSWORD=…   → adds authenticated read-only smoke tests
//
// Stages:
//   1. Backend compile  — python3 -m py_compile on every backend/*.py
//   2. Grading units    — typo_check + grade_attempt sanity tests
//   3. Frontend build   — vite build (catches JSX/import errors)
//   4. API smoke        — every route must exist (401/422 ≠ 404) + live checks
//
// Exit code 0 = everything green; 1 = at least one failure.

import { execSync, spawnSync } from "node:child_process";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const API_BASE = (process.env.API_BASE || "https://haylinguav2.onrender.com").replace(/\/$/, "");

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

let passed = 0, failed = 0, skipped = 0;
const failures = [];

function ok(name, extra = "") {
  passed++;
  console.log(`  ${green("✓")} ${name}${extra ? "  " + yellow(extra) : ""}`);
}
function bad(name, why) {
  failed++;
  failures.push(`${name} — ${why}`);
  console.log(`  ${red("✗")} ${name} — ${red(why)}`);
}
function skip(name, why) {
  skipped++;
  console.log(`  ${yellow("→")} ${name} ${yellow(`(skipped: ${why})`)}`);
}
function stage(title) {
  console.log(`\n${bold(title)}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Stage 1 — backend compile
// ────────────────────────────────────────────────────────────────────────────
stage("1/4 Backend compile");
{
  const files = readdirSync(path.join(ROOT, "backend")).filter((f) => f.endsWith(".py"));
  const r = spawnSync("python3", ["-m", "py_compile", ...files.map((f) => path.join("backend", f))], {
    cwd: ROOT, encoding: "utf8",
  });
  if (r.status === 0) ok(`py_compile — ${files.length} files`);
  else bad("py_compile", (r.stderr || "").split("\n").slice(-6).join(" ").trim());
}

// ────────────────────────────────────────────────────────────────────────────
// Stage 2 — grading unit tests (typo forgiveness + core grade_attempt)
// ────────────────────────────────────────────────────────────────────────────
stage("2/4 Grading unit tests");
{
  const py = `
import sys; sys.path.insert(0, "backend")
import grading

fails = []
def t(name, got, want):
    if got != want: fails.append(f"{name}: got {got!r}, want {want!r}")

# typo_check
t("typo: exact match is not a typo",
  grading.typo_check(kind="word_spelling", expected_answer="բարև", config=None, answer_text="բարև"), None)
t("typo: 1-char slip forgiven",
  grading.typo_check(kind="write_translate", expected_answer="good morning", config=None, answer_text="good mornng"), "good morning")
t("typo: single letters never forgiven",
  grading.typo_check(kind="letter_typing", expected_answer="Ա", config=None, answer_text="Բ"), None)
t("typo: MCQ kinds never forgiven",
  grading.typo_check(kind="translate_mcq", expected_answer="bread", config=None, answer_text="braed"), None)
t("typo: wildly different rejected",
  grading.typo_check(kind="word_spelling", expected_answer="բարև", config=None, answer_text="հաց"), None)

# grade_attempt core paths
t("grade: free text correct",
  grading.grade_attempt(kind="fill_blank", expected_answer="հաց", config=None, options=None,
                        answer_text="Հաց ", selected_indices=None), True)
t("grade: free text wrong",
  grading.grade_attempt(kind="fill_blank", expected_answer="հաց", config=None, options=None,
                        answer_text="ջուր", selected_indices=None), False)
t("grade: MCQ flagged option",
  grading.grade_attempt(kind="translate_mcq", expected_answer=None, config=None,
                        options=[{"text":"Sun","is_correct":False},{"text":"Bread","is_correct":True}],
                        answer_text="Bread", selected_indices=[1]), True)
t("grade: MCQ wrong pick",
  grading.grade_attempt(kind="translate_mcq", expected_answer=None, config=None,
                        options=[{"text":"Sun","is_correct":False},{"text":"Bread","is_correct":True}],
                        answer_text="Sun", selected_indices=[0]), False)
t("grade: info kinds always pass",
  grading.grade_attempt(kind="char_intro", expected_answer=None, config=None, options=None,
                        answer_text=None, selected_indices=None), True)
t("grade: word order",
  grading.grade_attempt(kind="word_bank", expected_answer=None, config={"solution":["Ես","հաց","եմ","ուտում"]},
                        options=None, answer_text="Ես հաց եմ ուտում", selected_indices=None), True)
t("grade: unknown kind never passes",
  grading.grade_attempt(kind="mystery", expected_answer="x", config=None, options=None,
                        answer_text="x", selected_indices=None), False)

if fails:
    print("FAIL::" + " || ".join(fails)); sys.exit(1)
print("PASS::12 assertions")
`;
  const r = spawnSync("python3", ["-c", py], { cwd: ROOT, encoding: "utf8" });
  const out = (r.stdout || "").trim();
  if (r.status === 0 && out.startsWith("PASS::")) ok(`grading tests — ${out.split("::")[1]}`);
  else bad("grading tests", out.replace("FAIL::", "") || (r.stderr || "").slice(-300));
}

// ────────────────────────────────────────────────────────────────────────────
// Stage 3 — frontend build
// ────────────────────────────────────────────────────────────────────────────
stage("3/4 Frontend build");
if (process.env.SKIP_BUILD) {
  skip("vite build", "SKIP_BUILD=1");
} else {
  try {
    execSync("npx vite build --mode development --logLevel error", { cwd: ROOT, stdio: "pipe" });
    ok("vite build");
  } catch (e) {
    bad("vite build", (e.stderr?.toString() || e.message).split("\n").slice(0, 4).join(" "));
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Stage 4 — live API smoke
// ────────────────────────────────────────────────────────────────────────────
stage(`4/4 API smoke — ${API_BASE}`);

async function req(method, p, { token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined) h["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${API_BASE}${p}`, {
      method, headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, error: e.message };
  }
}

// A route "exists" when the server answers anything except 404/405/0.
// Auth-protected routes answer 401/403/422 without a token.
const ROUTES = [
  // core
  ["GET", "/health", { expect: [200] }],
  ["POST", "/login", {}],
  ["GET", "/me/practice", {}],
  ["GET", "/me/stats", {}],
  ["GET", "/me/streak", {}],
  ["GET", "/me/quests", {}],
  ["GET", "/me/league", {}],
  ["GET", "/me/wallet", {}],
  ["GET", "/me/review/stats", {}],
  ["GET", "/conversation/scenarios", { expect: [200] }],
  ["POST", "/conversation/turn", {}],
  // new: failure moment
  ["POST", "/me/exercises/1/explain", {}],
  ["POST", "/me/hearts/earn", {}],
  // new: mistakes hub
  ["GET", "/me/mistakes", {}],
  ["GET", "/me/mistakes/count", {}],
  // new: word hints + exposure
  ["GET", "/me/word-hint?word=%D5%B0%D5%A1%D6%81", {}],
  ["POST", "/me/words/expose", {}],
  // new: email reminders
  ["POST", "/me/email-reminders", {}],
  ["POST", "/cron/send-streak-emails", {}],
];

const health = await req("GET", "/health");
if (health.status === 0) {
  bad("API reachable", `cannot reach ${API_BASE} (${health.error})`);
} else {
  ok("API reachable", `HTTP ${health.status}`);

  for (const [method, p, opts] of ROUTES) {
    const r = await req(method, p, { body: method === "POST" ? {} : undefined });
    const label = `${method} ${p.split("?")[0]}`;
    if (opts.expect) {
      if (opts.expect.includes(r.status)) ok(label, `${r.status}`);
      else bad(label, `expected ${opts.expect.join("/")}, got ${r.status}`);
    } else if ([404, 405, 0].includes(r.status)) {
      bad(label, `route missing (${r.status || r.error})`);
    } else {
      ok(label, `exists (${r.status})`);
    }
  }

  // ── Authenticated read-only checks (optional) ──────────────────────────
  const email = process.env.TEST_EMAIL, password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    skip("authenticated checks", "set TEST_EMAIL + TEST_PASSWORD to enable");
  } else {
    const login = await req("POST", "/login", { body: { email, password } });
    const token = login.json?.access_token;
    if (!token) {
      bad("login as test user", `HTTP ${login.status}: ${JSON.stringify(login.json)?.slice(0, 120)}`);
    } else {
      ok("login as test user");
      const AUTHED = [
        ["GET", "/me/stats", (j) => Number.isFinite(j?.total_xp)],
        ["GET", "/me/streak", (j) => "streak" in (j || {})],
        ["GET", "/me/quests", (j) => Array.isArray(j?.quests)],
        ["GET", "/me/wallet", (j) => j && typeof j === "object"],
        ["GET", "/me/review/stats", (j) => "due_today" in (j || {})],
        ["GET", "/me/practice", (j) => Array.isArray(j?.exercises)],
        ["GET", "/me/mistakes", (j) => Array.isArray(j?.exercises)],
        ["GET", "/me/mistakes/count", (j) => Number.isFinite(j?.count)],
        ["GET", "/me/hearts", (j) => j && ("current" in j || "hearts_current" in j)],
      ];
      for (const [method, p, check] of AUTHED) {
        const r = await req(method, p, { token });
        if (r.status === 200 && check(r.json)) ok(`${method} ${p} (authed)`, "200 + shape ok");
        else bad(`${method} ${p} (authed)`, `HTTP ${r.status}, body ${JSON.stringify(r.json)?.slice(0, 100)}`);
      }
      // words/expose round-trip: same nonce word is NEW once, then not.
      const nonce = `վերիֆ${Date.now() % 100000}`;
      const first = await req("POST", "/me/words/expose", { token, body: { words: [nonce] } });
      const second = await req("POST", "/me/words/expose", { token, body: { words: [nonce] } });
      if (first.json?.new_words?.length === 1 && second.json?.new_words?.length === 0) {
        ok("POST /me/words/expose round-trip", "new→seen works");
      } else {
        bad("POST /me/words/expose round-trip",
          `first=${JSON.stringify(first.json)} second=${JSON.stringify(second.json)}`);
      }
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${bold("Result:")} ${green(passed + " passed")}, ${failed ? red(failed + " failed") : "0 failed"}${skipped ? `, ${yellow(skipped + " skipped")}` : ""}`);
if (failures.length) {
  console.log(red("\nFailures:"));
  failures.forEach((f) => console.log(red(`  • ${f}`)));
}
process.exit(failed ? 1 : 0);
