import { Toggle as TogglePrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../lib/utils.ts";

/**
 * One of a set of filters or tags, each on or off on its own, that acts the moment it is pressed:
 * a notebook's tags narrowing its notes. `pressed` with `onPressedChange` controls it,
 * `defaultPressed` leaves it to itself. Put a run of them in a `fieldset` named with
 * `aria-label`.
 */
function Toggle({
  className,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      // Under raymond a toolbar button that latches on its own, as
      // WordPad's bold and italic: flat until the pointer raises it by a
      // pixel, and while on sunk by a pixel over the face dithered with its
      // highlight, as SegmentedControl's pressed mode is; all in the window
      // text, square.
      className={cn(
        "relative inline-flex h-control-xs items-center gap-1 rounded-full border px-2 text-ui-sm outline-none transition-colors hover:bg-accent focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground touch:hit-area",
        "raymond:rounded-none raymond:border-transparent raymond:text-foreground raymond:transition-none raymond:[--focus-offset:-3px] raymond:hover:bg-transparent raymond:not-aria-pressed:hover:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:aria-pressed:border-transparent raymond:aria-pressed:bg-(--3d-highlight) raymond:aria-pressed:bg-[conic-gradient(var(--3d-face)_25%,transparent_0_50%,var(--3d-face)_0_75%,transparent_0)] raymond:aria-pressed:bg-size-[2px_2px] raymond:aria-pressed:text-foreground raymond:aria-pressed:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:disabled:opacity-100 raymond:disabled:text-(--3d-shadow) raymond:disabled:[text-shadow:1px_1px_var(--3d-highlight)]",
        className,
      )}
      {...props}
    />
  );
}

export { Toggle };
