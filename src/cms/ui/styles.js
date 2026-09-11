// src/cms/ui/styles.js — interim: the shared class strings older CMS forms
// use on raw <input>/<textarea>/<select>, so a page can drop its local copy
// before it's fully migrated to <Input>/<Textarea>. Visually matches the
// shadcn Input (1px border, small radius, orange focus ring). Delete this
// file once nothing imports it.
export const inputCls =
  "w-full rounded-lg bg-white px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60";
export const textareaCls = inputCls + " min-h-[80px]";
export const labelCls = "mb-1 block text-xs font-medium text-slate-600";
