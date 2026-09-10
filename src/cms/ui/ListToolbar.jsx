// src/cms/ui/ListToolbar.jsx — the row above a list: search on the left,
// filters next to it, actions on the right, and a quiet "N items" count.
import { cn } from "@/lib/utils";

export function ListToolbar({ search, filters, actions, count, countLabel = "item", className }) {
  return (
    <div className={cn("mb-3 flex flex-wrap items-center gap-2", className)}>
      {search && <div className="w-full sm:w-72">{search}</div>}
      {filters}
      <div className="flex-1" />
      {typeof count === "number" && (
        <div className="text-xs font-semibold text-slate-400 tabular-nums">
          {count} {countLabel}{count === 1 ? "" : "s"}
        </div>
      )}
      {actions}
    </div>
  );
}
