"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import { copyToClipboard, writeClipboard } from "../lib/clipboard.ts";
import { Button } from "./button.tsx";
import { CommandTooltip } from "./toolbar/command.tsx";
import { ToolbarInternalContext } from "./toolbar/store.ts";
import { ToolbarButton } from "./toolbar.tsx";

/** How long the button shows the check after a copy. */
const COPIED_MS = 1500;

type Size = "xs" | "sm" | "default" | "lg";

const ICON = {
  xs: "icon-xs",
  sm: "icon-sm",
  default: "icon",
  lg: "icon-lg",
} as const;

type CopyButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "size" | "onClick" | "children" | "value"
> &
  Pick<
    React.ComponentProps<typeof ToolbarButton>,
    "tooltip" | "shortcut" | "priority" | "labelCollapse"
  > & {
    /**
     * What it copies, or a function that reads it at the press, for a value that is costly to
     * write out or that changes. A function that gives `null` or `undefined` copies nothing.
     */
    text: string | (() => string | null | undefined);
    /**
     * The height, one of the style's control sizes; without words the button is the square of
     * it. Outside a toolbar `default`, inside one the bar's, unless given.
     */
    size?: Size;
    /**
     * The icon it shows at rest. The check that stands in for it takes its `className` and
     * `data-icon`. Default: a copy icon.
     */
    icon?: React.ReactNode;
    /** What a screen reader hears once the text is on the clipboard. */
    copiedLabel?: string;
    /**
     * Its words after the icon, in a `ToolbarLabel` to hide to fit in a `Toolbar`. Without them
     * the icon alone, named by `aria-label` (default "Copy"), which its tooltip shows. With
     * `asChild`, the button of the caller's own.
     */
    children?: React.ReactNode;
    /**
     * Put the copying on the single child, a button of the caller's own, with the icon before
     * its children: a `ToolbarButton` among the commands of a strip that is not a `Toolbar`.
     */
    asChild?: boolean;
  };

/**
 * A button that copies `text` and answers on itself: its icon turns into a check for a moment
 * (`data-copied` on the button), and a screen reader hears `copiedLabel`. A copy that fails
 * toasts, as `writeClipboard` does.
 *
 * A ghost `Button` unless given a `variant`. In a `Toolbar` it is a `ToolbarButton`: its words
 * hide to fit, and it goes into the ⋯ menu, where the button is out of sight and a toast says the
 * copy was made.
 */
function CopyButton({
  text,
  size,
  icon = <CopyIcon />,
  copiedLabel = "Copied",
  asChild = false,
  variant,
  tooltip,
  shortcut,
  priority,
  labelCollapse,
  children,
  ...props
}: CopyButtonProps) {
  const inBar = React.useContext(ToolbarInternalContext) !== null;
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  // A write still pending at unmount must not start a timer nothing clears.
  const mounted = React.useRef(false);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);
  const copy = async (event: React.MouseEvent<HTMLElement>) => {
    const value = typeof text === "function" ? text() : text;
    if (value === null || value === undefined) return;
    // The ⋯ menu hands on its item's event, and closes over the button.
    if (event.currentTarget.getAttribute("role") === "menuitem") {
      await copyToClipboard(value, copiedLabel);
      return;
    }
    if (!(await writeClipboard(value)) || !mounted.current) return;
    clearTimeout(timer.current);
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };
  const marks = {
    "data-copied": copied ? "" : undefined,
    onClick: copy,
  };
  // The check stands in at the icon's size and place, so nothing moves.
  const drawn = React.isValidElement<{
    className?: string;
    "data-icon"?: string;
  }>(icon)
    ? icon.props
    : {};
  const glyph = copied ? (
    <CheckIcon className={drawn.className} data-icon={drawn["data-icon"]} />
  ) : (
    icon
  );
  const words =
    children !== undefined &&
    children !== null &&
    typeof children !== "boolean";
  const name = props["aria-label"] ?? (words ? undefined : "Copy");
  const square = (each: Size) => (words ? each : ICON[each]);

  let button: React.ReactNode;
  if (asChild) {
    button = (
      <Slot.Root {...props} {...marks}>
        {glyph}
        <Slot.Slottable>{children}</Slot.Slottable>
      </Slot.Root>
    );
  } else if (inBar) {
    button = (
      <ToolbarButton
        {...props}
        {...marks}
        variant={variant ?? "ghost"}
        size={size === undefined ? undefined : square(size)}
        aria-label={name}
        tooltip={tooltip ?? (words ? undefined : name)}
        shortcut={shortcut}
        priority={priority}
        labelCollapse={labelCollapse}
      >
        {glyph}
        {children}
      </ToolbarButton>
    );
  } else {
    button = (
      <CommandTooltip
        enabled={!words || tooltip !== undefined || shortcut !== undefined}
        text={tooltip ?? name}
        shortcut={shortcut}
      >
        <Button
          {...props}
          {...marks}
          variant={variant ?? "ghost"}
          size={square(size ?? "default")}
          aria-label={name}
        >
          {glyph}
          {children}
        </Button>
      </CommandTooltip>
    );
  }
  return (
    <>
      {button}
      {/* Beside the button rather than in it, where its words would join the button's name. */}
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}

export { CopyButton, type CopyButtonProps };
