// src/cms/ui/DataTable.jsx — presentational table for CMS lists. Search,
// sort and paging live outside it (useListQuery + useClientList or server
// data + <Pagination>); this only renders what it's given.
//
//   columns: [{ key, header, cell?: (row) => node, className?, headerClassName?,
//               align?: "right" | "center", sortable?: bool, hideBelow?: "sm" | "md" | "lg" }]
//   rowActions?: (row) => [{ label, icon?: Icon, onSelect, destructive?, disabled? }]
//   sort / onSortChange: "-key" for descending (same convention as useListQuery)
import { ArrowDown, ArrowUp, ArrowUpDown, MoreHorizontal } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListState } from "./ListState";

const HIDE = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

export function DataTable({
  columns,
  rows,
  rowKey = "id",
  loading,
  error,
  onRetry,
  emptyState,
  onRowClick,
  rowActions,
  sort = "",
  onSortChange,
  dense = false,
  className,
}) {
  const keyOf = typeof rowKey === "function" ? rowKey : (r) => r?.[rowKey];
  const sortKey = sort.startsWith("-") ? sort.slice(1) : sort;
  const sortDesc = sort.startsWith("-");

  function toggleSort(col) {
    if (!col.sortable || !onSortChange) return;
    if (sortKey !== col.key) return onSortChange(col.key);
    if (!sortDesc) return onSortChange(`-${col.key}`);
    onSortChange("");
  }

  return (
    <ListState loading={loading} error={error} onRetry={onRetry} empty={!rows || rows.length === 0} emptyState={emptyState}>
      <div className={cn("overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200 shadow-sm", className)}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "text-xs font-extrabold uppercase tracking-wide text-slate-500",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.hideBelow && HIDE[col.hideBelow],
                    col.headerClassName
                  )}
                >
                  {col.sortable && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col)}
                      className="inline-flex items-center gap-1 rounded hover:text-slate-800"
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDesc ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-slate-300" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
              {rowActions && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const actions = rowActions ? rowActions(row) || [] : [];
              return (
                <TableRow
                  key={keyOf(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(
                        dense ? "py-2" : "py-3",
                        "text-sm font-semibold text-slate-700",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.hideBelow && HIDE[col.hideBelow],
                        col.className
                      )}
                    >
                      {col.cell ? col.cell(row) : row?.[col.key]}
                    </TableCell>
                  ))}
                  {rowActions && (
                    <TableCell className={cn(dense ? "py-1.5" : "py-2", "text-right")} onClick={(e) => e.stopPropagation()}>
                      {actions.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Row actions" className="h-8 w-8">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {actions.map((a) => (
                              <DropdownMenuItem
                                key={a.label}
                                disabled={a.disabled}
                                onSelect={() => a.onSelect(row)}
                                className={cn(a.destructive && "text-cardinal-600 focus:text-cardinal-700")}
                              >
                                {a.icon && <a.icon className="mr-2 h-4 w-4" />}
                                {a.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </ListState>
  );
}
