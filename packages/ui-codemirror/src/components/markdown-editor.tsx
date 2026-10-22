import {
  copyLineDown,
  deleteLine,
  insertBlankLine,
  moveLineDown,
  moveLineUp,
  selectLine,
} from "@codemirror/commands";
import {
  defineLanguageFacet,
  HighlightStyle,
  Language,
} from "@codemirror/language";
import { selectNextOccurrence } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { parser as commonmarkParser, GFM } from "@lezer/markdown";
import { useRef } from "react";

import { trimTrailingSpaceOnEnter } from "../extensions/trim-trailing-space.ts";
import { CodeEditor, type CodeEditorHandle } from "./code-editor.tsx";

/**
 * GFM markdown, assembled straight from the Lezer parser rather than through
 * @codemirror/lang-markdown. That package hard-depends on lang-html — and so
 * on the JS and CSS parsers and @codemirror/autocomplete — purely to colour
 * embedded HTML in fenced blocks. It costs ~170 KB gzip, which is more than
 * the rest of the editor put together, to highlight something a markdown
 * input has no use for.
 *
 * Exported so a caller or a test can build an `EditorState` that parses
 * exactly the way the editor does.
 */
export const markdownLanguage = new Language(
  defineLanguageFacet({
    commentTokens: { block: { open: "<!--", close: "-->" } },
  }),
  commonmarkParser.configure([GFM]),
  [],
  "markdown",
);

export type MarkdownEditorHandle = CodeEditorHandle;

/**
 * Native-event shape shared by React's synthetic events and the DOM's own, so
 * one file-staging handler can serve both a <textarea> and CodeMirror's raw
 * listeners.
 */
export type FileClipboardEvent = {
  clipboardData: DataTransfer | null;
  preventDefault: () => void;
};
export type FileDragEvent = {
  dataTransfer: DataTransfer | null;
  preventDefault: () => void;
};

export type MarkdownEditorProps = {
  /** Read once, at mount: the editor owns its document from then on. */
  initialValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
  /** Dirty state is registered by a stable owner outside this editor. */
  ownerManagedDirty?: boolean;
  /**
   * Mod-Enter. Receives the current document so callers need no ref.
   *
   * Mod-Enter belongs to this prop alone: without one the key does nothing,
   * and a blank line goes on Alt-Enter instead. Callers that submit another
   * way leave Alt-Enter to the editor.
   */
  onSubmit?: (value: string) => void;
  /** Escape. */
  onCancel?: () => void;
  /**
   * Fires on every document change. Only for cheap derived state (an empty
   * draft disabling its submit button) — the document itself lives in the
   * editor, not in React.
   */
  onChange?: (value: string) => void;
  onPaste?: (event: FileClipboardEvent) => void;
  onDrop?: (event: FileDragEvent) => void;
  onDragOver?: (event: FileDragEvent) => void;
  /** Extra CodeMirror extensions, appended last so they can override. */
  extensions?: Extension;
  /** Height is the caller's business: pass the min-height/max-height here. */
  className?: string;
  ref?: React.Ref<MarkdownEditorHandle>;
};

/** Sublime-style line editing: six bindings, no more. */
const lineKeymap = [
  { key: "Mod-d", run: selectNextOccurrence, preventDefault: true },
  { key: "Mod-l", run: selectLine },
  { key: "Mod-Shift-k", run: deleteLine },
  { key: "Mod-Shift-d", run: copyLineDown },
  { key: "Alt-ArrowUp", run: moveLineUp },
  { key: "Alt-ArrowDown", run: moveLineDown },
  // Where Mod-Enter used to land: @codemirror/commands' defaultKeymap binds
  // Mod-Enter to insertBlankLine, and this editor now claims that key for
  // submit, so the blank line needs a binding of its own.
  { key: "Alt-Enter", run: insertBlankLine },
];

/**
 * Restrained markdown highlighting: enough structure to see the shape of a
 * document, never a rainbow. Colors come from theme variables only, so every
 * palette — and .dark — follows without a rebuild.
 */
export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, fontWeight: "600" },
  { tag: tags.strong, fontWeight: "600" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: [tags.link, tags.url], color: "var(--primary)" },
  {
    tag: [tags.monospace, tags.labelName],
    fontFamily: "var(--font-mono)",
    color: "var(--foreground)",
  },
  { tag: tags.quote, color: "var(--muted-foreground)" },
  // The literal `#`, `*`, backticks — present but receding.
  {
    tag: [tags.processingInstruction, tags.contentSeparator],
    color: "var(--muted-foreground)",
  },
]);

/**
 * A markdown input surface: one editor for every place that takes markdown.
 *
 * The document is deliberately *not* React state — the EditorView owns it and
 * callers read through the ref at submit time. onChange exists only for
 * derived flags; routing every keystroke through React would re-render the
 * caller's whole tree on every character.
 */
export function MarkdownEditor({
  initialValue,
  placeholder,
  ariaLabel,
  autoFocus,
  readOnly,
  ownerManagedDirty,
  onSubmit,
  onCancel,
  onChange,
  onPaste,
  onDrop,
  onDragOver,
  extensions,
  className,
  ref,
}: MarkdownEditorProps) {
  // Keymap and DOM handlers are built once but must always call today's
  // props, not the ones captured at mount.
  const handlers = useRef({ onSubmit, onCancel, onPaste, onDrop, onDragOver });
  handlers.current = { onSubmit, onCancel, onPaste, onDrop, onDragOver };

  return (
    <CodeEditor
      slot="markdown-editor"
      ref={ref}
      initialValue={initialValue}
      placeholder={placeholder}
      ariaLabel={ariaLabel}
      autoFocus={autoFocus}
      readOnly={readOnly}
      ownerManagedDirty={ownerManagedDirty}
      keymap={[
        {
          key: "Mod-Enter",
          run: (v) => {
            // Swallowed whether or not anyone is listening. Falling
            // through would reach defaultKeymap's Mod-Enter →
            // insertBlankLine, and a key that means "submit" on every
            // other form should not silently add a line here.
            handlers.current.onSubmit?.(v.state.doc.toString());
            return true;
          },
        },
        {
          key: "Escape",
          run: () => {
            const cancel = handlers.current.onCancel;
            if (cancel === undefined) return false;
            cancel();
            return true;
          },
        },
        // Completion's Prec.highest keymap sees Enter first while its panel is
        // open; this only handles the key after completion declines it.
        {
          key: "Enter",
          run: trimTrailingSpaceOnEnter,
          shift: trimTrailingSpaceOnEnter,
        },
        ...lineKeymap,
      ]}
      language={markdownLanguage}
      highlightStyle={markdownHighlightStyle}
      onChange={onChange}
      extensions={[
        EditorView.domEventHandlers({
          paste: (event) => {
            handlers.current.onPaste?.(event);
            return false;
          },
          drop: (event) => {
            handlers.current.onDrop?.(event);
            return false;
          },
          dragover: (event) => {
            handlers.current.onDragOver?.(event);
            return false;
          },
        }),
        ...(extensions ? [extensions] : []),
      ]}
      className={className}
    />
  );
}
