// src/exercises/FooterSlot.jsx
// Lets any exercise kind's Check/Continue button render into ExerciseShell's
// fixed-position bottom bar instead of inline inside the card — so the button
// sits in the exact same screen position across every exercise kind, instead
// of moving up/down with how tall each kind's content happens to be.
//
// This is a pure DOM relocation: the button's onClick/disabled logic is
// completely untouched, only *where* it renders changes.
import { createContext, useContext } from "react";
import { createPortal } from "react-dom";

export const ExerciseFooterContext = createContext(null);

export function FooterSlot({ children }) {
  const node = useContext(ExerciseFooterContext);
  // No shell footer available (e.g. rendered outside ExerciseShell) — fall
  // back to the original inline placement so nothing breaks.
  if (!node) return <div className="mt-6 space-y-3">{children}</div>;
  return createPortal(<div className="w-full space-y-3">{children}</div>, node);
}
