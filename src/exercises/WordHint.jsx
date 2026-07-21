// src/exercises/WordHint.jsx
// Tappable words with definition popovers. Static glossary hints are shown
// instantly; any other word is looked up on demand via /me/word-hint (GPT-4o,
// server-cached). Words the learner has never seen get a "NEW" badge.
import React, { useState, useRef, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function authToken() {
  return localStorage.getItem("access_token") || localStorage.getItem("hay_token") || "";
}

// Normalize a word the same way the backend does, for matching NEW-word sets.
export function normWord(w) {
  return String(w || "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim()
    .toLowerCase();
}

const _hintCache = new Map(); // norm -> hint string (session cache)

async function fetchWordHint(word) {
  const key = normWord(word);
  if (!key) return null;
  if (_hintCache.has(key)) return _hintCache.get(key);
  try {
    const res = await fetch(`${API_BASE}/me/word-hint?word=${encodeURIComponent(word)}`, {
      headers: { Authorization: `Bearer ${authToken()}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hint = data?.hint || null;
    _hintCache.set(key, hint);
    return hint;
  } catch {
    return null;
  }
}

/**
 * Records that `words` have now been seen and returns the Set of normalized
 * words that were NEW (first exposure). Fires once per distinct word list.
 */
export function useNewWords(words) {
  const [newSet, setNewSet] = useState(() => new Set());
  const key = (words || []).map(normWord).filter(Boolean).sort().join("|");
  useEffect(() => {
    const list = (words || []).map((w) => String(w || "")).filter((w) => normWord(w));
    if (list.length === 0) return;
    let cancelled = false;
    fetch(`${API_BASE}/me/words/expose`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken()}` },
      body: JSON.stringify({ words: list }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setNewSet(new Set((d.new_words || []).map(normWord)));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return newSet;
}

export function WordHint({ word, hint, isNew, children, alwaysUnderline = true }) {
  const [open, setOpen] = useState(false);
  const [lazyHint, setLazyHint] = useState(hint || null);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => { setLazyHint(hint || null); }, [hint]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside, true);
    document.addEventListener("touchstart", onClickOutside, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside, true);
      document.removeEventListener("touchstart", onClickOutside, true);
    };
  }, [open]);

  const display = children ?? word;

  async function toggle(e) {
    e.stopPropagation();
    const next = !open;
    setOpen(next);
    if (next && !lazyHint && !loading) {
      setLoading(true);
      const h = await fetchWordHint(word);
      setLazyHint(h || "No definition found");
      setLoading(false);
    }
  }

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        className={
          // Duolingo-style: every tappable word carries a visible dashed
          // underline (hover doesn't exist on mobile, so the affordance must
          // always show). Brand color for authored glossary hints, muted for
          // on-demand lookups.
          "cursor-pointer underline decoration-dashed decoration-2 underline-offset-4 hover:text-brand-600 dark:hover:text-brand-400 " +
          (hint || alwaysUnderline
            ? "decoration-brand-400"
            : "decoration-slate-300 dark:decoration-stone-600")
        }
      >
        {display}
      </button>
      {isNew ? (
        <span className="ml-0.5 align-super text-[8px] font-black uppercase tracking-wide text-grass-600 dark:text-grass-400">new</span>
      ) : null}
      {open && (
        <span className="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
          {loading ? "…" : lazyHint}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

/**
 * Renders a sentence/prompt with inline word hints. Every word is tappable:
 * static `glossary` entries show instantly; others are looked up on demand.
 * `newWords` (a Set of normalized words) badges first-exposure vocabulary.
 */
export function GlossaryText({ text, glossary, newWords }) {
  if (!text) return null;

  const tokens = String(text).split(/(\s+)/);
  return (
    <>
      {tokens.map((tok, i) => {
        if (/^\s+$/.test(tok) || !tok) return <React.Fragment key={i}>{tok}</React.Fragment>;
        const bare = tok.replace(/[,;:!?."»«']+$/u, "").replace(/^[«"']+/u, "");
        if (!bare) return <React.Fragment key={i}>{tok}</React.Fragment>;
        const staticHint = glossary?.[bare] || glossary?.[bare.toLowerCase()];
        const prefix = tok.slice(0, tok.indexOf(bare));
        const suffix = tok.slice(tok.indexOf(bare) + bare.length);
        const isNew = newWords ? newWords.has(normWord(bare)) : false;
        return (
          <React.Fragment key={i}>
            {prefix}
            <WordHint word={bare} hint={staticHint} isNew={isNew} alwaysUnderline={!!staticHint} />
            {suffix}
          </React.Fragment>
        );
      })}
    </>
  );
}
