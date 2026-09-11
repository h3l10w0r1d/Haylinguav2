// src/cms/journey/nodes/TriggerNode.jsx — display-only summary of the
// campaign's event trigger. Editing `filters`/`eventType` stays owned by
// AutomationEditor.jsx's existing "Trigger" SectionCard (single write
// path) — clicking this just scrolls/focuses that section.
import { Handle, Position } from "@xyflow/react";
import { Zap, ArrowUp } from "lucide-react";
import { useJourney } from "../JourneyContext";

export default function TriggerNode() {
  const { eventLabel, onOpenTrigger } = useJourney();
  return (
    <button
      type="button"
      onClick={onOpenTrigger}
      className="relative flex w-[220px] items-center gap-2.5 rounded-2xl bg-brand-500 p-3 text-left text-white shadow-sm ring-1 ring-brand-600/40 transition hover:bg-brand-600"
    >
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/15">
        <Zap className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-extrabold uppercase tracking-wide text-white/70">Trigger</div>
        <div className="truncate text-xs font-bold">{eventLabel}</div>
      </div>
      <ArrowUp className="h-3.5 w-3.5 shrink-0 text-white/60" />
    </button>
  );
}
