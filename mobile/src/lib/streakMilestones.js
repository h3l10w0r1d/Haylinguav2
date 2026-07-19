// src/lib/streakMilestones.js — mirrors the web's streak-milestone gate
// (StreakCelebration.jsx): show a celebration once per milestone ever
// reached, persisted so it never repeats. AsyncStorage stands in for the
// web's localStorage.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 365];
export const STREAK_MILESTONE_KEY = 'hay_streak_celebrated';

export async function checkStreakMilestone(streak) {
  const hit = [...STREAK_MILESTONES].reverse().find((m) => streak >= m);
  if (!hit) return null;
  try {
    const seen = Number(await AsyncStorage.getItem(STREAK_MILESTONE_KEY)) || 0;
    if (hit <= seen) return null;
    return hit;
  } catch {
    return null;
  }
}

export async function markStreakMilestoneSeen(milestone) {
  try {
    await AsyncStorage.setItem(STREAK_MILESTONE_KEY, String(milestone));
  } catch {
    // non-fatal — worst case the celebration re-shows once more
  }
}
