import { copyToClipboard } from "@orz/ui/lib/clipboard";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stripAnsi } from "../../src/parse/parser.ts";
import { AnsiView } from "../../src/view/ansi-view.tsx";

vi.mock("@orz/ui/lib/clipboard", () => ({
  copyToClipboard: vi.fn(async () => true),
}));

// happy-dom has no layout: 20px rows, 8px cells, 100 columns, 20 rows visible.
// The real hook still runs, so its probe is mounted; a test can ask for its
// numbers.
const metricsMode = vi.hoisted(() => ({ real: false }));
vi.mock("../../src/view/metrics.ts", async (importOriginal) => {
  const real =
    await importOriginal<typeof import("../../src/view/metrics.ts")>();
  return {
    useCellMetrics: (ref: Parameters<typeof real.useCellMetrics>[0]) => {
      const measured = real.useCellMetrics(ref);
      return metricsMode.real
        ? measured
        : { rowHeight: 20, cellWidth: 8, width: 800, viewportHeight: 400 };
    },
  };
});

beforeEach(() => {
  metricsMode.real = false;
  vi.mocked(copyToClipboard).mockClear();
});

function rows(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-line]")];
}

function spanWithText(container: HTMLElement, text: string): HTMLElement {
  const found = [
    ...container.querySelectorAll<HTMLElement>("[data-text] > *"),
  ].find((el) => el.textContent === text);
  if (!found) throw new Error(`no run "${text}"`);
  return found;
}

function styleOf(el: HTMLElement): string {
  return el.getAttribute("style") ?? "";
}

describe("AnsiView runs", () => {
  it("draws each run with its style", () => {
    const { container } = render(
      <AnsiView
        chrome="pane"
        text={
          "\x1b[31mred\x1b[0m \x1b[1;4:3;58;5;196mwavy\x1b[0m \x1b[48;2;1;2;3mbg"
        }
      />,
    );
    expect(styleOf(spanWithText(container, "red"))).toContain(
      "var(--ansi-red)",
    );
    const wavy = styleOf(spanWithText(container, "wavy"));
    expect(wavy).toContain("font-weight: 700");
    expect(wavy).toContain("wavy");
    expect(wavy).toContain("underline");
    expect(styleOf(spanWithText(container, "bg"))).toMatch(/rgb\(1 2 3\)/);
    expect(rows(container)[0].textContent).toBe("red wavy bg");
  });

  it("draws inverse, dim and hidden", () => {
    const { container } = render(
      <AnsiView
        chrome="pane"
        text={"\x1b[7minv\x1b[0m\x1b[2mdim\x1b[0m\x1b[8mhid"}
      />,
    );
    const inv = styleOf(spanWithText(container, "inv"));
    expect(inv).toContain("var(--terminal-background)");
    expect(inv).toContain("var(--terminal-foreground)");
    // happy-dom drops color-mix() from a style; run-style.test.ts covers it.
    expect(styleOf(spanWithText(container, "dim"))).not.toContain("opacity");
    expect(styleOf(spanWithText(container, "hid"))).toContain("transparent");
  });

  it("brightens bold palette colours with boldIsBright", () => {
    const text = "\x1b[1;32mok";
    const { container, rerender } = render(
      <AnsiView chrome="pane" text={text} />,
    );
    expect(styleOf(spanWithText(container, "ok"))).toContain(
      "var(--ansi-green)",
    );
    rerender(<AnsiView chrome="pane" text={text} boldIsBright />);
    expect(styleOf(spanWithText(container, "ok"))).toContain(
      "var(--ansi-bright-green)",
    );
  });

  it("renders an OSC 8 link as an anchor, and a javascript: one as text", () => {
    const { container } = render(
      <AnsiView
        chrome="pane"
        text={
          "\x1b]8;;https://example.com/x\x07site\x1b]8;;\x07 \x1b]8;;javascript:alert(1)\x07bad\x1b]8;;\x07"
        }
      />,
    );
    const link = screen.getByRole("link", { name: "site" });
    expect(link.getAttribute("href")).toBe("https://example.com/x");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    // A refused link leaves the run unstyled, merged with the space before.
    expect(spanWithText(container, " bad").tagName).toBe("SPAN");
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });
});

describe("AnsiView chrome", () => {
  it("copies the stripped text", () => {
    render(<AnsiView chrome="pane" text={"\x1b[31ma\x1b[0m\nb\rc"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(copyToClipboard).toHaveBeenCalledWith("a\nc", "Copied output");
  });

  it("draws no gutter or header in a pane", () => {
    const { container } = render(<AnsiView chrome="pane" text={"a\nb"} />);
    expect(container.querySelector("[data-gutter]")).toBeNull();
    expect(screen.queryByText(/lines?$/)).toBeNull();
    expect(screen.getByRole("region", { name: "Terminal output" })).toBe(
      container.querySelector("[tabindex='0']"),
    );
  });

  it("numbers lines and counts them in a file", () => {
    const { container } = render(
      <AnsiView
        chrome="file"
        filename="build.log"
        downloadUrl="https://example.com/build.log"
        text={"one\ntwo\nthree"}
      />,
    );
    expect(screen.getByText("build.log")).toBeTruthy();
    expect(screen.getByText("3 lines")).toBeTruthy();
    const numbers = [...container.querySelectorAll("[data-gutter]")].map((el) =>
      el.getAttribute("data-n"),
    );
    expect(numbers).toEqual(["1", "2", "3"]);
    // The number is CSS content, so the row's own text is the line's.
    expect(rows(container)[1].textContent).toBe("two");
    const download = screen.getByRole("link", { name: "Download" });
    expect(download.getAttribute("href")).toBe("https://example.com/build.log");
    expect(screen.getByRole("region", { name: "build.log" })).toBeTruthy();
  });

  it("says 0 lines for empty text and still draws one row", () => {
    const { container } = render(<AnsiView chrome="file" text="" />);
    expect(screen.getByText("0 lines")).toBeTruthy();
    expect(rows(container)).toHaveLength(1);
  });

  it("counts lines while a large text is parsed", async () => {
    const text = "ok\n".repeat(400_000);
    render(<AnsiView chrome="file" text={text} />);
    expect(screen.getByText(/^Parsing… [\d,]+ lines$/)).toBeTruthy();
    await waitFor(
      () => expect(screen.getByText("400,001 lines")).toBeTruthy(),
      { timeout: 15_000 },
    );
  }, 20_000);

  it("says 1 line for one line", () => {
    render(<AnsiView chrome="file" text="x" />);
    expect(screen.getByText("1 line")).toBeTruthy();
  });

  it("toggles wrap: a 300-cell line at 100 columns takes 3 rows", () => {
    const { container } = render(
      <AnsiView chrome="pane" text={"x".repeat(300)} />,
    );
    expect(rows(container)).toHaveLength(1);
    const wrap = screen.getByRole("button", { name: "Wrap lines" });
    expect(wrap.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(wrap);
    expect(wrap.getAttribute("aria-pressed")).toBe("true");
    const wrapped = rows(container);
    expect(wrapped).toHaveLength(3);
    expect(wrapped.map((row) => row.getAttribute("data-from"))).toEqual([
      "0",
      "100",
      "200",
    ]);
  });

  it("numbers only the first row of a wrapped line", () => {
    const { container } = render(
      <AnsiView chrome="file" wrap text={`${"x".repeat(150)}\ny`} />,
    );
    // 800px less a 3ch gutter of 24px leaves 97 columns.
    const numbers = [...container.querySelectorAll("[data-gutter]")].map((el) =>
      el.getAttribute("data-n"),
    );
    expect(numbers).toEqual(["1", null, "2"]);
  });
});

describe("AnsiView virtualisation", () => {
  // Under SYNC_PARSE_MAX, so it is parsed whole on the first render.
  const BIG = Array.from({ length: 100_000 }, (_, i) => `L${i}`).join("\n");

  it("mounts only the window of a 100k-line text", () => {
    const { container } = render(<AnsiView chrome="pane" text={BIG} />);
    const mounted = rows(container);
    // 20 visible rows plus 20 of overscan on each side.
    expect(mounted.length).toBeLessThanOrEqual(20 + 40);
    expect(mounted[0].getAttribute("data-line")).toBe("0");
    const scroller = screen.getByRole("region");
    expect(scroller.style.height).toBe("32rem");
  });

  it("moves the window when scrolled", () => {
    const { container } = render(
      <AnsiView chrome="pane" maxHeight="400px" text={BIG} />,
    );
    const scroller = screen.getByRole("region");
    expect(scroller.style.height).toBe("400px");
    scroller.scrollTop = 50_000 * 20;
    fireEvent.scroll(scroller);
    const lines = rows(container).map((row) =>
      Number(row.getAttribute("data-line")),
    );
    expect(lines.length).toBeLessThanOrEqual(60);
    expect(lines[0]).toBe(49_980);
    expect(lines).toContain(50_000);
    expect(lines).toContain(50_019);
    expect(lines.at(-1)).toBe(50_039);
  });
});

function selectAndCopy(
  view: HTMLElement,
  start: [Node, number],
  end: [Node, number],
) {
  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  const selection = window.getSelection() as Selection;
  selection.removeAllRanges();
  selection.addRange(range);
  const setData = vi.fn();
  const proceeded = fireEvent.copy(view, { clipboardData: { setData } });
  return { setData, prevented: !proceeded };
}

function textNode(row: HTMLElement): Node {
  return row.querySelector("[data-text]")?.firstChild?.firstChild as Node;
}

describe("AnsiView selection copy", () => {
  it("joins the rows of one wrapped line without a newline", () => {
    const text = "a".repeat(150) + "b".repeat(150);
    const { container } = render(<AnsiView chrome="file" wrap text={text} />);
    const [first, second] = rows(container);
    const from = Number(second.getAttribute("data-from"));
    const { setData, prevented } = selectAndCopy(
      screen.getByRole("region"),
      [textNode(first), 90],
      [textNode(second), 20],
    );
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      text.slice(90, from + 20),
    );
    expect(prevented).toBe(true);
  });

  it("separates lines with a newline", () => {
    const { container } = render(
      <AnsiView chrome="pane" text={"\x1b[32mfirst\x1b[0m\nmiddle\nlast"} />,
    );
    const all = rows(container);
    const { setData } = selectAndCopy(
      screen.getByRole("region"),
      [textNode(all[0]), 2],
      [textNode(all[2]), 3],
    );
    expect(setData).toHaveBeenCalledWith("text/plain", "rst\nmiddle\nlas");
  });

  it("leaves a selection reaching outside the rows to the browser", () => {
    const { container } = render(
      <AnsiView chrome="file" filename="out.log" text={"one\ntwo"} />,
    );
    const header = screen.getByText("out.log");
    const { setData, prevented } = selectAndCopy(
      screen.getByRole("region"),
      [header.firstChild as Node, 0],
      [textNode(rows(container)[1]), 2],
    );
    expect(setData).not.toHaveBeenCalled();
    expect(prevented).toBe(false);
  });
});

function copy(start: [Node, number], end: [Node, number]) {
  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  const selection = window.getSelection() as Selection;
  selection.removeAllRanges();
  selection.addRange(range);
  const setData = vi.fn();
  const proceeded = fireEvent.copy(screen.getByRole("region"), {
    clipboardData: { setData },
  });
  return { setData, prevented: !proceeded };
}

function copyBackwards(anchor: [Node, number], focus: [Node, number]) {
  const selection = window.getSelection() as Selection;
  selection.removeAllRanges();
  selection.setBaseAndExtent(anchor[0], anchor[1], focus[0], focus[1]);
  const setData = vi.fn();
  const proceeded = fireEvent.copy(screen.getByRole("region"), {
    clipboardData: { setData },
  });
  return { setData, prevented: !proceeded };
}

const textOf = (row: HTMLElement) =>
  row.querySelector("[data-text]") as HTMLElement;
const firstText = (row: HTMLElement) =>
  textOf(row).firstChild?.firstChild as Node;
const gutterOf = (row: HTMLElement) =>
  row.querySelector("[data-gutter]") as HTMLElement;

describe("AnsiView selection endpoints", () => {
  // 800px less a 3ch gutter leaves 97 columns.
  const LONG = `${"a".repeat(97)}${"b".repeat(97)}${"c".repeat(10)}`;

  it("starts in a gutter and ends mid-way through a wrapped row", () => {
    const { container } = render(
      <AnsiView chrome="file" wrap text={`head\n${LONG}\ntail`} />,
    );
    const all = rows(container);
    expect(all).toHaveLength(5);
    const { setData, prevented } = copy(
      [gutterOf(all[1]), 0],
      [firstText(all[2]), 5],
    );
    expect(prevented).toBe(true);
    expect(setData).toHaveBeenCalledWith("text/plain", LONG.slice(0, 97 + 5));
  });

  it("ends in the gutter of a continuation row", () => {
    const { container } = render(
      <AnsiView chrome="file" wrap text={`${LONG}`} />,
    );
    const all = rows(container);
    const { setData } = copy([firstText(all[0]), 3], [gutterOf(all[2]), 0]);
    expect(setData).toHaveBeenCalledWith("text/plain", LONG.slice(3, 194));
  });

  it("ends in the gutter of the next line, keeping the newline", () => {
    const { container } = render(
      <AnsiView chrome="file" text={"one\ntwo\nthree"} />,
    );
    const all = rows(container);
    const { setData } = copy([firstText(all[0]), 1], [gutterOf(all[2]), 0]);
    expect(setData).toHaveBeenCalledWith("text/plain", "ne\ntwo\n");
  });

  it("handles endpoints on the row and [data-text] elements", () => {
    const { container } = render(
      <AnsiView chrome="file" text={"\x1b[31mre\x1b[0md\nsecond\nthird"} />,
    );
    const all = rows(container);
    // Row offset 2 is after the gutter and the text: the end of line 0.
    const a = copy([all[0], 2], [textOf(all[2]), 1]);
    expect(a.setData).toHaveBeenCalledWith("text/plain", "\nsecond\nthird");
    // Row offset 1 is between gutter and text: the start of the line.
    const b = copy([all[1], 1], [textOf(all[1]), 1]);
    expect(b.setData).toHaveBeenCalledWith("text/plain", "second");
    // [data-text] offset 1 in line 0 is after the "re" run.
    const c = copy([textOf(all[0]), 1], [all[1], 0]);
    expect(c.setData).toHaveBeenCalledWith("text/plain", "d\n");
  });

  it("maps an endpoint inside a link", () => {
    const { container } = render(
      <AnsiView
        chrome="pane"
        text={"go \x1b]8;;https://example.com/\x07there\x1b]8;;\x07 now\nnext"}
      />,
    );
    const link = screen.getByRole("link");
    const all = rows(container);
    const { setData } = copy(
      [link.firstChild as Node, 2],
      [firstText(all[1]), 2],
    );
    expect(setData).toHaveBeenCalledWith("text/plain", "ere now\nne");
    const d = copy([textOf(all[0]), 0], [link, 1]);
    expect(d.setData).toHaveBeenCalledWith("text/plain", "go there");
  });

  it("is direction-agnostic", () => {
    const { container } = render(
      <AnsiView chrome="pane" text={"alpha\nbeta\ngamma"} />,
    );
    const all = rows(container);
    const { setData, prevented } = copyBackwards(
      [firstText(all[2]), 2],
      [firstText(all[0]), 3],
    );
    expect(prevented).toBe(true);
    expect(setData).toHaveBeenCalledWith("text/plain", "ha\nbeta\nga");
  });

  it("copies across empty lines", () => {
    const { container } = render(<AnsiView chrome="file" text={"x\n\n\ny"} />);
    const all = rows(container);
    expect(all).toHaveLength(4);
    const { setData } = copy([textOf(all[1]), 0], [firstText(all[3]), 1]);
    expect(setData).toHaveBeenCalledWith("text/plain", "\n\ny");
  });

  it("keeps hidden text and tab-expanded text as drawn", () => {
    const { container } = render(
      <AnsiView chrome="pane" text={"a\tb \x1b[8msecret\x1b[0m!"} />,
    );
    const all = rows(container);
    const len = textOf(all[0]).textContent?.length ?? 0;
    const { setData } = copy([textOf(all[0]), 0], [all[0], 1]);
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      textOf(all[0]).textContent,
    );
    expect(len).toBeGreaterThan(0);
    expect(String(setData.mock.calls[0][1])).toContain("secret");
  });

  it("keeps a surrogate pair split by a row boundary intact", () => {
    // 96 narrow cells then a wide emoji does not fit 97 columns; it moves to
    // the next row whole.
    const text = `${"a".repeat(96)}\u{1F600}${"z".repeat(5)}`;
    const { container } = render(<AnsiView chrome="file" wrap text={text} />);
    const all = rows(container);
    for (const row of all) {
      const t = textOf(row).textContent ?? "";
      expect(/^[\uDC00-\uDFFF]/.test(t)).toBe(false);
      expect(/[\uD800-\uDBFF]$/.test(t)).toBe(false);
    }
    const { setData } = copy([firstText(all[0]), 95], [all[1], 2]);
    expect(setData).toHaveBeenCalledWith("text/plain", text.slice(95));
  });

  it("leaves a selection ending in another view to the browser", () => {
    const { container } = render(
      <>
        <AnsiView chrome="pane" text={"one"} />
        <AnsiView chrome="file" filename="b" text={"two"} />
      </>,
    );
    const [a, b] = rows(container);
    const region = screen.getAllByRole("region")[0];
    const range = document.createRange();
    range.setStart(firstText(a), 1);
    range.setEnd(firstText(b), 1);
    const selection = window.getSelection() as Selection;
    selection.removeAllRanges();
    selection.addRange(range);
    const setData = vi.fn();
    const proceeded = fireEvent.copy(region, { clipboardData: { setData } });
    expect(setData).not.toHaveBeenCalled();
    expect(proceeded).toBe(true);
  });

  it("maps an endpoint on the rows container inside the view", () => {
    // Inside the view but not inside a row, e.g. a drag past the last row:
    // the spec only falls back for endpoints outside the view.
    const { container } = render(
      <AnsiView chrome="file" wrap text={`${LONG}\nend`} />,
    );
    const all = rows(container);
    const body = all[0].parentElement as HTMLElement;
    const { setData, prevented } = copy(
      [firstText(all[0]), 0],
      [body, body.childNodes.length],
    );
    expect(prevented).toBe(true);
    expect(setData).toHaveBeenCalledWith("text/plain", `${LONG}\nend`);
  });
});

describe("AnsiView gutter never reaches copied text", () => {
  it("has no text node in any gutter, wrapped or not", () => {
    const text = Array.from({ length: 120 }, (_, i) =>
      i % 7 === 0 ? "w".repeat(250) : `line ${i}`,
    ).join("\n");
    for (const wrap of [false, true]) {
      const { container, unmount } = render(
        <AnsiView chrome="file" wrap={wrap} text={text} />,
      );
      for (const g of container.querySelectorAll("[data-gutter]")) {
        expect(g.childNodes).toHaveLength(0);
        expect(g.getAttribute("aria-hidden")).toBe("true");
        expect(g.className).toContain("select-none");
        expect(g.className).toContain("text-ansi-bright-black");
      }
      // A whole-view selection's DOM text equals the model's lines.
      const drawn = rows(container as HTMLElement)
        .map((r) => textOf(r).textContent)
        .join("");
      expect(drawn).toBe(stripAnsi(text).replaceAll("\n", ""));
      const all = rows(container as HTMLElement);
      const { setData } = copy(
        [gutterOf(all[0]), 0],
        [all.at(-1) as HTMLElement, 2],
      );
      expect(setData).toHaveBeenCalledWith("text/plain", text);
      unmount();
    }
  });
});

describe("AnsiView Copy button", () => {
  const cases: [string, string][] = [
    ["sgr and cr", "\x1b[31ma\x1b[0m\nb\rc"],
    ["crlf and trailing newline", "one\r\ntwo\r\n"],
    [
      "tabs and osc",
      "a\tb\x1b]0;title\x07c\n\x1b]8;;https://example.com/\x07l\x1b]8;;\x07",
    ],
    ["cursor moves dropped", "ab\x1b[2Kc\x1b[1Ad"],
    ["empty", ""],
    ["only newlines", "\n\n"],
    ["overwrites", "abc\rX\nd\be\x1b[2K\x1b[1Gz\n"],
  ];
  for (const [name, text] of cases) {
    it(`copies stripAnsi of the whole text: ${name}`, () => {
      render(<AnsiView chrome="pane" text={text} />);
      fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
      expect(copyToClipboard).toHaveBeenCalledWith(
        stripAnsi(text),
        "Copied output",
      );
    });
  }

  it("copies every line of a virtualised text, not just the window", () => {
    const big = Array.from({ length: 20_000 }, (_, i) => `L${i}`).join("\n");
    render(<AnsiView chrome="file" text={big} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(copyToClipboard).toHaveBeenCalledWith(big, "Copied output");
  });

  it("copies the new text after the prop changes", () => {
    const { rerender } = render(<AnsiView chrome="pane" text="old" />);
    rerender(<AnsiView chrome="pane" text={"\x1b[1mnew"} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(copyToClipboard).toHaveBeenLastCalledWith("new", "Copied output");
  });

  it("copies the stripped whole text of a large log while still parsing", async () => {
    const line = "\x1b[32mok\x1b[0m line\n";
    const big = line.repeat(Math.ceil((1 << 20) / line.length) + 10);
    render(<AnsiView chrome="file" text={big} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(copyToClipboard).toHaveBeenLastCalledWith(
      stripAnsi(big),
      "Copied output",
    );
    await waitFor(() => expect(screen.queryByText(/^Parsing…/)).toBeNull(), {
      timeout: 15_000,
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(copyToClipboard).toHaveBeenLastCalledWith(
      stripAnsi(big),
      "Copied output",
    );
  }, 20_000);
});

describe("AnsiView virtualised selection", () => {
  const BIG = Array.from({ length: 10_000 }, (_, i) => `L${i}`).join("\n");

  it("maps a selection between two mounted rows", () => {
    const { container } = render(<AnsiView chrome="file" text={BIG} />);
    const all = rows(container);
    const { setData, prevented } = copy(
      [firstText(all[3]), 1],
      [firstText(all[10]), 2],
    );
    expect(prevented).toBe(true);
    const lines = BIG.split("\n");
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      [lines[3].slice(1), ...lines.slice(4, 10), lines[10].slice(0, 2)].join(
        "\n",
      ),
    );
  });

  it("still maps the selection after its start row scrolls out", () => {
    const { container } = render(
      <AnsiView chrome="file" maxHeight="400px" text={BIG} />,
    );
    const all = rows(container);
    const range = document.createRange();
    range.setStart(firstText(all[2]), 0);
    range.setEnd(firstText(all[5]), 1);
    const selection = window.getSelection() as Selection;
    selection.removeAllRanges();
    selection.addRange(range);
    const scroller = screen.getByRole("region");
    scroller.scrollTop = 200 * 20;
    fireEvent.scroll(scroller);
    // Extend to a row now mounted far below. A browser has moved the start,
    // whose row unmounted, to the rows' parent ahead of the mounted rows.
    const target = rows(container).find(
      (r) => r.getAttribute("data-line") === "210",
    ) as HTMLElement;
    selection.setBaseAndExtent(
      target.parentElement as HTMLElement,
      0,
      firstText(target),
      2,
    );
    const setData = vi.fn();
    fireEvent.copy(scroller, { clipboardData: { setData } });
    const lines = BIG.split("\n");
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      [...lines.slice(2, 210), lines[210].slice(0, 2)].join("\n"),
    );
  });
});

describe("AnsiView chrome details", () => {
  it("pane tools show on hover, on focus-within and on touch", () => {
    const { container } = render(<AnsiView chrome="pane" text="x" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("group");
    expect(root.className).toContain("ansi-view");
    expect(root.className).toContain("font-mono");
    const cluster = screen.getByRole("button", { name: "Copy output" })
      .parentElement as HTMLElement;
    expect(cluster.className).toContain("group-hover:opacity-100");
    expect(cluster.className).toContain("focus-within:opacity-100");
    // A touch screen has no hover to reveal them.
    expect(cluster.className).toContain("pointer-coarse:opacity-100");
    expect(screen.getByRole("button", { name: "Wrap lines" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });

  it("file without downloadUrl has no Download link", () => {
    render(<AnsiView chrome="file" filename="a.ansi" text="x" />);
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });

  it("Download link names the file", () => {
    render(
      <AnsiView
        chrome="file"
        filename="a.ansi"
        downloadUrl="https://example.com/a.ansi"
        text="x"
      />,
    );
    const link = screen.getByRole("link", { name: "Download" });
    expect(link.getAttribute("download")).toBe("a.ansi");
  });

  it("empty pane text draws one empty row and copies an empty string", () => {
    const { container } = render(<AnsiView chrome="pane" text="" />);
    expect(rows(container)).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(copyToClipboard).toHaveBeenCalledWith("", "Copied output");
  });

  it("a link with its own underline keeps its style; without one is dotted", () => {
    const { container } = render(
      <AnsiView
        chrome="pane"
        text={
          "\x1b]8;;https://example.com/a\x07a\x1b]8;;\x07 \x1b[4:5m\x1b]8;;https://example.com/b\x07b\x1b]8;;\x07"
        }
      />,
    );
    const [a, b] = [...container.querySelectorAll("a")];
    expect(a.getAttribute("style")).toContain("dotted");
    expect(b.getAttribute("style")).toContain("dashed");
  });

  it("CRLF lines carry no carriage return", () => {
    const { container } = render(
      <AnsiView chrome="file" text={"a\r\nb\r\n"} />,
    );
    expect(rows(container).map((r) => r.textContent)).toEqual(["a", "b", ""]);
  });
});

describe("AnsiView React", () => {
  it("a large text finishes parsing under StrictMode", async () => {
    const text = "ok\n".repeat(400_000);
    render(
      <StrictMode>
        <AnsiView chrome="file" text={text} />
      </StrictMode>,
    );
    await waitFor(
      () => expect(screen.getByText("400,001 lines")).toBeTruthy(),
      { timeout: 15_000 },
    );
  }, 20_000);

  it("a new small text replaces the rows", () => {
    const { container, rerender } = render(
      <AnsiView chrome="pane" text={"a\nb"} />,
    );
    rerender(<AnsiView chrome="pane" text={"c\nd"} />);
    expect(rows(container).map((r) => r.textContent)).toEqual(["c", "d"]);
  });

  it("virtual rows render in file chrome with gutter numbers", () => {
    const big = Array.from({ length: 10_000 }, (_, i) => `L${i}`).join("\n");
    const { container } = render(<AnsiView chrome="file" text={big} />);
    const scroller = screen.getByRole("region");
    scroller.scrollTop = 5000 * 20;
    fireEvent.scroll(scroller);
    const nums = [...container.querySelectorAll("[data-gutter]")].map((g) =>
      g.getAttribute("data-n"),
    );
    expect(nums).toContain("5001");
  });

  it("the metrics probe follows the scroll container when chrome changes", () => {
    metricsMode.real = true;
    const { rerender } = render(<AnsiView chrome="pane" text="x" />);
    const probeIn = (el: Element) =>
      [...el.children].some((c) => c.textContent === "MMMMMMMMMM");
    expect(probeIn(screen.getByRole("region"))).toBe(true);
    rerender(<AnsiView chrome="file" text="x" />);
    // The section is remounted under a new parent; the probe and the
    // ResizeObserver must move with it, or every metric stays stale.
    expect(probeIn(screen.getByRole("region"))).toBe(true);
  });
});
