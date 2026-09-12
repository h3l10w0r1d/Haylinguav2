// src/cms/journey/nodes/NodeShell.jsx — shared compact-card chrome for
// Wait/Action nodes (Condition renders its own since it needs per-branch
// handles). Doubles as a dnd-kit drag source (grip handle only, so it
// doesn't fight the click-to-open-Sheet button) via `useDraggable`.
import { useDraggable } from "@dnd-kit/core";
import { Handle, Position } from "@xyflow/react";
import { GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJourney } from "../JourneyContext";

// React Flow's custom node types render zero built-in handles — every
// custom node needs its own explicit <Handle>s or edges silently fail to
// draw (logged as a console warning, easy to miss). Top/bottom handles
// here are functional-only (near-invisible); ConditionNode is the only
// node type with visually meaningful (per-branch) handles.
const HANDLE_STYLE = { opacity: 0, width: 1, height: 1 };

// React Flow's pane binds its own pan-on-drag gesture (d3-drag) to every
// pointerdown that isn't on an element marked "nodrag"/"nopan" — without
// this, a real (trusted) click on a node button gets swallowed as the
// start of a canvas pan and never fires, even though .click()-dispatched
// synthetic clicks in tests go through fine (no real pointerdown/up pair
// for d3 to intercept). Blanket-applied to the whole card since node
// dragging is already off (nodesDraggable={false}) and dnd-kit's own
// drag (via the grip handle) is a separate, unrelated system.
const NO_PANE_GESTURE = "nodrag nopan";

export default function NodeShell({ path, icon: Icon, tone, label, summary, stat, onClick, onRemove, width = 220 }) {
  const { readOnly } = useJourney();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `step:${path}`,
    data: { stepPath: path },
    disabled: readOnly,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ width, opacity: isDragging ? 0.4 : 1 }}
      className={cn("group relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300", NO_PANE_GESTURE)}
    >
      <Handle type="target" position={Position.Top} style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} style={HANDLE_STYLE} />
      <button type="button" onClick={onClick} className="flex w-full items-start gap-2.5 text-left">
        <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", tone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{label}</div>
          <div className="truncate text-xs font-bold text-slate-700">{summary}</div>
          {stat && <div className="mt-0.5 truncate text-[10px] font-semibold text-brand-600">{stat}</div>}
        </div>
      </button>
      {!readOnly && (
        <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          {onRemove && (
            <button type="button" onClick={onRemove} className="grid h-6 w-6 place-items-center rounded-full bg-white text-cardinal-500 ring-1 ring-slate-200 hover:bg-cardinal-50">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          <span {...attributes} {...listeners} className="grid h-6 w-6 cursor-grab place-items-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 active:cursor-grabbing">
            <GripVertical className="h-3 w-3" />
          </span>
        </div>
      )}
    </div>
  );
}
