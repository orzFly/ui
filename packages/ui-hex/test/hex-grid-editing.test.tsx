import { render } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getTextDecoding, type HexEncoding } from "../src/encodings.ts";
import {
  type GridContext,
  type GridEditing,
  HexGrid,
  type HexViewProps,
} from "../src/hex-grid.tsx";
import { bytesSource } from "../src/source.ts";

function stubEditing(overrides: Partial<GridEditing> = {}): GridEditing {
  return {
    onKey: () => false,
    onCaretMove: () => {},
    onPaste: () => {},
    onCut: () => {},
    appendCell: true,
    readOnly: false,
    mode: "overwrite",
    modifiedRanges: () => [],
    contextRef: { current: null as GridContext | null },
    ...overrides,
  };
}

function setup(
  size: number,
  editing: GridEditing = stubEditing(),
  props: Partial<HexViewProps> = {},
) {
  const source = bytesSource(Uint8Array.from({ length: size }, (_, i) => i));
  const utils = render(
    <HexGrid source={source} rows={4} editing={editing} {...props} />,
  );
  const root = utils.container.querySelector(".orz-hex") as HTMLElement;
  const rerender = (next: Partial<HexViewProps>) =>
    utils.rerender(
      <HexGrid
        source={source}
        rows={4}
        editing={editing}
        {...props}
        {...next}
      />,
    );
  return { ...utils, root, rerender };
}

const appendCells = (root: HTMLElement) =>
  [...root.querySelectorAll("[data-append]")].map((el) => [
    el.getAttribute("data-offset"),
    el.getAttribute("data-pane"),
  ]);

describe("HexGrid with editing", () => {
  it("draws the append cell after a short last row", () => {
    const { root } = setup(20);
    expect(appendCells(root)).toEqual([
      ["20", "hex"],
      ["20", "text"],
    ]);
    const rows = root.querySelectorAll(".orz-hex-layer .orz-hex-row");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.querySelectorAll("[data-append]")).toHaveLength(2);
  });

  it("starts a new row for the append cell after a full row", () => {
    const { root } = setup(32);
    const rows = root.querySelectorAll(".orz-hex-layer .orz-hex-row");
    expect(rows).toHaveLength(3);
    expect(rows[2]?.querySelector(".orz-hex-addr")?.textContent).toBe("0020");
    expect(appendCells(root)[0]).toEqual(["32", "hex"]);
  });

  it("shows only the append cell for an empty document", () => {
    const { root } = setup(0);
    expect(root.querySelectorAll("[data-offset]")).toHaveLength(2);
    expect(appendCells(root)).toHaveLength(2);
  });

  it("draws no append cell for a locked size", () => {
    const { root } = setup(20, stubEditing({ appendCell: false }));
    expect(appendCells(root)).toEqual([]);
  });

  it("marks modified cells in both panes", () => {
    const { root } = setup(
      40,
      stubEditing({
        modifiedRanges: (offset, length) =>
          [
            [3, 5],
            [15, 18],
          ].filter(([s, e]) => s < offset + length && e > offset) as Array<
            [number, number]
          >,
      }),
    );
    const marked = (pane: string) =>
      [...root.querySelectorAll(`[data-pane="${pane}"][data-modified]`)].map(
        (el) => Number(el.getAttribute("data-offset")),
      );
    expect(marked("hex")).toEqual([3, 4, 15, 16, 17]);
    expect(marked("text")).toEqual([3, 4, 15, 16, 17]);
  });

  it("puts the nibble on the caret cell and the mode on the root", () => {
    const { root, rerender } = setup(40, stubEditing({ mode: "insert" }), {
      selection: { anchor: 5, focus: 5, pane: "hex", nibble: 1 },
    });
    const caret = () =>
      root.querySelector('[data-pane="hex"][data-caret]') as HTMLElement;
    expect(caret().getAttribute("data-offset")).toBe("5");
    expect(caret().getAttribute("data-caret")).toBe("1");
    expect(caret().querySelectorAll(".orz-hex-nibble")).toHaveLength(2);
    expect(root.getAttribute("data-mode")).toBe("insert");
    expect(root.getAttribute("aria-roledescription")).toBe("hex editor");
    rerender({ selection: { anchor: 40, focus: 40, pane: "hex" } });
    expect(caret().getAttribute("data-offset")).toBe("40");
    expect(caret().hasAttribute("data-append")).toBe(true);
    expect(caret().getAttribute("data-caret")).toBe("0");
  });

  it("keeps the whole-byte twin caret when the caret is in the text pane", () => {
    const { root } = setup(40, stubEditing(), {
      selection: { anchor: 5, focus: 5, pane: "text" },
    });
    const twin = root.querySelector(
      '[data-pane="hex"][data-caret]',
    ) as HTMLElement;
    expect(twin.getAttribute("data-caret")).toBe("");
    expect(twin.querySelector(".orz-hex-nibble")).toBeNull();
  });

  it("never highlights the append cell as selected", () => {
    const { root } = setup(20, stubEditing(), {
      selection: { anchor: 18, focus: 20, pane: "hex" },
    });
    const selected = [
      ...root.querySelectorAll('[data-pane="hex"][data-sel]'),
    ].map((el) => el.getAttribute("data-offset"));
    expect(selected).toEqual(["18", "19"]);
  });

  it("does not re-render an unchanged row after an edit elsewhere", () => {
    let modified: Array<[number, number]> = [];
    const editing = stubEditing({
      modifiedRanges: (offset, length) =>
        modified.filter(([s, e]) => s < offset + length && e > offset),
    });
    const source = bytesSource(new Uint8Array(64));
    const onRender = vi.fn();
    const view = () => (
      <Profiler id="grid" onRender={onRender}>
        <HexGrid source={source} rows={4} editing={editing} />
      </Profiler>
    );
    const { container, rerender } = render(view());
    const rows = [...container.querySelectorAll(".orz-hex-layer .orz-hex-row")];
    const firstRow = rows[0]?.firstElementChild;
    modified = [[40, 41]];
    rerender(view());
    const after = [
      ...container.querySelectorAll(".orz-hex-layer .orz-hex-row"),
    ];
    // The same DOM node, untouched: React skipped rendering row 0.
    expect(after[0]?.firstElementChild).toBe(firstRow);
    expect(
      after[2]
        ?.querySelector('[data-offset="40"]')
        ?.hasAttribute("data-modified"),
    ).toBe(true);
    expect(
      after[0]
        ?.querySelector('[data-offset="0"]')
        ?.hasAttribute("data-modified"),
    ).toBe(false);
  });

  it("leaves a plain view unchanged", () => {
    const source = bytesSource(new Uint8Array(20));
    const { container } = render(<HexGrid source={source} rows={4} />);
    expect(container.querySelector("[data-append]")).toBeNull();
    expect(container.querySelector(".orz-hex-nibble")).toBeNull();
    expect(
      container.querySelector(".orz-hex")?.getAttribute("aria-roledescription"),
    ).toBe("hex view");
  });
});

describe("HexGrid encoder warm-up", () => {
  // Table decodings build nothing ahead, so the test lends them a hook.
  const lend = (id: HexEncoding) => {
    const decoding = getTextDecoding(id);
    const prepare = vi.fn();
    decoding.prepareEncode = prepare;
    return {
      prepare,
      restore: () => {
        delete decoding.prepareEncode;
      },
    };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("prepares the encoder in idle time, again on each switch", () => {
    const a = lend("windows-1251");
    const b = lend("windows-1252");
    const callbacks = new Map<number, () => void>();
    let next = 0;
    const cancel = vi.fn((id: number) => callbacks.delete(id));
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      callbacks.set(++next, callback);
      return next;
    });
    vi.stubGlobal("cancelIdleCallback", cancel);
    try {
      const { rerender, unmount } = setup(20, stubEditing(), {
        encoding: "windows-1251",
      });
      expect(callbacks.size).toBe(1);
      rerender({ encoding: "windows-1252" });
      expect(cancel).toHaveBeenCalledWith(1);
      for (const callback of callbacks.values()) callback();
      expect(a.prepare).not.toHaveBeenCalled();
      expect(b.prepare).toHaveBeenCalledTimes(1);
      unmount();
      expect(cancel).toHaveBeenCalledWith(2);
    } finally {
      a.restore();
      b.restore();
    }
  });

  it("falls back to a timeout without requestIdleCallback", () => {
    const a = lend("windows-1251");
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    try {
      setup(20, stubEditing(), { encoding: "windows-1251" });
      expect(a.prepare).not.toHaveBeenCalled();
      vi.runAllTimers();
      expect(a.prepare).toHaveBeenCalledTimes(1);
    } finally {
      a.restore();
    }
  });

  it("leaves a read-only editor's encoder cold", () => {
    const a = lend("windows-1251");
    vi.useFakeTimers();
    try {
      render(
        <HexGrid
          source={bytesSource(new Uint8Array(20))}
          rows={4}
          encoding="windows-1251"
          editing={stubEditing({ readOnly: true })}
        />,
      );
      vi.runAllTimers();
      expect(a.prepare).not.toHaveBeenCalled();
    } finally {
      a.restore();
    }
  });

  it("leaves a plain view's encoder cold", () => {
    const a = lend("windows-1251");
    vi.useFakeTimers();
    try {
      render(
        <HexGrid
          source={bytesSource(new Uint8Array(20))}
          rows={4}
          encoding="windows-1251"
        />,
      );
      vi.runAllTimers();
      expect(a.prepare).not.toHaveBeenCalled();
    } finally {
      a.restore();
    }
  });
});
