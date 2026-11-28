import { Slot } from "radix-ui";
import * as React from "react";

import { isPlainClick } from "../lib/link.ts";
import { cn } from "../lib/utils.ts";

/**
 * `.markdown-body a` underlines every link, and a border saying "clickable"
 * on top of an underline says it twice; hover takes over what the underline
 * was for. The utilities layer is emitted after the components layer that
 * rule lives in, so `no-underline` wins without a specificity fight.
 */
export const RICH_CHIP_SKIN =
  "rounded-[min(var(--radius-chip),6px)] border bg-muted/40 px-[0.3em] py-px no-underline hover:border-ring hover:bg-muted focus-visible:focus-ring focus-visible:outline-offset-1";

/**
 * `inline-block`, not `inline-flex`: Chromium copies each flex item as a block
 * of its own, so a sentence with a chip in it pasted with a line break before
 * and after the label (UI-292). Everything inside is inline, and the chip
 * itself is what truncates.
 *
 * `overflow-x-clip` is what lets it. `text-overflow` wants the box to clip,
 * and `hidden` would make it a scroll container, whose baseline CSS puts at
 * its bottom margin edge; a box that only clips keeps its line's baseline, so
 * the label still sits on the paragraph's: measured at most 0.01px off the
 * surrounding text in Chromium, Firefox and WebKit, as the flex chip was
 * (T-460). Only the x axis, so a descender below the line is drawn rather
 * than cut.
 *
 * `leading-[1.2]` is how tall the chip is drawn. Against the body's 1.6 it
 * has room to spare, and vscode's 1.25 does not — that one overruns the line
 * by 0.11px.
 *
 * `-my-[2px]` is how tall the line has to think it is. The drawn box is
 * `1.2em` plus RICH_CHIP_SKIN's `border` and `py-px`, and a heading's line is
 * `1.25em`, so leading alone only fits wherever `4px` is under `0.05em` —
 * every heading under 80px was 2.59–3.13px taller than its chipless
 * neighbour (T-498). A line box measures an atomic inline by its margin box,
 * so giving those 4px back as margin is what the line reads, while the
 * border box still paints where the baseline puts it: unchanged at the
 * body's 22.39px, and the label's baseline with it. The 2px is the skin's
 * own border and padding per side, so neither may move without this
 * following.
 */
export const RICH_CHIP_STRUCTURE =
  "inline-block max-w-full overflow-x-clip text-ellipsis align-baseline -my-[2px] leading-[1.2] whitespace-nowrap";

/**
 * `align-top` and `mt-[0.1em]` centre the 1em icon on the chip's 1.2em line,
 * which is where the label's box is: an SVG has no baseline of its own, and
 * `align-middle` centres it half an x-height above the baseline instead, which
 * is not the line's middle. Its margin box stays inside the line, so the line
 * is no taller.
 *
 * `1em`, because a chip inside a heading is drawn at the heading's font size
 * and a glyph in `rem` stays at the body's — 14px beside 28px text (T-495).
 * The gap is a margin rather than a space, so a copied chip is its label.
 */
export const RICH_CHIP_ICON =
  "inline size-[1em] align-top mt-[0.1em] mr-[0.24em]";

/**
 * @deprecated The chip truncates its own label now that it is not a flex
 * box (see RICH_CHIP_STRUCTURE); a label needs no classes.
 */
export const RICH_CHIP_LABEL = "";

/** @deprecated Use `isPlainClick` from `@orz/ui/lib/link`. */
export const isPlainLeftClick = isPlainClick;

export type LinkChipProps = React.ComponentProps<"a"> & {
  /** Drawn before the label, at the label's font size. */
  icon?: React.ComponentType<{ className?: string }>;
  /** A bordered chip; default false, underlined on hover. */
  boxed?: boolean;
  /**
   * Render the single child element (a router's link, say) as the chip; its
   * own children become the label.
   */
  asChild?: boolean;
};

/**
 * An inline link that sits on the line of the text around it, with an
 * optional icon and a label that truncates rather than wraps.
 */
export function LinkChip({
  icon: Icon,
  boxed = false,
  asChild = false,
  className,
  children,
  ...props
}: LinkChipProps) {
  const content = (label: React.ReactNode) => (
    <>
      {Icon && <Icon className={RICH_CHIP_ICON} />}
      <span>{label}</span>
    </>
  );
  const chipProps = {
    "data-slot": "link-chip",
    className: cn(
      RICH_CHIP_STRUCTURE,
      boxed ? RICH_CHIP_SKIN : "hover:underline",
      className,
    ),
    ...props,
  };

  if (
    asChild &&
    React.isValidElement<{ children?: React.ReactNode }>(children)
  ) {
    return (
      <Slot.Root {...chipProps}>
        {React.cloneElement(
          children,
          undefined,
          content(children.props.children),
        )}
      </Slot.Root>
    );
  }
  return <a {...chipProps}>{content(children)}</a>;
}
