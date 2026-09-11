// src/cms/journey/PaletteSidebar.jsx — draggable step-kind list. Each item
// is a dnd-kit drag source (`palette:<kind>`, data.kind) picked up by
// AddStepNode's useDroppable targets in JourneyCanvas's onDragEnd.
import { useDraggable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { PALETTE } from "./palette";

function PaletteItem({ kind, label, icon: Icon, tone }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${kind}`,
    data: { kind },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      className={cn(
        "flex w-full cursor-grab items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-bold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <div className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", tone)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      {label}
    </button>
  );
}

export default function PaletteSidebar() {
  return (
    <div className="flex w-44 shrink-0 flex-col gap-1.5 border-r border-slate-200 bg-white/60 p-3">
      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Drag to add</div>
      {PALETTE.map((p) => <PaletteItem key={p.kind} {...p} />)}
    </div>
  );
}
