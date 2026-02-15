// src/exercises/kinds/AudioChoiceTTS.jsx
import React, { useEffect, useRef, useState } from "react";
import { Card, Title, Muted, PrimaryButton, SecondaryButton, ChoiceGrid, normalizeText } from "../ui";
import { ttsFetch } from "../tts";

export default function AudioChoiceTTS({ exercise, cfg, apiBaseUrl, correct, wrong, onSkip, onAnswer }) {
  const prompt = exercise?.prompt || "Listen and choose";
  const expected = exercise?.expected_answer;

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [busy, setBusy] = useState(false);

  const audioRef = useRef(null);
  const [audioUrl, setAudioUrl] = useState(null);

  useEffect(() => {
    setSelectedIndex(null);
    setBusy(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const ttsText = cfg.ttsText ?? cfg.text ?? "";
  const promptText = cfg.promptText ?? prompt ?? "Listen and choose";
  const choices = cfg.choices ?? cfg.options ?? [];
  // NOTE: CMS UI historically stores answerIndex as 1-based (users see 1..N),
  // while this component's selectedIndex is 0-based. Normalize here.
  const rawAnswerIndex =
    cfg.answerIndex ?? cfg.correctIndex ?? cfg.correctChoice ?? cfg.correct_option ?? null;
  let answerIndex = null;
  if (rawAnswerIndex !== null && rawAnswerIndex !== undefined && rawAnswerIndex !== "") {
    const n = Number(rawAnswerIndex);
    if (Number.isFinite(n)) answerIndex = n;
  }
  if (answerIndex !== null) {
    // Heuristic: if it's within 1..N, treat it as 1-based.
    if (answerIndex >= 1 && answerIndex <= choices.length) answerIndex = answerIndex - 1;
    // Guard against out-of-range values.
    if (answerIndex < 0 || answerIndex >= choices.length) answerIndex = null;
  }
  const answerText = expected ?? cfg.answer ?? null;

  const canCheck = selectedIndex !== null;

  async function play() {
    if (!ttsText) return;
    try {
      setBusy(true);
      const url = await ttsFetch(apiBaseUrl, ttsText);
      setAudioUrl(url);
      const audio = new Audio(url);
      audioRef.current = audio;
      await audio.play();
    } catch {
      wrong("Could not play audio. Check ElevenLabs key / /tts endpoint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Title>{promptText}</Title>
      <Muted className="mt-2">Tap play, then choose the correct option.</Muted>

      <div className="mt-4">
        <PrimaryButton onClick={play} disabled={busy || !ttsText}>
          {busy ? "Loading audio…" : "🔊 Play"}
        </PrimaryButton>
        {!ttsText && <Muted className="mt-2">Missing config.ttsText</Muted>}
      </div>

      <div className="mt-4">
        <ChoiceGrid
          choices={choices}
          selected={selectedIndex}
          onSelect={setSelectedIndex}
          columns={2}
        />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={() => {
            if (answerIndex !== null) {
              selectedIndex === answerIndex ? correct() : wrong("Wrong choice. Try again.");
              return;
            }
            const pick = choices[selectedIndex] ?? "";
            if (answerText && normalizeText(pick) === normalizeText(answerText)) correct();
            else wrong("Wrong choice. Try again.");
          }}
        >
          Check
        </PrimaryButton>

        <SecondaryButton
          onClick={() => {
            onSkip?.();
            onAnswer?.({ skipped: true, isCorrect: true, xpEarned: 0 });
          }}
        >
          Skip
        </SecondaryButton>
      </div>
    </Card>
  );
}
