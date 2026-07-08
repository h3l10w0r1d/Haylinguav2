// src/cms/analytics/WidgetGallery.jsx
// Slide-over panel listing all widgets with toggle checkboxes.

import { X } from "lucide-react";
import { WIDGET_DEFS, WIDGET_SECTIONS } from "./widgetDefs";

export function WidgetGallery({ open, onClose, isHidden, toggle }) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-80 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-display text-base font-extrabold text-slate-800">Widget Gallery</h2>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">Toggle to show or hide</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-xl hover:bg-slate-100 text-slate-500 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Widget list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {WIDGET_SECTIONS.map((section) => {
            const widgets = WIDGET_DEFS.filter((w) => w.section === section);
            return (
              <div key={section}>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1 mb-2">
                  {section}
                </div>
                <div className="space-y-1">
                  {widgets.map((w) => {
                    const hidden = isHidden(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggle(w.id)}
                        className={[
                          "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                          hidden ? "bg-slate-50" : "bg-brand-50 ring-1 ring-brand-100",
                        ].join(" ")}
                      >
                        {/* Color dot / accent */}
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: hidden ? "#cbd5e1" : w.accent }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-bold truncate ${hidden ? "text-slate-400" : "text-slate-800"}`}>
                            {w.label}
                          </div>
                          <div className="text-xs font-semibold text-slate-400 truncate">{w.description}</div>
                        </div>
                        {/* Toggle indicator */}
                        <div
                          className={[
                            "h-5 w-9 shrink-0 rounded-full transition-colors relative",
                            hidden ? "bg-slate-200" : "bg-brand-500",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                              hidden ? "left-0.5" : "left-[calc(100%-1.125rem)]",
                            ].join(" ")}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-400 text-center">
          Layout is saved automatically in your browser.
        </div>
      </div>
    </>
  );
}
