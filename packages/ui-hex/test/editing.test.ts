import { describe, expect, it } from "vitest";

import {
  type EditCommand,
  type EditInput,
  type EditState,
  editKey,
  editPaste,
  type HexEditMode,
  selectionRange,
} from "../src/editing.ts";
import type { HexSelection } from "../src/types.ts";

const BYTES = [0x12, 0x34, 0x56, 0x78, 0x9a];

function state(overrides: Partial<EditState> = {}): EditState {
  return {
    selection: { anchor: 1, focus: 1, pane: "hex" },
    mode: "overwrite",
    size: BYTES.length,
    resizable: true,
    readOnly: false,
    byteAt: (offset) => BYTES[offset],
    encode: (text) => new TextEncoder().encode(text),
    ...overrides,
  };
}

const press = (
  key: string,
  mods: Partial<Omit<EditInput, "key">> = {},
): EditInput => ({
  key,
  shift: false,
  mod: false,
  alt: false,
  altGraph: false,
  ...mods,
});

const at = (
  offset: number,
  pane: HexSelection["pane"] = "hex",
  nibble?: 0 | 1,
): HexSelection =>
  nibble === undefined
    ? { anchor: offset, focus: offset, pane }
    : { anchor: offset, focus: offset, pane, nibble };

/** The command's edits as plain arrays, for readable expectations. */
function edits(
  command: EditCommand | null,
): { edits?: unknown; [field: string]: unknown } | null {
  if (command?.kind !== "edit") return command;
  return {
    edits: command.edits.map((e) => [e.offset, e.length, [...e.bytes]]),
    key: command.key,
    selection: command.selection,
  };
}

describe("editKey: hex digits", () => {
  it.each<[HexEditMode, 0 | 1, unknown]>([
    [
      "overwrite",
      0,
      { edits: [[1, 1, [0xa4]]], key: "type-hex", selection: at(1, "hex", 1) },
    ],
    [
      "overwrite",
      1,
      { edits: [[1, 1, [0x3a]]], key: "type-hex", selection: at(2, "hex", 0) },
    ],
    [
      "insert",
      0,
      { edits: [[1, 0, [0xa0]]], key: "type-hex", selection: at(1, "hex", 1) },
    ],
    [
      "insert",
      1,
      { edits: [[1, 1, [0x3a]]], key: "type-hex", selection: at(2, "hex", 0) },
    ],
  ])("%s mode, nibble %i", (mode, nibble, expected) => {
    const s = state({ mode, selection: at(1, "hex", nibble) });
    expect(edits(editKey(s, press("a")))).toEqual(expected);
    expect(edits(editKey(s, press("A")))).toEqual(expected);
  });

  it("treats a byte that is not loaded as zero", () => {
    const s = state({ byteAt: () => undefined });
    expect(edits(editKey(s, press("7")))?.edits).toEqual([[1, 1, [0x70]]]);
  });

  it("ignores a non-hex character", () => {
    expect(editKey(state(), press("g"))).toEqual({ kind: "ignored" });
    expect(editKey(state(), press(" "))).toEqual({ kind: "ignored" });
  });

  it.each<HexEditMode>(["overwrite", "insert"])(
    "appends at the append cell in %s mode",
    (mode) => {
      const s = state({ mode, selection: at(5) });
      expect(edits(editKey(s, press("f")))).toEqual({
        edits: [[5, 0, [0xf0]]],
        key: "type-hex",
        selection: at(5, "hex", 1),
      });
    },
  );

  it("collapses a multi-byte selection to its start in overwrite mode", () => {
    const s = state({ selection: { anchor: 3, focus: 1, pane: "hex" } });
    expect(edits(editKey(s, press("0")))?.edits).toEqual([[1, 1, [0x04]]]);
  });

  it("replaces a multi-byte selection in insert mode", () => {
    const s = state({
      mode: "insert",
      selection: { anchor: 1, focus: 3, pane: "hex", nibble: 1 },
    });
    expect(edits(editKey(s, press("b")))).toEqual({
      edits: [
        [1, 3, []],
        [1, 0, [0xb0]],
      ],
      key: "type-hex",
      selection: at(1, "hex", 1),
    });
  });

  it("stops at the last byte when the size is locked", () => {
    const locked = { resizable: false, mode: "insert" as const };
    expect(
      edits(editKey(state({ ...locked, selection: at(4) }), press("1"))),
    ).toEqual({
      edits: [[4, 1, [0x1a]]],
      key: "type-hex",
      selection: at(4, "hex", 1),
    });
    expect(
      edits(
        editKey(state({ ...locked, selection: at(4, "hex", 1) }), press("1")),
      ),
    ).toEqual({
      edits: [[4, 1, [0x91]]],
      key: "type-hex",
      selection: at(4, "hex", 1),
    });
    expect(editKey(state({ ...locked, selection: at(5) }), press("1"))).toEqual(
      { kind: "ignored" },
    );
  });
});

describe("editKey: text", () => {
  it.each<[HexEditMode, unknown]>([
    [
      "overwrite",
      { edits: [[1, 1, [0x41]]], key: "type-text", selection: at(2, "text") },
    ],
    [
      "insert",
      { edits: [[1, 0, [0x41]]], key: "type-text", selection: at(2, "text") },
    ],
  ])("types a character in %s mode", (mode, expected) => {
    const s = state({ mode, selection: at(1, "text") });
    expect(edits(editKey(s, press("A")))).toEqual(expected);
  });

  it("writes a character's encoded bytes", () => {
    const s = state({ selection: at(4, "text") });
    expect(edits(editKey(s, press("é")))).toEqual({
      edits: [[4, 1, [0xc3, 0xa9]]],
      key: "type-text",
      selection: at(6, "text"),
    });
  });

  it("refuses text the encoder cannot represent", () => {
    const s = state({ selection: at(1, "text"), encode: () => null });
    expect(editKey(s, press("A"))).toEqual({ kind: "ignored" });
  });

  it("types AltGr characters but not modified keys", () => {
    const s = state({ selection: at(1, "text") });
    expect(
      editKey(s, press("@", { mod: true, alt: true, altGraph: true }))?.kind,
    ).toBe("edit");
    expect(editKey(s, press("a", { mod: true }))).toBeNull();
    expect(editKey(s, press("a", { alt: true }))).toBeNull();
  });

  it("truncates at the end when the size is locked", () => {
    const s = state({ resizable: false, selection: at(3, "text") });
    expect(edits(editKey(s, press("€")))).toEqual({
      edits: [[3, 2, [0xe2, 0x82]]],
      key: "type-text",
      selection: at(4, "text"),
    });
  });
});

describe("editKey: delete and backspace", () => {
  it.each<HexEditMode>(["overwrite", "insert"])(
    "Delete removes the caret byte or the selection in %s mode",
    (mode) => {
      expect(edits(editKey(state({ mode }), press("Delete")))).toEqual({
        edits: [[1, 1, []]],
        key: undefined,
        selection: at(1, "hex", 0),
      });
      const multi = state({
        mode,
        selection: { anchor: 3, focus: 1, pane: "text" },
      });
      expect(edits(editKey(multi, press("Delete")))).toEqual({
        edits: [[1, 3, []]],
        key: undefined,
        selection: at(1, "text"),
      });
    },
  );

  it("Delete at the append cell does nothing", () => {
    expect(editKey(state({ selection: at(5) }), press("Delete"))).toEqual({
      kind: "ignored",
    });
  });

  it("Backspace removes the byte before the caret", () => {
    expect(edits(editKey(state(), press("Backspace")))).toEqual({
      edits: [[0, 1, []]],
      key: undefined,
      selection: at(0, "hex", 0),
    });
    expect(editKey(state({ selection: at(0) }), press("Backspace"))).toEqual({
      kind: "ignored",
    });
    expect(
      edits(editKey(state({ selection: at(5) }), press("Backspace")))?.edits,
    ).toEqual([[4, 1, []]]);
  });

  it("Backspace at nibble 1 steps back to nibble 0", () => {
    const s = state({ selection: at(2, "hex", 1) });
    expect(editKey(s, press("Backspace"))).toEqual({
      kind: "select",
      selection: at(2, "hex", 0),
    });
  });

  it("Backspace removes a multi-byte selection", () => {
    const s = state({ selection: { anchor: 1, focus: 2, pane: "hex" } });
    expect(edits(editKey(s, press("Backspace")))?.edits).toEqual([[1, 2, []]]);
  });
});

describe("editKey: commands", () => {
  it("maps undo and redo", () => {
    expect(editKey(state(), press("z", { mod: true }))).toEqual({
      kind: "undo",
    });
    expect(editKey(state(), press("Z", { mod: true, shift: true }))).toEqual({
      kind: "redo",
    });
    expect(editKey(state(), press("y", { mod: true }))).toEqual({
      kind: "redo",
    });
  });

  it("toggles the mode with Insert", () => {
    expect(editKey(state(), press("Insert"))).toEqual({ kind: "toggle-mode" });
    expect(editKey(state(), press("Insert", { shift: true }))).toBeNull();
  });

  it("cuts a selection but not the append cell", () => {
    expect(editKey(state(), press("x", { mod: true }))).toEqual({
      kind: "cut",
    });
    expect(
      editKey(state({ selection: at(5) }), press("x", { mod: true })),
    ).toEqual({ kind: "ignored" });
  });

  it.each(["Delete", "Backspace", "Insert"])(
    "ignores %s when the size is locked",
    (key) => {
      expect(editKey(state({ resizable: false }), press(key))).toEqual({
        kind: "ignored",
      });
    },
  );

  it("ignores cut when the size is locked", () => {
    expect(
      editKey(state({ resizable: false }), press("x", { mod: true })),
    ).toEqual({ kind: "ignored" });
  });

  it("ignores every editing key when read-only", () => {
    const s = state({ readOnly: true });
    for (const input of [
      press("a"),
      press("Delete"),
      press("Backspace"),
      press("Insert"),
      press("z", { mod: true }),
      press("y", { mod: true }),
      press("x", { mod: true }),
    ]) {
      expect(editKey(s, input)).toEqual({ kind: "ignored" });
    }
  });

  it("leaves navigation and copy to the view", () => {
    for (const input of [
      press("ArrowLeft"),
      press("End", { mod: true }),
      press("a", { mod: true }),
      press("c", { mod: true }),
      press("v", { mod: true }),
      press("Tab"),
      press("Enter"),
    ]) {
      expect(editKey(state(), input)).toBeNull();
    }
  });
});

describe("editPaste", () => {
  const bytes = Uint8Array.of(0xde, 0xad, 0xbe, 0xef);

  it("inserts before the caret, or in place of a selection, in insert mode", () => {
    const caret = editPaste(state({ mode: "insert" }), bytes);
    expect(edits(caret.command)).toEqual({
      edits: [[1, 0, [0xde, 0xad, 0xbe, 0xef]]],
      key: undefined,
      selection: at(5, "hex", 0),
    });
    const replaced = editPaste(
      state({
        mode: "insert",
        selection: { anchor: 1, focus: 2, pane: "text" },
      }),
      bytes,
    );
    expect(edits(replaced.command)).toMatchObject({
      edits: [
        [1, 2, []],
        [1, 0, [0xde, 0xad, 0xbe, 0xef]],
      ],
      selection: at(5, "text"),
    });
  });

  it("overwrites and extends past the end in overwrite mode", () => {
    const { command, truncated } = editPaste(
      state({ selection: at(3) }),
      bytes,
    );
    expect(edits(command)).toMatchObject({
      edits: [[3, 2, [0xde, 0xad, 0xbe, 0xef]]],
      selection: at(7, "hex", 0),
    });
    expect(truncated).toBe(false);
  });

  it("truncates at the end when the size is locked", () => {
    const { command, truncated } = editPaste(
      state({ resizable: false, mode: "insert", selection: at(3) }),
      bytes,
    );
    expect(edits(command)).toMatchObject({
      edits: [[3, 2, [0xde, 0xad]]],
      selection: at(4, "hex", 0),
    });
    expect(truncated).toBe(true);
  });

  it("does nothing when read-only", () => {
    expect(editPaste(state({ readOnly: true }), bytes).command).toEqual({
      kind: "ignored",
    });
  });
});

describe("selectionRange", () => {
  it("clips the append cell off the selected range", () => {
    expect(selectionRange({ anchor: 2, focus: 5, pane: "hex" }, 5)).toEqual([
      2, 4,
    ]);
    expect(selectionRange({ anchor: 5, focus: 5, pane: "hex" }, 5)).toBeNull();
    expect(selectionRange({ anchor: 0, focus: 0, pane: "hex" }, 0)).toBeNull();
  });
});
