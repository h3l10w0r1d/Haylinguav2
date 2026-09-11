// src/cms/ui/ReorderButtons.jsx — the ↑/↓ pair for manually ordered lists
// (shop items, plans, achievements, chapters). Stops click propagation so it
// can sit inside a clickable DataTable row without opening the editor.
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReorderButtons({ index, count, onMove, disabled = false, label = "item" }) {
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-slate-400 hover:text-slate-700"
        disabled={disabled || index === 0}
        onClick={() => onMove(index, -1)}
        aria-label={`Move ${label} up`}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-slate-400 hover:text-slate-700"
        disabled={disabled || index === count - 1}
        onClick={() => onMove(index, 1)}
        aria-label={`Move ${label} down`}
      >
        <ChevronDown />
      </Button>
    </div>
  );
}
