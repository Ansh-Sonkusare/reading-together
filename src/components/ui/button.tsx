import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const primary = "bg-ink text-paper hover:bg-ink/85"
const quiet = "text-foreground hover:bg-wash aria-expanded:bg-wash"
const outline = "border-rule bg-transparent text-foreground hover:bg-wash aria-expanded:bg-wash"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding font-sans font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary,
        quiet,
        outline,
        // Pre-U0 names, kept so unrestyled pages still render; U1/U2 move them to the three above.
        default: primary,
        ghost: quiet,
        secondary: "bg-wash text-foreground hover:bg-rule",
        destructive: "bg-danger/10 text-danger hover:bg-danger/20",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 gap-1 px-3.5 text-sm [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-10 gap-1.5 px-5 text-base",
        default: "h-8 gap-1.5 px-2.5 text-sm",
        xs: "h-6 gap-1 px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        lg: "h-9 gap-1.5 px-4 text-sm",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export type ButtonProps = ButtonPrimitive.Props & VariantProps<typeof buttonVariants>

function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
