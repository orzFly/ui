import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  breakRun,
  documentVersion,
  editDocument,
  editGroup,
  type HexDocument,
  isHexDocument,
  lastChange,
} from "./document.ts";
import {
  type EditCommand,
  type EditState,
  editKey,
  editPaste,
  type HexEditMode,
  selectionRange,
} from "./editing.ts";
import {
  type GridContext,
  type GridEditing,
  HexGrid,
  type HexViewProps,
  useControllableSelection,
  useLatest,
} from "./hex-grid.tsx";
import { clipboardBytes, HEX_BYTES_TYPE } from "./hex-paste.ts";
import type { HexSelection } from "./types.ts";

export type { HexEditMode } from "./editing.ts";

export type HexPasteResult =
  | { ok: true; bytes: number; truncated: boolean }
  | {
      ok: false;
      /** "unencodable": the text pane's encoding has no bytes for a pasted character. */
      reason: "not-hex" | "unencodable" | "empty" | "read-only";
    };

export interface HexEditorProps extends Omit<HexViewProps, "source"> {
  document: HexDocument;
  mode?: HexEditMode;
  /** "overwrite". */
  defaultMode?: HexEditMode;
  onModeChange?: (mode: HexEditMode) => void;
  /** Shows the document with the editor's caret and refuses edits. */
  readOnly?: boolean;
  onPaste?: (result: HexPasteResult) => void;
  /** "Hex editor". */
  "aria-label"?: string;
}

const utf8 = new TextEncoder();
const MODE_NAMES = { insert: "Insert mode", overwrite: "Overwrite mode" };
const NOT_CUT = "Copied, not cut: the text would not paste back as these bytes";

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const isApple = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform);

/**
 * Whether the held modifiers compose a character rather than form a shortcut.
 * ⌥ is how a Mac types characters, yet Chrome and Safari report it as Alt
 * alone and Firefox reports AltGraph even with ⌘ held, so on Apple platforms
 * the keys themselves decide.
 */
function composing(event: ReactKeyboardEvent): boolean {
  if (isApple()) return event.altKey && !event.ctrlKey && !event.metaKey;
  return event.getModifierState?.("AltGraph") ?? false;
}

function useControllableMode(
  value: HexEditMode | undefined,
  defaultValue: HexEditMode,
  onChange: ((mode: HexEditMode) => void) | undefined,
) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const onChangeRef = useLatest(onChange);
  const set = useCallback(
    (next: HexEditMode) => {
      if (value === undefined) setInner(next);
      onChangeRef.current?.(next);
    },
    [value, onChangeRef],
  );
  return [current, set] as const;
}

function clampSelection(
  selection: HexSelection | null,
  maxOffset: number,
): HexSelection | null {
  if (!selection) return selection;
  if (maxOffset < 0) return null;
  if (selection.anchor <= maxOffset && selection.focus <= maxOffset) {
    return selection;
  }
  return {
    anchor: Math.min(selection.anchor, maxOffset),
    focus: Math.min(selection.focus, maxOffset),
    pane: selection.pane,
  };
}

export function HexEditor({
  document: doc,
  mode: modeProp,
  defaultMode = "overwrite",
  onModeChange,
  readOnly = false,
  onPaste,
  selection: selectionProp,
  defaultSelection,
  onSelectionChange,
  "aria-label": ariaLabel = "Hex editor",
  ...viewProps
}: HexEditorProps) {
  if (!isHexDocument(doc)) {
    throw new TypeError("HexEditor needs a document from createHexDocument");
  }
  const [selection, setSelection, selectionRef] = useControllableSelection(
    selectionProp,
    defaultSelection,
    onSelectionChange,
  );
  const [modeValue, setMode] = useControllableMode(
    modeProp,
    defaultMode,
    onModeChange,
  );
  const mode: HexEditMode = doc.resizable ? modeValue : "overwrite";
  const modeRef = useLatest(mode);
  // A mode the app switches through the prop ends the typing run too.
  const lastMode = useRef(mode);
  useEffect(() => {
    if (lastMode.current === mode) return;
    lastMode.current = mode;
    breakRun(doc);
  }, [doc, mode]);
  const readOnlyRef = useLatest(readOnly);
  const onPasteRef = useLatest(onPaste);

  const getVersion = useCallback(() => documentVersion(doc), [doc]);
  useSyncExternalStore(doc.subscribe, getVersion, getVersion);

  const contextRef = useRef<GridContext | null>(null);
  // Set while the editor applies its own edit: it sets the selection itself.
  const applying = useRef(false);

  const maxOffset = useCallback(
    () => (doc.resizable ? doc.size : doc.size - 1),
    [doc],
  );

  useEffect(
    () =>
      doc.subscribe(() => {
        if (applying.current) return;
        const change = lastChange(doc);
        const current = selectionRef.current;
        const next =
          (change.kind === "undo" || change.kind === "redo") &&
          change.selection !== undefined
            ? clampSelection(change.selection, maxOffset())
            : clampSelection(current, maxOffset());
        if (next === current) return;
        setSelection(next);
        if (next) contextRef.current?.reveal(next.focus);
        contextRef.current?.announce(next);
      }),
    [doc, maxOffset, selectionRef, setSelection],
  );

  const editState = useCallback(
    (ctx: GridContext): EditState => ({
      selection: selectionRef.current,
      mode: modeRef.current,
      size: doc.size,
      resizable: doc.resizable,
      readOnly: readOnlyRef.current,
      byteAt: (offset) => ctx.cache.get(offset, 1)?.[0],
      encode: (text) =>
        ctx.decoding.encode ? ctx.decoding.encode(text) : utf8.encode(text),
    }),
    [doc, modeRef, readOnlyRef, selectionRef],
  );

  const toggleMode = useCallback(
    (ctx: GridContext | null) => {
      if (!doc.resizable || readOnlyRef.current) return;
      const next = modeRef.current === "insert" ? "overwrite" : "insert";
      breakRun(doc);
      setMode(next);
      ctx?.announce(MODE_NAMES[next]);
    },
    [doc, modeRef, readOnlyRef, setMode],
  );

  const run = useCallback(
    (command: EditCommand, ctx: GridContext) => {
      switch (command.kind) {
        case "edit": {
          const before = selectionRef.current;
          const after = command.selection;
          applying.current = true;
          try {
            editGroup(doc, () => {
              for (const edit of command.edits) {
                editDocument(doc, { ...edit, key: command.key, before, after });
              }
            });
          } finally {
            applying.current = false;
          }
          setSelection(after);
          ctx.reveal(after.focus);
          ctx.announce(after);
          return;
        }
        case "select":
          setSelection(command.selection);
          ctx.announce(command.selection);
          return;
        case "undo":
          doc.undo();
          return;
        case "redo":
          doc.redo();
          return;
        case "toggle-mode":
          toggleMode(ctx);
          return;
        default:
          return;
      }
    },
    [doc, selectionRef, setSelection, toggleMode],
  );

  const editing = useMemo<GridEditing>(
    () => ({
      appendCell: doc.resizable,
      readOnly,
      mode,
      contextRef,
      modifiedRanges: (offset, length) => doc.modifiedRanges(offset, length),
      onCaretMove: () => breakRun(doc),

      onKey(event: ReactKeyboardEvent<HTMLDivElement>, ctx) {
        const command = editKey(editState(ctx), {
          key: event.key,
          shift: event.shiftKey,
          mod: event.ctrlKey || event.metaKey,
          alt: event.altKey,
          altGraph: composing(event),
        });
        if (!command) return false;
        // The native cut event follows the key; cancelling the key would stop it.
        if (command.kind === "cut") return true;
        event.preventDefault();
        run(command, ctx);
        return true;
      },

      onPaste(event, ctx) {
        const report = (result: Parameters<NonNullable<typeof onPaste>>[0]) =>
          onPasteRef.current?.(result);
        const current = selectionRef.current;
        if (!current) return;
        event.preventDefault();
        if (readOnlyRef.current) {
          report({ ok: false, reason: "read-only" });
          return;
        }
        const data = event.clipboardData;
        const state = editState(ctx);
        const bytes = clipboardBytes(
          {
            text: data?.getData("text/plain") ?? "",
            bytes: data?.getData(HEX_BYTES_TYPE),
          },
          current.pane,
          state.encode,
        );
        if (bytes === null) {
          report({
            ok: false,
            reason: current.pane === "hex" ? "not-hex" : "unencodable",
          });
          return;
        }
        if (bytes.length === 0) {
          report({ ok: false, reason: "empty" });
          return;
        }
        const { command, truncated } = editPaste(state, bytes);
        breakRun(doc);
        let written = 0;
        if (command.kind === "edit") {
          written = command.edits.at(-1)?.bytes.length ?? 0;
          run(command, ctx);
          breakRun(doc);
        }
        report({ ok: true, bytes: written, truncated });
      },

      onCut(event, ctx) {
        const current = selectionRef.current;
        const range = current && selectionRange(current, doc.size);
        if (readOnlyRef.current || !doc.resizable || !current || !range) {
          event.preventDefault();
          return;
        }
        const version = documentVersion(doc);
        ctx.copy(event, ({ bytes, clipboard }) => {
          // An async copy lands later; an edit in between moved the bytes.
          if (documentVersion(doc) !== version) return;
          // Text alone may not paste back as the bytes (a dot for 00), and a
          // cut that deletes what the clipboard lacks loses it.
          const back = clipboardBytes(
            clipboard,
            current.pane,
            editState(ctx).encode,
          );
          if (!back || !sameBytes(back, bytes)) {
            ctx.announce(NOT_CUT);
            return;
          }
          run(
            {
              kind: "edit",
              edits: [
                {
                  offset: range[0],
                  length: range[1] - range[0] + 1,
                  bytes: new Uint8Array(0),
                },
              ],
              selection:
                current.pane === "hex"
                  ? {
                      anchor: range[0],
                      focus: range[0],
                      pane: "hex",
                      nibble: 0,
                    }
                  : { anchor: range[0], focus: range[0], pane: "text" },
            },
            ctx,
          );
        });
      },

      statusExtra: (
        <button
          type="button"
          tabIndex={-1}
          className="orz-hex-mode"
          aria-label={MODE_NAMES[mode]}
          aria-pressed={mode === "insert"}
          disabled={!doc.resizable || readOnly}
          // Keeps focus, and so the caret's colours, on the grid.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            toggleMode(contextRef.current);
            contextRef.current?.focus();
          }}
        >
          {mode === "insert" ? "INS" : "OVR"}
        </button>
      ),
    }),
    [
      doc,
      mode,
      readOnly,
      editState,
      run,
      toggleMode,
      onPasteRef,
      readOnlyRef,
      selectionRef,
    ],
  );

  return (
    <HexGrid
      {...viewProps}
      source={doc}
      selection={selection}
      onSelectionChange={setSelection}
      aria-label={ariaLabel}
      editing={editing}
    />
  );
}
