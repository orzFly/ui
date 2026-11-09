import * as React from "react";

import { cn } from "../lib/utils.ts";

const SegmentedControlContext = React.createContext<{
  value: string | undefined;
  onPress: (value: string) => void;
}>({ value: undefined, onPress: () => {} });

/**
 * One of two or three modes of a tool, side by side, the pressed one marked: a hex editor's
 * typing mode, a light or dark switch. It acts the moment one is pressed. Name it with
 * `aria-label`; `value` with `onValueChange` controls it, `defaultValue` leaves it to itself.
 */
function SegmentedControl({
  value: controlled,
  defaultValue,
  onValueChange,
  className,
  ...props
}: Omit<React.ComponentProps<"fieldset">, "defaultValue"> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [own, setOwn] = React.useState(defaultValue);
  const value = controlled ?? own;
  const context = React.useMemo(
    () => ({
      value,
      onPress: (next: string) => {
        setOwn(next);
        onValueChange?.(next);
      },
    }),
    [value, onValueChange],
  );
  return (
    <SegmentedControlContext.Provider value={context}>
      <fieldset
        data-slot="segmented-control"
        // Under raymond a run of toolbar buttons only one of which latches,
        // as WordPad's alignment: on the face, with no track of its own.
        className={cn(
          "grid grid-flow-col rounded-[calc(var(--radius-control)*0.8)] bg-muted p-0.5 raymond:bg-transparent",
          className,
        )}
        {...props}
      />
    </SegmentedControlContext.Provider>
  );
}

/** One mode, pressed while it is the control's value. */
function SegmentedControlItem({
  value,
  className,
  onClick,
  ...props
}: Omit<React.ComponentProps<"button">, "value"> & { value: string }) {
  const context = React.useContext(SegmentedControlContext);
  return (
    <button
      type="button"
      data-slot="segmented-control-item"
      aria-pressed={context.value === value}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.onPress(value);
      }}
      // Under raymond flat until the pointer raises it by a pixel, and the
      // pressed one sunk by a pixel over the face dithered with its
      // highlight, as a latched toolbar button is; all in the window text.
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)*0.6)] px-2.5 py-1 text-muted-foreground text-ui-sm outline-none transition-colors enabled:hover:text-foreground focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:pressed-cue touch:hit-area",
        "raymond:text-foreground raymond:transition-none raymond:[--focus-offset:-3px] raymond:enabled:not-aria-pressed:hover:shadow-[inset_1px_1px_var(--3d-highlight),inset_-1px_-1px_var(--3d-shadow)] raymond:aria-pressed:bg-(--3d-highlight) raymond:aria-pressed:bg-[conic-gradient(var(--3d-face)_25%,transparent_0_50%,var(--3d-face)_0_75%,transparent_0)] raymond:aria-pressed:bg-size-[2px_2px] raymond:aria-pressed:shadow-[inset_1px_1px_var(--3d-shadow),inset_-1px_-1px_var(--3d-highlight)] raymond:disabled:opacity-100 raymond:disabled:text-(--3d-shadow) raymond:disabled:[text-shadow:1px_1px_var(--3d-highlight)]",
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
