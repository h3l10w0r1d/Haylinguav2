// src/cms/journey/nodes/AddStepNode.jsx — the small "+" insertion point:
// a dnd-kit drop target (for palette-drag and node-drag-to-move) AND a
// click-to-open kind picker, so inserting a step never requires drag-only
// input (touch/trackpad/accessibility).
import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { Plus } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { useJourney } from "../JourneyContext";
import { PALETTE } from "../palette";

export default function AddStepNode({ data }) {
  const { onInsertStep } = useJourney();
  const [open, setOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `add:${data.insertionPath}`,
    data: { insertionPath: data.insertionPath },
  });

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <button
        ref={setNodeRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "grid h-8 w-8 place-items-center rounded-full bg-white text-slate-400 ring-2 ring-slate-200 transition hover:text-brand-600 hover:ring-brand-300",
          isOver && "scale-125 text-brand-600 ring-brand-400"
        )}
      >
        <Plus className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-full z-20 mt-1 w-44 -translate-x-1/2 rounded-xl bg-white p-1.5 shadow-lg ring-1 ring-slate-200">
            {PALETTE.map((p) => (
              <button
                key={p.kind}
                type="button"
                onClick={() => { onInsertStep(data.insertionPath, p.kind); setOpen(false); }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                <p.icon className="h-3.5 w-3.5" /> {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
