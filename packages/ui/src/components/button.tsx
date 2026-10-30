import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-control border border-transparent bg-clip-padding text-ui font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:focus-ring active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 touch:hit-area",
  {
    variants: {
      variant: {
        // The depth tokens are no-ops in the default style; a style that
        // bevels draws its buttons raised, and pressed while held or open.
        default:
          "bg-primary text-primary-foreground shadow-raised hover:bg-primary/80 active:shadow-pressed aria-expanded:shadow-pressed",
        outline:
          "border-input bg-background shadow-raised hover:bg-muted hover:text-foreground active:shadow-pressed aria-expanded:bg-muted aria-expanded:text-foreground aria-expanded:shadow-pressed",
        secondary:
          "bg-secondary text-secondary-foreground shadow-raised hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] active:shadow-pressed aria-expanded:bg-secondary aria-expanded:text-secondary-foreground aria-expanded:shadow-pressed",
        ghost:
          "hover:bg-muted hover:text-foreground hover:shadow-raised active:shadow-pressed aria-expanded:bg-muted aria-expanded:text-foreground aria-expanded:shadow-pressed dark:hover:bg-muted/50",
        // Not bare text-destructive: on its own 10-30% tint that measured
        // 3.2-4.5:1 in 15 of the 19 themes. Mixing 65% of --foreground in
        // clears 4.5:1 in every theme at rest and on hover; the tint keeps the
        // red. test/destructive-contrast.test.ts pins it.
        destructive:
          "bg-destructive/10 text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)] shadow-raised hover:bg-destructive/20 active:shadow-pressed focus-visible:outline-destructive dark:bg-destructive/20 dark:hover:bg-destructive/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-control gap-1.5 px-2.5 touch:h-10 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-control-xs gap-1 rounded-[min(var(--radius-control),8px)] px-2 text-ui-sm in-data-[slot=button-group]:rounded-control has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-control-sm gap-1 rounded-[min(var(--radius-control),8px)] px-2.5 text-ui-sm in-data-[slot=button-group]:rounded-control has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-control-lg gap-1.5 px-2.5 touch:h-11 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-control",
        "icon-xs":
          "size-control-xs rounded-[min(var(--radius-control),8px)] in-data-[slot=button-group]:rounded-control [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-control-sm rounded-[min(var(--radius-control),8px)] in-data-[slot=button-group]:rounded-control",
        "icon-lg": "size-control-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  /**
   * The look: `default` filled in the primary colour, `outline` and
   * `secondary` quieter, `ghost` bare until hovered, `destructive` in the
   * destructive colour, `link` as underlined text.
   */
  variant?: VariantProps<typeof buttonVariants>["variant"];
  /**
   * The height, one of the style's control sizes (`xs`, `sm`, `default`,
   * `lg`); an `icon` size is the square of the same height, for a button
   * that holds only an icon.
   */
  size?: VariantProps<typeof buttonVariants>["size"];
  /** Render the single child element (an `<a>`, a router's link) as the button. */
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
