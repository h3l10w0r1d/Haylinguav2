// src/cms/journey/nodes/ConditionNode.jsx — the one node type with more
// than a single output: each branch gets its own labeled source `Handle`
// (id `branch-{i}`) so stepsToGraph's per-branch edges fan out to the
// right spot on the node, giving the canvas its "diverging paths" look.
// Branch add/remove stays a one-click affordance on the node itself
// (matches the old ConditionEditor) — branch *content* (the `when` filter)
// opens in the Sheet via the node body's onClick, same split as Wait/Action.
import { GitBranch, Plus, X, GripVertical, Trash2 } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { useDraggable } from "@dnd-kit/core";
import { useJourney } from "../JourneyContext";

export default function ConditionNode({ data }) {
  const { readOnly, onOpenStep, onRemoveStep, onAddBranch, onRemoveBranch } = useJourney();
  const { path, step } = data;
  const branches = Array.isArray(step.branches) ? step.branches : [];
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `step:${path}`,
    data: { stepPath: path },
    disabled: readOnly,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ width: 240, opacity: isDragging ? 0.4 : 1 }}
      className="group relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300"
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
      <button type="button" onClick={() => onOpenStep(path)} className="flex w-full items-center gap-2.5 text-left">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cardinal-50 text-cardinal-600">
          <GitBranch className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Condition</div>
          <div className="truncate text-xs font-bold text-slate-700">{branches.length} branch{branches.length === 1 ? "" : "es"}</div>
        </div>
      </button>

      <div className="mt-2 space-y-1.5">
        {branches.map((b, i) => (
          <div key={i} className="relative flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1 pr-4 text-[11px] font-bold text-slate-600">
            <span className="truncate">{b.else ? "Else" : i === 0 ? "If" : "Else if"}</span>
            {!readOnly && !b.else && (
              <button type="button" onClick={() => onRemoveBranch(path, i)} className="text-slate-400 hover:text-cardinal-500">
                <X className="h-3 w-3" />
              </button>
            )}
            <Handle
              type="source"
              position={Position.Right}
              id={`branch-${i}`}
              style={{ position: "absolute", right: -8, top: "50%" }}
              className="!h-2.5 !w-2.5 !border-2 !border-white !bg-cardinal-400"
            />
          </div>
        ))}
      </div>

      {!readOnly && (
        <button type="button" onClick={() => onAddBranch(path)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-600 hover:underline">
          <Plus className="h-3 w-3" /> Add else-if
        </button>
      )}

      {!readOnly && (
        <div className="absolute -right-2 -top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button type="button" onClick={() => onRemoveStep(path)} className="grid h-6 w-6 place-items-center rounded-full bg-white text-cardinal-500 ring-1 ring-slate-200 hover:bg-cardinal-50">
            <Trash2 className="h-3 w-3" />
          </button>
          <span {...attributes} {...listeners} className="grid h-6 w-6 cursor-grab place-items-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 active:cursor-grabbing">
            <GripVertical className="h-3 w-3" />
          </span>
        </div>
      )}
    </div>
  );
}
