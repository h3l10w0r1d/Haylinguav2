// src/cms/ui/useListQuery.js — list state (page, page size, search, sort)
// kept in the URL via useSearchParams, so any CMS list view is linkable and
// survives reload/back. Mirrors the pattern src/BlogPage.jsx uses for its
// `?page=`.
//
//   const list = useListQuery();                       // ?page=2&q=arm
//   const apps = useListQuery({ prefix: "apps_" });    // ?apps_page=2 (second list on the same page)
//
// Rules: changing `q` or `pageSize` resets `page` to 1; `q` writes replace
// history (typing shouldn't spam back-button entries) while page changes
// push; values equal to their defaults are removed from the URL so plain
// routes stay clean; a bad `page` (<1, NaN) reads as 1; a `pageSize` not
// in `pageSizes` reads as the default.
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export const DEFAULT_PAGE_SIZES = [25, 50, 100];

export function useListQuery({
  prefix = "",
  defaults: userDefaults,
  pageSizes = DEFAULT_PAGE_SIZES,
} = {}) {
  const defaults = { page: 1, pageSize: pageSizes[0], q: "", sort: "", ...(userDefaults || {}) };
  const [params, setParams] = useSearchParams();
  const k = (name) => `${prefix}${name}`;

  const rawPage = parseInt(params.get(k("page")) || "", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : defaults.page;
  const rawSize = parseInt(params.get(k("size")) || "", 10);
  const pageSize = pageSizes.includes(rawSize) ? rawSize : defaults.pageSize;
  const q = params.get(k("q")) ?? defaults.q;
  const sort = params.get(k("sort")) ?? defaults.sort;

  const set = useCallback(
    (patch, { replace } = {}) => {
      const next = new URLSearchParams(params);
      const merged = { page, pageSize, q, sort, ...patch };
      if (("q" in patch && patch.q !== q) || ("pageSize" in patch && patch.pageSize !== pageSize)) {
        merged.page = 1;
      }
      const write = (name, value, def) => {
        if (value === def || value === "" || value == null) next.delete(k(name));
        else next.set(k(name), String(value));
      };
      write("page", merged.page, defaults.page);
      write("size", merged.pageSize, defaults.pageSize);
      write("q", merged.q, defaults.q);
      write("sort", merged.sort, defaults.sort);
      // Extra keys (e.g. { lesson: id, tab: "exercises" }) pass straight through.
      for (const [name, value] of Object.entries(patch)) {
        if (["page", "pageSize", "q", "sort"].includes(name)) continue;
        if (value === "" || value == null) next.delete(k(name));
        else next.set(k(name), String(value));
      }
      setParams(next, { replace: replace ?? "q" in patch });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, setParams, page, pageSize, q, sort, prefix]
  );

  const reset = useCallback(() => set({ page: defaults.page, pageSize: defaults.pageSize, q: defaults.q, sort: defaults.sort }), [set]); // eslint-disable-line react-hooks/exhaustive-deps

  const get = useCallback((name) => params.get(k(name)), [params, prefix]); // eslint-disable-line react-hooks/exhaustive-deps

  return useMemo(
    () => ({ page, pageSize, q, sort, pageSizes, set, reset, get }),
    [page, pageSize, q, sort, pageSizes, set, reset, get]
  );
}
