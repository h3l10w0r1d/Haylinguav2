// src/cms/ui/styles.js — interim: the exact `inputCls` string 15 CMS pages
// define locally, so a page can drop its copy in one line before it's fully
// migrated to <Input>/<Textarea>. Delete this file once nothing imports it.
export const inputCls =
  "w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 focus:bg-white focus:ring-brand-400 focus:outline-none";
export const textareaCls = inputCls + " min-h-[80px]";
export const labelCls = "mb-1 block text-xs font-extrabold uppercase tracking-wide text-slate-500";
