// src/cms/ui/EditorSheet.jsx — right-hand slide-over for editing one record.
// List pages render a compact DataTable and open this for the selected row
// (or for a blank draft on "New …"), instead of expanding every record into
// an inline form.
//
// Unsaved-change guard: pass `dirty` (see isDirty below). While dirty,
// closing by Esc / overlay click / ✕ / Cancel asks "Discard unsaved
// changes?", and reloading or closing the tab triggers the browser's
// leave-page prompt. The sheet is modal, so the list behind it (page,
// filters, search) can't change underneath an open edit.
//
//   <EditorSheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}
//     title="Edit post" dirty={isDirty(initial, fields)} saving={saving}
//     onSave={save} onDelete={remove}>
//     …fields…
//   </EditorSheet>
import { useEffect, useRef } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useConfirm } from "./ConfirmDialog";

const WIDTH = { md: "sm:max-w-xl", lg: "sm:max-w-2xl", xl: "sm:max-w-3xl" };

// Structural equality for plain form state (strings, numbers, arrays, objects).
export function isDirty(initial, current) {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

export function EditorSheet({
  open,
  onOpenChange,
  title,
  description,
  dirty = false,
  saving = false,
  onSave,
  saveLabel = "Save changes",
  saveDisabled = false,
  onDelete,
  deleteLabel = "Delete",
  footerStart,
  size = "lg",
  children,
}) {
  const confirm = useConfirm();
  // Read inside the ⌘S handler without re-binding it on every keystroke.
  const latest = useRef({});
  latest.current = { onSave, saving, saveDisabled };

  useEffect(() => {
    if (!open || !dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [open, dirty]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const { onSave: save, saving: busy, saveDisabled: disabled } = latest.current;
        if (save && !busy && !disabled) save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function requestClose() {
    if (saving) return;
    if (
      dirty &&
      !(await confirm({
        title: "Discard unsaved changes?",
        description: "Your edits haven't been saved and will be lost.",
        confirmText: "Discard",
        cancelText: "Keep editing",
      }))
    ) {
      return;
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : requestClose())}>
      <SheetContent
        side="right"
        className={cn("cms-root flex w-full flex-col gap-0 p-0", WIDTH[size] || WIDTH.lg)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader className="space-y-1 border-b border-slate-200 px-6 py-4 pr-12 text-left">
          <SheetTitle className="text-base font-semibold text-slate-900">{title}</SheetTitle>
          {description ? <SheetDescription className="text-sm text-slate-500">{description}</SheetDescription> : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-6 py-3">
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={saving}
              className="text-cardinal-600 hover:bg-cardinal-50 hover:text-cardinal-700"
            >
              <Trash2 /> {deleteLabel}
            </Button>
          )}
          {footerStart}
          <div className="flex-1" />
          {dirty && <span className="text-xs text-slate-500">Unsaved changes</span>}
          <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
            {onSave ? "Cancel" : "Close"}
          </Button>
          {onSave && (
            <Button type="button" onClick={onSave} disabled={saving || saveDisabled} title="Save (⌘S)">
              {saving && <Loader2 className="animate-spin" />}
              {saveLabel}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
