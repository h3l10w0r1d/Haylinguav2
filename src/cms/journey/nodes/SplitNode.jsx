// src/cms/journey/nodes/SplitNode.jsx — A/B split step. Modeled directly on
// ConditionNode.jsx (same card chrome, per-branch source Handle, inline
// add/remove) but each branch shows an editable weight instead of an
// if/else-if/else label, and there's no `when` filter to configure (a
// split doesn't evaluate anything — see backend/automations.py's
// _pick_split_branch), so unlike ConditionNode there's nothing for the
// detail Sheet to show; everything lives on the node itself.
import { Shuffle, Plus, X, GripVertical, Trash2 } from "lucide-react";
import { Handle, Position } from "@xyflow/react";
import { useDraggable } from "@dnd-kit/core";
import { useJourney } from "../JourneyContext";

export default function SplitNode({ data }) {
  const { readOnly, onRemoveStep, onAddSplitBranch, onRemoveSplitBranch, onUpdateSplitBranchWeight, onNormalizeSplitWeights } = useJourney();
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
      className="nodrag nopan group relative rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-300"
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <div className="flex w-full items-center gap-2.5 text-left">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-600">
          <Shuffle className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">A/B split</div>
          <div className="truncate text-xs font-bold text-slate-700">{branches.length}-way split</div>
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {branches.map((b, i) => (
          <div key={i} className="relative flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 pr-4 text-[11px] font-bold text-slate-600">
            <span className="shrink-0 truncate">Path {String.fromCharCode(65 + i)}</span>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={b.weight ?? 0}
              disabled={readOnly}
              onChange={(e) => onUpdateSplitBranchWeight(path, i, Number(e.target.value) || 0)}
              onBlur={() => onNormalizeSplitWeights(path)}
              className="nodrag h-6 w-12 rounded-md bg-white px-1 text-right text-[11px] font-bold ring-1 ring-slate-200 focus:outline-none focus:ring-brand-400"
            />
            <span className="text-slate-400">%</span>
            {!readOnly && branches.length > 2 && (
              <button type="button" onClick={() => onRemoveSplitBranch(path, i)} className="ml-auto text-slate-400 hover:text-cardinal-500">
                <X className="h-3 w-3" />
              </button>
            )}
            <Handle
              type="source"
              position={Position.Right}
              id={`branch-${i}`}
              style={{ position: "absolute", right: -8, top: "50%" }}
              className="!h-2.5 !w-2.5 !border-2 !border-white !bg-purple-400"
            />
          </div>
        ))}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={() => onAddSplitBranch(path)}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-brand-600 hover:underline"
        >
          <Plus className="h-3 w-3" /> Add path
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
