// src/exercises/WordHint.jsx
// Wraps any word/text in a tappable element that shows a definition popover.
// Usage: <WordHint word="Բարև" hint="Hello" />
// If `hint` is falsy, renders children as plain text with no interaction.
import React, { useState, useRef, useEffect } from "react";

export function WordHint({ word, hint, children }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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

  if (!hint) return <span>{display}</span>;

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="cursor-pointer underline decoration-dotted decoration-brand-400 underline-offset-2 hover:text-brand-600"
      >
        {display}
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
          {hint}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </span>
      )}
    </span>
  );
}

/**
 * Renders a sentence/prompt with inline word hints.
 * `glossary` is an object mapping Armenian words → English definitions.
 * Words found in the glossary get a tappable hint; others render as plain text.
 */
export function GlossaryText({ text, glossary }) {
  if (!text) return null;
  if (!glossary || Object.keys(glossary).length === 0) return <span>{text}</span>;

  // Tokenise by spaces, preserving punctuation attached to words
  const tokens = text.split(/(\s+)/);
  return (
    <>
      {tokens.map((tok, i) => {
        // Strip trailing punctuation to look up the bare word
        const bare = tok.replace(/[,;:!?."»«']+$/u, "").replace(/^[«"']+/u, "");
        const hint = glossary[bare] || glossary[bare.toLowerCase()];
        if (!hint || !bare) return <React.Fragment key={i}>{tok}</React.Fragment>;
        // Reattach punctuation visually
        const prefix = tok.slice(0, tok.indexOf(bare));
        const suffix = tok.slice(tok.indexOf(bare) + bare.length);
        return (
          <React.Fragment key={i}>
            {prefix}
            <WordHint word={bare} hint={hint} />
            {suffix}
          </React.Fragment>
        );
      })}
    </>
  );
}
