// src/exercises/kinds/AudioChoiceTTS.jsx
import React, { useEffect, useRef, useState } from "react";
import { Card, Title, Muted, PrimaryButton, SecondaryButton, ChoiceGrid, normalizeText } from "../ui";
import { ttsFetch } from "../tts";
import { newTrackedAudio } from "../../lib/audioRegistry";

export default function AudioChoiceTTS({ exercise, cfg, apiBaseUrl, correct, wrong, onSkip, onAnswer }) {
  const prompt = exercise?.prompt || "Listen and choose";
  const expected = exercise?.expected_answer;

  const [selectedIndex, setSelectedIndex] = useState(null);
  const [busy, setBusy] = useState(false);
  // UI-1: track grading result so we can pass it to ChoiceGrid
  const [graded, setGraded] = useState(null); // null | { correct: number, picked: number }

  const audioRef = useRef(null);
  // AC-1: use a ref to track the current blob URL so we can revoke it
  // synchronously before creating a new one (avoids URL leaks on rapid play()).
  const audioUrlRef = useRef(null);

  useEffect(() => {
    setSelectedIndex(null);
    setBusy(false);
    setGraded(null);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // AC-1: revoke current blob URL on exercise change
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercise?.id]);

  const ttsText = cfg.ttsText ?? cfg.text ?? "";
  const promptText = cfg.promptText ?? prompt ?? "Listen and choose";
  const choices = cfg.choices ?? cfg.options ?? [];

  // AC-2: normalize answerIndex from CMS.
  // CMS historically stores 1-based values (users see 1..N). But an explicit 0
  // is also a valid 0-based index — only shift if the value is >= 1.
  const rawAnswerIndex =
    cfg.answerIndex ?? cfg.correctIndex ?? cfg.correctChoice ?? cfg.correct_option ?? null;
  let answerIndex = null;
  if (rawAnswerIndex !== null && rawAnswerIndex !== undefined && rawAnswerIndex !== "") {
    const n = Number(rawAnswerIndex);
    if (Number.isFinite(n) && n >= 0) {
      if (n === 0) {
        // AC-2: explicit 0 — treat as first item (0-based), no shift needed
        answerIndex = 0;
      } else if (n >= 1 && n <= choices.length) {
        // 1-based → 0-based shift
        answerIndex = n - 1;
      } else {
        // out of range, clamp to first
        answerIndex = 0;
      }
    }
  }
  const answerText = expected ?? cfg.answer ?? null;

  const canCheck = selectedIndex !== null && graded === null;

  async function play() {
    if (!ttsText) return;
    try {
      setBusy(true);
      // AC-1: revoke the previous blob URL before creating a new one
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const url = await ttsFetch(apiBaseUrl, {
        text: ttsText,
        exerciseId: exercise?.id,
        // Voice preference is resolved inside ttsFetch (onboarding/localStorage) unless overridden.
      });
      audioUrlRef.current = url;
      const audio = newTrackedAudio(url);
      audioRef.current = audio;
      await audio.play();
    } catch {
      wrong("Could not play audio. Check ElevenLabs key / /tts endpoint.");
    } finally {
      setBusy(false);
    }
  }

  function handleCheck() {
    let isCorrect = false;
    let correctIdx = answerIndex;

    if (answerIndex !== null) {
      isCorrect = selectedIndex === answerIndex;
    } else if (answerText) {
      const pick = choices[selectedIndex] ?? "";
      isCorrect = normalizeText(pick) === normalizeText(answerText);
      // Compute correctIdx from text for graded display
      correctIdx = choices.findIndex((c) => normalizeText(c) === normalizeText(answerText));
      if (correctIdx === -1) correctIdx = null;
    }

    // UI-1: set graded state so ChoiceGrid shows visual feedback
    setGraded({ correct: correctIdx ?? selectedIndex, picked: selectedIndex });

    if (isCorrect) correct();
    else wrong("Wrong choice. Try again.");
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
        {/* UI-1: pass graded prop so ChoiceGrid shows green/red feedback */}
        <ChoiceGrid
          choices={choices}
          selected={selectedIndex}
          onSelect={setSelectedIndex}
          columns={2}
          graded={graded}
        />
      </div>

      <div className="mt-6 space-y-3">
        <PrimaryButton
          disabled={!canCheck}
          onClick={handleCheck}
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
