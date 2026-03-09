import React, { useMemo, useState } from "react";
import AudioManager from "./AudioManager";

function normalizeText(x) {
  return String(x ?? "").trim();
}

function deriveTargets(kind, prompt, cfg) {
  const targets = [];
  const add = (key, label, text) => {
    const t = normalizeText(text);
    if (!t) return;
    targets.push({ key, label, text: t });
  };

  // Always provide a prompt target (fallback to kind-derived).
  add("prompt", "Prompt", prompt);

  const c = cfg || {};
  switch (kind) {
    case "char_intro": {
      add("letter", "Letter", c.letter);
      add("word", "Example word", c.word);
      add("example", "Example sentence", c.example);
      break;
    }
    case "char_mcq_sound": {
      add("question", "Question sound", c.letter);
      (c.options || []).forEach((opt, i) => add(`choice_${i}`, `Choice ${i + 1}`, opt));
      break;
    }
    case "letter_recognition": {
      add("question", "Question", c.question);
      (c.choices || []).forEach((opt, i) => add(`choice_${i}`, `Choice ${i + 1}`, opt));
      break;
    }
    case "char_build_word": {
      add("word", "Target word", c.word);
      (c.tiles || []).forEach((t, i) => add(`tile_${i}`, `Tile ${i + 1}`, t));
      break;
    }
    case "letter_typing": {
      add("question", "Question", c.question);
      add("answer", "Answer", c.answer);
      break;
    }
    case "word_spelling": {
      add("word", "Word", c.word);
      add("hint", "Hint", c.hint);
      break;
    }
    case "fill_blank": {
      add("sentence", "Sentence", c.sentence);
      add("answer", "Answer", c.answer);
      break;
    }
    case "translate_mcq": {
      add("sentence", "Sentence", c.sentence);
      (c.choices || []).forEach((opt, i) => add(`choice_${i}`, `Choice ${i + 1}`, opt));
      break;
    }
    case "true_false": {
      add("statement", "Statement", c.statement);
      break;
    }
    case "sentence_order": {
      // Prefer explicit solution. Otherwise join tokens.
      const full = normalizeText(c.solution) || (Array.isArray(c.tokens) ? c.tokens.join(" ") : "");
      add("sentence", "Full sentence", full);
      (c.tokens || []).forEach((tok, i) => add(`token_${i}`, `Token ${i + 1}`, tok));
      break;
    }
    case "match_pairs": {
      (c.pairs || []).forEach((p, i) => {
        add(`pair_${i}_a`, `Pair ${i + 1} A`, p?.a);
        add(`pair_${i}_b`, `Pair ${i + 1} B`, p?.b);
      });
      break;
    }
    case "audio_choice_tts": {
      add("tts_text", "TTS text", c.ttsText);
      (c.choices || []).forEach((opt, i) => add(`choice_${i}`, `Choice ${i + 1}`, opt));
      break;
    }
    case "multi_select": {
      add("question", "Question", c.question);
      (c.choices || []).forEach((opt, i) => add(`choice_${i}`, `Choice ${i + 1}`, opt));
      break;
    }
    default: {
      // Best-effort: discover common arrays of strings.
      const arrays = [
        ["choices", c.choices],
        ["options", c.options],
        ["tokens", c.tokens],
      ];
      arrays.forEach(([name, arr]) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((v, i) => add(`${name}_${i}`, `${name} ${i + 1}`, v));
      });
      break;
    }
  }

  // Ensure unique keys
  const seen = new Set();
  return targets.filter((t) => {
    if (seen.has(t.key)) return false;
    seen.add(t.key);
    return true;
  });
}

export default function AudioTargetsManager({ exercise }) {
  const [active, setActive] = useState(null);

  const cfgObj = useMemo(() => {
    try {
      if (!exercise?.config) return {};
      return typeof exercise.config === "string" ? JSON.parse(exercise.config) : exercise.config;
    } catch {
      return {};
    }
  }, [exercise]);

  const targets = useMemo(
    () => deriveTargets(exercise?.kind, exercise?.prompt, cfgObj),
    [exercise?.kind, exercise?.prompt, cfgObj]
  );

  return (
    <div className="space-y-3">
      <div className="text-sm opacity-80">
        Add audio per *target* (full sentence, tokens, choices, letters). Learner playback prefers custom recordings over AI.
      </div>

      <div className="grid gap-2">
        {targets.map((t) => (
          <div
            key={t.key}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{t.label}</div>
              <div className="text-xs opacity-70 truncate">{t.text}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="rounded-md bg-white/10 hover:bg-white/15 px-3 py-1 text-xs"
                onClick={() => setActive(t)}
              >
                Manage audio
              </button>
            </div>
          </div>
        ))}

        {targets.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm opacity-80">
            No audio targets detected for this exercise yet.
          </div>
        ) : null}
      </div>

      {active ? (
        <AudioManager
          exerciseId={exercise.id}
          exerciseText={active.text}
          targetKey={active.key}
          onClose={() => setActive(null)}
        />
      ) : null}
    </div>
  );
}
