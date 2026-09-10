// src/cms/ui/SectionCard.jsx — the white rounded section every CMS page
// hand-rolled as `rounded-3xl bg-white p-6 ring-1 ring-slate-200 shadow-sm`,
// with an optional title row.
import { cn } from "@/lib/utils";

export function SectionCard({ title, description, actions, children, className, bodyClassName }) {
  return (
    <section className={cn("rounded-3xl bg-white p-5 ring-1 ring-slate-200 shadow-sm sm:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg font-extrabold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm font-semibold text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// Inline callout (info / warning / success / danger) — the tinted notice
// boxes pages used for "email isn't configured", "these were auto-hidden", etc.
const NOTE = {
  info: "bg-feather-50 text-feather-700 ring-feather-100",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  success: "bg-grass-50 text-grass-700 ring-grass-200",
  danger: "bg-cardinal-50 text-cardinal-700 ring-cardinal-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
};
export function Note({ tone = "info", icon: Icon, children, className }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl p-4 text-sm font-semibold ring-1", NOTE[tone], className)} role={tone === "danger" ? "alert" : undefined}>
      {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
