import { Slot, Toolbar as ToolbarPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "../../lib/utils.ts";
import { Kbd } from "../kbd.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../tooltip.tsx";
import {
  type LabelHost,
  LabelHostContext,
  OUT_OF_FLOW,
  ToolbarInternalContext,
  UnitLabelsContext,
} from "./store.ts";

/**
 * A command's words, which hide to fit on a fine pointer, its icon staying
 * and its tooltip taking the words over. Outside a toolbar, or in the ⋯
 * menu, it is plain text.
 */
export function ToolbarLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const host = React.useContext(LabelHostContext);
  const labels = React.useContext(UnitLabelsContext);
  const ref = React.useRef<HTMLSpanElement>(null);
  const hidden = host?.hidden ?? false;
  const collapsible = host?.collapsible ?? false;
  const mode = host?.mode ?? "swap";
  const button = host?.button;
  React.useLayoutEffect(() => {
    if (!collapsible || !labels || !ref.current || !button) return;
    return labels.add({ el: ref.current, mode, button });
  }, [collapsible, labels, mode, button]);
  const setText = host?.setText;
  React.useLayoutEffect(() => {
    setText?.(ref.current?.textContent ?? "");
  });
  return (
    <span
      ref={ref}
      data-slot="toolbar-label"
      aria-hidden={hidden || undefined}
      className={cn("whitespace-nowrap", hidden && OUT_OF_FLOW, className)}
    >
      {children}
    </span>
  );
}

function walk(
  children: React.ReactNode,
  visit: (child: React.ReactNode) => boolean,
): boolean {
  let found = false;
  React.Children.forEach(children, (child) => {
    if (found) return;
    if (
      React.isValidElement<{ children?: React.ReactNode }>(child) &&
      child.type === React.Fragment
    ) {
      found = walk(child.props.children, visit);
      return;
    }
    if (visit(child)) found = true;
  });
  return found;
}

const isLabel = (child: React.ReactNode) =>
  React.isValidElement(child) && child.type === ToolbarLabel;

/** What a command shows: its child's children when it renders through `asChild`. */
export function contentOf(
  children: React.ReactNode,
  asChild: boolean | undefined,
): React.ReactNode {
  if (!asChild) return children;
  return React.isValidElement<{ children?: React.ReactNode }>(children)
    ? children.props.children
    : children;
}

/** Holds a `ToolbarLabel`. */
export const hasLabel = (content: React.ReactNode) => walk(content, isLabel);

/** Holds something besides its label, an icon, which stays when the label hides. */
export const hasMore = (content: React.ReactNode) =>
  walk(
    content,
    (child) =>
      !isLabel(child) &&
      child !== null &&
      child !== undefined &&
      typeof child !== "boolean",
  );

/** Shows words: a `ToolbarLabel` or bare text. */
export const hasWords = (content: React.ReactNode) =>
  walk(
    content,
    (child) =>
      isLabel(child) || typeof child === "string" || typeof child === "number",
  );

/**
 * Whether a command's label may hide: its own `labelCollapse` first, then
 * the toolbar's `never`, then never for a primary or destructive command,
 * whose words say what it does before it is done.
 */
export function mayCollapse(
  own: "auto" | "never" | undefined,
  toolbar: "auto" | "never",
  variant: string | null | undefined,
): boolean {
  if (own) return own === "auto";
  if (toolbar === "never") return false;
  return variant !== "default" && variant !== "destructive";
}

/** A button that holds a `ToolbarLabel`: whether it hides, and the words it shows. */
export function useLabelHost(
  mode: "swap" | "stay",
  collapsible: boolean,
  hidden: boolean,
) {
  const button = React.useRef<HTMLElement | null>(null);
  const [text, setText] = React.useState("");
  const host = React.useMemo<LabelHost>(
    () => ({
      mode,
      collapsible,
      hidden: collapsible && hidden,
      button,
      setText,
    }),
    [mode, collapsible, hidden],
  );
  return { host, text, button };
}

/**
 * A command's tooltip, mounted whether or not it may open: wrapping a
 * button only while its label is hidden would remount it as the bar
 * narrows, and a button holding the focus would lose it.
 */
export function CommandTooltip({
  enabled,
  text,
  shortcut,
  children,
  ...props
}: React.ComponentProps<typeof TooltipTrigger> & {
  enabled: boolean;
  text: React.ReactNode;
  shortcut?: string;
}) {
  const internal = React.useContext(ToolbarInternalContext);
  const [open, setOpen] = React.useState(false);
  // Held shut, the tooltip still hears a hover or a focus open it, but not
  // the pointer or the focus leave: an open taken while the words showed, or
  // kept as they came back, would show it the moment they hide again,
  // wherever the pointer is by then.
  if (!enabled && open) setOpen(false);
  // Outside a toolbar, which provides them, only a command given a tooltip
  // has one, under a provider of its own.
  if (!internal && !enabled)
    return <Slot.Root {...props}>{children}</Slot.Root>;
  const tooltip = (
    <Tooltip
      open={enabled && open}
      onOpenChange={(next) => setOpen(enabled && next)}
    >
      <TooltipTrigger asChild {...props}>
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {text}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
  return internal ? tooltip : <TooltipProvider>{tooltip}</TooltipProvider>;
}

/**
 * Set around a trigger a part has already put in its toolbar's arrow-key
 * order (a `FilterMenu`'s), so a `ToolbarButton` given as that trigger does
 * not put it in twice: listed twice, the arrows would stop on it.
 */
export const RovingTaken = React.createContext(false);

/**
 * A command's place in its toolbar's arrow-key order: one Tab stop for the
 * bar, the arrows moving between its commands. Outside a toolbar, nothing.
 */
export function Roving({
  link,
  ...props
}: React.ComponentProps<typeof Slot.Root> & {
  link?: boolean;
  /** Skipped by the arrow keys, as the button it wraps is. */
  disabled?: boolean;
}) {
  const internal = React.useContext(ToolbarInternalContext);
  const taken = React.useContext(RovingTaken);
  if (!internal || taken) return <Slot.Root {...props} />;
  // A link takes no `type`, which the button's part would write onto it.
  if (link) {
    return (
      <ToolbarPrimitive.Link
        asChild
        {...(props as React.ComponentProps<typeof ToolbarPrimitive.Link>)}
      />
    );
  }
  return (
    <ToolbarPrimitive.Button
      asChild
      {...(props as React.ComponentProps<typeof ToolbarPrimitive.Button>)}
    />
  );
}
