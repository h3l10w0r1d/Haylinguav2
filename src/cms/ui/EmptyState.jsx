// src/cms/ui/EmptyState.jsx — the "nothing here" card (port of CmsShell's
// "Pick a lesson to edit" and CmsMistakes' "Nothing flagged").
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, action, tone = "neutral", className }) {
  const iconTone = tone === "success"
    ? "bg-grass-50 text-grass-500"
    : tone === "brand"
    ? "bg-brand-50 text-brand-500"
    : "bg-slate-100 text-slate-400";
  return (
    <div className={cn("grid place-items-center rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-slate-200", className)}>
      {Icon && (
        <div className={cn("grid h-14 w-14 place-items-center rounded-2xl", iconTone)}>
          <Icon className="h-7 w-7" />
        </div>
      )}
      <div className="mt-3 font-display text-lg font-extrabold text-slate-800">{title}</div>
      {description && <div className="mt-1 max-w-md text-sm font-semibold text-slate-500">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
