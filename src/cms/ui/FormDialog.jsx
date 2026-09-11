// src/cms/ui/FormDialog.jsx — small modal form for "New …" actions that only
// need a few fields (a vacancy's title/location, a forum category's name).
// Enter submits; Cancel / Esc / overlay close unless a submit is in flight.
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel = "Create",
  submitting = false,
  submitDisabled = false,
  onSubmit,
  children,
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitting && !submitDisabled) onSubmit();
          }}
          className="space-y-5"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900">{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <div className="space-y-4">{children}</div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || submitDisabled}>
              {submitting && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
