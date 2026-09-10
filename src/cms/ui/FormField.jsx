// src/cms/ui/FormField.jsx — label + control + hint/error, so forms stop
// repeating the same three lines of markup per field.
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({ label, hint, error, htmlFor, required, className, children }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor} className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
          {label}
          {required && <span className="ml-0.5 text-cardinal-500">*</span>}
        </Label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-semibold text-cardinal-600" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs font-semibold text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function FieldRow({ children, className }) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>;
}
