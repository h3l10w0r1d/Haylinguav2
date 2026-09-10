// src/cms/ui/useClientList.js — search / sort / page an in-memory array.
// For the CMS's small lists (lessons, chapters, achievements, team…) that
// fetch everything and don't need server pagination.
//
//   const list = useListQuery();
//   const { pageRows, total, pageCount } = useClientList(rows, {
//     q: list.q, searchKeys: ["title", "slug"], page: list.page, pageSize: list.pageSize,
//   });
//
// Pass `pageSize: Infinity` to filter without paging (reorderable lists).
import { useMemo } from "react";

export function useClientList(
  rows,
  { q = "", searchKeys = [], page = 1, pageSize = 25, sort = "", sorters = {} } = {}
) {
  return useMemo(() => {
    const all = Array.isArray(rows) ? rows : [];
    const needle = q.trim().toLowerCase();
    let filtered = needle
      ? all.filter((r) =>
          searchKeys.some((key) => String(r?.[key] ?? "").toLowerCase().includes(needle))
        )
      : all;

    if (sort) {
      const desc = sort.startsWith("-");
      const key = desc ? sort.slice(1) : sort;
      const by = sorters[key] || ((r) => r?.[key]);
      filtered = filtered.slice().sort((a, b) => {
        const av = by(a), bv = by(b);
        const cmp = typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" });
        return desc ? -cmp : cmp;
      });
    }

    const total = filtered.length;
    const pageCount = Number.isFinite(pageSize) ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    const safePage = Math.min(Math.max(1, page), pageCount);
    const pageRows = Number.isFinite(pageSize)
      ? filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
      : filtered;
    return { pageRows, filtered, total, pageCount, page: safePage };
  }, [rows, q, searchKeys, page, pageSize, sort, sorters]);
}
