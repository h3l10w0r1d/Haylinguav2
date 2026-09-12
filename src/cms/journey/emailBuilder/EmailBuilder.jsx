// src/cms/journey/emailBuilder/EmailBuilder.jsx — the drag-and-drop block
// list. Same @dnd-kit/sortable pattern already used for CMS analytics
// widget reordering (src/cms/analytics/index.jsx) — a flat sortable list,
// not the graph-canvas machinery in ../JourneyCanvas.jsx (blocks don't
// branch). Each block is a compact rounded card with its fields shown
// inline (no accordion — a handful of blocks per email doesn't need one).
import { useMemo, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter, DragOverlay,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Plus, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Textarea, notify } from "../../ui";
import { createCmsApi, getCmsToken } from "../../api";
import { BLOCK_TYPES, COLOR_PRESETS, newBlock } from "./blocks";

function BannerDropzone({ block, patch, field, readOnly, onUploadImage }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file) {
    if (!file || readOnly) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      patch({ imageUrl: url });
    } catch (err) {
      notify(err.message || "Image upload failed", "err");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!readOnly) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        upload(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "flex items-center gap-2.5 rounded-2xl bg-slate-50 p-2.5 ring-2 ring-dashed transition",
        dragOver ? "ring-brand-400 bg-brand-50/50" : "ring-slate-200"
      )}
    >
      {block.imageUrl ? (
        <img src={block.imageUrl} alt="" className="h-12 w-16 shrink-0 rounded-lg border border-slate-100 object-cover" />
      ) : (
        <div className="grid h-12 w-16 shrink-0 place-items-center rounded-lg bg-slate-200 text-slate-400">
          <ImagePlus className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Input
          placeholder="Image URL, or drop/choose a file"
          value={block.imageUrl || ""}
          onChange={(e) => patch({ imageUrl: e.target.value })}
          onFocus={(e) => field("imageUrl", e.target)}
          disabled={readOnly}
          className="h-8 text-xs"
        />
      </div>
      <label className={cn("shrink-0 rounded-xl bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200", readOnly ? "opacity-50" : "cursor-pointer hover:bg-slate-50")}>
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Choose"}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={readOnly} onChange={(e) => upload(e.target.files?.[0])} />
      </label>
    </div>
  );
}

function ColorSwatchRow({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {COLOR_PRESETS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={disabled}
          onClick={() => onChange(c)}
          title={c}
          style={{ background: c }}
          className={cn(
            "h-6 w-6 rounded-full ring-2 ring-offset-1 transition disabled:pointer-events-none disabled:opacity-40",
            value?.toLowerCase() === c.toLowerCase() ? "ring-brand-500" : "ring-slate-200"
          )}
        />
      ))}
      <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full ring-2 ring-slate-200">
        <input
          type="color"
          value={value || "#FFFFFF"}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="absolute -left-1 -top-1 h-8 w-8 cursor-pointer disabled:cursor-not-allowed"
        />
      </label>
    </div>
  );
}

function AlignButtons({ value, onChange, disabled }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-slate-200">
      {["left", "center"].map((a) => (
        <button
          key={a}
          type="button"
          disabled={disabled}
          onClick={() => onChange(a)}
          className={cn(
            "px-2.5 py-1 text-[11px] font-bold capitalize transition disabled:pointer-events-none disabled:opacity-40",
            (value || "left") === a ? "bg-brand-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
          )}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function BlockCard({ block, readOnly, onUpdate, onRemove, onFocusField, onUploadImage }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id, disabled: readOnly });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const meta = BLOCK_TYPES.find((t) => t.type === block.type);
  const Icon = meta?.icon;

  function patch(p) { onUpdate({ ...block, ...p }); }
  function field(name, el) { onFocusField?.(block.id, name, el); }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200 transition",
        isDragging && "z-10 opacity-60 shadow-lg"
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        {!readOnly && (
          <span {...attributes} {...listeners} className="grid h-6 w-6 shrink-0 cursor-grab place-items-center rounded-lg text-slate-300 hover:bg-slate-50 hover:text-slate-500 active:cursor-grabbing">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{meta?.label || block.type}</span>
        {!readOnly && (
          <button type="button" onClick={onRemove} className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-lg text-cardinal-400 opacity-0 transition hover:bg-cardinal-50 hover:text-cardinal-600 group-hover:opacity-100">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-2.5">
        {block.type === "banner" && (
          <>
            <BannerDropzone block={block} patch={patch} field={field} readOnly={readOnly} onUploadImage={onUploadImage} />
            <Input placeholder="Link when clicked (optional)" value={block.linkUrl || ""} onChange={(e) => patch({ linkUrl: e.target.value })} onFocus={(e) => field("linkUrl", e.target)} disabled={readOnly} className="h-9 text-xs" />
            <Input placeholder="Alt text" value={block.alt || ""} onChange={(e) => patch({ alt: e.target.value })} onFocus={(e) => field("alt", e.target)} disabled={readOnly} className="h-9 text-xs" />
            <ColorSwatchRow value={block.bg} onChange={(bg) => patch({ bg })} disabled={readOnly} />
          </>
        )}

        {block.type === "heading" && (
          <>
            <Input value={block.text || ""} onChange={(e) => patch({ text: e.target.value })} onFocus={(e) => field("text", e.target)} placeholder="Heading text" disabled={readOnly} className="h-9 font-bold" />
            <div className="flex flex-wrap items-center gap-2">
              <AlignButtons value={block.align} onChange={(align) => patch({ align })} disabled={readOnly} />
              <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-slate-200">
                {["lg", "xl"].map((s) => (
                  <button key={s} type="button" disabled={readOnly} onClick={() => patch({ size: s })} className={cn("px-2.5 py-1 text-[11px] font-bold uppercase transition disabled:pointer-events-none disabled:opacity-40", (block.size || "lg") === s ? "bg-brand-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}>{s}</button>
                ))}
              </div>
            </div>
            <ColorSwatchRow value={block.bg} onChange={(bg) => patch({ bg })} disabled={readOnly} />
          </>
        )}

        {block.type === "text" && (
          <>
            <Textarea value={block.text || ""} onChange={(e) => patch({ text: e.target.value })} onFocus={(e) => field("text", e.target)} rows={3} placeholder="Hi {{first_name}}, ..." disabled={readOnly} className="text-xs" />
            <div className="flex flex-wrap items-center gap-2">
              <AlignButtons value={block.align} onChange={(align) => patch({ align })} disabled={readOnly} />
            </div>
            <ColorSwatchRow value={block.bg} onChange={(bg) => patch({ bg })} disabled={readOnly} />
          </>
        )}

        {block.type === "button" && (
          <>
            <Input placeholder="Button label" value={block.label || ""} onChange={(e) => patch({ label: e.target.value })} onFocus={(e) => field("label", e.target)} disabled={readOnly} className="h-9 text-xs" />
            <Input placeholder="https://…" value={block.url || ""} onChange={(e) => patch({ url: e.target.value })} onFocus={(e) => field("url", e.target)} disabled={readOnly} className="h-9 text-xs" />
            <div className="flex flex-wrap items-center gap-2">
              <AlignButtons value={block.align} onChange={(align) => patch({ align })} disabled={readOnly} />
              <span className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Button color</span>
              <ColorSwatchRow value={block.color} onChange={(color) => patch({ color })} disabled={readOnly} />
            </div>
          </>
        )}

        {block.type === "divider" && <ColorSwatchRow value={block.color} onChange={(color) => patch({ color })} disabled={readOnly} />}

        {block.type === "spacer" && (
          <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-slate-200">
            {[{ v: 16, l: "Small" }, { v: 24, l: "Medium" }, { v: 48, l: "Large" }].map((o) => (
              <button key={o.v} type="button" disabled={readOnly} onClick={() => patch({ height: o.v })} className={cn("px-2.5 py-1 text-[11px] font-bold transition disabled:pointer-events-none disabled:opacity-40", (block.height || 24) === o.v ? "bg-brand-500 text-white" : "bg-white text-slate-500 hover:bg-slate-50")}>{o.l}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EmailBuilder({ blocks, readOnly, onChange, onFocusField }) {
  const list = Array.isArray(blocks) ? blocks : [];
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // Same "leaf component builds its own client" pattern as EmailFields.jsx
  // (which is this component's own parent) — avoids threading an api prop
  // down through StepDetailSheet/JourneyCanvas for one upload button.
  const api = useMemo(() => createCmsApi(getCmsToken()), []);
  async function onUploadImage(file) {
    const { url } = await api.uploadBlogImage(file);
    return url;
  }

  function addBlock(type) { onChange([...list, newBlock(type)]); }
  function updateBlock(id, next) { onChange(list.map((b) => (b.id === id ? next : b))); }
  function removeBlock(id) { onChange(list.filter((b) => b.id !== id)); }

  function handleDragEnd(event) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = list.findIndex((b) => b.id === active.id);
    const newIdx = list.findIndex((b) => b.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(list, oldIdx, newIdx));
  }

  const activeBlock = list.find((b) => b.id === activeId);

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => addBlock(t.type)}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 hover:ring-brand-300"
            >
              <Plus className="h-3 w-3" /> <t.icon className="h-3 w-3" /> {t.label}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-xs font-semibold text-slate-400">
          No blocks yet — add a banner, heading, text, or button above to start building.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveId(e.active.id)}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={list.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2.5">
              {list.map((b) => (
                <BlockCard
                  key={b.id}
                  block={b}
                  readOnly={readOnly}
                  onUpdate={(next) => updateBlock(b.id, next)}
                  onRemove={() => removeBlock(b.id)}
                  onFocusField={onFocusField}
                  onUploadImage={onUploadImage}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activeBlock && (
              <div className="rounded-2xl bg-white p-3 text-xs font-bold text-slate-600 shadow-lg ring-2 ring-brand-400">
                {BLOCK_TYPES.find((t) => t.type === activeBlock.type)?.label}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
