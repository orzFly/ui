import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HexView, type HexViewHandle } from "../src/hex-view.tsx";
import { type ByteSource, bytesSource } from "../src/source.ts";
import type { HexSelection } from "../src/types.ts";

const BYTES = Uint8Array.from({ length: 100 }, (_, i) => (i * 7 + 0x41) & 0xff);
BYTES[3] = 0;
const source = bytesSource(BYTES);

function setup(props: Partial<Parameters<typeof HexView>[0]> = {}) {
  const onSelectionChange = vi.fn();
  const utils = render(
    <HexView
      source={source}
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
  return { ...utils, root, cell, onSelectionChange };
}

const last = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)?.[0];

describe("HexView", () => {
  it("renders the column labels and the visible rows' addresses", () => {
    const { root } = setup();
    const header = root.querySelector(".orz-hex-header") as HTMLElement;
    const labels = [...header.querySelectorAll(".orz-hex-cell")].map(
      (el) => el.textContent,
    );
    expect(labels[0]).toBe("00");
    expect(labels[15]).toBe("0F");
    expect(labels).toHaveLength(16);
    expect(header.textContent).toContain("Text");
    const addresses = [
      ...root.querySelectorAll(".orz-hex-layer .orz-hex-addr"),
    ].map((el) => el.textContent);
    // Four visible rows plus the one below that scrolls in.
    expect(addresses).toEqual(["0000", "0010", "0020", "0030", "0040"]);
  });

  it("shifts displayed addresses by baseAddress", () => {
    const { root } = setup({ baseAddress: 0x1000 });
    const first = root.querySelector(".orz-hex-layer .orz-hex-addr");
    expect(first?.textContent).toBe("1000");
  });

  it("renders bytes, text glyphs and the faded zero byte", () => {
    const { cell } = setup();
    expect(cell(0).textContent).toBe("41");
    expect(cell(0, "text").textContent).toBe("A");
    expect(cell(3).hasAttribute("data-faded")).toBe(true);
    expect(cell(3, "text").textContent).toBe("NU");
    expect(cell(3, "text").getAttribute("data-kind")).toBe("control");
  });

  it("drag-selects in the hex pane", () => {
    const { cell, onSelectionChange } = setup();
    fireEvent.pointerDown(cell(5), { button: 0, pointerId: 1 });
    fireEvent.pointerMove(cell(20), { pointerId: 1 });
    fireEvent.pointerUp(cell(20), { pointerId: 1 });
    expect(last(onSelectionChange)).toEqual({
      anchor: 5,
      focus: 20,
      pane: "hex",
    });
  });

  it("extends from the anchor on shift+pointer down", () => {
    const { cell, onSelectionChange } = setup();
    fireEvent.pointerDown(cell(5), { button: 0 });
    fireEvent.pointerUp(cell(5));
    fireEvent.pointerDown(cell(30), { button: 0, shiftKey: true });
    fireEvent.pointerUp(cell(30));
    expect(last(onSelectionChange)).toEqual({
      anchor: 5,
      focus: 30,
      pane: "hex",
    });
  });

  it("lets a drag cross panes, ending in the pane released over", () => {
    const { root, cell, onSelectionChange } = setup();
    fireEvent.pointerDown(cell(5), { button: 0 });
    fireEvent.pointerMove(cell(37, "text"));
    fireEvent.pointerMove(
      root.querySelector(".orz-hex-pane-gap") as HTMLElement,
    );
    fireEvent.pointerUp(cell(37, "text"));
    expect(last(onSelectionChange)).toEqual({
      anchor: 5,
      focus: 37,
      pane: "text",
    });

    fireEvent.pointerDown(cell(40, "text"), { button: 0 });
    fireEvent.pointerMove(cell(9));
    fireEvent.pointerMove(
      root.querySelector(".orz-hex-pane-gap") as HTMLElement,
    );
    fireEvent.pointerUp(cell(9));
    expect(last(onSelectionChange)).toEqual({
      anchor: 40,
      focus: 9,
      pane: "hex",
    });
  });

  it("moves and extends with the keyboard, and clears with Escape", () => {
    const { root, cell, onSelectionChange } = setup();
    fireEvent.pointerDown(cell(5), { button: 0 });
    fireEvent.pointerUp(cell(5));
    fireEvent.keyDown(root, { key: "ArrowRight" });
    expect(last(onSelectionChange)).toEqual({
      anchor: 6,
      focus: 6,
      pane: "hex",
    });
    fireEvent.keyDown(root, { key: "ArrowDown", shiftKey: true });
    expect(last(onSelectionChange)).toEqual({
      anchor: 6,
      focus: 22,
      pane: "hex",
    });
    expect(root.querySelector(".orz-hex-live")?.textContent).toBe(
      "0x6–0x16, 17 bytes",
    );
    fireEvent.keyDown(root, { key: "Escape" });
    expect(last(onSelectionChange)).toBeNull();
  });

  it("scrolls the caret into view", () => {
    const { root, onSelectionChange } = setup({
      defaultSelection: { anchor: 0, focus: 0, pane: "hex" },
    });
    fireEvent.keyDown(root, { key: "End", ctrlKey: true });
    expect(last(onSelectionChange)).toEqual({
      anchor: 99,
      focus: 99,
      pane: "hex",
    });
    const addresses = [
      ...root.querySelectorAll(".orz-hex-layer .orz-hex-addr"),
    ].map((el) => el.textContent);
    expect(addresses.at(-1)).toBe("0060");
    expect(addresses[0]).toBe("0030");
  });

  it("renders a controlled selection in both panes", () => {
    const selection: HexSelection = { anchor: 18, focus: 16, pane: "text" };
    const { root, cell } = setup({ selection });
    const selected = [...root.querySelectorAll("[data-sel]")].map(
      (el) =>
        `${el.getAttribute("data-pane")}${el.getAttribute("data-offset")}`,
    );
    expect(selected).toEqual([
      "hex16",
      "hex17",
      "hex18",
      "text16",
      "text17",
      "text18",
    ]);
    expect(root.getAttribute("data-active-pane")).toBe("text");
    expect(cell(16).hasAttribute("data-caret")).toBe(true);
    expect(root.querySelector(".orz-hex-status")?.textContent).toContain(
      "0x10–0x12 · 3 bytes",
    );
  });

  it("copies hex or text on the sync path", () => {
    const onCopy = vi.fn();
    const { root, rerender } = setup({
      selection: { anchor: 0, focus: 3, pane: "hex" },
      onCopy,
    });
    root.focus();
    const setData = vi.fn();
    fireEvent.copy(root, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "41 48 4F 00");
    expect(onCopy).toHaveBeenCalledWith({ ok: true, bytes: 4 });

    rerender(
      <HexView
        source={source}
        rows={4}
        selection={{ anchor: 0, focus: 3, pane: "text" }}
        onCopy={onCopy}
      />,
    );
    fireEvent.copy(root, { clipboardData: { setData } });
    expect(setData).toHaveBeenLastCalledWith("text/plain", "AHO.");
  });

  it("shows loading cells for an async source, then the bytes", async () => {
    let resolve: (() => void) | undefined;
    const asyncSource: ByteSource = {
      size: 100,
      read: (offset, length) =>
        new Promise((r) => {
          resolve = () => r(BYTES.subarray(offset, offset + length));
        }),
    };
    const { cell, root } = setup({ source: asyncSource });
    expect(cell(0).getAttribute("data-state")).toBe("loading");
    expect(cell(0).textContent).toBe("··");
    expect(root.querySelector(".orz-hex-status")?.textContent).toContain(
      "Loading…",
    );
    await act(async () => resolve?.());
    await waitFor(() => expect(cell(0).textContent).toBe("41"));
    expect(cell(0).hasAttribute("data-state")).toBe(false);
  });

  it("reports a failed page and marks its cells", async () => {
    const onReadError = vi.fn();
    const error = new Error("nope");
    const failing: ByteSource = {
      size: 100,
      read: () => Promise.reject(error),
    };
    const { cell } = setup({ source: failing, onReadError });
    await waitFor(() =>
      expect(cell(0).getAttribute("data-state")).toBe("error"),
    );
    expect(cell(0).textContent).toBe("??");
    expect(onReadError).toHaveBeenCalledWith(error, 0);
  });

  it("scrolls through its handle", () => {
    let handle: HexViewHandle | null = null;
    const { root } = setup({
      ref: (h: HexViewHandle | null) => {
        handle = h;
      },
    });
    act(() => handle?.scrollToOffset(0x20, "start"));
    const first = root.querySelector(".orz-hex-layer .orz-hex-addr");
    expect(first?.textContent).toBe("0020");
  });

  it("survives a source whose read throws synchronously", async () => {
    const onReadError = vi.fn();
    const error = new Error("boom");
    const throwing: ByteSource = {
      size: 100,
      read() {
        throw error;
      },
    };
    const { cell } = setup({ source: throwing, onReadError });
    await waitFor(() => expect(cell(0).textContent).toBe("??"));
    expect(onReadError).toHaveBeenCalledWith(error, 0);
    expect(onReadError.mock.calls.length).toBeLessThan(4);
  });

  it("re-renders a sync source changed in place", () => {
    const buf = new Uint8Array(64);
    let notify: (() => void) | undefined;
    const mutable: ByteSource = {
      size: 64,
      read: (offset, length) => buf.subarray(offset, offset + length),
      subscribe: (listener) => {
        notify = listener;
        return () => {
          notify = undefined;
        };
      },
    };
    const { cell } = setup({ source: mutable });
    expect(cell(0).textContent).toBe("00");
    act(() => {
      buf[0] = 0xab;
      notify?.();
    });
    expect(cell(0).textContent).toBe("AB");
  });

  it("clears the read error once the page reads again", async () => {
    let fail = true;
    let notify: (() => void) | undefined;
    const flaky: ByteSource = {
      size: 100,
      read: (offset, length) =>
        fail
          ? Promise.reject(new Error("offline"))
          : Promise.resolve(BYTES.subarray(offset, offset + length)),
      subscribe: (listener) => {
        notify = listener;
        return () => {
          notify = undefined;
        };
      },
    };
    const { root, cell } = setup({ source: flaky });
    const status = () => root.querySelector(".orz-hex-status")?.textContent;
    await waitFor(() => expect(status()).toContain("Read failed at 0x0"));
    fail = false;
    act(() => notify?.());
    await waitFor(() => expect(cell(0).textContent).toBe("41"));
    expect(status()).not.toContain("Read failed");
  });
});
