import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { HexEncoding } from "../src/encodings.ts";
import { HEX_BYTES_TYPE } from "../src/hex-paste.ts";
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
    expect(header.textContent).toContain("ASCII");
    const addresses = [
      ...root.querySelectorAll(".orz-hex-layer .orz-hex-addr"),
    ].map((el) => el.textContent);
    // Exactly the four rows asked for: no half row scrolls in below.
    expect(addresses).toEqual(["0000", "0010", "0020", "0030"]);
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
    setData.mockClear();
    fireEvent.copy(root, { clipboardData: { setData } });
    expect(setData.mock.calls).toEqual([
      ["text/plain", "AHO."],
      [HEX_BYTES_TYPE, "41484f00"],
    ]);
  });

  it("writes no exact bytes beside the hex pane's text", () => {
    const { root } = setup({ selection: { anchor: 0, focus: 1, pane: "hex" } });
    root.focus();
    const setData = vi.fn();
    fireEvent.copy(root, { clipboardData: { setData } });
    expect(setData.mock.calls).toEqual([["text/plain", "41 48"]]);
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

  it("centres on a whole row", () => {
    let handle: HexViewHandle | null = null;
    const { root } = setup({
      ref: (h: HexViewHandle | null) => {
        handle = h;
      },
    });
    act(() => handle?.scrollToOffset(0x40, "center"));
    const first = root.querySelector(".orz-hex-layer .orz-hex-addr");
    expect(first?.textContent).toBe("0030");
  });

  it("keeps rows aligned under a fractional rows prop", () => {
    const { root } = setup({
      rows: 4.5,
      defaultSelection: { anchor: 0, focus: 0, pane: "hex" },
    });
    fireEvent.keyDown(root, { key: "End", ctrlKey: true });
    const addresses = [
      ...root.querySelectorAll(".orz-hex-layer .orz-hex-addr"),
    ].map((el) => el.textContent);
    expect(addresses).toEqual(["0030", "0040", "0050", "0060"]);
  });

  it("shows whole rows from a scroll position between rows", () => {
    const { root } = setup();
    const scroller = root.querySelector(".orz-hex-scroller") as HTMLElement;
    // 1.4 rows at the fallback 22px row height.
    scroller.scrollTop = 31;
    fireEvent.scroll(scroller);
    const addresses = [
      ...root.querySelectorAll(".orz-hex-layer .orz-hex-addr"),
    ].map((el) => el.textContent);
    expect(addresses).toEqual(["0010", "0020", "0030", "0040"]);
  });

  it("keeps the top row's first byte on top when the columns change", () => {
    let handle: HexViewHandle | null = null;
    const ref = (h: HexViewHandle | null) => {
      handle = h;
    };
    const { root, rerender } = setup({ ref });
    act(() => handle?.scrollToOffset(0x30, "start"));
    rerender(<HexView source={source} rows={4} ref={ref} columns={8} />);
    const first = () =>
      root.querySelector(".orz-hex-layer .orz-hex-addr")?.textContent;
    expect(first()).toBe("0030");
    rerender(<HexView source={source} rows={4} ref={ref} columns={16} />);
    expect(first()).toBe("0030");
  });

  it("lays out maxColumns for columns=auto until it can measure", () => {
    const { root } = setup({ columns: "auto", maxColumns: 8 });
    expect(root.hasAttribute("data-columns-auto")).toBe(true);
    const header = root.querySelector(".orz-hex-header") as HTMLElement;
    expect(header.querySelectorAll(".orz-hex-cell")).toHaveLength(8);
    const addresses = [
      ...root.querySelectorAll(".orz-hex-layer .orz-hex-addr"),
    ].map((el) => el.textContent);
    expect(addresses).toEqual(["0000", "0008", "0010", "0018"]);
  });

  it("lets a vertical resize handle grow the rows past `rows`", () => {
    const { root } = setup({ resizable: true });
    expect(root.getAttribute("data-resizable")).toBe("both");
    const scroller = root.querySelector(".orz-hex-scroller") as HTMLElement;
    expect(scroller.style.flex).toContain("calc(");
    expect(scroller.style.height).toBe("");

    const fixed = setup({ resizable: "horizontal" });
    expect(fixed.root.getAttribute("data-resizable")).toBe("horizontal");
    const fixedScroller = fixed.root.querySelector(
      ".orz-hex-scroller",
    ) as HTMLElement;
    expect(fixedScroller.style.height).toContain("calc(");
  });

  it("adds small wheel steps up to whole rows when scaled", () => {
    const huge: ByteSource = {
      size: 2 ** 32,
      read: (_offset, length) => new Uint8Array(length),
    };
    const { root } = setup({ source: huge });
    const scroller = root.querySelector(".orz-hex-scroller") as HTMLElement;
    const first = () =>
      root.querySelector(".orz-hex-layer .orz-hex-addr")?.textContent;
    fireEvent.wheel(scroller, { deltaY: 8 });
    fireEvent.wheel(scroller, { deltaY: 8 });
    expect(first()).toBe("00000000");
    fireEvent.wheel(scroller, { deltaY: 8 });
    expect(first()).toBe("00000010");
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

const utf8Bytes = (...parts: Array<string | number[]>) =>
  Uint8Array.from(
    parts.flatMap((part) =>
      typeof part === "string" ? [...new TextEncoder().encode(part)] : part,
    ),
  );

const hovered = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-hover]")].map(
    (el) => `${el.getAttribute("data-pane")}${el.getAttribute("data-offset")}`,
  );

describe("HexView encodings", () => {
  it("draws a multi-byte glyph in its first cell, over continuation cells", () => {
    const { cell } = setup({
      source: bytesSource(Uint8Array.of(0xe4, 0xb8, 0x96, 0xe7, 0x95, 0x8c)),
      encoding: "utf-8",
    });
    for (const [lead, glyph] of [
      [0, "世"],
      [3, "界"],
    ] as const) {
      const first = cell(lead, "text");
      expect(first.getAttribute("data-kind")).toBe("char");
      const box = first.querySelector(".orz-hex-glyph") as HTMLElement;
      expect(box.textContent).toBe(glyph);
      expect(box.style.getPropertyValue("--hex-glyph-span")).toBe("3");
      expect(box.style.getPropertyValue("--hex-glyph-squeeze")).toBe("1");
      for (const offset of [lead + 1, lead + 2]) {
        expect(cell(offset, "text").getAttribute("data-kind")).toBe(
          "continuation",
        );
        expect(cell(offset, "text").textContent).toBe("");
      }
      for (const offset of [lead, lead + 1, lead + 2]) {
        for (const pane of ["hex", "text"] as const) {
          expect(cell(offset, pane).getAttribute("data-glyph")).toBe(
            String(lead),
          );
          expect(cell(offset, pane).getAttribute("data-glyph-length")).toBe(
            "3",
          );
        }
      }
    }
  });

  it("draws a glyph crossing the row end on its starting row, squeezed", () => {
    const { cell } = setup({
      source: bytesSource(utf8Bytes("A".repeat(15), "世B")),
      encoding: "utf-8",
    });
    const box = cell(15, "text").querySelector(".orz-hex-glyph") as HTMLElement;
    expect(box.textContent).toBe("世");
    expect(box.style.getPropertyValue("--hex-glyph-span")).toBe("1");
    expect(
      Number(box.style.getPropertyValue("--hex-glyph-squeeze")),
    ).toBeLessThan(1);
    for (const offset of [16, 17]) {
      expect(cell(offset, "text").getAttribute("data-kind")).toBe(
        "continuation",
      );
      expect(cell(offset, "text").querySelector(".orz-hex-glyph")).toBeNull();
      expect(cell(offset, "hex").getAttribute("data-glyph")).toBe("15");
      expect(cell(offset, "hex").getAttribute("data-glyph-length")).toBe("3");
    }
    expect(cell(18, "text").textContent).toBe("B");
  });

  it("hovers a glyph's bytes in both panes, across the row boundary", () => {
    const { root, cell } = setup({
      source: bytesSource(utf8Bytes("A".repeat(15), "世B")),
      encoding: "utf-8",
    });
    fireEvent.pointerMove(cell(16, "text"));
    expect(hovered(root)).toEqual([
      "hex15",
      "text15",
      "hex16",
      "hex17",
      "text16",
      "text17",
    ]);
    fireEvent.pointerMove(cell(18));
    expect(hovered(root)).toEqual(["hex18", "text18"]);
  });

  it("hovers a glyph whole when it spans three rows", () => {
    const { root, cell } = setup({
      source: bytesSource(utf8Bytes("A", "😀", "B")),
      encoding: "utf-8",
      columns: 2,
      groupSize: 0,
    });
    fireEvent.pointerMove(cell(2, "text"));
    expect(hovered(root).filter((id) => id.startsWith("hex"))).toEqual([
      "hex1",
      "hex2",
      "hex3",
      "hex4",
    ]);
  });

  it("hovers by the new encoding's glyphs after a switch", () => {
    const glyphs = bytesSource(utf8Bytes("世界"));
    const { root, cell, rerender } = setup({
      source: glyphs,
      encoding: "utf-8",
    });
    fireEvent.pointerMove(cell(1, "text"));
    expect(hovered(root)).toHaveLength(6);
    rerender(<HexView source={glyphs} rows={4} encoding="ascii" />);
    expect(hovered(root)).toEqual(["hex1", "text1"]);
  });

  it("copies the text pane as displayed, from mid-glyph to mid-glyph", () => {
    const setData = vi.fn();
    const { root } = setup({
      source: bytesSource(utf8Bytes("A世B界C")),
      encoding: "utf-8",
      // 世 is 1–3, B is 4 and 界 5–7: the selection starts and ends inside a glyph.
      selection: { anchor: 2, focus: 6, pane: "text" },
    });
    root.focus();
    fireEvent.copy(root, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "B界");
  });

  it("announces the glyph a continuation byte belongs to", () => {
    const { root } = setup({
      source: bytesSource(utf8Bytes("A".repeat(15), "世B")),
      encoding: "utf-8",
      defaultSelection: { anchor: 0, focus: 0, pane: "text" },
    });
    fireEvent.keyDown(root, { key: "ArrowDown" });
    expect(root.querySelector(".orz-hex-live")?.textContent).toBe(
      "0x10: B8 (世)",
    );
  });

  it("switches the encoding without touching the selection or the scroll", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const selection: HexSelection = { anchor: 0xc1, focus: 0xc1, pane: "text" };
    let handle: HexViewHandle | null = null;
    const { cell, root, rerender, onSelectionChange } = setup({
      source: bytesSource(bytes),
      selection,
      ref: (h: HexViewHandle | null) => {
        handle = h;
      },
    });
    act(() => handle?.scrollToOffset(0xc0, "start"));
    expect(cell(0xc0, "text").getAttribute("data-kind")).toBe("dot");
    rerender(
      <HexView
        source={bytesSource(bytes)}
        rows={4}
        selection={selection}
        encoding="windows-1251"
        onSelectionChange={onSelectionChange}
      />,
    );
    expect(cell(0xc0, "text").textContent).toBe("А");
    expect(cell(0xc1, "text").hasAttribute("data-sel")).toBe(true);
    expect(
      root.querySelector(".orz-hex-layer .orz-hex-addr")?.textContent,
    ).toBe("00C0");
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("keeps a row loading until its lookahead's page arrives", async () => {
    const PAGE = 65536;
    const pending = new Map<number, () => void>();
    const big: ByteSource = {
      size: PAGE + 64,
      read: (offset, length) =>
        new Promise((resolve) => {
          pending.set(offset, () => resolve(new Uint8Array(length).fill(0x41)));
        }),
    };
    const view = (encoding: HexEncoding) => (
      <HexView source={big} rows={1} encoding={encoding} />
    );
    let handle: HexViewHandle | null = null;
    const { container, rerender } = render(
      <HexView
        source={big}
        rows={1}
        encoding="utf-8"
        ref={(h: HexViewHandle | null) => {
          handle = h;
        }}
      />,
    );
    act(() => handle?.scrollToOffset(PAGE - 16, "start"));
    const cell = (pane: string, offset: number) =>
      container.querySelector(
        `[data-pane="${pane}"][data-offset="${offset}"]`,
      ) as HTMLElement;
    await waitFor(() => expect(pending.has(0)).toBe(true));
    await act(async () => pending.get(0)?.());
    // The hex pane shows the row's own bytes; only the text pane waits.
    expect(cell("hex", PAGE - 1).textContent).toBe("41");
    expect(cell("text", PAGE - 1).getAttribute("data-state")).toBe("loading");
    rerender(view("ascii"));
    expect(cell("text", PAGE - 1).textContent).toBe("A");
    rerender(view("utf-8"));
    expect(cell("text", PAGE - 1).getAttribute("data-state")).toBe("loading");
    await waitFor(() => expect(pending.has(PAGE)).toBe(true));
    await act(async () => pending.get(PAGE)?.());
    await waitFor(() => expect(cell("text", PAGE - 1).textContent).toBe("A"));
  });

  it("shows a row's bytes when only its lookbehind page failed", async () => {
    const PAGE = 65536;
    const failing: ByteSource = {
      size: PAGE * 2,
      read: async (offset, length) => {
        if (offset < PAGE) throw new Error("unreadable");
        return new Uint8Array(length).fill(0x41);
      },
    };
    let handle: HexViewHandle | null = null;
    const { container } = render(
      <HexView
        source={failing}
        rows={1}
        encoding="shift_jis"
        onReadError={() => {}}
        ref={(h: HexViewHandle | null) => {
          handle = h;
        }}
      />,
    );
    act(() => handle?.scrollToOffset(PAGE, "start"));
    const cell = (pane: string) =>
      container.querySelector(
        `[data-pane="${pane}"][data-offset="${PAGE}"]`,
      ) as HTMLElement;
    await waitFor(() =>
      expect(cell("text").getAttribute("data-state")).toBe("error"),
    );
    expect(cell("hex").textContent).toBe("41");
    expect(cell("hex").getAttribute("data-state")).toBeNull();
  });

  it("leaves a copy from the header native", () => {
    const onCopy = vi.fn();
    const { root } = setup({
      selection: { anchor: 0, focus: 3, pane: "hex" },
      onCopy,
    });
    const trigger = root.querySelector(".orz-hex-encoding") as HTMLElement;
    // Drawn at the dense row's height; a touch pointer gets 44px to hit.
    expect(trigger.className.split(" ")).toEqual(
      expect.arrayContaining(["relative", "touch:hit-area"]),
    );
    const setData = vi.fn();
    fireEvent.copy(trigger, { clipboardData: { setData } });
    expect(setData).not.toHaveBeenCalled();
    expect(onCopy).not.toHaveBeenCalled();
  });

  it("renders the plain label when the picker is hidden", () => {
    const { root } = setup({
      encoding: "windows-1252",
      showEncodingPicker: false,
    });
    const header = root.querySelector(".orz-hex-header") as HTMLElement;
    expect(header.querySelector(".orz-hex-encoding")).toBeNull();
    expect(header.querySelector(".orz-hex-text-label")?.textContent).toBe(
      "Windows-1252 (Western)",
    );
  });

  it("labels an encoding this runtime lacks as the ASCII it renders", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { root } = setup({
      encoding: "not-an-encoding" as HexEncoding,
      showEncodingPicker: false,
    });
    expect(root.querySelector(".orz-hex-text-label")?.textContent).toBe(
      "ASCII",
    );
    warn.mockRestore();
  });

  it("switches through the header picker, and keeps its keys from the grid", async () => {
    const onEncodingChange = vi.fn();
    const { root, cell, onSelectionChange } = setup({
      defaultSelection: { anchor: 5, focus: 5, pane: "hex" },
      onEncodingChange,
    });
    const trigger = root.querySelector(".orz-hex-encoding") as HTMLElement;
    expect(trigger.getAttribute("aria-label")).toBe("Text encoding");
    expect(trigger.textContent).toBe("ASCII");
    expect(cell(19, "text").getAttribute("data-kind")).toBe("dot");

    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    fireEvent.click(trigger);
    const box = screen.getByRole("combobox", { name: "Filter encodings" });
    await waitFor(() => expect(document.activeElement).toBe(box));
    const listbox = screen.getByRole("listbox", { name: "Text encodings" });
    const groups = () =>
      within(listbox)
        .queryAllByRole("group")
        .map(
          (el) =>
            document.getElementById(el.getAttribute("aria-labelledby") ?? "")
              ?.textContent,
        );
    expect(groups()).toEqual(["Western", "Unicode", "East Asian", "Other"]);

    const options = () =>
      within(listbox)
        .queryAllByRole("option")
        .map((el) => el.textContent);
    fireEvent.change(box, { target: { value: "cyril" } });
    expect(options()).toEqual([
      "Windows-1251 (Cyrillic)",
      "ISO-8859-5 (Cyrillic)",
      "IBM866 (Cyrillic DOS)",
    ]);
    expect(groups()).toEqual(["Other"]);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "ArrowUp" });
    fireEvent.keyDown(box, { key: "ArrowRight" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onEncodingChange).toHaveBeenCalledWith("windows-1251");
    expect(onEncodingChange).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(
      (root.querySelector(".orz-hex-encoding") as HTMLElement).textContent,
    ).toBe("Windows-1251 (Cyrillic)");
    expect(cell(19, "text").textContent).toBe("Ж");
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("filters the picker by aliases and ids, and says when nothing matches", () => {
    const { root } = setup({ encoding: "utf-8" });
    fireEvent.click(root.querySelector(".orz-hex-encoding") as HTMLElement);
    const box = screen.getByRole("combobox", { name: "Filter encodings" });
    const options = () =>
      screen
        .queryAllByRole("option")
        .map((el) => el.querySelector(".orz-hex-encoding-label")?.textContent);
    const aliases = () =>
      screen
        .queryAllByRole("option")
        .map((el) => el.querySelector(".orz-hex-encoding-alias")?.textContent);
    const checked = () =>
      screen
        .queryAllByRole("option")
        .filter((el) => el.hasAttribute("data-selected"))
        .map((el) => el.textContent);
    expect(checked()).toEqual(["UTF-8"]);
    fireEvent.change(box, { target: { value: "sjis" } });
    expect(options()).toEqual(["Shift_JIS"]);
    // The name it matched by, since the label does not show it.
    expect(aliases()).toEqual(["sjis"]);
    fireEvent.change(box, { target: { value: "utf8" } });
    expect(options()).toEqual(["UTF-8"]);
    expect(aliases()).toEqual([undefined]);
    fireEvent.change(box, { target: { value: "cp1252" } });
    expect(options()).toEqual(["Windows-1252 (Western)"]);
    fireEvent.change(box, { target: { value: "8859 15" } });
    expect(options()).toEqual(["ISO-8859-15 (Western)"]);
    fireEvent.change(box, { target: { value: "gbk" } });
    expect(options()).toEqual(["GB18030 (GBK)"]);
    expect(screen.getByRole("listbox").querySelector("mark")?.textContent).toBe(
      "GBK",
    );
    fireEvent.change(box, { target: { value: "asian" } });
    expect(options()).toEqual([
      "Shift_JIS",
      "EUC-JP",
      "GB18030 (GBK)",
      "Big5",
      "EUC-KR",
    ]);
    fireEvent.change(box, { target: { value: "klingon" } });
    expect(options()).toEqual([]);
    expect(screen.getByText('No encodings match "klingon"')).toBeTruthy();
  });
});
