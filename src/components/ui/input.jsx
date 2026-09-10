import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        // Matches the `inputCls` string every existing CMS page defines
        // locally (rounded-2xl, slate-50 fill, 2px slate ring, brand ring
        // on focus), so migrated forms look identical to unmigrated ones.
        "flex w-full rounded-2xl bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 ring-2 ring-slate-200 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:font-semibold placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
