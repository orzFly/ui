import type { HexSelection } from "./types.ts";

export type HexEditMode = "overwrite" | "insert";

export interface EditState {
  selection: HexSelection | null;
  mode: HexEditMode;
  size: number;
  resizable: boolean;
  readOnly: boolean;
  /** `undefined` while the byte is loading or failed to read. */
  byteAt(offset: number): number | undefined;
  /** The active decoding's encoder, or UTF-8; `null` when the text is not representable. */
  encode(text: string): Uint8Array | null;
}

export interface EditInput {
  key: string;
  shift: boolean;
  /** Ctrl, or ⌘ on Apple platforms. */
  mod: boolean;
  alt: boolean;
  /**
   * AltGr, or ⌥ alone on Apple platforms: reported with Alt (and on Windows
   * Ctrl) held, yet it types characters.
   */
  altGraph: boolean;
}

export interface ByteEdit {
  offset: number;
  length: number;
  bytes: Uint8Array;
}

export type EditCommand =
  | {
      kind: "edit";
      /** Two when typing replaces a selection in insert mode: the delete, then the insert. */
      edits: ByteEdit[];
      key?: "type-hex" | "type-text";
      selection: HexSelection;
    }
  /** A caret change with no edit (Backspace at nibble 1). */
  | { kind: "select"; selection: HexSelection }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "toggle-mode" }
  /** The native cut event does the work; the key itself must not be cancelled. */
  | { kind: "cut" }
  /** An editing key that does nothing here: locked size, read-only, a non-hex digit. */
  | { kind: "ignored" };

const IGNORED: EditCommand = { kind: "ignored" };
const EMPTY = new Uint8Array(0);

/** The selected bytes, inclusive, without the append cell; `null` when only the append cell is selected. */
export function selectionRange(
  selection: HexSelection,
  size: number,
): [start: number, end: number] | null {
  const start = Math.min(selection.anchor, selection.focus);
  const end = Math.min(Math.max(selection.anchor, selection.focus), size - 1);
  return start > end ? null : [start, end];
}

function caret(
  offset: number,
  pane: HexSelection["pane"],
  nibble?: 0 | 1,
): HexSelection {
  return pane === "hex" && nibble !== undefined
    ? { anchor: offset, focus: offset, pane, nibble }
    : { anchor: offset, focus: offset, pane };
}

/** Where an edit starts and what it replaces, for typing and paste alike. */
function target(state: EditState, selection: HexSelection) {
  const range = selectionRange(selection, state.size);
  const multi = range !== null && range[1] > range[0];
  const offset = multi ? range[0] : selection.focus;
  return { range, multi, offset };
}

/** The edits that write `bytes` at the selection, and where the caret lands. */
function write(
  state: EditState,
  selection: HexSelection,
  bytes: Uint8Array,
): { edits: ByteEdit[]; end: number; truncated: boolean } | null {
  const { range, multi, offset } = target(state, selection);
  const mode = state.resizable ? state.mode : "overwrite";
  if (mode === "insert") {
    const edits: ByteEdit[] = [];
    if (multi && range) {
      edits.push({ offset, length: range[1] - range[0] + 1, bytes: EMPTY });
    }
    edits.push({ offset, length: 0, bytes });
    return { edits, end: offset + bytes.length, truncated: false };
  }
  const room = state.size - offset;
  if (state.resizable) {
    return {
      edits: [{ offset, length: Math.min(bytes.length, room), bytes }],
      end: offset + bytes.length,
      truncated: false,
    };
  }
  if (room <= 0) return null;
  const written = bytes.subarray(0, room);
  return {
    edits: [{ offset, length: written.length, bytes: written }],
    end: Math.min(offset + written.length, state.size - 1),
    truncated: written.length < bytes.length,
  };
}

function typeHexDigit(
  state: EditState,
  selection: HexSelection,
  digit: number,
): EditCommand {
  const { range, multi, offset } = target(state, selection);
  const mode = state.resizable ? state.mode : "overwrite";
  const nibble = multi ? 0 : (selection.nibble ?? 0);
  if (offset >= state.size && !state.resizable) return IGNORED;
  const append = offset >= state.size;

  if (nibble === 0 && (mode === "insert" || append)) {
    const edits: ByteEdit[] = [];
    if (multi && range) {
      edits.push({ offset, length: range[1] - range[0] + 1, bytes: EMPTY });
    }
    edits.push({ offset, length: 0, bytes: Uint8Array.of(digit << 4) });
    return {
      kind: "edit",
      edits,
      key: "type-hex",
      selection: caret(offset, "hex", 1),
    };
  }
  const old = state.byteAt(offset) ?? 0;
  if (nibble === 0) {
    return {
      kind: "edit",
      edits: [
        {
          offset,
          length: 1,
          bytes: Uint8Array.of((digit << 4) | (old & 0x0f)),
        },
      ],
      key: "type-hex",
      selection: caret(offset, "hex", 1),
    };
  }
  const last = state.resizable ? state.size : state.size - 1;
  const next = Math.min(offset + 1, last);
  return {
    kind: "edit",
    edits: [{ offset, length: 1, bytes: Uint8Array.of((old & 0xf0) | digit) }],
    key: "type-hex",
    // Locked, the caret stays on the last byte's low digit.
    selection:
      next === offset ? caret(offset, "hex", 1) : caret(next, "hex", 0),
  };
}

function typeText(
  state: EditState,
  selection: HexSelection,
  text: string,
): EditCommand {
  const bytes = state.encode(text);
  if (!bytes?.length) return IGNORED;
  const written = write(state, selection, bytes);
  if (!written) return IGNORED;
  return {
    kind: "edit",
    edits: written.edits,
    key: "type-text",
    selection: caret(written.end, selection.pane),
  };
}

function remove(
  state: EditState,
  selection: HexSelection,
  backspace: boolean,
): EditCommand {
  if (!state.resizable) return IGNORED;
  const range = selectionRange(selection, state.size);
  if (range && (range[1] > range[0] || !backspace)) {
    return {
      kind: "edit",
      edits: [
        { offset: range[0], length: range[1] - range[0] + 1, bytes: EMPTY },
      ],
      selection: caret(range[0], selection.pane, nibbleFor(selection)),
    };
  }
  if (!backspace) return IGNORED;
  if (selection.pane === "hex" && selection.nibble === 1) {
    return { kind: "select", selection: caret(selection.focus, "hex", 0) };
  }
  const offset = selection.focus;
  if (offset <= 0) return IGNORED;
  return {
    kind: "edit",
    edits: [{ offset: offset - 1, length: 1, bytes: EMPTY }],
    selection: caret(offset - 1, selection.pane, nibbleFor(selection)),
  };
}

const nibbleFor = (selection: HexSelection) =>
  selection.pane === "hex" ? 0 : undefined;

/** What `input` does to the document; `null` when it is not an editing key and navigation should have it. */
export function editKey(
  state: EditState,
  input: EditInput,
): EditCommand | null {
  const { key, shift, mod, alt, altGraph } = input;
  const selection = state.selection;
  const lower = key.length === 1 ? key.toLowerCase() : key;

  if (mod && !altGraph) {
    if (lower === "z") {
      if (state.readOnly) return IGNORED;
      return shift ? { kind: "redo" } : { kind: "undo" };
    }
    if (lower === "y" && !shift) {
      return state.readOnly ? IGNORED : { kind: "redo" };
    }
    if (lower === "x" && !shift) {
      if (state.readOnly || !state.resizable || !selection) return IGNORED;
      return selectionRange(selection, state.size) ? { kind: "cut" } : IGNORED;
    }
    return null;
  }
  if (alt && !altGraph) return null;

  if (key === "Insert") {
    // Shift+Insert pastes on some platforms.
    if (shift) return null;
    return state.readOnly || !state.resizable
      ? IGNORED
      : { kind: "toggle-mode" };
  }
  if (key === "Delete" || key === "Backspace") {
    if (state.readOnly || !selection) return IGNORED;
    return remove(state, selection, key === "Backspace");
  }
  if ([...key].length !== 1) return null;
  if (state.readOnly || !selection) return IGNORED;
  if (selection.pane === "hex") {
    if (!/^[0-9a-f]$/i.test(key)) return IGNORED;
    return typeHexDigit(state, selection, Number.parseInt(key, 16));
  }
  return typeText(state, selection, key);
}

/** Pasting `bytes` at the selection: one undo step, the caret after the last byte. */
export function editPaste(
  state: EditState,
  bytes: Uint8Array,
): { command: EditCommand; truncated: boolean } {
  const selection = state.selection;
  if (state.readOnly || !selection || !bytes.length) {
    return { command: IGNORED, truncated: false };
  }
  const written = write(state, selection, bytes);
  if (!written) return { command: IGNORED, truncated: true };
  return {
    command: {
      kind: "edit",
      edits: written.edits,
      selection: caret(written.end, selection.pane, nibbleFor(selection)),
    },
    truncated: written.truncated,
  };
}
