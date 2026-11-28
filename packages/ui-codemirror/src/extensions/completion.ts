import {
  acceptCompletion,
  autocompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { spaceAfterAccept } from "./completion-space.ts";
import { snippetFieldKeys, tagCompletionSource } from "./tag-completion.ts";

/**
 * How a surface draws its rows beyond label, detail and type icon: a class
 * per row (one of `completionRowClass`) and extra parts, such as an avatar
 * from `reactOption`. CodeMirror owns the `Completion` shape, so a source
 * that knows whose row it made records that in a `WeakMap` keyed by the
 * completion, which both callbacks read.
 */
export type CompletionRows = Pick<
  NonNullable<Parameters<typeof autocompletion>[0]>,
  "optionClass" | "addToOptions"
>;

/**
 * One `autocompletion()` for a surface. Several sources have to share one
 * instance: a second call would install a second panel that competes with
 * the first for the same keys.
 *
 * Tab lives here rather than in the editor's own keymap so that only a
 * surface with a panel claims the key. `acceptCompletion` returns false with
 * no panel open and no row selected, which leaves the event unhandled and
 * the browser free to move focus as it always has. Shift-Tab is left
 * unbound for the same reason, and Enter is left to `completionKeymap`,
 * where every caller row is accepted by the same rule.
 *
 * Tag templates need no inputs, so every caller gets the source here.
 * The snippet facet lives beside the Tab binding whose priority it arbitrates.
 */
export function completionWith(
  sources: CompletionSource[],
  rows: CompletionRows = {},
): Extension {
  return [
    Prec.high(keymap.of([{ key: "Tab", run: acceptCompletion }])),
    snippetFieldKeys,
    // With filter:false CodeMirror ignores boost and preserves source order.
    // Put tags first so <det selects the template while retaining caller rows.
    autocompletion({ override: [tagCompletionSource, ...sources], ...rows }),
    spaceAfterAccept,
    completionTheme,
  ];
}

/** Every `reactOption` host, which `completionTheme` sizes to its part. */
const PART = "cm-completionPart";

/**
 * An `addToOptions` entry drawn by React, for a part of a row that a
 * hand-built DOM copy would drift from (an avatar, a status pill). `draw`
 * returns null for a row without one. `position` places the part among
 * CodeMirror's own: the icon is 20, the label 50, the detail 80.
 *
 * Each part is a React root of its own and sees no context from the
 * editor's tree, so `draw` wraps it in whatever providers it needs.
 * CodeMirror gives no hook for a row leaving the DOM, so each root is
 * unmounted on a later render once its host is gone; the newest batch is
 * spared until it has had a chance to be attached.
 */
export function reactOption(
  position: number,
  className: string,
  draw: (completion: Completion) => ReactNode | null,
): { position: number; render: (completion: Completion) => Node | null } {
  const mounted: { host: HTMLElement; root: Root; settled: boolean }[] = [];
  return {
    position,
    render(completion) {
      for (let i = mounted.length - 1; i >= 0; i--) {
        const entry = mounted[i];
        if (entry === undefined || !entry.settled || entry.host.isConnected) {
          continue;
        }
        entry.root.unmount();
        mounted.splice(i, 1);
      }
      const node = draw(completion);
      if (node === null) return null;
      const host = document.createElement("span");
      host.className = `${PART} ${className}`;
      const root = createRoot(host);
      root.render(node);
      const entry = { host, root, settled: false };
      mounted.push(entry);
      queueMicrotask(() => {
        entry.settled = true;
      });
      return host;
    },
  };
}

/**
 * Row classes `completionTheme` draws, for `CompletionRows.optionClass` to
 * return. Both centre a drawn part in the row, which grows to hold it, and
 * set their text in the UI font rather than as code.
 */
export const completionRowClass = {
  /** A drawn part (an avatar) takes the type icon's place; the label stays. */
  drawn: "cm-completion-drawn",
  /**
   * The drawn part (a pill, a chip) shows the label itself, so neither the
   * icon nor the label text is printed.
   */
  face: "cm-completion-face",
} as const;

/**
 * Panel styling. CodeMirror draws its icons through CSS `content`, and every
 * colour has to come from a theme variable so both palettes — and `.dark` —
 * follow without a rebuild.
 *
 * The list and its rows are drawn as a menu's are (`DropdownMenu`, a
 * `QueryBox`'s suggestions): the list inset from its frame, rows at the row
 * token's height and the item radius, and the picked row in the accent fill
 * with the state cue, a fill alone being barely off the popover in a light
 * palette. What only a style or a coarse pointer changes is in the package's
 * `styles.css`, where their variants reach.
 *
 * Only the package's own completion types have icons here. A caller adds
 * icons for its own `type`s with an `EditorView.theme` of its own, passed
 * next to `completionWith(...)`.
 */
export const completionTheme = EditorView.theme({
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid var(--border)",
    borderRadius: "min(var(--radius-overlay), 0.5rem)",
    backgroundColor: "var(--popover)",
    color: "var(--popover-foreground)",
    boxShadow: "var(--shadow-overlay)",
    overflow: "hidden",
    fontFamily: "var(--font-ui)",
  },
  // The list and its rows are named in full: the base theme sets the list's
  // `10em`, its monospace and its rows' 1px padding and 1.2 line height
  // through `.cm-tooltip.cm-tooltip-autocomplete > ul`, which outranks a
  // shorter selector.
  ".cm-tooltip.cm-tooltip-autocomplete > ul": {
    maxHeight: "16rem",
    padding: "0.25rem",
    fontFamily: "inherit",
    fontSize: "var(--text-ui)",
  },
  // Code and words share a baseline, which centring them would not keep
  // across two faces, so the padding is what centres the line: half of what
  // the row's height leaves of it. A coarse pointer's row height comes in
  // through --completion-row, from styles.css.
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "baseline",
    gap: "0.375rem",
    minHeight: "var(--completion-row, var(--spacing-row))",
    padding:
      "max(0px, (var(--completion-row, var(--spacing-row)) - var(--text-ui--line-height)) / 2) 0.5rem",
    borderRadius: "var(--radius-item)",
    lineHeight: "var(--text-ui--line-height)",
  },
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
    backgroundImage: "var(--state-cue)",
    backgroundPosition: "left center",
    backgroundSize: "2px 50%",
    backgroundRepeat: "no-repeat",
  },
  // Pointing at a row shows it can be clicked; Enter still takes the picked
  // one, which alone has the cue.
  "@media (hover: hover)": {
    ".cm-tooltip.cm-tooltip-autocomplete > ul > li:not([aria-selected]):hover":
      {
        backgroundColor: "color-mix(in oklab, var(--accent) 60%, transparent)",
      },
  },
  // Code a size down, as a QueryBox's suggestions set it: monospace at the
  // UI size stands larger than the words beside it. On its own shorter line,
  // so its face's taller ascent and descent stay inside the words' line
  // rather than stretching the row.
  ".cm-completionLabel": {
    flex: "0 0 auto",
    fontFamily: "var(--font-mono)",
    fontSize: "var(--text-ui-sm)",
    lineHeight: "var(--text-ui-sm--line-height)",
  },
  ".cm-completionDetail": {
    flex: "1 1 auto",
    fontStyle: "normal",
    color: "var(--muted-foreground)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "600" },
  // A drawn part has no baseline of its own to share, so it is centred, and
  // the row grows past its height by what the part needs. Named in full to
  // outrank the plain row.
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-completion-drawn, .cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-completion-face":
    { alignItems: "center", gap: "0.5rem", paddingBlock: "0.25rem" },
  // A flex box, so an inline part (a Badge) stands at its own height rather
  // than on a line of the row's, whose descent would add a pixel below it.
  [`.${PART}`]: { display: "flex", alignItems: "center" },
  ".cm-completion-drawn .cm-completionIcon, .cm-completion-face .cm-completionIcon, .cm-completion-face .cm-completionLabel":
    { display: "none" },
  ".cm-completion-drawn .cm-completionLabel": {
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
  },
  ".cm-completionIcon": { width: "1em", paddingRight: "0", opacity: "1" },
  ".cm-completionIcon-command::after": {
    content: "'/'",
    color: "var(--primary)",
  },
  ".cm-completionIcon-tag::after": {
    content: "'<'",
    color: "var(--primary)",
  },
});
