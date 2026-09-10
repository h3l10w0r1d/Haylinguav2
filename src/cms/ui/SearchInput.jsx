// src/cms/ui/SearchInput.jsx — controlled search box with a debounced
// onChange (so URL/state updates don't fire per keystroke), a magnifier, and
// a clear button. `value` is the committed value (e.g. list.q); the field
// keeps its own draft while typing.
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchInput({ value = "", onChange, placeholder = "Search…", delay = 250, autoFocus, className }) {
  const [draft, setDraft] = useState(value);

  // External resets (e.g. list.reset()) flow back into the field.
  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pl-10 pr-9"
        type="search"
        aria-label={placeholder}
      />
      {draft && (
        <button
          type="button"
          onClick={() => { setDraft(""); onChange(""); }}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
