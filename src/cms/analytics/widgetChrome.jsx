// src/cms/analytics/widgetChrome.jsx
// SortableWidgetGrid, SortableWidget, drag overlay, and WidgetMenu.

import { useState, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MoreHorizontal, GripVertical, Info, Trash2 } from "lucide-react";
import { WIDGET_SIZE_CAPS, WIDGET_MAP, ALL_SIZES } from "./widgetDefs";

// ── Size → grid span ──────────────────────────────────────────────────────────
export function sizeToSpan(size) {
  if (size === "lg") return 3;
  if (size === "md") return 2;
  return 1;
}

// ── Per-widget popup menu ─────────────────────────────────────────────────────
function WidgetMenu({ id, size, onSizeChange, onRemove, onDragStart, open, setOpen }) {
  const def = WIDGET_MAP[id];
  const caps = WIDGET_SIZE_CAPS[id] || ALL_SIZES;
  const [showInfo, setShowInfo] = useState(false);

  if (!open) return null;

  return (
    <div
      className="absolute top-8 right-2 z-30 w-52 rounded-2xl bg-white ring-1 ring-slate-200 shadow-xl p-2 text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Drag handle row */}
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 font-bold text-slate-600 hover:bg-slate-50 cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          setOpen(false);
          onDragStart(e);
        }}
      >
        <GripVertical className="h-4 w-4 text-slate-400" />
        Drag to reorder
      </button>

      <div className="my-1 h-px bg-slate-100" />

      {/* Size picker */}
      <div className="px-2 py-1">
        <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400 mb-1.5">Size</div>
        <div className="flex gap-1">
          {ALL_SIZES.map((s) => {
            const allowed = caps.includes(s);
            return (
              <button
                key={s}
                type="button"
                disabled={!allowed}
                onClick={() => { onSizeChange(s); setOpen(false); }}
                className={[
                  "flex-1 rounded-lg py-1 text-xs font-extrabold uppercase transition",
                  size === s
                    ? "bg-brand-500 text-white"
                    : allowed
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    : "bg-slate-50 text-slate-300 cursor-not-allowed",
                ].join(" ")}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <div className="my-1 h-px bg-slate-100" />

      {/* Info */}
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
        onClick={() => setShowInfo((v) => !v)}
      >
        <Info className="h-4 w-4 text-slate-400" />
        About this widget
      </button>
      {showInfo && def?.info && (
        <p className="px-2 pb-1.5 text-xs text-slate-500 font-semibold leading-snug">{def.info}</p>
      )}

      <div className="my-1 h-px bg-slate-100" />

      {/* Remove */}
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 font-bold text-cardinal-600 hover:bg-cardinal-50"
        onClick={() => { onRemove(); setOpen(false); }}
      >
        <Trash2 className="h-4 w-4" />
        Remove widget
      </button>
    </div>
  );
}

// ── Sortable widget wrapper ────────────────────────────────────────────────────
export function SortableWidget({ id, size, onSizeChange, onRemove, renderContent }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    activatorEvent,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    gridColumn: `span ${sizeToSpan(size)} / span ${sizeToSpan(size)}`,
    opacity: isDragging ? 0.2 : 1,
    scale: isDragging ? "0.97" : "1",
    position: "relative",
  };

  // Expose the drag activator so the menu drag-handle row can trigger it
  const handleMenuDragStart = (e) => {
    if (listeners?.onPointerDown) listeners.onPointerDown(e);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/widget"
      onClick={() => menuOpen && setMenuOpen(false)}
    >
      {renderContent(id, size)}

      {/* Hover menu button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        className="absolute top-2 right-2 z-20 grid h-7 w-7 place-items-center rounded-xl bg-white/80 text-slate-500 opacity-0 shadow-sm ring-1 ring-slate-200 transition hover:bg-white group-hover/widget:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <WidgetMenu
        id={id}
        size={size}
        onSizeChange={onSizeChange}
        onRemove={onRemove}
        onDragStart={handleMenuDragStart}
        open={menuOpen}
        setOpen={setMenuOpen}
      />
    </div>
  );
}

// ── Ghost shown while dragging ────────────────────────────────────────────────
function DragGhost({ id, size, renderContent }) {
  return (
    <div
      style={{
        gridColumn: `span ${sizeToSpan(size)} / span ${sizeToSpan(size)}`,
        transform: "scale(1.035) rotate(0.6deg)",
        opacity: 0.95,
        pointerEvents: "none",
      }}
    >
      {renderContent(id, size)}
    </div>
  );
}

// ── Grid of sortable widgets for one section ──────────────────────────────────
export function SortableWidgetGrid({ section, widgetIds, getSize, setWidgetSize, toggle, onReorder, renderContent }) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = widgetIds.indexOf(active.id);
    const newIdx = widgetIds.indexOf(over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      onReorder(section, arrayMove(widgetIds, oldIdx, newIdx));
    }
  }

  const activeSize = activeId ? getSize(activeId) : "md";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-3">
          {widgetIds.map((id) => (
            <SortableWidget
              key={id}
              id={id}
              size={getSize(id)}
              onSizeChange={(s) => setWidgetSize(id, s)}
              onRemove={() => toggle(id)}
              renderContent={renderContent}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeId ? <DragGhost id={activeId} size={activeSize} renderContent={renderContent} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
