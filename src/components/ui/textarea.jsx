import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // Same treatment as input.jsx — mirrors the CMS pages' local
        // `textareaCls`.
        "flex min-h-[80px] w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 transition-colors placeholder:font-semibold placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
