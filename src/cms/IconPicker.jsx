// src/cms/IconPicker.jsx — modal icon picker for the chapter builder (and
// anywhere else that wants "pick one of lucide's ~1,500 icons"). Search-first:
// rendering all of them on open is real DOM weight, so the default view
// caps at a manageable slice and search narrows the full list instead. Icon
// data comes from public/icons/lucide-icons.json (see lucideIcons.jsx) — a
// plain static asset, not a JS import, so it never touches the app bundle.
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useIconNames, LucideGlyph } from "../lib/lucideIcons";

const DEFAULT_VISIBLE = 240;

// Names are kebab-case (e.g. "alarm-clock-check") — humanize for search.
function humanize(name) {
  return name.replace(/-/g, " ");
}

export default function IconPicker({ open, onClose, onSelect, currentIcon }) {
  const [query, setQuery] = useState("");
  const iconNames = useIconNames();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return iconNames.slice(0, DEFAULT_VISIBLE);
    return iconNames.filter((name) => humanize(name).includes(q)).slice(0, 400);
  }, [query, iconNames]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="font-display text-base font-bold text-slate-900">Choose an icon</div>
            <div className="text-xs font-semibold text-slate-400">{iconNames.length.toLocaleString()} icons available</div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — e.g. shirt, plane, house…"
              className="w-full rounded-2xl bg-slate-50 py-2.5 pl-9 pr-4 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:outline-none focus:ring-brand-400"
            />
          </div>
        </div>

        <div className="overflow-y-auto p-4">
          {results.length === 0 ? (
            <div className="py-10 text-center text-sm font-semibold text-slate-400">No icons match "{query}".</div>
          ) : (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
              {results.map((name) => {
                const active = name === currentIcon;
                return (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => {
                      onSelect(name);
                      onClose();
                    }}
                    className={
                      "grid aspect-square place-items-center rounded-2xl ring-1 transition " +
                      (active ? "bg-brand-50 text-brand-600 ring-brand-300" : "text-slate-600 ring-slate-200 hover:bg-slate-50 hover:ring-slate-300")
                    }
                  >
                    <LucideGlyph name={name} className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          )}
          {!query && iconNames.length > DEFAULT_VISIBLE && (
            <div className="mt-3 text-center text-xs font-semibold text-slate-400">
              Showing the first {DEFAULT_VISIBLE} — search to reach the rest.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
