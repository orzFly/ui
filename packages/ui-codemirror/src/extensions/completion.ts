import {
  acceptCompletion,
  autocompletion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { type Extension, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { spaceAfterAccept } from "./completion-space.ts";
import { snippetFieldKeys, tagCompletionSource } from "./tag-completion.ts";

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
export function completionWith(sources: CompletionSource[]): Extension {
  return [
    Prec.high(keymap.of([{ key: "Tab", run: acceptCompletion }])),
    snippetFieldKeys,
    // With filter:false CodeMirror ignores boost and preserves source order.
    // Put tags first so <det selects the template while retaining caller rows.
    autocompletion({ override: [tagCompletionSource, ...sources] }),
    spaceAfterAccept,
    completionTheme,
  ];
}

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
