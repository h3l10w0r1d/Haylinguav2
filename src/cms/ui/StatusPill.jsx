// src/cms/ui/StatusPill.jsx — small read-only status label for table cells
// (Live / Hidden / Draft / Scheduled…). Tone carries meaning, not decoration.
import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-grass-50 text-grass-700 ring-grass-200",
  warning: "bg-gold-50 text-gold-700 ring-gold-200",
  danger: "bg-cardinal-50 text-cardinal-700 ring-cardinal-200",
  info: "bg-feather-50 text-feather-700 ring-feather-200",
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function StatusPill({ tone = "neutral", children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}
