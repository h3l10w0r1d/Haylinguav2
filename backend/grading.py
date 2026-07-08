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

    # 1-based → 0-based conversion: only when an index is out-of-range for 0-based
    # (i.e. mx >= n, meaning it can't be 0-based). The old "looks_one_based" heuristic
    # (mn>=1 and mx<=n) was too aggressive — it misfired on already-0-based data such
    # as a 3-option exercise with the correct answer at index 2 (0-based), converting
    # it to index 1 and permanently misgrading the question.
    # Guard: filter out negative results after shifting so a mixed set (e.g. {0, 3})
    # doesn't produce index -1 as a valid answer when the whole set is shifted down.
    if n > 0 and s:
        vals = list(s)
        mx = max(vals)
        if mx >= n:
            shifted = {v - 1 for v in vals if v - 1 >= 0}
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
        valid = {}
        for it in items:
            if isinstance(it, dict):
                txt = norm_text(it.get("text") or it.get("item") or it.get("left"))
                bucket = norm_text(it.get("bucket") or it.get("group") or it.get("right"))
                if txt:
                    valid[txt] = bucket
        try:
            built = json.loads(answer_text) if isinstance(answer_text, str) else None
        except Exception:
            built = None
        if not isinstance(built, list) or len(built) != len(valid):
            return False
        seen: Set[str] = set()
        for entry in built:
            if not isinstance(entry, dict):
                return False
            txt = norm_text(entry.get("text") or entry.get("item") or entry.get("left"))
            bucket = norm_text(entry.get("bucket") or entry.get("group") or entry.get("right"))
            if txt not in valid or valid[txt] != bucket:
                return False
            seen.add(txt)
        return len(seen) == len(valid)

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
        if not isinstance(built, list) or len(built) != len(pairs):
            return False
        valid = {
            (norm_text(p.get("left")), norm_text(p.get("right")))
            for p in pairs
            if isinstance(p, dict)
        }
        seen: Set[tuple] = set()
        for item in built:
            if isinstance(item, dict):
                key = (norm_text(item.get("left")), norm_text(item.get("right")))
            elif isinstance(item, (list, tuple)) and len(item) == 2:
                key = (norm_text(item[0]), norm_text(item[1]))
            else:
                return False
            if key not in valid:
                return False
            seen.add(key)
        return len(seen) == len(valid)

    # Unknown / unverifiable kind -> never award credit.
    return False
