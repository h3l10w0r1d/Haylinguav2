// src/cms/ui/ListState.jsx — one place for a list's non-happy states:
// loading skeleton rows, an error card with retry, or the empty state.
// Renders `children` otherwise.
import { AlertTriangle, RefreshCw } from "lucide-react";
import { SkeletonBlock } from "../../lib/Skeleton";
import { Button } from "@/components/ui/button";

export function ListSkeleton({ rows = 3, className = "" }) {
  return (
    <div className={"space-y-2 " + className} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock key={i} className="h-14 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function ErrorCard({ error, onRetry }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-cardinal-50 p-4 text-sm text-cardinal-700 ring-1 ring-cardinal-200" role="alert">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-cardinal-500" />
      <div className="min-w-0 flex-1">
        <div className="font-extrabold">Couldn't load this list</div>
        <div className="mt-0.5 break-words font-semibold text-cardinal-600">{String(error)}</div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
          <RefreshCw /> Retry
        </Button>
      )}
    </div>
  );
}

export function ListState({ loading, error, onRetry, empty, emptyState, rows = 3, children }) {
  if (loading) return <ListSkeleton rows={rows} />;
  if (error) return <ErrorCard error={error} onRetry={onRetry} />;
  if (empty) return emptyState ?? null;
  return children;
}
