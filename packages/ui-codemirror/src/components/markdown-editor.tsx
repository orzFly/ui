import {
  copyLineDown,
  deleteLine,
  insertBlankLine,
  isolateHistory,
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
import { dropCursor, EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { parser as commonmarkParser, GFM } from "@lezer/markdown";
import { useCallback, useEffect, useRef, useState } from "react";

import { imagePairs } from "../extensions/image-pairs.ts";
import {
  handlePaste,
  pasteAs,
  prefetchPasteConverter,
} from "../extensions/paste-as.ts";
import { toggleQuote } from "../extensions/quote-toggle.ts";
import { stagedTokenAtoms } from "../extensions/staged-token-atoms.ts";
import { STAGED_FILE_TYPE } from "../extensions/staged-tokens.ts";
import { trimTrailingSpaceOnEnter } from "../extensions/trim-trailing-space.ts";
import {
  CodeEditor,
  type CodeEditorHandle,
  type CodeEditorPurpose,
} from "./code-editor.tsx";
import { PlainMarkdownEditor } from "./plain-markdown-editor.tsx";

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
 * one file-staging handler can serve both a `<textarea>` and CodeMirror's raw
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

/**
 * The text box as file staging sees it, whichever editor draws it: the
 * CodeMirror view, or the textarea `plain` mounts.
 */
export type StagingSurface = {
  /** Where the reader presses and types: what counts as touching the box. */
  dom: HTMLElement;
  doc: () => string;
  /** `head` is the end the caret is on. */
  selection: () => { from: number; to: number; head: number };
  /** The document position under a viewport point, where one is known. */
  posAtCoords: (x: number, y: number) => number | null;
  /**
   * Apply non-overlapping `changes`, positions in the current document, as
   * one undo step where the editor allows it. A `cursor` (in the changed
   * document) moves the caret there and scrolls to it.
   */
  change: (spec: {
    changes: ReadonlyArray<{ from: number; to: number; insert?: string }>;
    cursor?: number;
    userEvent: string;
  }) => void;
};

/**
 * Where pasted, dropped and picked files go. `useStagedFiles` from
 * `hooks/use-staged-files` implements it, and the editor only calls it.
 * Each staged file sits in the text as a placeholder token
 * (`extensions/staged-tokens`), which the editor keeps whole.
 */
export type EditorFileStaging = {
  /** The box once mounted, null once it is gone. */
  bind: (surface: StagingSurface | null) => void;
  /** Every document change, programmatic ones included. */
  sync: (doc: string) => void;
  /** Whether `key` is a file this editor staged: only those are tokens. */
  knows: (key: string) => boolean;
  /** Takes the paste's files, if any, and then default-prevents it. */
  paste: (event: ClipboardEvent, surface: StagingSurface) => void;
  /** True when it took the drop; the editor's own drop then stays out. */
  drop: (event: DragEvent, surface: StagingSurface) => boolean;
  dragOver: (event: DragEvent) => void;
};

function viewSurface(view: EditorView): StagingSurface {
  return {
    dom: view.dom,
    doc: () => view.state.doc.toString(),
    selection: () => {
      const { from, to, head } = view.state.selection.main;
      return { from, to, head };
    },
    posAtCoords: (x, y) => view.posAtCoords({ x, y }),
    change: ({ changes, cursor, userEvent }) =>
      view.dispatch({
        changes: [...changes],
        ...(cursor === undefined
          ? {}
          : { selection: { anchor: cursor }, scrollIntoView: true }),
        // An undo step of its own, so the next keystroke's undo cannot take
        // a file with it, and one undo brings back exactly what a remove took.
        annotations: isolateHistory.of("full"),
        userEvent,
      }),
  };
}

/** One instance for every editor, so reconfiguring never rebuilds it. */
const dropCursorExtension = dropCursor();

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
  /**
   * File staging, from `useStagedFiles`: a pasted, dropped or picked file
   * goes into the text as a placeholder where the reader put it, drawn as a
   * chip the caret steps over. Read at mount; it sees a paste or a drop
   * before `onPaste` and `onDrop` do.
   */
  staging?: EditorFileStaging;
  /** Extra CodeMirror extensions, appended last so they can override. */
  extensions?: Extension;
  /**
   * A native textarea (`PlainMarkdownEditor`) in place of CodeMirror, with
   * the same handle, keys and callbacks and none of the extensions. Read
   * once, at mount: switching under an open draft would drop it.
   */
  plain?: boolean;
  /** What the editor is for, as `CodeEditor` takes it. Default `field`. */
  purpose?: CodeEditorPurpose;
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
 * CodeMirror matches Shift+. by keyCode as `Mod-Shift-.`, but a layout whose
 * Shift+. is `>` can arrive under that name instead.
 */
const quoteKeymap = [
  { key: "Mod-Shift-.", run: toggleQuote },
  { key: "Mod->", run: toggleQuote },
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
 * A formatted paste becomes Markdown (`pasteAs`), Mod-Shift-V pastes plain
 * text, Mod-Alt-V pastes as a quote, and Mod-Shift-. quotes or unquotes the
 * selected lines; `EditorShortcutsHelp` lists these keys. Two images with an
 * arrow between them, alone in a paragraph, get a green arrow, and a paste or
 * drop that lands one image beside another offers to join them that way
 * (`imagePairs`).
 *
 * The document is deliberately *not* React state — the EditorView owns it and
 * callers read through the ref at submit time. onChange exists only for
 * derived flags; routing every keystroke through React would re-render the
 * caller's whole tree on every character.
 *
 * `plain` trades all of this for a native textarea, for a reader who would
 * rather have the browser's own text box (a phone keyboard, a screen reader,
 * a spell checker that only knows textareas).
 */
export function MarkdownEditor({ plain, ...props }: MarkdownEditorProps) {
  const [textarea] = useState(plain ?? false);
  return textarea ? (
    <PlainMarkdownEditor {...props} />
  ) : (
    <CodeMirrorMarkdownEditor {...props} />
  );
}

function CodeMirrorMarkdownEditor({
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
  staging,
  extensions,
  purpose,
  className,
  ref,
}: Omit<MarkdownEditorProps, "plain">) {
  // Keymap and DOM handlers are built once but must always call today's
  // props, not the ones captured at mount.
  const handlers = useRef({
    onSubmit,
    onCancel,
    onPaste,
    onDrop,
    onDragOver,
    staging,
  });
  handlers.current = {
    onSubmit,
    onCancel,
    onPaste,
    onDrop,
    onDragOver,
    staging,
  };

  // Built once, like the handlers: a new instance would make the compartment
  // rebuild the chips on every render.
  const [tokenExtension] = useState(() =>
    staging === undefined
      ? []
      : stagedTokenAtoms(
          (key) => handlers.current.staging?.knows(key) ?? false,
        ),
  );
  const bindView = useCallback(
    (view: EditorView | null) =>
      handlers.current.staging?.bind(view === null ? null : viewSurface(view)),
    [],
  );

  useEffect(() => {
    const prefetch = () => void prefetchPasteConverter().catch(() => {});
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(prefetch);
      return () => cancelIdleCallback(handle);
    }
    const handle = setTimeout(prefetch, 0);
    return () => clearTimeout(handle);
  }, []);

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
        ...quoteKeymap,
      ]}
      language={markdownLanguage}
      highlightStyle={markdownHighlightStyle}
      onView={bindView}
      onChange={(value) => {
        handlers.current.staging?.sync(value);
        onChange?.(value);
      }}
      extensions={[
        pasteAs(),
        imagePairs(),
        dropCursorExtension,
        tokenExtension,
        EditorView.domEventHandlers({
          // Staging, then `onPaste`: a paste either takes as files is
          // default-prevented, and handlePaste then leaves it alone. All
          // three live in this one handler because the order of separate
          // handlers is decided by extension precedence, not by position.
          paste: (event, view) => {
            handlers.current.staging?.paste(event, viewSurface(view));
            handlers.current.onPaste?.(event);
            return handlePaste(view, event);
          },
          drop: (event, view) => {
            const staging = handlers.current.staging;
            if (staging?.drop(event, viewSurface(view))) return true;
            // A staged file's drag means nothing to an editor that stages
            // no files.
            if (
              staging === undefined &&
              event.dataTransfer?.types.includes(STAGED_FILE_TYPE)
            ) {
              event.preventDefault();
              return true;
            }
            handlers.current.onDrop?.(event);
            return false;
          },
          dragover: (event) => {
            handlers.current.staging?.dragOver(event);
            handlers.current.onDragOver?.(event);
            return false;
          },
        }),
        ...(extensions ? [extensions] : []),
      ]}
      purpose={purpose}
      className={className}
    />
  );
}
