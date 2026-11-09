import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

// Under raymond a badge that is not filled is a static edge, Windows 2000's
// one-pixel sunken border, and no tint: a tinted badge keeps its tinted text
// on whatever face it sits on.
const STATIC_EDGE =
  "raymond:border-transparent raymond:bg-transparent raymond:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:dark:bg-transparent raymond:[a]:hover:bg-transparent";

const badgeVariants = cva(
  "group/badge inline-flex h-chip w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-chip border border-transparent px-2 py-0.5 text-ui-xs font-medium whitespace-nowrap transition-all focus-visible:focus-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        // The same text mix as Button's destructive variant, for the same reason.
        destructive: [
          "bg-destructive/10 text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)] focus-visible:outline-destructive dark:bg-destructive/20 [a]:hover:bg-destructive/20",
          STATIC_EDGE,
        ],
        success: [
          "bg-success/10 text-[color-mix(in_oklab,var(--success),var(--foreground)_65%)] focus-visible:outline-success dark:bg-success/20 [a]:hover:bg-success/20",
          STATIC_EDGE,
        ],
        warning: [
          "bg-warning/10 text-[color-mix(in_oklab,var(--warning),var(--foreground)_65%)] focus-visible:outline-warning dark:bg-warning/20 [a]:hover:bg-warning/20",
          STATIC_EDGE,
        ],
        outline: [
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
          STATIC_EDGE,
        ],
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
