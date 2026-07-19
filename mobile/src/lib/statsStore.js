// src/lib/statsStore.js — hearts/streak/XP/gems, kept in sync across screens.
// Replaces the web's `window.dispatchEvent`/`addEventListener` pattern
// (hay_wallet, hay_xp_changed, hay_hearts custom events) since RN has no
// `window` — any screen can call refresh() or the setters after an action
// that changes these, and every subscriber re-renders.
import { create } from 'zustand';
import { api } from './api';

export const useStatsStore = create((set, get) => ({
  totalXp: 0,
  todayXp: 0,
  streak: 0,
  lessonsCompleted: 0,
  heartsCurrent: null,
  heartsMax: null,
  isPremium: false,
  gems: null,
  chests: 0,
  loaded: false,

  async refresh() {
    const [stats, hearts, wallet] = await Promise.all([
      api.get('/me/stats').catch(() => null),
      api.get('/me/hearts').catch(() => null),
      api.get('/me/wallet').catch(() => null),
    ]);
    set({
      ...(stats
        ? {
            totalXp: Number(stats.total_xp || 0),
            todayXp: Number(stats.today_xp || 0),
            streak: Number(stats.streak || 0),
            lessonsCompleted: Number(stats.lessons_completed || 0),
          }
        : {}),
      ...(hearts
        ? {
            heartsCurrent: hearts.current ?? hearts.hearts_current ?? null,
            heartsMax: hearts.max ?? hearts.hearts_max ?? null,
            isPremium: !!hearts.is_premium,
          }
        : {}),
      ...(wallet ? { gems: Number(wallet.gems || 0), chests: Number(wallet.chests || 0) } : {}),
      loaded: true,
    });
  },

  // Called right after POST /me/chests/open — that response is itself a
  // full wallet snapshot (gems/chests/xp_multiplier_active etc.), so patch
  // directly instead of a redundant refetch.
  applyWallet(wallet) {
    if (!wallet) return;
    set({
      gems: Number(wallet.gems ?? get().gems ?? 0),
      chests: Number(wallet.chests ?? get().chests ?? 0),
      isPremium: wallet.is_premium != null ? !!wallet.is_premium : get().isPremium,
    });
  },

  // Called after an exercise attempt — the attempt response already carries
  // updated hearts/xp, so we don't need a full refetch.
  applyAttempt(attempt) {
    const patch = {};
    if (attempt.hearts_current != null) patch.heartsCurrent = attempt.hearts_current;
    if (attempt.hearts_max != null) patch.heartsMax = attempt.hearts_max;
    if (attempt.is_premium != null) patch.isPremium = attempt.is_premium;
    if (attempt.earned_xp_delta) patch.totalXp = get().totalXp + attempt.earned_xp_delta;
    set(patch);
  },
}));
