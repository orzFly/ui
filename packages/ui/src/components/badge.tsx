import { TAG_COLORS, type TagColor } from "@orz/themes";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { autoTagColor, tagInk } from "../lib/tag-color.ts";
import { cn } from "../lib/utils.ts";

// Under raymond a badge that is not filled is a static edge, Windows 2000's
// one-pixel sunken border, and no tint: a tinted badge keeps its tinted text
// on whatever face it sits on.
const STATIC_EDGE =
  "raymond:border-transparent raymond:bg-transparent raymond:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:dark:bg-transparent raymond:[a]:hover:bg-transparent";

// A marker in a tag's colour, `--tag-ink`, which Badge sets: the name and the
// edge in it, on it mixed into the page at TAG_FILL's share (16% light, 24%
// dark). Important, so a menu row that recolours every descendant on
// highlight leaves the tag its colour. Under raymond the colour is a swatch
// before the name, edged in the name's colour, and the name takes the text
// around it, so a row filled with the highlight turns both white and the
// swatch keeps its colour.
const TAG_MARKER = [
  "border-(color:--tag-ink)/35 bg-[color-mix(in_oklab,var(--tag-ink)_16%,var(--background))] text-(color:--tag-ink)! dark:bg-[color-mix(in_oklab,var(--tag-ink)_24%,var(--background))] [a]:hover:border-(color:--tag-ink)",
  "raymond:border-transparent raymond:bg-transparent raymond:text-inherit! raymond:dark:bg-transparent raymond:[a]:hover:border-transparent raymond:[a]:hover:bg-transparent",
  "raymond:before:size-[9px] raymond:before:shrink-0 raymond:before:border raymond:before:border-current raymond:before:bg-(color:--tag-ink) raymond:before:content-['']",
];

const badgeVariants = cva(
  "group/badge inline-flex h-chip w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-chip border border-transparent px-2 py-0.5 text-ui-xs font-medium whitespace-nowrap transition-all focus-visible:focus-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        // The same text mix as Button's destructive variant, for the same reason.
        destructive: [
          "border-destructive/35 bg-destructive/10 text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)] focus-visible:outline-destructive dark:bg-destructive/20 [a]:hover:bg-destructive/20",
          STATIC_EDGE,
        ],
        success: [
          "border-success/35 bg-success/10 text-[color-mix(in_oklab,var(--success),var(--foreground)_65%)] focus-visible:outline-success dark:bg-success/20 [a]:hover:bg-success/20",
          STATIC_EDGE,
        ],
        warning: [
          "border-warning/35 bg-warning/10 text-[color-mix(in_oklab,var(--warning),var(--foreground)_65%)] focus-visible:outline-warning dark:bg-warning/20 [a]:hover:bg-warning/20",
          STATIC_EDGE,
        ],
        outline: [
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
          STATIC_EDGE,
        ],
        // Under raymond the marker keeps its fill inside the static edge, as
        // raymond's module marker square does.
        marker: [
          "border-primary/35 bg-marker text-primary [a]:hover:border-primary",
          STATIC_EDGE,
          "raymond:bg-marker raymond:dark:bg-marker raymond:[a]:hover:bg-marker",
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

type BadgeProps = Omit<React.ComponentProps<"span">, "color"> & {
  asChild?: boolean;
} & (
    | {
        variant: "marker";
        /**
         * A tag's colour: a name from `TAG_COLORS`, which the theme draws, or
         * any CSS colour value, drawn from the theme's tag colours at its hue.
         * Absent, or a value that does not parse, the marker is the accent's.
         */
        color?: TagColor | (string & {});
      }
    | {
        variant?: Exclude<
          VariantProps<typeof badgeVariants>["variant"],
          "marker"
        >;
        color?: never;
      }
  );

/**
 * A short label or count. `marker` is in the module marker's colours: the
 * accent on the marker tint, edged in the accent; with a `color`, a tag's.
 */
function Badge({
  className,
  variant = "default",
  asChild = false,
  color,
  style,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";
  const ink = variant === "marker" ? tagInk(color) : undefined;
  const named = (TAG_COLORS as readonly (string | undefined)[]).includes(color);

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-color={ink === undefined ? undefined : named ? color : "value"}
      className={cn(
        ink === undefined
          ? badgeVariants({ variant })
          : [badgeVariants({ variant: null }), TAG_MARKER],
        className,
      )}
      style={
        ink === undefined
          ? style
          : ({ "--tag-ink": ink, ...style } as React.CSSProperties)
      }
      {...props}
    />
  );
}

export { autoTagColor, Badge, badgeVariants, TAG_COLORS, type TagColor };
