// src/cms/analytics/index.jsx — Widget-based analytics dashboard
import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RefreshCw, LayoutGrid, RotateCcw, GripVertical } from "lucide-react";

import CmsLayout from "../CmsLayout";
import { useWidgetLayout } from "./useWidgetLayout";
import { SortableWidgetGrid } from "./widgetChrome";
import { WidgetGallery } from "./WidgetGallery";
import { useRenderWidget } from "./useRenderWidget";
import { WIDGET_MAP } from "./widgetDefs";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://haylinguav2.onrender.com";

function getCmsToken() {
  try { return localStorage.getItem("hay_cms_token") || ""; } catch { return ""; }
}

// ── Draggable section row ─────────────────────────────────────────────────────

function SortableSectionRow({ section, children, isLast }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className={isLast ? "" : "pb-8"}>
      {/* Section label with drag handle */}
      <div className="flex items-center gap-2 mb-3 group/sec">
        <button
          type="button"
          className="grid h-7 w-7 place-items-center rounded-xl text-slate-300 hover:text-slate-500 hover:bg-slate-100 transition opacity-0 group-hover/sec:opacity-100 cursor-grab active:cursor-grabbing"
          {...listeners}
          {...attributes}
          aria-label={`Drag ${section} section`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <h3 className="font-display text-sm font-extrabold uppercase tracking-wider text-slate-400">
          {section}
        </h3>
      </div>
      {children}
    </div>
  );
}

// Ghost pill shown while dragging a section
function SectionDragPreview({ section }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-xl ring-1 ring-slate-200">
      <GripVertical className="h-4 w-4 text-slate-400" />
      {section}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CmsAnalyticsWidgets() {
  const navigate = useNavigate();

  // Redirect to CMS login if not authenticated
  useEffect(() => {
    if (!getCmsToken()) navigate("/cms/login", { replace: true });
  }, [navigate]);

  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(null);

  const {
    sectionOrder,
    isHidden,
    toggle,
    reorderSections,
    reorderWidgets,
    getWidgetIds,
    getSize,
    setWidgetSize,
    resetAll,
    hiddenCount,
  } = useWidgetLayout();

  const { renderWidget } = useRenderWidget(analytics);

  // ── Data loading ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/cms/analytics`, {
        headers: { Authorization: `Bearer ${getCmsToken()}` },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setAnalytics(await res.json());
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Section drag ────────────────────────────────────────────────────────────
  const sectionSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  function handleSectionDragStart(event) {
    setActiveSectionId(event.active.id);
  }

  function handleSectionDragEnd(event) {
    const { active, over } = event;
    setActiveSectionId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = sectionOrder.indexOf(active.id);
    const newIdx = sectionOrder.indexOf(over.id);
    if (oldIdx !== -1 && newIdx !== -1) {
      reorderSections(arrayMove(sectionOrder, oldIdx, newIdx));
    }
  }

  // ── Render a single widget, filtering hidden ──────────────────────────────
  function renderWidgetGuarded(id, size) {
    if (isHidden(id)) return null;
    return renderWidget(id, size);
  }

  // ── Visible widget IDs per section (filtered) ─────────────────────────────
  function visibleIds(section) {
    return getWidgetIds(section).filter((id) => !isHidden(id));
  }

  return (
    <CmsLayout
      active="analytics"
      title="Analytics"
      breadcrumb={[{ label: "CMS" }, { label: "Analytics" }]}
      actions={
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="hidden sm:block text-xs font-semibold text-slate-400">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-500 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 transition"
            title="Reset layout to defaults"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 transition"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Edit Widgets
            {hiddenCount > 0 && (
              <span className="ml-0.5 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white leading-none">
                {hiddenCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-brand-500 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-600 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      }
    >
      {error && (
        <div className="mb-4 rounded-2xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading && !analytics && (
        <div className="flex items-center justify-center py-32 text-slate-400 font-bold text-sm">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          Loading analytics…
        </div>
      )}

      {/* ── Section-level DnD ──────────────────────────────────────────────── */}
      {analytics && (
        <DndContext
          sensors={sectionSensors}
          collisionDetection={closestCenter}
          onDragStart={handleSectionDragStart}
          onDragEnd={handleSectionDragEnd}
        >
          <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
            {sectionOrder.map((section, idx) => {
              const ids = visibleIds(section);
              if (ids.length === 0) return null;
              return (
                <SortableSectionRow key={section} section={section} isLast={idx === sectionOrder.length - 1}>
                  <SortableWidgetGrid
                    section={section}
                    widgetIds={ids}
                    getSize={getSize}
                    setWidgetSize={setWidgetSize}
                    toggle={toggle}
                    onReorder={reorderWidgets}
                    renderContent={renderWidgetGuarded}
                  />
                </SortableSectionRow>
              );
            })}
          </SortableContext>

          <DragOverlay>
            {activeSectionId ? <SectionDragPreview section={activeSectionId} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Widget Gallery slide-over ──────────────────────────────────────── */}
      <WidgetGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        isHidden={isHidden}
        toggle={toggle}
      />
    </CmsLayout>
  );
}
