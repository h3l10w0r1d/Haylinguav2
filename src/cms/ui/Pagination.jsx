// src/cms/ui/Pagination.jsx — "Showing a–b of N · Prev · Page X of Y · Next"
// plus an optional page-size select. Presentational: give it the numbers and
// callbacks (usually straight from useListQuery). Renders nothing when
// there's a single page at the default size, so short lists stay clean.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DEFAULT_PAGE_SIZES } from "./useListQuery";

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = DEFAULT_PAGE_SIZES,
  compact = false,
  className,
}) {
  const pageCount = Math.max(1, Math.ceil((total || 0) / (pageSize || 1)));
  if (pageCount <= 1 && pageSize === pageSizes[0]) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500", className)}>
      {!compact && (
        <div className="font-semibold tabular-nums">
          Showing {from}–{to} of {total}
        </div>
      )}
      <div className={cn("flex items-center gap-2", compact && "w-full justify-between")}>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          <ChevronLeft /> Prev
        </Button>
        <span className="font-semibold tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount}>
          Next <ChevronRight />
        </Button>
        {!compact && onPageSizeChange && (
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="h-8 w-[7.5rem] rounded-xl text-xs font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map((n) => (
                <SelectItem key={n} value={String(n)}>{n} per page</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
