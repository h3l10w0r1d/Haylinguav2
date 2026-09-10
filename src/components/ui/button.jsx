import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // Haylingua's signature pressable 3D buttons (.btn3d* in
        // src/index.css) reachable as variants, so a CMS page can keep the
        // brand CTA look with <Button variant="brand3d">.
        brand3d: "btn3d btn3d-brand",
        neutral3d: "btn3d btn3d-neutral",
        danger3d: "btn3d btn3d-cardinal",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-xl px-3 text-xs",
        lg: "h-10 rounded-xl px-8",
        icon: "h-9 w-9",
      },
    },
    // .btn3d's own padding/rounding lives in Tailwind's components layer, so
    // the base + size utilities above (h-9 px-4 py-2 rounded-xl) would win
    // over it. Re-assert its geometry last so the 3D variants render as the
    // real .btn3d does, regardless of size.
    compoundVariants: [
      { variant: "brand3d", class: "h-auto rounded-2xl px-5 py-3.5 font-extrabold shadow-none hover:shadow-none" },
      { variant: "neutral3d", class: "h-auto rounded-2xl px-5 py-3.5 font-extrabold shadow-none hover:shadow-none" },
      { variant: "danger3d", class: "h-auto rounded-2xl px-5 py-3.5 font-extrabold shadow-none hover:shadow-none" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
