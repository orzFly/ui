"use client";

import { Slot } from "radix-ui";
import * as React from "react";

import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import {
  accepts,
  dragOf,
  register,
  subscribe,
  type ZoneOptions,
} from "./file-drop/store.ts";
import { useComposedRef } from "./overflow/util.ts";

/**
 * The drag drawn on a span of the zone's own, which reads its own
 * `data-drag`, so an outer zone's drag never shows through an inner one.
 * Nothing it draws takes room, and it draws at once: a drag's answer cannot
 * wait for a transition.
 */
const HIGHLIGHT = [
  "pointer-events-none absolute hidden data-drag:block raymond:rounded-none",
  // A field is drawn around, 6px out and under its controls, so nothing it holds is covered.
  "data-[purpose=field]:-inset-1.5 data-[purpose=field]:-z-10 data-[purpose=field]:rounded-frame",
  // A pane fills its box, so its edge is all there is to draw on, over what it holds, in the box's own corners.
  "data-[purpose=pane]:inset-0 data-[purpose=pane]:z-50 data-[purpose=pane]:rounded-[inherit]",
  // A file anywhere in the window: a faint dashed line at each place it can go.
  "data-[drag=ready]:border data-[drag=ready]:border-dashed data-[drag=ready]:border-input",
  // Over a field: Tree's drop target, a primary wash and a solid line.
  "data-[purpose=field]:data-[drag=over]:border data-[purpose=field]:data-[drag=over]:border-primary data-[purpose=field]:data-[drag=over]:bg-[color-mix(in_oklab,var(--primary)_12%,var(--background))]",
  // Over a pane: a heavier edge, and a veil faint enough to read the pane through.
  "data-[purpose=pane]:data-[drag=over]:border-2 data-[purpose=pane]:data-[drag=over]:border-primary data-[purpose=pane]:data-[drag=over]:bg-primary/7",
  // raymond: a dotted line in the bevel's shadow, as its focus rectangle is.
  "raymond:data-[drag=ready]:border-dotted raymond:data-[drag=ready]:border-(--3d-shadow)",
  // raymond over a field: a 2px frame in the highlight over the face dithered with its highlight, as the current page's button is latched.
  "raymond:data-[drag=over]:border-2 raymond:data-[drag=over]:border-primary raymond:data-[purpose=field]:data-[drag=over]:bg-(--3d-highlight) raymond:data-[purpose=field]:data-[drag=over]:bg-[conic-gradient(var(--3d-face)_25%,transparent_0_50%,var(--3d-face)_0_75%,transparent_0)] raymond:data-[purpose=field]:data-[drag=over]:bg-size-[2px_2px]",
  // raymond over a pane: the frame alone, since its flat face has no veil to show.
  "raymond:data-[purpose=pane]:data-[drag=over]:bg-transparent",
].join(" ");

interface FileDropState {
  open: () => void;
  disabled: boolean;
}

const FileDropContext = React.createContext<FileDropState | null>(null);

type FileDropProps = React.ComponentProps<"div"> & {
  /**
   * The one file the zone takes, chosen, dropped or pasted. The latest
   * function given is called, so it needs no `useCallback`.
   */
  onFile: (file: File) => void;
  /**
   * The types it takes, as `<input accept>` writes them: a MIME type
   * (`image/png`), a wildcard (`image/*`) or an extension (`.json`), comma
   * separated, any case. The chooser, a drop and a paste all go by it.
   * Default: any file.
   */
  accept?: string;
  /**
   * A file chosen or dropped that `accept` turns away, for the app to say
   * why. A paste is refused only when the focus is in the zone: one made
   * with the pointer resting on it is left alone, and so is one into a
   * text field there that brings text along.
   */
  onReject?: (file: File) => void;
  /**
   * Takes nothing: its `FileDropTrigger` is disabled, a file dragged over it
   * cannot be let go, and a paste passes it by. Its other controls are the
   * app's to disable.
   */
  disabled?: boolean;
  /**
   * `field`, a group of controls in a form, is drawn 6px outside its box,
   * which the scroller around it must leave room for. `pane`, a region that
   * fills its box (a viewer, the whole window), is drawn on its edge, over
   * what it holds.
   */
  purpose?: "field" | "pane";
  /**
   * Put the zone on the single child (a `main`, a `Pane`), which keeps its
   * own role; a `pane` usually is one.
   */
  asChild?: boolean;
};

/**
 * Takes one file, however it comes: chosen through its `FileDropTrigger`,
 * dropped on it, or pasted while the focus is inside it or the pointer rests
 * on it. While a file is dragged anywhere in the window, every zone draws
 * itself as a place it can go (`data-drag="ready"`), and the one under the
 * pointer as taking it (`"over"`). A file let go outside every zone and
 * outside a text field is caught, rather than opened in place of the page.
 *
 * A `group` that adds no tab stop, named by `aria-labelledby` or
 * `aria-label`; the focus stays on the controls it holds.
 */
function FileDrop({
  onFile,
  accept,
  onReject,
  disabled = false,
  purpose = "field",
  asChild = false,
  className,
  children,
  ref,
  ...props
}: FileDropProps) {
  const [element, setElement] = React.useState<HTMLElement | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const options = React.useRef<ZoneOptions>({
    accept,
    disabled,
    onFile,
    onReject,
  });
  // Read at each event rather than registered anew, so a change mid-drag
  // keeps the drag the store is following.
  React.useEffect(() => {
    options.current = { accept, disabled, onFile, onReject };
  });
  React.useEffect(
    () => (element ? register(element, options) : undefined),
    [element],
  );
  const drag = React.useSyncExternalStore(
    subscribe,
    () => dragOf(element, disabled),
    () => undefined,
  );
  const composedRef = useComposedRef<HTMLElement>(
    setElement,
    ref as React.Ref<HTMLElement> | undefined,
  );
  const context = React.useMemo<FileDropState>(
    () => ({ open: () => input.current?.click(), disabled }),
    [disabled],
  );

  const Comp = asChild ? Slot.Root : "div";
  return (
    <FileDropContext.Provider value={context}>
      <Comp
        role={asChild ? undefined : "group"}
        {...props}
        ref={composedRef}
        data-slot="file-drop"
        data-purpose={purpose}
        data-drag={drag}
        data-disabled={disabled ? "" : undefined}
        className={cn("relative isolate", className)}
      >
        <Slot.Slottable>{children}</Slot.Slottable>
        <span
          aria-hidden
          data-slot="file-drop-highlight"
          data-purpose={purpose}
          data-drag={drag}
          className={HIGHLIGHT}
        />
        <input
          ref={input}
          type="file"
          hidden
          tabIndex={-1}
          accept={accept}
          disabled={disabled}
          data-slot="file-drop-input"
          // Opened from the trigger; its click is no click on what holds the zone.
          onClick={(event) => event.stopPropagation()}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            // The same file chosen again still fires a change.
            event.currentTarget.value = "";
            if (!file) return;
            if (accepts(accept, file)) onFile(file);
            // The chooser can be switched to any file.
            else onReject?.(file);
          }}
        />
      </Comp>
    </FileDropContext.Provider>
  );
}

type FileDropTriggerProps = React.ComponentProps<typeof Button>;

/**
 * Opens the chooser of the `FileDrop` it is in: an `outline` `Button`
 * unless given a `variant`, or with `asChild` the caller's own button (a
 * `ToolbarButton`, a menu item in a portal). Its words end in "…", since
 * it opens a dialog. Disabled with its zone.
 */
function FileDropTrigger({
  variant = "outline",
  asChild = false,
  disabled,
  onClick,
  ...props
}: FileDropTriggerProps) {
  const zone = React.useContext(FileDropContext);
  if (!zone) throw new Error("FileDropTrigger renders inside a FileDrop");
  const marks = {
    disabled: zone.disabled || disabled,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (!event.defaultPrevented) zone.open();
    },
  };
  // The caller's button keeps its own look; Button's would draw over it.
  if (asChild) return <Slot.Root {...props} {...marks} />;
  return (
    // In a form it opens the chooser, never submits.
    <Button type="button" variant={variant} {...props} {...marks} />
  );
}

export {
  FileDrop,
  type FileDropProps,
  FileDropTrigger,
  type FileDropTriggerProps,
};
