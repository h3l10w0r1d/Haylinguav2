// src/cms/journey/JourneyCanvas.jsx — top-level component: owns the React
// Flow canvas (nodes/edges derived from `steps` via graph.js, auto-laid-out
// by dagre every render — nothing about position is persisted), the
// dnd-kit DndContext driving drag-to-insert/drag-to-reorder, the palette
// sidebar, and the detail Sheet. Props mirror the old StepListEditor's
// contract (`steps`, `onChange`, `segments`, `readOnly`) plus
// `triggerLabel` (a plain, already-formatted string — "User signs up" or
// "Segment: Premium users") for the read-only TriggerNode summary, since
// this canvas has no business knowing about EVENT_TYPES or segment names.
// AutomationEditor keeps `onChange={setSteps}` replacing the whole array
// exactly as before.
import { useMemo, useState, useCallback } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  stepsToGraph, getStepAtPath, insertStepAtPath, removeStepAtPath, updateStepAtPath,
  addBranch, removeBranch, moveStep, ACTION_META,
} from "./graph";
import { paletteMetaFor } from "./palette";
import { JourneyProvider } from "./JourneyContext";
import PaletteSidebar from "./PaletteSidebar";
import StepDetailSheet from "./StepDetailSheet";
import TriggerNode from "./nodes/TriggerNode";
import WaitNode from "./nodes/WaitNode";
import ConditionNode from "./nodes/ConditionNode";
import ActionNode from "./nodes/ActionNode";
import AddStepNode from "./nodes/AddStepNode";
import { notify } from "../ui";

const NODE_TYPES = { trigger: TriggerNode, wait: WaitNode, condition: ConditionNode, action: ActionNode, add: AddStepNode };

export default function JourneyCanvas({ steps, onChange, segments, readOnly = false, triggerLabel }) {
  const [selectedPath, setSelectedPath] = useState(null);
  const [activeDrag, setActiveDrag] = useState(null); // { kind } | { stepPath }

  const list = Array.isArray(steps) ? steps : [];
  const { nodes, edges } = useMemo(
    () => stepsToGraph(list, { readOnly }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [steps, readOnly]
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onInsertStep = useCallback((insertionPath, kind) => onChange(insertStepAtPath(list, insertionPath, kind)), [list, onChange]);
  const onRemoveStep = useCallback((path) => {
    onChange(removeStepAtPath(list, path));
    setSelectedPath((cur) => (cur === path ? null : cur));
  }, [list, onChange]);
  const onAddBranch = useCallback((conditionPath) => onChange(addBranch(list, conditionPath)), [list, onChange]);
  const onRemoveBranchCb = useCallback((conditionPath, branchIndex) => onChange(removeBranch(list, conditionPath, branchIndex)), [list, onChange]);
  const onOpenStep = useCallback((path) => setSelectedPath(path), []);
  const onOpenTrigger = useCallback(() => {
    document.getElementById("automation-trigger-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  function handleDragStart(event) {
    const data = event.active?.data?.current;
    if (!data) return;
    setActiveDrag(data.kind ? { kind: data.kind } : { stepPath: data.stepPath });
  }

  function handleDragEnd(event) {
    setActiveDrag(null);
    const insertionPath = event.over?.data?.current?.insertionPath;
    if (insertionPath == null) return;
    const active = event.active?.data?.current;
    if (!active) return;
    if (active.kind) {
      onChange(insertStepAtPath(list, insertionPath, active.kind));
    } else if (active.stepPath) {
      const { steps: next, blocked } = moveStep(list, active.stepPath, insertionPath);
      if (blocked) {
        notify("Can't move a condition inside its own branch", "err");
        return;
      }
      onChange(next);
    }
  }

  const selectedStep = selectedPath != null ? getStepAtPath(list, selectedPath) : null;

  const contextValue = useMemo(() => ({
    readOnly,
    triggerLabel: triggerLabel || "—",
    onOpenStep,
    onOpenTrigger,
    onRemoveStep,
    onAddBranch,
    onRemoveBranch: onRemoveBranchCb,
    onInsertStep,
  }), [readOnly, triggerLabel, onOpenStep, onOpenTrigger, onRemoveStep, onAddBranch, onRemoveBranchCb, onInsertStep]);

  const dragOverlayLabel = activeDrag?.kind
    ? (paletteMetaFor(activeDrag.kind)?.label || ACTION_META[activeDrag.kind]?.label || activeDrag.kind)
    : activeDrag?.stepPath != null
      ? (() => {
          const s = getStepAtPath(list, activeDrag.stepPath);
          if (!s) return "Step";
          if (s.type === "wait") return "Wait";
          if (s.type === "condition") return "Condition";
          return ACTION_META[s.action]?.label || "Action";
        })()
      : null;

  return (
    <JourneyProvider value={contextValue}>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex h-full">
          {!readOnly && <PaletteSidebar />}
          <div className="relative min-w-0 flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={NODE_TYPES}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              // React Flow only sets `pointer-events: auto` on a node's
              // wrapper div when it thinks the node is interactive —
              // isSelectable || isDraggable || onClick || onMouseEnter/
              // Move/Leave (see its NodeWrapper source). We turned off
              // selectable/draggable above and never passed onNodeClick,
              // so every node wrapper was rendering `pointer-events: none`
              // inline, silently blocking clicks on everything inside —
              // including our own onClick handlers several levels down.
              // This no-op is enough to flip that switch; our nodes route
              // their own clicks through JourneyContext, not this prop.
              onNodeClick={() => {}}
              panOnScroll
              zoomOnScroll
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={20} size={1} />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!bg-white" nodeColor="#e2e8f0" />
            </ReactFlow>
          </div>
        </div>
        <DragOverlay>
          {dragOverlayLabel && (
            <div className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-lg ring-2 ring-brand-400">
              {dragOverlayLabel}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <StepDetailSheet
        open={selectedPath != null}
        onOpenChange={(open) => { if (!open) setSelectedPath(null); }}
        step={selectedStep}
        path={selectedPath}
        segments={segments}
        readOnly={readOnly}
        onUpdateStep={(patch) => selectedPath != null && onChange(updateStepAtPath(list, selectedPath, patch))}
        onUpdateParams={(patch) => {
          if (selectedPath == null || !selectedStep) return;
          onChange(updateStepAtPath(list, selectedPath, { params: { ...selectedStep.params, ...patch } }));
        }}
        onUpdateBranchWhen={(branchIndex, when) => {
          if (selectedPath == null || !selectedStep) return;
          const branches = Array.isArray(selectedStep.branches) ? selectedStep.branches : [];
          const nextBranches = branches.map((b, i) => (i === branchIndex ? { ...b, when } : b));
          onChange(updateStepAtPath(list, selectedPath, { branches: nextBranches }));
        }}
      />
    </JourneyProvider>
  );
}
