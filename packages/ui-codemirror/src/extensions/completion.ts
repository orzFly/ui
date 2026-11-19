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
      host.className = className;
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
 * return. Both stand at a picker row's height, so a drawn part has room, and
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
    boxShadow:
      "0 4px 6px -1px color-mix(in oklab, var(--foreground) 12%, transparent)",
    overflow: "hidden",
    fontFamily: "var(--font-ui)",
  },
  ".cm-tooltip-autocomplete > ul": {
    maxHeight: "16rem",
    fontFamily: "inherit",
  },
  // Named in full: the base theme's `10em` comes through this selector,
  // which outranks the one above, and would show four drawn rows and the top
  // of a fifth.
  ".cm-tooltip.cm-tooltip-autocomplete > ul": { maxHeight: "16rem" },
  ".cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "baseline",
    gap: "0.375rem",
    padding: "0.25rem 0.5rem",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--accent)",
    color: "var(--accent-foreground)",
  },
  ".cm-completionLabel": { flex: "0 0 auto", fontFamily: "var(--font-mono)" },
  ".cm-completionDetail": {
    flex: "1 1 auto",
    fontStyle: "normal",
    color: "var(--muted-foreground)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-completionMatchedText": { textDecoration: "none", fontWeight: "600" },
  // Named in full for the same reason: the base theme sets the list's
  // monospace and its rows' 1px padding through `… > ul`, and at that padding
  // a drawn part touches both edges of its row.
  ".cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-completion-drawn, .cm-tooltip.cm-tooltip-autocomplete > ul > li.cm-completion-face":
    {
      alignItems: "center",
      gap: "0.5rem",
      minHeight: "1.875rem",
      padding: "0.25rem 0.5rem",
      fontFamily: "var(--font-ui)",
    },
  ".cm-completion-drawn .cm-completionIcon, .cm-completion-face .cm-completionIcon, .cm-completion-face .cm-completionLabel":
    { display: "none" },
  ".cm-completion-drawn .cm-completionLabel": { fontFamily: "inherit" },
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
