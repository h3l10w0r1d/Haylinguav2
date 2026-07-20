// src/lib/useExerciseQueueSession.js — shared "play through a list of
// exercises, track score" session logic used by CheckpointScreen and
// PracticeScreen (NOT ReviewScreen, which is a genuinely different
// flashcard flow — see web's ReviewMode.jsx vs CheckpointPlayer/PracticeMode).
// Owns the queue/index/combo/checkState state machine and the wrong-answer
// requeue (gap = min(2, remaining.length)), mirroring the web's shared
// requeue logic in CheckpointPlayer.jsx/PracticeMode.jsx.
import { useCallback, useRef, useState } from 'react';
import { api } from './api';
import { useStatsStore } from './statsStore';

export function useExerciseQueueSession(initialExercises) {
  const initialCountRef = useRef((initialExercises || []).length);
  const [queue, setQueue] = useState(initialExercises || []);
  const [index, setIndex] = useState(0);
  const [checkState, setCheckState] = useState({ canCheck: false, run: null });
  const [lastResult, setLastResult] = useState(null);
  const [lastAnswerText, setLastAnswerText] = useState('');
  const [combo, setCombo] = useState(0);
  const [done, setDone] = useState(false);

  const comboRef = useRef(0);
  const xpRef = useRef(0);
  const attemptedRef = useRef(new Set());
  const firstAttemptCorrectRef = useRef(0);

  const current = queue[index];

  const onCheckStateChange = useCallback((next) => setCheckState(next), []);

  const submitAttempt = useCallback(
    async (payload) => {
      if (!current) return null;
      comboRef.current = payload.isCorrect ? comboRef.current + 1 : 0;
      setCombo(comboRef.current);
      setLastAnswerText(payload.answerText ?? '');

      const isFirstAttempt = !attemptedRef.current.has(current.id);
      if (isFirstAttempt) {
        attemptedRef.current.add(current.id);
        if (payload.isCorrect) firstAttemptCorrectRef.current += 1;
      }

      try {
        const result = await api.post(`/me/exercises/${current.id}/attempt`, {
          lesson_id: current.lesson_id,
          answer_text: payload.answerText,
          selected_indices: payload.selectedIndices,
          combo: comboRef.current,
        });
        useStatsStore.getState().applyAttempt(result);
        if (result?.earned_xp_delta) xpRef.current += result.earned_xp_delta;
        if (result) setLastResult(result);

        if (!payload.isCorrect) {
          setQueue((q) => {
            const rest = q.slice(index + 1);
            const gap = Math.min(2, rest.length);
            const next = q.slice();
            next.splice(index + 1 + gap, 0, current);
            return next;
          });
        }
        return result;
      } catch {
        return null;
      }
    },
    [current, index]
  );

  const advance = useCallback(() => {
    setLastResult(null);
    setCheckState({ canCheck: false, run: null });
    setIndex((i) => {
      const next = i + 1;
      if (next >= queue.length) {
        setDone(true);
        return i;
      }
      return next;
    });
  }, [queue.length]);

  return {
    current,
    index,
    total: queue.length,
    checkState,
    onCheckStateChange,
    submitAttempt,
    advance,
    done,
    lastResult,
    lastAnswerText,
    combo,
    summary: {
      xpEarned: xpRef.current,
      correctFirstAttempt: firstAttemptCorrectRef.current,
      totalOriginal: initialCountRef.current,
    },
  };
}
