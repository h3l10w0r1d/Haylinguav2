# AI mistake tutor — caching design

## Status quo (already shipped, not a greenfield feature)

The "why was this wrong?" tutor already exists end-to-end in real lessons — this
is **not** the landing-page demo (`LandingExerciseDemo` in `src/LandingPage.jsx`,
which is fully scripted/canned for marketing). The real thing:

- **Backend**: `POST /me/exercises/{exercise_id}/explain` (`backend/routes.py:4850-4966`).
  Looks up the exercise's `kind, prompt, expected_answer, sentence_before,
  sentence_after, config`, derives the correct answer, and calls `gpt-4o`
  (`max_tokens=120, temperature=0.4`) with a system prompt that tells the model
  the answer was *already* graded wrong server-side and it must never
  contradict that verdict. A guardrail scans the response for contradiction
  phrases ("actually correct", "you're right", …) and swaps in a deterministic
  fallback if found.
- **Frontend**: `ExplainMistake` (`src/ExerciseShell.jsx:71-115`) — a button
  ("Why was this wrong?") in the wrong-answer result sheet that POSTs
  `{ user_answer }` and renders the returned explanation. Wired from
  `src/ExerciseRenderer.jsx` (~line 2463), which threads `exerciseId` +
  `userAnswer` into the result payload specifically so this button can appear.

**The gap**: every click is a live GPT-4o call. There is currently **no
caching** on this endpoint — the exact same (exercise, wrong answer) pair
re-prompts the model every single time, whether that's:

1. The same learner tapping "Why was this wrong?" again after re-reading it,
   or getting the same exercise again later (spaced repetition resurfaces it).
2. A different learner making the identical mistake on a popular exercise
   (multiple-choice wrong options are a small, closed set — most learners who
   get a given MC exercise wrong pick from 2-3 predictable wrong options).

There's also no endpoint-specific rate limit — `/explain` only inherits the
generic 300 req/min/IP global rule (`backend/middleware/rate_limit.py:32`), and
identifier-based throttling doesn't apply because it keys off body fields like
`email`/`username` (`_extract_identifier`, `rate_limit.py:129-145`), which
`ExplainIn` (`{user_answer}`) never has.

This doc is the caching design to fix both, following a pattern **already
proven in this codebase**: the `word_hints` table
(`backend/ensure_schema.py:87-93`), used by `GET /me/word-hint`
(`backend/routes.py:4980-5037`) to cache GPT-4o word glosses across *all*
users, keyed by normalized word text.

## Why a global (cross-user) cache is correct here, not a per-user one

The explanation is **deterministic given its inputs** — it depends only on:

- the exercise's fixed content (`kind`, `prompt`, `expected_answer`, sentence
  context), and
- the learner's wrong answer text.

It does **not** depend on who the learner is: the current prompt
(`routes.py:4900-4918`) carries no user id, name, level, or history. Two
different learners submitting the identical wrong answer to the identical
exercise get, and *should* get, the identical explanation. That makes this a
textbook case for a global content-addressed cache — same shape as
`word_hints`, not a per-user memoization.

(If personalization is added later — e.g. referencing the learner's level or
streak in the explanation — the cache key must absorb that, and the hit rate
drops accordingly. Out of scope here; flagged under "Future extensions".)

## Cache key: normalizing "the wrong answer that was already given"

The tricky part isn't the cache table — it's producing a **stable key** for
"this wrong answer" across exercise kinds, since `ExplainIn.user_answer` is a
free-form string today but its meaning differs per kind:

| Exercise kind | What `user_answer` currently holds | Normalization needed |
|---|---|---|
| `multiple_choice` | the selected option's text | trim + casefold; option text is already a small closed set, so this alone gives high hit rates |
| `fill_blank` | free-typed text | trim + casefold + collapse internal whitespace + Unicode NFC-normalize (Armenian text, same as `_norm_word`, `routes.py:4972-4977`) |
| `sentence_order` | the learner's assembled word order | normalize to a canonical form independent of incidental whitespace — join selected tokens with a single delimiter |
| `match_pairs` | N/A today — `wrong()` fires per mismatched pair with a generic message, no `/explain` call wired for this kind yet | when wired, key on the specific mismatched pair, not the whole board |

Proposed normalizer (mirrors `_norm_word`, `routes.py:4972-4977`, but keeps
spaces since answers are often phrases, not single words):

```python
def _norm_answer(kind: str, answer: str) -> str:
    a = unicodedata.normalize("NFC", str(answer or ""))
    a = re.sub(r"\s+", " ", a).strip().lower()
    return a[:200]  # guard against pathological input; explanations are short anyway
```

The full cache key is **`(exercise_id, kind, answer_norm)`** — `kind` is
included even though it's derivable from `exercise_id` via a join, purely so
the cache row is self-describing and the normalization rule is auditable
per-kind later without a join. `exercise_id` alone isn't enough (an exercise
can have multiple distinct wrong answers); `answer_norm` alone isn't enough
(the same literal text could be a valid answer to one exercise and wrong for
another).

**Empty/missing answers** (`user_ans == ""`, i.e. the learner submitted
nothing, or `skip`) — cache under `answer_norm = ""` like any other value.
This is common enough (skipped exercises, timeouts) to be worth caching too.

## Schema addition

```sql
-- backend/ensure_schema.py, alongside the word_hints block (~line 87)
CREATE TABLE exercise_explanations (
    exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    answer_norm  TEXT NOT NULL,
    explanation  TEXT NOT NULL,
    correct_answer TEXT,               -- snapshot at generation time (see invalidation below)
    hit_count    INTEGER NOT NULL DEFAULT 0,   -- cheap telemetry, see "Observability"
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (exercise_id, answer_norm)
);
```

Using `ensure_table(...)` + the existing `add_col_if_missing` helpers already
present in `ensure_schema.py`, matching the file's own conventions. No new
migration tooling needed — this repo's schema is managed by idempotent
`ensure_table`/`add_col_if_missing` calls run at boot, not a migration
framework (see `word_hints`, `chest_rewards`, etc. for precedent).

## Request flow (cache-first)

```
POST /me/exercises/{id}/explain
  │
  ├─ auth check (unchanged)
  ├─ look up exercise row (unchanged: kind, prompt, expected_answer, config, …)
  ├─ compute answer_norm = _norm_answer(kind, payload.user_answer)
  │
  ├─ SELECT explanation FROM exercise_explanations
  │    WHERE exercise_id = :id AND answer_norm = :norm
  │
  ├─ HIT  → UPDATE ... SET hit_count = hit_count + 1 WHERE ...  (fire-and-forget-ish, non-blocking to the response)
  │         return {explanation, correct_answer, cached: true}   ← no GPT-4o call
  │
  └─ MISS → build prompt (unchanged system/user prompt from routes.py:4900-4918)
            → call gpt-4o (unchanged)
            → run contradiction guardrail (unchanged)
            → INSERT INTO exercise_explanations (...) ON CONFLICT (exercise_id, answer_norm) DO NOTHING
              (DO NOTHING, not DO UPDATE — a benign race between two learners
              missing the cache simultaneously should keep whichever row
              landed first, not flip-flop; the two GPT-4o outputs for the
              same input are near-identical anyway)
            → return {explanation, correct_answer, cached: false}
```

This is a minimal, additive change to `explain_mistake` — no change to its
request/response contract except one new response field, `cached` (frontend
can safely ignore it if unused; see below for one thing it's actually useful
for).

## Cache invalidation

Exercises are editable via the CMS (`src/cms/CmsChapters.jsx` and friends). If
a CMS editor changes an exercise's correct answer or rewords its prompt after
explanations have been cached, stale explanations could reference the old
correct answer.

Two options, in order of preference:

1. **Snapshot + compare** (recommended, already in the schema above): store
   `correct_answer` alongside each cached row at generation time. On a cache
   hit, compare it to the *current* `correct` computed from the exercise row
   (cheap — it's already being fetched). If they differ, treat as a miss,
   regenerate, and overwrite the stale row (`ON CONFLICT (...) DO UPDATE` for
   this specific path only — this is a genuine content change, not a race).
   No CMS-side changes needed, self-healing on first hit after an edit.
2. **Explicit invalidation on save** (more moving parts, skip unless #1 proves
   insufficient): CMS exercise-save handler in `backend/routes.py` issues
   `DELETE FROM exercise_explanations WHERE exercise_id = :id` whenever an
   exercise's `expected_answer`, `config`, or options change.

Start with #1 — it's a few lines, requires no coordination with the CMS save
path, and only pays a regeneration cost in the rare case content actually
changed (vs. #2's DELETE running on every save regardless of whether the
learner-facing answer actually changed).

## Rate limiting (backstop, not the primary cost control)

Caching is the real cost control — once popular exercises are warm, most
traffic never reaches GPT-4o. But the first-ever hit on a given (exercise,
wrong-answer) pair, and the long tail of typo'd free-text answers on
`fill_blank` exercises, still hit the model. Add a per-user rate limit as a
backstop against abuse (scripted spam hitting many *distinct* wrong answers
to force cache misses):

```python
# backend/middleware/rate_limit.py, _compile_rules()
Rule("POST", re.compile(r"^/me/exercises/\d+/explain$"), limit=30, window_seconds=3600),
```

This is IP-keyed like the other rules (the existing `Rule`/`InMemoryRateLimiter`
machinery is IP-based, not user-based — see `rate_limit.py:20-27`). A
same-IP-different-account bypass exists in theory but matches the precedent
set by every other rule in this file; not worth a bespoke per-user-id keying
scheme for a first pass. 30/hour comfortably covers a real learner hitting
"why was this wrong?" on every mistake in a long study session, while capping
the worst-case cost of one client hammering fresh misses.

## Observability

- `hit_count` on each row (schema above) — cheap running total, no separate
  events table. A periodic query
  (`SELECT exercise_id, answer_norm, hit_count FROM exercise_explanations
  ORDER BY hit_count DESC LIMIT 50`) surfaces the highest-value cached rows —
  useful signal for which exercises have confusing/ambiguous wrong options
  worth revisiting in the CMS.
- Response's `cached: true/false` field — cheap to log client-side or
  server-side (a one-line log statement on the MISS branch is enough to graph
  hit rate over time without a new table).
- Expected hit rate: high for `multiple_choice` (small closed option set —
  should climb toward >80% after the first few days of real traffic once
  popular exercises' wrong options are warm). Lower for `fill_blank` (open
  text, more typo variance) — normalization absorbs case/whitespace but not
  genuine spelling variants; that's an acceptable, expected miss, not a bug.

## Frontend changes

Minimal — the contract barely changes:

- `ExplainMistake` (`src/ExerciseShell.jsx:71-115`) needs no functional
  change; a cache hit is just a faster response through the exact same fetch.
- Optional, cosmetic: skip the "Thinking…" loading state entirely when the
  round-trip resolves in, say, under ~150ms (a cache hit) — jumping straight
  to the explanation. This avoids a distracting one-frame flash of a spinner
  that immediately vanishes. Simple to add (`state = "loading"` only if a
  `setTimeout(120)` still hasn't resolved) but genuinely optional — not doing
  this has zero correctness impact, purely a polish call.

## What this doc deliberately does NOT cover

- **"Explain differently" / regenerate** — the landing-page demo
  (`AI_FRAMES`, `src/LandingPage.jsx`) has a fake "regenerate" button that
  cycles through 4 pre-written phrasings client-side. A real regenerate
  feature (ask GPT-4o again for different wording) is a legitimate future
  extension, but it inherently *bypasses* the cache by design (the whole
  point is a second, different generation) — so it needs its own, tighter
  rate limit if built, separate from the cache-hit-dominated default path.
  Not needed for the core ask here (avoid re-prompting the *same* wrong
  answer) and would muddy this design; call out as a follow-up if wanted.
- **Personalized explanations** (referencing learner level/history) — as
  noted above, this would need to fold into the cache key and reduce hit
  rate. No current signal that the flat explanation is underperforming
  without personalization, so not proposed here.

## Rollout checklist

1. Add `exercise_explanations` table via `ensure_schema.py` (idempotent, safe
   to deploy ahead of the endpoint change).
2. Update `explain_mistake` (`routes.py:4850-4966`) with the cache-first flow
   above — additive, no breaking change to the response shape.
3. Add the rate-limit `Rule` in `rate_limit.py`.
4. Deploy backend only first; verify via `hit_count`/`cached` logging that
   cache writes are landing before declaring done.
5. (Optional) frontend loading-state polish, once real hit-rate data confirms
   it's worth the visual tweak.

No frontend deploy is strictly required for the core fix — everything above
is backend-only and transparent to the existing `ExplainMistake` component.
