// src/cms/ui/ConfirmDialog.jsx — promise-based confirm on shadcn's
// AlertDialog, replacing the bare window.confirm() every CMS page used.
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: `Delete "${c.title}"?`, description: "…" }))) return;
//
// `useConfirm` must be called from a component rendered inside
// <ConfirmProvider> (CmsLayout mounts it from Phase 3).
import { createContext, useCallback, useContext, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setReq({
        title: "Are you sure?",
        description: "",
        confirmText: "Delete",
        cancelText: "Cancel",
        destructive: true,
        ...options,
      });
    });
  }, []);

  function settle(value) {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setReq(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!req} onOpenChange={(open) => { if (!open) settle(false); }}>
        {req && (
          <AlertDialogContent className="rounded-3xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display text-lg font-extrabold">{req.title}</AlertDialogTitle>
              {req.description ? <AlertDialogDescription>{req.description}</AlertDialogDescription> : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => settle(false)}>{req.cancelText}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => settle(true)}
                className={cn(req.destructive && "bg-cardinal-500 text-white hover:bg-cardinal-600")}
              >
                {req.confirmText}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    // Outside a provider (shouldn't happen once CmsLayout mounts one) —
    // degrade to the browser dialog rather than silently confirming.
    return (opts = {}) => Promise.resolve(window.confirm(opts.title || "Are you sure?"));
  }
  return confirm;
}
