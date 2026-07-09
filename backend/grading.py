# backend/grading.py
"""
Authoritative, server-side grading of exercise attempts.

SECURITY: The client must NOT be trusted to report whether an answer is
correct. Previously `POST /me/exercises/{id}/attempt` stored the client-sent
`is_correct` flag verbatim, which let any authenticated user mint unlimited XP
and top the leaderboard simply by sending `{"is_correct": true}`.

This module recomputes correctness from the stored exercise definition
(`kind`, `expected_answer`, `config`, `exercise_options`) and the submitted
answer (`answer_text`, `selected_indices`). The comparison logic mirrors the
frontend grading (Phase2Exercise.jsx `normStr`/`eqLoose` and
ExerciseRenderer.jsx helpers) so legitimate correct answers are not rejected.

Anything the server cannot positively verify is graded as INCORRECT (no XP).
"""
from __future__ import annotations

import difflib
import json
import re
import unicodedata
from typing import Any, List, Optional, Set

# Zero-width / bidi / soft-hyphen characters stripped before comparison.
_ZERO_WIDTH_RE = re.compile(
    "[​-‏‪-‮⁠⁦-⁩﻿­]"
)
# Non-breaking / narrow / figure spaces normalized to a normal space.
_ODD_SPACE_RE = re.compile("[   ]")
_WS_RE = re.compile(r"\s+")

# Kinds that are pure information cards with no gradable answer.
_INFO_KINDS = {"char_intro", "reading_section", "flashcard"}


def norm_text(x: Any) -> str:
    """Mirror of the frontend `normStr` (Phase2Exercise.jsx lines 107-126)."""
    if x is None:
        return ""
    s = str(x)
    try:
        s = unicodedata.normalize("NFC", s)
    except Exception:
        pass
    s = _ODD_SPACE_RE.sub(" ", s)
    s = _ZERO_WIDTH_RE.sub("", s)
    s = s.replace("եւ", "և")  # Armenian "եւ" ligature -> "և"
    s = s.strip().lower()
    s = _WS_RE.sub(" ", s)
    return s


def _eq(a: Any, b: Any) -> bool:
    return norm_text(a) == norm_text(b)


# Free-text kinds eligible for typo forgiveness (must match the block in
# grade_attempt below). Ordered-token / choice / speech kinds are excluded.
_TYPO_KINDS = {"letter_typing", "word_spelling", "fill_blank", "listen_type", "write_translate"}


def _levenshtein(a: str, b: str) -> int:
    """Classic edit distance (insert/delete/substitute), iterative two-row."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(
                prev[j] + 1,        # deletion
                cur[j - 1] + 1,     # insertion
                prev[j - 1] + (ca != cb),  # substitution
            ))
        prev = cur
    return prev[-1]


def typo_check(
    *,
    kind: Optional[str],
    expected_answer: Any,
    config: Any,
    answer_text: Any,
) -> Optional[str]:
    """
    If `answer_text` is a near-miss (small typo) of an accepted free-text answer
    — but not an exact match — return the intended answer string so the caller
    can mark it correct-with-a-warning. Otherwise return None.

    Only free-text kinds are eligible. Very short answers (single letters) are
    never forgiven, because an edit distance of 1 there matches almost anything.
    """
    kind = (kind or "").strip()
    if kind not in _TYPO_KINDS:
        return None
    cfg = _as_cfg(config)
    at = norm_text(answer_text)
    if not at:
        return None
    best: Optional[tuple[int, str]] = None
    for raw in _expected_text_answers(cfg, expected_answer):
        na = norm_text(raw)
        if not na or na == at:
            # Exact matches are handled by grade_attempt; not a typo.
            return None
        # Require a reasonably long target so we don't forgive single letters.
        if len(na) < 4:
            continue
        dist = _levenshtein(na, at)
        # 1 typo for short-ish words, 2 for longer ones.
        tol = 1 if len(na) <= 7 else 2
        # Guard against wildly different lengths slipping under the tolerance.
        if abs(len(na) - len(at)) > tol:
            continue
        if dist <= tol and (best is None or dist < best[0]):
            best = (dist, raw.strip() if isinstance(raw, str) else str(raw))
    return best[1] if best else None


def _as_cfg(config: Any) -> dict:
    if isinstance(config, dict):
        return config
    if isinstance(config, str) and config.strip():
        try:
            v = json.loads(config)
            return v if isinstance(v, dict) else {}
        except Exception:
            return {}
    return {}


def _as_int(v: Any) -> Optional[int]:
    if isinstance(v, bool):  # bool is a subclass of int; reject it explicitly
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return None


def _selected_ints(selected_indices: Any) -> List[int]:
    if not isinstance(selected_indices, list):
        return []
    out: List[int] = []
    for v in selected_indices:
        iv = _as_int(v)
        if iv is not None:
            out.append(iv)
    return out


def _correct_index_set(options: List[dict], cfg: dict, expected_answer: Any) -> Set[int]:
    """Mirror of `buildCorrectIndexSet` (Phase2Exercise.jsx lines 32-71)."""
    s: Set[int] = set()
    n = len(options)

    for i, o in enumerate(options):
        if o.get("is_correct") is True or o.get("isCorrect") is True:
            s.add(i)

    ci = cfg.get("correctIndices") or cfg.get("correct_indices")
    if isinstance(ci, list):
        for v in ci:
            iv = _as_int(v)
            if iv is not None:
                s.add(iv)

    for key in ("correctIndex", "answerIndex", "answer_index", "correct_option"):
        iv = _as_int(cfg.get(key))
        if iv is not None:
            s.add(iv)

    iv = _as_int(expected_answer)
    if iv is not None:
        s.add(iv)

    # 1-based → 0-based conversion: only apply when ALL indices are out of the
    # valid 0-based range [0, n-1]. If ANY index is already in range, treat the
    # entire set as 0-based — this prevents the shift from eliminating index 0
    # (i.e. when the first option is correct, v-1 == -1 which was filtered out).
    if n > 0 and s:
        in_range = [v for v in s if 0 <= v < n]
        out_of_range = [v for v in s if v >= n]
        if in_range:
            # At least one index is already valid 0-based — use as-is.
            return set(in_range)
        elif out_of_range:
            # All indices exceed the 0-based range — assume 1-based and shift.
            shifted = {v - 1 for v in out_of_range if v - 1 >= 0}
            if shifted:
                return shifted

    return s


def _push(out: List[str], v: Any) -> None:
    if isinstance(v, str) and v.strip():
        out.append(v.strip())


def _correct_text_candidates(options: List[dict], cfg: dict, expected_answer: Any) -> List[str]:
    out: List[str] = []
    for k in (
        "correct", "answer", "expected", "expected_text",
        "correctText", "correct_text", "correctAnswer", "correct_answer",
    ):
        _push(out, cfg.get(k))
    _push(out, expected_answer)
    for o in options:
        if o.get("is_correct") is True or o.get("isCorrect") is True:
            _push(out, o.get("text"))
    return out


def _expected_text_answers(cfg: dict, expected_answer: Any) -> List[str]:
    """Accepted free-text answers for typing/spelling/fill kinds."""
    out: List[str] = []
    _push(out, expected_answer)
    for k in ("expected", "expectedAnswer", "expected_answer", "answer", "ttsText", "tts_text", "text"):
        _push(out, cfg.get(k))
    for k in ("answers", "acceptedAnswers", "accepted_answers"):
        arr = cfg.get(k)
        if isinstance(arr, list):
            for v in arr:
                _push(out, v)
    return out


def _flagged_option_indices(options: List[dict]) -> Set[int]:
    return {
        i for i, o in enumerate(options)
        if o.get("is_correct") is True or o.get("isCorrect") is True
    }


def _grade_single_choice(options, cfg, expected_answer, sel, answer_text) -> bool:
    # Preferred: the user clicked an option whose stored is_correct flag is true.
    # This avoids the fragile 1-based/0-based index heuristic and is consistent
    # with whatever the frontend rendered (a working exercise always lets the
    # correct option be selected).
    flagged = _flagged_option_indices(options)
    if options and flagged:
        return len(sel) == 1 and sel[0] in flagged
    # No option flags: fall back to config-supplied index, then text match.
    cset = _correct_index_set(options, cfg, expected_answer)
    if cset:
        return len(sel) == 1 and sel[0] in cset
    cand = [norm_text(t) for t in _correct_text_candidates(options, cfg, expected_answer)]
    if not cand:
        return False
    return isinstance(answer_text, str) and norm_text(answer_text) in cand


def grade_attempt(
    *,
    kind: Optional[str],
    expected_answer: Any,
    config: Any,
    options: Optional[List[dict]],
    answer_text: Any,
    selected_indices: Any,
) -> bool:
    """Return the authoritative correctness for an attempt. Default: False."""
    kind = (kind or "").strip()
    cfg = _as_cfg(config)
    options = options or []
    sel = _selected_ints(selected_indices)

    if kind in _INFO_KINDS:
        return True

    # Free-text input (incl. dictation, and open-ended writing graded against a
    # teacher-provided set of acceptable answers).
    if kind in ("letter_typing", "word_spelling", "fill_blank", "listen_type", "write_translate"):
        expected = _expected_text_answers(cfg, expected_answer)
        if not expected:
            return False
        return any(_eq(a, answer_text) for a in expected)

    # Speech-to-text: `answer_text` is the transcript of the learner's speech.
    # STT is imperfect, so accept a close-enough match (in addition to exact).
    if kind in ("speak", "speech_to_text", "pronounce", "speak_line"):
        expected = _expected_text_answers(cfg, expected_answer)
        at = norm_text(answer_text)
        if not expected or not at:
            return False
        threshold = cfg.get("match_threshold")
        try:
            threshold = float(threshold)
        except (TypeError, ValueError):
            threshold = 0.82
        threshold = min(max(threshold, 0.5), 1.0)
        for a in expected:
            na = norm_text(a)
            if not na:
                continue
            if na == at:
                return True
            if difflib.SequenceMatcher(None, na, at).ratio() >= threshold:
                return True
        return False

    # True / False — graded by the submitted label so it is robust to the two
    # differing index conventions in the legacy vs Phase2 renderers.
    if kind == "true_false":
        c = cfg.get("correct")
        correct_bool = (c is True) or (c == 1) or (isinstance(c, str) and c.strip().lower() == "true")
        at = norm_text(answer_text)
        if at in ("true", "false"):
            return (at == "true") == correct_bool
        if sel:  # Phase2 choices are ["True","False"] -> index 0 == True
            return (sel[0] == 0) == correct_bool
        return False

    # Categorize: drag each item into a bucket. answer_text is a JSON list of
    # {item/text/left, bucket/group/right} pairs; every item must land in the
    # bucket the author assigned.
    if kind == "categorize":
        items = cfg.get("items")
        if not isinstance(items, list) or not items:
            return False
        # Use a list of (text, bucket) tuples — NOT a dict — so duplicate items
        # (same text in different buckets) are not collapsed to the last one.
        required = []
        for it in items:
            if isinstance(it, dict):
                txt = norm_text(it.get("text") or it.get("item") or it.get("left"))
                bucket = norm_text(it.get("bucket") or it.get("group") or it.get("right"))
                if txt:
                    required.append((txt, bucket))
        if not required:
            return False
        try:
            built = json.loads(answer_text) if isinstance(answer_text, str) else None
        except Exception:
            built = None
        if not isinstance(built, list):
            return False
        submitted = []
        for entry in built:
            if not isinstance(entry, dict):
                return False
            txt = norm_text(entry.get("text") or entry.get("item") or entry.get("left"))
            bucket = norm_text(entry.get("bucket") or entry.get("group") or entry.get("right"))
            submitted.append((txt, bucket))
        # Every required (text, bucket) pair must be satisfied exactly once.
        remaining = list(submitted)
        for pair in required:
            if pair in remaining:
                remaining.remove(pair)
            else:
                return False
        return True

    # Conjugation: fill a paradigm. answer_text is a JSON list of strings (one per
    # cell, in order) compared against each cell's expected answer.
    if kind == "conjugation":
        cells = cfg.get("cells")
        if not isinstance(cells, list) or not cells:
            return False
        try:
            typed = json.loads(answer_text) if isinstance(answer_text, str) else None
        except Exception:
            typed = None
        if not isinstance(typed, list) or len(typed) != len(cells):
            return False
        for i, c in enumerate(cells):
            ans = c.get("answer") if isinstance(c, dict) else None
            if ans is None:
                # No configured answer for this cell — skip it (don't let an
                # empty submission match via norm_text(None) == "").
                continue
            if not _eq(typed[i], ans):
                return False
        return True

    # Multi-select kinds: picked index set must equal the correct index set.
    if kind in ("letter_recognition", "multi_select", "highlight_grammar"):
        flagged = _flagged_option_indices(options)
        if options and flagged:
            return len(sel) > 0 and set(sel) == flagged
        cset = _correct_index_set(options, cfg, expected_answer)
        if cset:
            return len(sel) > 0 and set(sel) == cset
        cand = {norm_text(t) for t in _correct_text_candidates(options, cfg, expected_answer)}
        if not cand:
            return False
        picked = {
            norm_text(p)
            for p in (answer_text.split(",") if isinstance(answer_text, str) else [])
            if p.strip()
        }
        return len(picked) > 0 and picked == cand

    # Single-choice MCQ variants.
    if kind in (
        "translate_mcq", "char_mcq_sound", "audio_choice_tts", "multiple_choice", "select_missing_word",
        "dialogue_mcq", "image_select", "reading_comprehension", "minimal_pairs",
    ):
        return _grade_single_choice(options, cfg, expected_answer, sel, answer_text)

    # Ordered-token answers (arrange tokens / tap a word bank to build the answer).
    if kind in ("sentence_order", "word_bank", "listen_word_bank", "dialogue_order"):
        cands: List[str] = []
        sol = cfg.get("solution")
        if isinstance(sol, list):
            cands.append(" ".join(str(x) for x in sol))
        for k in ("correct", "answer", "expected"):
            _push(cands, cfg.get(k))
        _push(cands, expected_answer)
        return any(_eq(answer_text, c) for c in cands if c)

    if kind == "char_build_word":
        cands = []
        for k in ("answer", "correct", "expected", "targetWord", "target_word"):
            _push(cands, cfg.get(k))
        _push(cands, expected_answer)
        return any(_eq(answer_text, c) for c in cands if c)

    if kind == "match_pairs":
        pairs = cfg.get("pairs")
        if not isinstance(pairs, list) or not pairs:
            return False
        try:
            built = json.loads(answer_text) if isinstance(answer_text, str) else None
        except Exception:
            built = None
        if not isinstance(built, list):
            return False
        # De-duplicate config pairs so a config with repeated entries can't be
        # satisfied by the user submitting the same pair twice.
        valid_pairs = list({
            (norm_text(p.get("left")), norm_text(p.get("right")))
            for p in pairs
            if isinstance(p, dict)
        })
        if not valid_pairs:
            return False
        if len(built) != len(valid_pairs):
            return False
        # Build submitted pairs
        submitted = []
        for item in built:
            if isinstance(item, dict):
                key = (norm_text(item.get("left")), norm_text(item.get("right")))
            elif isinstance(item, (list, tuple)) and len(item) == 2:
                key = (norm_text(item[0]), norm_text(item[1]))
            else:
                return False
            submitted.append(key)
        # Every valid pair must be matched exactly once
        remaining = list(submitted)
        for pair in valid_pairs:
            if pair in remaining:
                remaining.remove(pair)
            else:
                return False
        return True

    # Unknown / unverifiable kind -> never award credit.
    return False
