// src/cms/SearchableSelect.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

/**
 * Dependency-free searchable dropdown matching the CMS's existing
 * rounded-2xl / ring-2 ring-slate-200 / brand-400 visual language.
 *
 * Props:
 *  - value, onChange(value)
 *  - options: [{ value, label, group? }]   — if any option has `group`,
 *      results render grouped under sorted group headers.
 *  - placeholder, searchPlaceholder, emptyText
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results",
  disabled,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (open) {
      setQ("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const selected = options.find((o) => String(o.value) === String(value ?? ""));

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(query));
  }, [options, q]);

  const grouped = useMemo(() => {
    const hasGroups = filtered.some((o) => o.group);
    if (!hasGroups) return [{ group: null, items: filtered }];
    const map = new Map();
    for (const o of filtered) {
      const g = o.group || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(o);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, items]) => ({ group, items }));
  }, [filtered]);

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex w-full items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <span className={cx("truncate", !selected && "font-medium text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cx("h-4 w-4 shrink-0 text-slate-400 transition", open && "rotate-180")} />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:font-medium placeholder:text-slate-400"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs font-semibold text-slate-400">{emptyText}</div>
            ) : (
              grouped.map(({ group, items }) => (
                <div key={group || "_flat"}>
                  {group && (
                    <div className="px-2.5 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                      {group}
                    </div>
                  )}
                  {items.map((o) => {
                    const isSel = String(o.value) === String(value ?? "");
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          onChange(o.value);
                          setOpen(false);
                        }}
                        className={cx(
                          "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-semibold transition",
                          isSel ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <Check className={cx("h-3.5 w-3.5 shrink-0", isSel ? "text-brand-600 opacity-100" : "opacity-0")} />
                        <span className="truncate">{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
