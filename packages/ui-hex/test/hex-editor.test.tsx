import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHexDocument, type HexDocument } from "../src/document.ts";
import {
  type HexEditMode,
  HexEditor,
  type HexEditorProps,
} from "../src/hex-editor.tsx";
import { bytesSource } from "../src/source.ts";
import type { HexSelection } from "../src/types.ts";

const INITIAL = [0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80];

function setup(
  props: Partial<HexEditorProps> = {},
  doc: HexDocument = createHexDocument(bytesSource(Uint8Array.from(INITIAL))),
) {
  const onSelectionChange = vi.fn();
  const utils = render(
    <HexEditor
      document={doc}
      rows={4}
      onSelectionChange={onSelectionChange}
      {...props}
    />,
  );
  const root = utils.container.querySelector(".orz-hex") as HTMLElement;
  const cell = (offset: number, pane: "hex" | "text" = "hex") =>
    root.querySelector(
      `[data-pane="${pane}"][data-offset="${offset}"]`,
    ) as HTMLElement;
  const click = (offset: number, pane: "hex" | "text" = "hex") => {
    fireEvent.pointerDown(cell(offset, pane), { button: 0 });
    fireEvent.pointerUp(cell(offset, pane));
  };
  const type = (...keys: string[]) => {
    for (const key of keys) fireEvent.keyDown(root, { key });
  };
  const bytes = () => [...(doc.read(0, doc.size) as Uint8Array)];
  const selection = () =>
    onSelectionChange.mock.calls.at(-1)?.[0] as HexSelection | null;
  return { ...utils, root, cell, click, type, bytes, doc, selection };
}

function paste(root: HTMLElement, text: string | null) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.assign(event, {
    clipboardData: { getData: () => text ?? "" },
  });
  act(() => {
    root.focus();
    root.dispatchEvent(event);
  });
  return event;
}

describe("HexEditor typing", () => {
  it("overwrites a byte digit by digit in the hex pane", () => {
    const { click, type, bytes, selection, doc } = setup();
    click(2);
    type("4");
    expect(bytes()[2]).toBe(0x40);
    expect(selection()).toEqual({
      anchor: 2,
      focus: 2,
      pane: "hex",
      nibble: 1,
    });
    type("1");
    expect(bytes()).toEqual([0x10, 0x20, 0x41, 0x40, 0x50, 0x60, 0x70, 0x80]);
    expect(selection()).toEqual({
      anchor: 3,
      focus: 3,
      pane: "hex",
      nibble: 0,
    });
    doc.undo();
    expect(bytes()).toEqual(INITIAL);
    expect(doc.canUndo).toBe(false);
  });

  it("inserts a new byte before the caret in insert mode", () => {
    const { click, type, bytes, doc } = setup({ defaultMode: "insert" });
    click(2);
    type("4");
    expect(bytes()).toEqual([
      0x10, 0x20, 0x40, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80,
    ]);
    type("1");
    expect(bytes()).toEqual([
      0x10, 0x20, 0x41, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80,
    ]);
    act(() => doc.undo());
    expect(bytes()).toEqual(INITIAL);
  });

  it.each<[HexEditMode, number[]]>([
    ["overwrite", [0x10, 0x41, 0x42, 0x40, 0x50, 0x60, 0x70, 0x80]],
    ["insert", [0x10, 0x41, 0x42, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]],
  ])("types text in the text pane in %s mode", (mode, expected) => {
    const { click, type, bytes, selection } = setup({ defaultMode: mode });
    click(1, "text");
    type("A", "B");
    expect(bytes()).toEqual(expected);
    expect(selection()).toEqual({ anchor: 3, focus: 3, pane: "text" });
  });

  it("appends at the append cell", () => {
    const { click, type, bytes, cell } = setup();
    click(8);
    type("a", "b", "c");
    expect(bytes()).toEqual([...INITIAL, 0xab, 0xc0]);
    expect(cell(9).getAttribute("data-caret")).toBe("1");
    expect(cell(10).hasAttribute("data-append")).toBe(true);
  });

  it("marks edited cells", () => {
    const { click, type, cell } = setup();
    click(2);
    type("4", "1");
    expect(cell(2).hasAttribute("data-modified")).toBe(true);
    expect(cell(2, "text").hasAttribute("data-modified")).toBe(true);
    expect(cell(1).hasAttribute("data-modified")).toBe(false);
  });
});

describe("HexEditor delete and backspace", () => {
  it("Delete removes the caret byte, then a selection", () => {
    const { click, type, bytes, root } = setup();
    click(1);
    type("Delete");
    expect(bytes()).toEqual([0x10, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]);
    fireEvent.keyDown(root, { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(root, { key: "ArrowRight", shiftKey: true });
    type("Delete");
    expect(bytes()).toEqual([0x10, 0x60, 0x70, 0x80]);
  });

  it("Backspace removes the byte before the caret, or steps back a digit", () => {
    const { click, type, bytes, selection } = setup();
    click(3);
    type("Backspace");
    expect(bytes()).toEqual([0x10, 0x20, 0x40, 0x50, 0x60, 0x70, 0x80]);
    expect(selection()?.focus).toBe(2);
    type("f");
    expect(selection()?.nibble).toBe(1);
    type("Backspace");
    expect(selection()).toEqual({
      anchor: 2,
      focus: 2,
      pane: "hex",
      nibble: 0,
    });
    expect(bytes()).toEqual([0x10, 0x20, 0xf0, 0x50, 0x60, 0x70, 0x80]);
  });
});

describe("HexEditor mode", () => {
  it("toggles uncontrolled with Insert and the status button", () => {
    const onModeChange = vi.fn();
    const { root, type } = setup({ onModeChange });
    const button = root.querySelector(".orz-hex-mode") as HTMLButtonElement;
    expect(button.textContent).toBe("OVR");
    type("Insert");
    expect(onModeChange).toHaveBeenLastCalledWith("insert");
    expect(root.getAttribute("data-mode")).toBe("insert");
    expect(button.textContent).toBe("INS");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(onModeChange).toHaveBeenLastCalledWith("overwrite");
    expect(root.getAttribute("data-mode")).toBe("overwrite");
    expect(root.querySelector(".orz-hex-live")?.textContent).toBe(
      "Overwrite mode",
    );
  });

  it("asks a controlled owner and waits for the prop", () => {
    const onModeChange = vi.fn();
    const { root, type, rerender, doc } = setup({
      mode: "overwrite",
      onModeChange,
    });
    type("Insert");
    expect(onModeChange).toHaveBeenCalledWith("insert");
    expect(root.getAttribute("data-mode")).toBe("overwrite");
    rerender(
      <HexEditor
        document={doc}
        rows={4}
        mode="insert"
        onModeChange={onModeChange}
      />,
    );
    expect(root.getAttribute("data-mode")).toBe("insert");
  });

  it("stays in overwrite mode when the size is locked", () => {
    const doc = createHexDocument(bytesSource(Uint8Array.from(INITIAL)), {
      resizable: false,
    });
    const onModeChange = vi.fn();
    const { root, type, click, bytes } = setup(
      { defaultMode: "insert", onModeChange },
      doc,
    );
    expect(root.getAttribute("data-mode")).toBe("overwrite");
    type("Insert");
    expect(onModeChange).not.toHaveBeenCalled();
    expect(
      (root.querySelector(".orz-hex-mode") as HTMLButtonElement).disabled,
    ).toBe(true);
    click(7);
    type("Delete", "Backspace");
    expect(bytes()).toEqual(INITIAL);
    expect(root.querySelector("[data-append]")).toBeNull();
  });
});

describe("HexEditor paste", () => {
  it.each<[HexEditMode, "hex" | "text", string, number[]]>([
    [
      "overwrite",
      "hex",
      "de ad",
      [0x10, 0xde, 0xad, 0x40, 0x50, 0x60, 0x70, 0x80],
    ],
    [
      "insert",
      "hex",
      "0xde, 0xad",
      [0x10, 0xde, 0xad, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80],
    ],
    [
      "overwrite",
      "text",
      "hi",
      [0x10, 0x68, 0x69, 0x40, 0x50, 0x60, 0x70, 0x80],
    ],
    [
      "insert",
      "text",
      "hi",
      [0x10, 0x68, 0x69, 0x20, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80],
    ],
  ])("%s mode, %s pane", (mode, pane, text, expected) => {
    const onPaste = vi.fn();
    const { click, root, bytes, selection, doc } = setup({
      defaultMode: mode,
      onPaste,
    });
    click(1, pane);
    const event = paste(root, text);
    expect(event.defaultPrevented).toBe(true);
    expect(bytes()).toEqual(expected);
    expect(onPaste).toHaveBeenCalledWith({
      ok: true,
      bytes: 2,
      truncated: false,
    });
    expect(selection()?.focus).toBe(3);
    act(() => doc.undo());
    expect(bytes()).toEqual(INITIAL);
  });

  it("reports text that is not hex, an empty clipboard and read-only", () => {
    const onPaste = vi.fn();
    const { click, root, bytes, rerender, doc } = setup({ onPaste });
    click(1);
    paste(root, "hello");
    expect(onPaste).toHaveBeenLastCalledWith({ ok: false, reason: "not-hex" });
    paste(root, "");
    expect(onPaste).toHaveBeenLastCalledWith({ ok: false, reason: "empty" });
    rerender(<HexEditor document={doc} rows={4} onPaste={onPaste} readOnly />);
    paste(root, "00");
    expect(onPaste).toHaveBeenLastCalledWith({
      ok: false,
      reason: "read-only",
    });
    expect(bytes()).toEqual(INITIAL);
  });

  it("truncates at the end of a locked document", () => {
    const doc = createHexDocument(bytesSource(Uint8Array.from(INITIAL)), {
      resizable: false,
    });
    const onPaste = vi.fn();
    const { click, root, bytes } = setup({ onPaste }, doc);
    click(6);
    paste(root, "01 02 03 04");
    expect(bytes()).toEqual([0x10, 0x20, 0x30, 0x40, 0x50, 0x60, 0x01, 0x02]);
    expect(onPaste).toHaveBeenCalledWith({
      ok: true,
      bytes: 2,
      truncated: true,
    });
  });
});

describe("HexEditor encodings", () => {
  it("refuses text-pane input the encoding cannot write", () => {
    const onPaste = vi.fn();
    const { click, root, type, bytes, doc } = setup({
      encoding: "windows-1252",
      onPaste,
    });
    click(1, "text");
    paste(root, "あ");
    expect(onPaste).toHaveBeenLastCalledWith({
      ok: false,
      reason: "unencodable",
    });
    type("あ");
    expect(bytes()).toEqual(INITIAL);
    expect(doc.canUndo).toBe(false);
    paste(root, "€");
    expect(bytes()).toEqual([0x10, 0x80, 0x30, 0x40, 0x50, 0x60, 0x70, 0x80]);
  });

  it("types through the active encoding", () => {
    const { click, type, bytes } = setup({ encoding: "shift_jis" });
    click(1, "text");
    type("あ");
    expect(bytes()).toEqual([0x10, 0x82, 0xa0, 0x40, 0x50, 0x60, 0x70, 0x80]);
  });

  it("leaves a paste into the encoding picker alone", () => {
    const onPaste = vi.fn();
    const { click, root, bytes } = setup({ onPaste });
    click(1, "text");
    const trigger = root.querySelector(".orz-hex-encoding") as HTMLElement;
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.assign(event, { clipboardData: { getData: () => "hi" } });
    act(() => {
      trigger.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(onPaste).not.toHaveBeenCalled();
    expect(bytes()).toEqual(INITIAL);
  });
});

describe("HexEditor modifier keys", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // jsdom reports AltGraph whenever Alt is held, so each browser's answer is
  // stubbed in by hand.
  function press(
    root: HTMLElement,
    init: KeyboardEventInit,
    altGraph = false,
  ): boolean {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    event.getModifierState = (key) => key === "AltGraph" && altGraph;
    act(() => {
      root.dispatchEvent(event);
    });
    return event.defaultPrevented;
  }

  const onPlatform = (platform: string) =>
    vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);

  it("types ⌥-composed characters on a Mac, whatever the browser reports", () => {
    onPlatform("MacIntel");
    const { click, root, bytes } = setup({ encoding: "utf-8" });
    click(1, "text");
    // Chrome and Safari: Alt alone.
    expect(press(root, { key: "ø", code: "KeyO", altKey: true })).toBe(true);
    // Firefox: Alt and AltGraph.
    expect(press(root, { key: "¢", code: "Digit4", altKey: true }, true)).toBe(
      true,
    );
    expect(bytes()).toEqual([0x10, 0xc3, 0xb8, 0xc2, 0xa2, 0x60, 0x70, 0x80]);
  });

  it("leaves ⌘⌥ and ⌃⌥ to shortcuts on a Mac, even with AltGraph reported", () => {
    onPlatform("MacIntel");
    const { click, root, bytes, doc } = setup({ encoding: "utf-8" });
    click(1, "text");
    const chord = { key: "k", code: "KeyK", altKey: true };
    expect(press(root, { ...chord, metaKey: true }, true)).toBe(false);
    expect(press(root, { ...chord, ctrlKey: true }, true)).toBe(false);
    expect(bytes()).toEqual(INITIAL);
    expect(doc.canUndo).toBe(false);
  });

  it("leaves Alt to shortcuts elsewhere, and types AltGr", () => {
    onPlatform("Win32");
    const { click, root, bytes } = setup({ encoding: "utf-8" });
    click(1, "text");
    expect(press(root, { key: "f", code: "KeyF", altKey: true })).toBe(false);
    expect(bytes()).toEqual(INITIAL);
    expect(
      press(
        root,
        { key: "@", code: "KeyQ", altKey: true, ctrlKey: true },
        true,
      ),
    ).toBe(true);
    expect(bytes()[1]).toBe(0x40);
  });
});

describe("HexEditor cut", () => {
  it("copies the selection, removes it and reports through onCopy", () => {
    const onCopy = vi.fn();
    const { click, root, bytes, selection } = setup({ onCopy });
    click(1);
    fireEvent.keyDown(root, { key: "ArrowRight", shiftKey: true });
    const setData = vi.fn();
    fireEvent.keyDown(root, { key: "x", ctrlKey: true });
    fireEvent.cut(root, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "20 30");
    expect(bytes()).toEqual([0x10, 0x40, 0x50, 0x60, 0x70, 0x80]);
    expect(onCopy).toHaveBeenCalledWith({ ok: true, bytes: 2 });
    expect(selection()).toEqual({
      anchor: 1,
      focus: 1,
      pane: "hex",
      nibble: 0,
    });
  });

  it("does not cancel the Ctrl+X key, so the native cut can follow", () => {
    const { click, root } = setup();
    click(1);
    expect(fireEvent.keyDown(root, { key: "x", ctrlKey: true })).toBe(true);
  });
});

describe("HexEditor undo", () => {
  it("restores the bytes and the selection with Ctrl+Z, and redoes", () => {
    const { click, root, type, bytes, selection } = setup();
    click(2);
    type("a", "b", "c");
    fireEvent.keyDown(root, { key: "z", ctrlKey: true });
    expect(bytes()).toEqual(INITIAL);
    expect(selection()).toEqual({ anchor: 2, focus: 2, pane: "hex" });
    fireEvent.keyDown(root, { key: "z", ctrlKey: true, shiftKey: true });
    expect(bytes()).toEqual([0x10, 0x20, 0xab, 0xc0, 0x50, 0x60, 0x70, 0x80]);
    expect(selection()).toEqual({
      anchor: 3,
      focus: 3,
      pane: "hex",
      nibble: 1,
    });
    fireEvent.keyDown(root, { key: "z", ctrlKey: true });
    fireEvent.keyDown(root, { key: "y", ctrlKey: true });
    expect(bytes()[2]).toBe(0xab);
  });

  it("splits undo steps where the caret moved", () => {
    const { click, root, type, bytes, doc } = setup();
    click(0);
    type("1", "1");
    fireEvent.keyDown(root, { key: "ArrowRight" });
    type("2", "2");
    act(() => doc.undo());
    expect(bytes().slice(0, 3)).toEqual([0x11, 0x20, 0x30]);
  });

  it("keeps the caret where it is when the app saves after an undo", () => {
    const { click, type, doc, selection } = setup();
    click(1);
    type("a", "b");
    click(3);
    type("c");
    act(() => doc.undo());
    click(6);
    act(() => doc.markSaved());
    expect(selection()?.focus).toBe(6);
  });

  it("ends the typing run when the app switches the mode prop", () => {
    const { click, type, doc, bytes, rerender } = setup({ mode: "overwrite" });
    click(2);
    type("4", "1");
    rerender(<HexEditor document={doc} rows={4} mode="insert" />);
    type("5");
    act(() => doc.undo());
    expect(bytes()).toEqual([0x10, 0x20, 0x41, 0x40, 0x50, 0x60, 0x70, 0x80]);
  });

  it("clamps the selection when the app shrinks the document", () => {
    const { click, doc, selection } = setup();
    click(7);
    act(() => doc.delete(0, 6));
    expect(selection()).toEqual({ anchor: 2, focus: 2, pane: "hex" });
  });
});

describe("HexEditor", () => {
  it("navigates but refuses edits when read-only", () => {
    const { click, root, type, bytes, selection } = setup({ readOnly: true });
    click(1);
    type("4", "Delete", "Backspace");
    fireEvent.keyDown(root, { key: "ArrowRight" });
    expect(selection()?.focus).toBe(2);
    expect(bytes()).toEqual(INITIAL);
  });

  it("labels itself as an editor", () => {
    const { root } = setup();
    expect(root.getAttribute("aria-label")).toBe("Hex editor");
    expect(root.getAttribute("aria-roledescription")).toBe("hex editor");
  });

  it("throws for a source that is not a document", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <HexEditor
          document={bytesSource(new Uint8Array(4)) as unknown as HexDocument}
        />,
      ),
    ).toThrow(TypeError);
  });
});
