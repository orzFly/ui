import { MAX_SPACER_PX } from "@orz/ui/lib/scroll-map";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseAnsi } from "../../src/parse/parser.ts";
import { AnsiView } from "../../src/view/ansi-view.tsx";
import * as geometry from "../../src/view/geometry.ts";

const metrics = vi.hoisted(() => ({
  rowHeight: 20,
  cellWidth: 8,
  width: 800,
  viewportHeight: 400,
}));

const walked = vi.hoisted(() => ({ lines: 0 }));

vi.mock("../../src/view/metrics.ts", () => ({
  useCellMetrics: () => ({ ...metrics }),
}));

vi.mock("../../src/view/geometry.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/view/geometry.ts")>();
  return {
    ...actual,
    buildRowIndex: vi.fn(
      (
        ls: Parameters<typeof actual.buildRowIndex>[0],
        cols: number | null,
        prev?: Uint32Array,
      ) => {
        // The array grows in place, so its length is read now; an extended
        // index walks only the lines past `prev`.
        walked.lines += ls.length - (prev ? prev.length - 1 : 0);
        return actual.buildRowIndex(ls, cols, prev);
      },
    ),
    splitRows: vi.fn(actual.splitRows),
    lineAtRow: vi.fn(actual.lineAtRow),
  };
});

vi.mock("@orz/ui/lib/clipboard", () => ({
  copyToClipboard: vi.fn(async () => true),
}));

beforeEach(() => {
  metrics.rowHeight = 20;
  metrics.cellWidth = 8;
  metrics.width = 800;
  metrics.viewportHeight = 400;
  vi.mocked(geometry.buildRowIndex).mockClear();
  vi.mocked(geometry.splitRows).mockClear();
  vi.mocked(geometry.lineAtRow).mockClear();
});

function mounted(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-line]")];
}

function mountedLines(container: HTMLElement): number[] {
  return mounted(container).map((row) => Number(row.dataset.line));
}

function spacer(container: HTMLElement): HTMLElement {
  const layer = container.querySelector<HTMLElement>("[data-line]")
    ?.parentElement as HTMLElement;
  // The layer holds the rows; the spacer holds the layer.
  return layer.parentElement as HTMLElement;
}

function layer(container: HTMLElement): HTMLElement {
  return container.querySelector<HTMLElement>("[data-line]")
    ?.parentElement as HTMLElement;
}

function scrollTo(el: HTMLElement, top: number) {
  el.scrollTop = top;
  fireEvent.scroll(el);
}

// The view's padding above the first row and below the last.
const PAD = 8;

const lines = (n: number, make: (i: number) => string = (i) => `L${i}`) =>
  Array.from({ length: n }, (_, i) => make(i)).join("\n");

describe("1:1 window bounds", () => {
  const TEXT = lines(100_000);

  it("mounts exactly top-20 .. top+viewportRows+20 at every position", () => {
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    const scroller = screen.getByRole("region");
    for (const top of [0, 1, 19, 20, 21, 777, 50_000, 99_979, 99_980]) {
      scrollTo(scroller, top * 20);
      const got = mountedLines(container);
      const first = Math.max(0, top - 20);
      const end = Math.min(100_000, top + 20 + 20);
      expect(got[0]).toBe(first);
      expect(got.at(-1)).toBe(end - 1);
      expect(got).toHaveLength(end - first);
      // 1:1, the layer sits at the padding plus first × rowHeight.
      expect(layer(container).style.transform).toBe(
        `translateY(${PAD + first * 20}px)`,
      );
    }
  });

  it("clamps a scrollTop past the end to the last full viewport", () => {
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    const scroller = screen.getByRole("region");
    scrollTo(scroller, 1e9);
    const got = mountedLines(container);
    expect(got.at(-1)).toBe(99_999);
    expect(got[0]).toBe(99_980 - 20);
  });

  it("sizes the spacer to the rows and the padding exactly", () => {
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    // maxTopRow × rowHeight + viewportHeight = totalRows × rowHeight here.
    expect(spacer(container).style.height).toBe(`${100_000 * 20 + 2 * PAD}px`);
  });
});

describe("scaled past the spacer cap", () => {
  // 100k rows of 200px is 20M px, past the 15M cap.
  const TEXT = lines(100_000);

  it("maps the scroll range end to end", () => {
    metrics.rowHeight = 200;
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    expect(spacer(container).style.height).toBe(`${MAX_SPACER_PX + 2 * PAD}px`);
    const scroller = screen.getByRole("region");
    const maxScroll = MAX_SPACER_PX - 400;

    scrollTo(scroller, maxScroll + PAD);
    let got = mountedLines(container);
    expect(got.at(-1)).toBe(99_999);
    // Top row 99_998, two rows visible, 20 overscan above.
    expect(got[0]).toBe(99_978);
    // The top row is pinned to the viewport's top edge.
    expect(layer(container).style.transform).toBe(
      `translateY(${PAD + maxScroll - 20 * 200}px)`,
    );

    scrollTo(scroller, PAD + maxScroll / 2);
    got = mountedLines(container);
    expect(got).toContain(49_999);
    expect(got[0]).toBe(49_999 - 20);
    expect(got.at(-1)).toBe(49_999 + 2 + 20 - 1);

    scrollTo(scroller, 0);
    expect(mountedLines(container)[0]).toBe(0);
  });

  it("steps the wheel by whole rows and keeps scrollTop in step", () => {
    metrics.rowHeight = 200;
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    const scroller = screen.getByRole("region");
    scrollTo(scroller, PAD + (MAX_SPACER_PX - 400) / 2);
    act(() => {
      scroller.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 3,
          deltaMode: 1,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    const got = mountedLines(container);
    expect(got[0]).toBe(49_999 + 3 - 20);
    const g = {
      maxTopRow: 99_998,
      range: MAX_SPACER_PX - 400,
    };
    expect(scroller.scrollTop).toBeCloseTo(
      PAD + (50_002 / g.maxTopRow) * g.range,
      0,
    );
  });

  it("keeps the top row when the row count grows past the cap", () => {
    metrics.rowHeight = 200;
    const { container, rerender } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    const scroller = screen.getByRole("region");
    scrollTo(scroller, (MAX_SPACER_PX - 400) / 2);
    expect(mountedLines(container)).toContain(49_999);
    // A resize that changes the mapping (taller viewport) keeps the top row.
    metrics.viewportHeight = 800;
    rerender(<AnsiView chrome="pane" maxHeight="400px" text={TEXT} />);
    expect(mountedLines(container)[0]).toBe(49_999 - 20);
  });
});

describe("padding above the first row and below the last", () => {
  const TEXT = lines(100_000);

  function translate(container: HTMLElement): number {
    const m = /translateY\((.+)px\)/.exec(layer(container).style.transform);
    return Number(m?.[1]);
  }

  /** Where the last mounted row ends, in the spacer's coordinates. */
  function bottom(container: HTMLElement, rowHeight: number): number {
    return translate(container) + mounted(container).length * rowHeight;
  }

  it("1:1, shows the padding at both ends with every row reachable", () => {
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    const scroller = screen.getByRole("region");
    scrollTo(scroller, 0);
    expect(mountedLines(container)[0]).toBe(0);
    expect(translate(container)).toBe(PAD);

    const maxScroll = 100_000 * 20 + 2 * PAD - 400;
    scrollTo(scroller, maxScroll);
    expect(mountedLines(container).at(-1)).toBe(99_999);
    // The last row ends the padding's height above the viewport's bottom.
    expect(bottom(container, 20)).toBe(maxScroll + 400 - PAD);
  });

  it("1:1, keeps the rows aligned to the scroll position", () => {
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    const scroller = screen.getByRole("region");
    scrollTo(scroller, PAD + 777 * 20);
    const got = mountedLines(container);
    // Row 777 sits exactly at the viewport's top edge.
    expect(translate(container) + (777 - got[0]) * 20).toBe(PAD + 777 * 20);
  });

  it("scaled, reaches the last row whole and the padding below it", () => {
    metrics.rowHeight = 200;
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    const scroller = screen.getByRole("region");
    const maxScroll = MAX_SPACER_PX + 2 * PAD - 400;
    scrollTo(scroller, maxScroll);
    expect(mountedLines(container).at(-1)).toBe(99_999);
    expect(bottom(container, 200)).toBe(maxScroll + 400 - PAD);

    scrollTo(scroller, 0);
    expect(mountedLines(container)[0]).toBe(0);
    expect(translate(container)).toBe(PAD);
  });

  it("scaled, a wheel to either end scrolls its padding into view", () => {
    metrics.rowHeight = 200;
    render(<AnsiView chrome="pane" maxHeight="400px" text={TEXT} />);
    const scroller = screen.getByRole("region");
    const wheel = (deltaY: number) =>
      act(() => {
        scroller.dispatchEvent(
          new WheelEvent("wheel", {
            deltaY,
            deltaMode: 1,
            bubbles: true,
            cancelable: true,
          }),
        );
      });
    scrollTo(scroller, PAD + 1000);
    wheel(-1e6);
    expect(scroller.scrollTop).toBe(0);
    wheel(1e6);
    expect(scroller.scrollTop).toBe(MAX_SPACER_PX + 2 * PAD - 400);
  });

  it("1:1, stays put at the bottom when more rows arrive", () => {
    // A 16px row: the padding is half a row, so the bottom's scrollTop
    // rounds to the row after the top one once the range grows.
    metrics.rowHeight = 16;
    const { rerender } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={lines(10_000)} />,
    );
    const scroller = screen.getByRole("region");
    const maxScroll = (10_000 - 25) * 16 + 2 * PAD;
    scrollTo(scroller, maxScroll);
    rerender(<AnsiView chrome="pane" maxHeight="400px" text={lines(10_100)} />);
    expect(scroller.scrollTop).toBe(maxScroll);
  });
});

describe("no O(lines) work per scroll", () => {
  it("does not rebuild the row index or walk lines when scrolled", () => {
    // 6000 lines of 250 cells: wrapped at 100 columns, 18k rows.
    const text = lines(3000, (i) => `${i}`.padEnd(250, "x"));
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" wrap text={text} />,
    );
    const scroller = screen.getByRole("region");
    const builds = vi.mocked(geometry.buildRowIndex).mock.calls.length;
    vi.mocked(geometry.lineAtRow).mockClear();
    vi.mocked(geometry.splitRows).mockClear();
    for (let i = 1; i <= 50; i++) scrollTo(scroller, i * 997 * 20);
    expect(vi.mocked(geometry.buildRowIndex).mock.calls.length).toBe(builds);
    // Each scroll renders at most the window (60 rows) and splits at most the
    // lines it shows (the cache keeps them).
    expect(vi.mocked(geometry.lineAtRow).mock.calls.length).toBeLessThanOrEqual(
      50 * 60,
    );
    expect(vi.mocked(geometry.splitRows).mock.calls.length).toBeLessThanOrEqual(
      50 * 60,
    );
    expect(mounted(container).length).toBeLessThanOrEqual(60);
  });
});

describe("wrap geometry", () => {
  // 900 KB: parsed in one go.
  const text = lines(6000, (i) => `${i}:`.padEnd(150, "x"));

  function rowsOf(container: HTMLElement) {
    return mounted(container).map((row) => ({
      line: Number(row.dataset.line),
      from: Number(row.dataset.from),
      text: row.querySelector("[data-text]")?.textContent ?? "",
    }));
  }

  it("agrees between the index and the rows drawn, across widths", () => {
    const { container, rerender } = render(
      <AnsiView chrome="file" maxHeight="400px" wrap text={text} />,
    );
    const scroller = screen.getByRole("region");
    for (const width of [800, 400, 333, 1210]) {
      metrics.width = width;
      rerender(<AnsiView chrome="file" maxHeight="400px" wrap text={text} />);
      // 4-digit gutter: 6 cells.
      const cols = Math.max(20, Math.floor((width - 48) / 8));
      const perLine = Math.ceil(150 / cols);
      const total = 6000 * perLine;
      expect(spacer(container).style.height).toBe(`${total * 20 + 2 * PAD}px`);
      const top = Math.floor(total / 2) + 1;
      scrollTo(scroller, top * 20);
      const drawn = rowsOf(container);
      expect(drawn).toHaveLength(60);
      for (let k = 0; k < drawn.length; k++) {
        const row = top - 20 + k;
        const line = Math.floor(row / perLine);
        const part = row % perLine;
        expect(drawn[k].line).toBe(line);
        expect(drawn[k].from).toBe(part * cols);
        expect(drawn[k].text.length).toBeLessThanOrEqual(cols);
      }
    }
  });

  it("counts a wide character pushed past the cut", () => {
    // 21 wide characters on 41 columns of a 20-col floor: each row holds 10.
    metrics.width = 0;
    const wide = "一".repeat(21);
    const big = lines(6000, () => wide);
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" wrap text={big} />,
    );
    // 20 columns hold 10 wide characters, so 3 rows a line.
    expect(spacer(container).style.height).toBe(`${6000 * 3 * 20 + 2 * PAD}px`);
    const scroller = screen.getByRole("region");
    scrollTo(scroller, 9000 * 20);
    const drawn = rowsOf(container);
    for (const row of drawn) expect(row.text.length).toBeGreaterThan(0);
  });

  it("goes back to one row per line when wrap is turned off", () => {
    const { container } = render(
      <AnsiView chrome="file" maxHeight="400px" wrap text={text} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    // 6000 rows: still virtual.
    expect(spacer(container).style.height).toBe(`${6000 * 20 + 2 * PAD}px`);
    // No wrap: gutter of 6 cells plus 150 cells.
    expect(spacer(container).style.width).toBe(`${(6 + 150) * 8}px`);
  });

  it("keeps the reader on the same line when wrap is toggled", () => {
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={text} />,
    );
    const scroller = screen.getByRole("region");
    scrollTo(scroller, 3000 * 20);
    expect(mountedLines(container)).toContain(3000);
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    // The line that was at the top should still be on screen.
    const topLine = Number(
      mounted(container)[Math.min(20, mounted(container).length - 1)].dataset
        .line,
    );
    expect(topLine).toBe(3000);
  });
});

describe("wrap resize", () => {
  const text = lines(6000, (i) => `${i}:`.padEnd(150, "x"));

  it("keeps the top row's text when it is a continuation row", () => {
    const { container, rerender } = render(
      <AnsiView chrome="pane" maxHeight="400px" wrap text={text} />,
    );
    const scroller = screen.getByRole("region");
    // 100 columns: row 6001 is line 3000 from offset 100.
    scrollTo(scroller, 6001 * 20);
    expect(mounted(container)[20].dataset.from).toBe("100");
    metrics.width = 400; // 50 columns: offset 100 starts line 3000's third row.
    rerender(<AnsiView chrome="pane" maxHeight="400px" wrap text={text} />);
    const top = mounted(container)[20];
    expect([top.dataset.line, top.dataset.from]).toEqual(["3000", "100"]);
    expect(scroller.scrollTop).toBe(PAD + (3000 * 3 + 2) * 20);
  });

  it("keeps the top line when a width change re-wraps", () => {
    const { container, rerender } = render(
      <AnsiView chrome="pane" maxHeight="400px" wrap text={text} />,
    );
    const scroller = screen.getByRole("region");
    // 100 columns: 2 rows a line; row 6000 is line 3000.
    scrollTo(scroller, 6000 * 20);
    expect(mounted(container)[20].dataset.line).toBe("3000");
    metrics.width = 400; // 50 columns: 3 rows a line.
    rerender(<AnsiView chrome="pane" maxHeight="400px" wrap text={text} />);
    expect(mounted(container)[20].dataset.line).toBe("3000");
  });
});

describe("streaming in wrap mode", () => {
  it("walks each line a bounded number of times", async () => {
    const N = 200_000;
    const text = lines(N, (i) => `${i}:`.padEnd(120, "x"));
    walked.lines = 0;
    render(<AnsiView chrome="file" maxHeight="400px" wrap text={text} />);
    await waitFor(
      () => expect(screen.getByText(`${N.toLocaleString("en-US")} lines`)),
      { timeout: 20_000 },
    );
    expect(walked.lines).toBeLessThanOrEqual(4 * N);
  }, 30_000);
});

describe("no-wrap width", () => {
  it("is the gutter plus maxCells × cellWidth, virtual or not", () => {
    const small = "a\n\x1b[31m".concat("y".repeat(77), "\x1b[0m\nb");
    const { container, unmount } = render(
      <AnsiView chrome="file" text={small} />,
    );
    const body = mounted(container)[0].parentElement as HTMLElement;
    expect(body.style.width).toBe(`${(3 + 77) * 8}px`);
    unmount();

    const big = lines(100_000).concat(`\n${"z".repeat(500)}`);
    const { container: c2 } = render(<AnsiView chrome="file" text={big} />);
    expect(spacer(c2).style.width).toBe(`${(8 + 500) * 8}px`);
  });

  it("counts a wide character as two cells", () => {
    const big = lines(6000).concat(`\n${"一".repeat(100)}`);
    const { container } = render(<AnsiView chrome="pane" text={big} />);
    expect(parseAnsi(big).maxCells).toBe(200);
    expect(spacer(container).style.width).toBe(`${200 * 8}px`);
  });
});

describe("VIRTUALIZE_ABOVE boundary", () => {
  it("renders every row at 5000 and virtualises at 5001", () => {
    const { container, unmount } = render(
      <AnsiView chrome="pane" text={lines(5000)} />,
    );
    expect(mounted(container)).toHaveLength(5000);
    unmount();
    const { container: c2 } = render(
      <AnsiView chrome="pane" text={lines(5001)} />,
    );
    expect(mounted(c2).length).toBeLessThanOrEqual(60);
  }, 20_000);

  it("crosses the threshold by toggling wrap", () => {
    // 2000 lines of 250 cells: 2000 rows unwrapped, 6000 wrapped at 100.
    const text = lines(2000, () => "w".repeat(250));
    const { container } = render(<AnsiView chrome="pane" text={text} />);
    expect(mounted(container)).toHaveLength(2000);
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(mounted(container).length).toBeLessThanOrEqual(60);
    expect(screen.getByRole("region").style.height).toBe("32rem");
    fireEvent.click(screen.getByRole("button", { name: "Wrap lines" }));
    expect(mounted(container)).toHaveLength(2000);
  }, 20_000);
});

describe("streaming growth", () => {
  // ~2.2 MB: parsed in slices.
  const N = 200_000;
  const TEXT = lines(N, (i) => `line ${i}`.padEnd(10, "."));

  it("grows the scroll extent while parsing and ends with every line", async () => {
    const { container } = render(
      <AnsiView chrome="file" maxHeight="400px" text={TEXT} />,
    );
    expect(screen.getByText(/^Parsing…/)).toBeTruthy();
    const firstHeight = Number.parseFloat(spacer(container).style.height);
    expect(firstHeight).toBeLessThan(N * 20);
    await waitFor(
      () => expect(screen.getByText(`${N.toLocaleString("en-US")} lines`)),
      { timeout: 15_000 },
    );
    expect(spacer(container).style.height).toBe(`${N * 20 + 2 * PAD}px`);
    const scroller = screen.getByRole("region");
    scrollTo(scroller, 1e9);
    const got = mountedLines(container);
    expect(got.at(-1)).toBe(N - 1);
    const last = mounted(container).at(-1) as HTMLElement;
    expect(last.textContent).toBe(`line ${N - 1}`.padEnd(10, "."));
  }, 20_000);

  it("mounts only a window from the first slice on", () => {
    // 6000 rows in all, but the first slice holds fewer than 5000 of them.
    const text = lines(6000, (i) => `${i}`.padEnd(300, "x"));
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={text} />,
    );
    // 20 rows in view, 20 overscan on each side.
    expect(mounted(container).length).toBeLessThanOrEqual(20 + 2 * 20);
  });

  it("keeps the scroll place while lines stream in", async () => {
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={TEXT} />,
    );
    const scroller = screen.getByRole("region");
    scrollTo(scroller, 1000 * 20);
    expect(mountedLines(container)).toContain(1000);
    await waitFor(
      () =>
        expect(Number.parseFloat(spacer(container).style.height)).toBe(
          N * 20 + 2 * PAD,
        ),
      { timeout: 15_000 },
    );
    expect(mountedLines(container)[0]).toBe(980);
  }, 20_000);

  it("parses every line once under StrictMode", async () => {
    const { container } = render(
      <StrictMode>
        <AnsiView chrome="file" maxHeight="400px" text={TEXT} />
      </StrictMode>,
    );
    await waitFor(
      () => expect(screen.getByText(`${N.toLocaleString("en-US")} lines`)),
      { timeout: 15_000 },
    );
    const scroller = screen.getByRole("region");
    scrollTo(scroller, 123_456 * 20);
    const row = mounted(container).find(
      (el) => Number(el.dataset.line) === 123_456,
    );
    expect(row?.textContent).toBe("line 123456");
  }, 20_000);
});
