// src/cms/ui/toast.js — one toast API for every CMS page, on sonner.
// `notify(msg, kind)` has the exact signature of the local `showToast`
// each page used to define, so migrating a page is an import swap plus
// deleting its toast state/JSX. A <Toaster /> must be mounted once on the
// page (CmsLayout does this from Phase 3; until then pilots mount it).
import { toast } from "sonner";

export function notify(msg, kind = "ok") {
  if (kind === "err") return toast.error(msg);
  return toast.success(msg);
}

export { toast };
