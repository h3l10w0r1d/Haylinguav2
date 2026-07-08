// src/cms/analytics/useWidgetLayout.js
import { useState, useCallback } from "react";
import { WIDGET_DEFS, WIDGET_SECTIONS, WIDGET_SIZE_CAPS, ALL_SIZES } from "./widgetDefs";

const KEY_HIDDEN   = "px_bi_hidden_widgets";
const KEY_SECTIONS = "px_bi_section_order";
const KEY_ORDER    = "px_bi_widget_order";
const KEY_SIZES    = "px_bi_widget_sizes";

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Default section → widget order from WIDGET_DEFS
function defaultWidgetOrder() {
  const out = {};
  WIDGET_SECTIONS.forEach((sec) => { out[sec] = []; });
  WIDGET_DEFS.forEach((w) => {
    if (out[w.section]) out[w.section].push(w.id);
  });
  return out;
}

function defaultSizes() {
  const out = {};
  WIDGET_DEFS.forEach((w) => { out[w.id] = w.defaultSize; });
  return out;
}

export function useWidgetLayout() {
  const [hidden, setHiddenState] = useState(() => {
    const arr = load(KEY_HIDDEN, []);
    return new Set(Array.isArray(arr) ? arr : []);
  });

  const [sectionOrder, setSectionOrderState] = useState(() =>
    load(KEY_SECTIONS, [...WIDGET_SECTIONS])
  );

  const [widgetOrder, setWidgetOrderState] = useState(() =>
    load(KEY_ORDER, defaultWidgetOrder())
  );

  const [widgetSizes, setWidgetSizesState] = useState(() =>
    load(KEY_SIZES, defaultSizes())
  );

  // ── Visibility ────────────────────────────────────────────────────────────
  const toggle = useCallback((id) => {
    setHiddenState((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      save(KEY_HIDDEN, [...next]);
      return next;
    });
  }, []);

  const isHidden = (id) => hidden.has(id);

  // ── Section order ─────────────────────────────────────────────────────────
  const reorderSections = useCallback((next) => {
    setSectionOrderState(next);
    save(KEY_SECTIONS, next);
  }, []);

  // ── Widget order within section ───────────────────────────────────────────
  const reorderWidgets = useCallback((section, nextIds) => {
    setWidgetOrderState((prev) => {
      const next = { ...prev, [section]: nextIds };
      save(KEY_ORDER, next);
      return next;
    });
  }, []);

  // Ensure a section key exists (in case new widgets were added)
  const getWidgetIds = useCallback((section) => {
    const stored = widgetOrder[section];
    if (Array.isArray(stored) && stored.length > 0) return stored;
    return WIDGET_DEFS.filter((w) => w.section === section).map((w) => w.id);
  }, [widgetOrder]);

  // ── Sizes ─────────────────────────────────────────────────────────────────
  const setWidgetSize = useCallback((id, size) => {
    const caps = WIDGET_SIZE_CAPS[id] || ALL_SIZES;
    const safe = caps.includes(size) ? size : caps[0];
    setWidgetSizesState((prev) => {
      const next = { ...prev, [id]: safe };
      save(KEY_SIZES, next);
      return next;
    });
  }, []);

  const getSize = (id) => widgetSizes[id] || WIDGET_DEFS.find((w) => w.id === id)?.defaultSize || "md";

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetAll = useCallback(() => {
    [KEY_HIDDEN, KEY_SECTIONS, KEY_ORDER, KEY_SIZES].forEach((k) => {
      try { localStorage.removeItem(k); } catch {}
    });
    setHiddenState(new Set());
    setSectionOrderState([...WIDGET_SECTIONS]);
    setWidgetOrderState(defaultWidgetOrder());
    setWidgetSizesState(defaultSizes());
  }, []);

  return {
    hidden,
    sectionOrder,
    widgetOrder,
    widgetSizes,
    toggle,
    isHidden,
    reorderSections,
    reorderWidgets,
    getWidgetIds,
    setWidgetSize,
    getSize,
    resetAll,
    hiddenCount: hidden.size,
  };
}
