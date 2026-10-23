import { copyToClipboard } from "@orz/ui/lib/clipboard";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stripAnsi } from "../../src/parse/parser.ts";
import { AnsiView } from "../../src/view/ansi-view.tsx";
import { LOG_SAMPLE } from "../parse/log-sample.ts";

vi.mock("@orz/ui/lib/clipboard", () => ({
  copyToClipboard: vi.fn(async () => true),
}));

// happy-dom has no layout: 20px rows, 8px cells, 100 columns, 20 rows visible.
vi.mock("../../src/view/metrics.ts", () => ({
  useCellMetrics: () => ({
    rowHeight: 20,
    cellWidth: 8,
    width: 800,
    viewportHeight: 400,
  }),
}));

beforeEach(() => {
  vi.mocked(copyToClipboard).mockClear();
});

const LOG = LOG_SAMPLE.map(([line]) => line).join("\n");
const PLAIN = LOG_SAMPLE.map(([line]) => stripAnsi(line));
const PADDING = 8;

function rows(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>("[data-line]")];
}

const lineIds = (container: HTMLElement) =>
  rows(container).map((row) => Number(row.getAttribute("data-line")));

function row(container: HTMLElement, id: number): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-line="${id}"]`);
  if (!found) throw new Error(`line ${id} is not mounted`);
  return found;
}

const chip = (name: string) =>
  screen.getByRole("button", { name: new RegExp(`^${name} `) });

const searchBox = () =>
  screen.getByRole("searchbox", { name: "Search log" }) as HTMLInputElement;

const counter = () =>
  searchBox().parentElement?.querySelector("[aria-live]") as HTMLElement;

function type(query: string) {
  fireEvent.change(searchBox(), { target: { value: query } });
}

async function counterReads(text: string) {
  await waitFor(() => expect(counter().textContent).toBe(text), {
    timeout: 5_000,
  });
}

function renderLog(text = LOG) {
  return render(
    <AnsiView chrome="file" filename="server.log" levels text={text} />,
  );
}

describe("level chips", () => {
  it("shows a chip per level that occurs, with its count", () => {
    renderLog();
    const expected: [string, number][] = [
      ["FATAL", 1],
      ["ERROR", 13],
      ["WARN", 5],
      ["INFO", 4],
      ["DEBUG", 1],
      ["TRACE", 1],
      ["Other", 1],
    ];
    for (const [name, count] of expected) {
      const button = chip(name);
      expect(button.textContent).toBe(`${name} ${count}`);
      expect(button.getAttribute("aria-pressed")).toBe("true");
    }
    expect(chip("ERROR").getAttribute("data-level")).toBe("error");
  });

  it("hides a level's rows on click, and says N of M lines", () => {
    const { container } = renderLog();
    expect(screen.getByText("26 lines")).toBeTruthy();
    fireEvent.click(chip("ERROR"));
    expect(chip("ERROR").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("13 of 26 lines")).toBeTruthy();
    expect(
      rows(container).some((r) => r.getAttribute("data-level") === "error"),
    ).toBe(false);
    // Line numbers keep their original values.
    expect(lineIds(container)).toEqual([
      0, 1, 2, 3, 4, 12, 13, 15, 16, 19, 20, 24, 25,
    ]);
    fireEvent.click(chip("ERROR"));
    expect(screen.getByText("26 lines")).toBeTruthy();
    expect(rows(container)).toHaveLength(26);
  });

  it("solos a level on shift+click, and shows all on a second one", () => {
    const { container } = renderLog();
    fireEvent.click(chip("INFO"), { shiftKey: true });
    expect(screen.getByText("4 of 26 lines")).toBeTruthy();
    expect(lineIds(container)).toEqual([0, 2, 12, 15]);
    expect(chip("INFO").getAttribute("aria-pressed")).toBe("true");
    expect(chip("WARN").getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip("INFO"), { shiftKey: true });
    expect(screen.getByText("26 lines")).toBeTruthy();
    expect(chip("WARN").getAttribute("aria-pressed")).toBe("true");
  });

  it("marks the row after a gap", () => {
    const { container } = renderLog();
    fireEvent.click(chip("ERROR"));
    expect(row(container, 12).hasAttribute("data-gap")).toBe(true);
    expect(row(container, 13).hasAttribute("data-gap")).toBe(false);
    expect(row(container, 0).hasAttribute("data-gap")).toBe(false);
    expect(row(container, 1).hasAttribute("data-gap")).toBe(false);
  });

  it("draws no gap above the first shown row", () => {
    const { container } = renderLog();
    fireEvent.click(chip("FATAL"), { shiftKey: true });
    // The first shown line has no previous one to be apart from.
    expect(lineIds(container)).toEqual([25]);
    expect(row(container, 25).hasAttribute("data-gap")).toBe(false);
  });

  it("an empty filter leaves an empty body and the chips clickable", () => {
    const { container } = renderLog();
    for (const name of ["FATAL", "ERROR", "WARN", "INFO", "DEBUG", "TRACE"]) {
      fireEvent.click(chip(name));
    }
    fireEvent.click(chip("Other"));
    expect(rows(container)).toHaveLength(0);
    expect(screen.getByText("0 of 26 lines")).toBeTruthy();
    fireEvent.click(chip("WARN"));
    expect(lineIds(container)).toEqual([3, 13, 16, 19, 20]);
  });

  it("shows only an Other chip for a log without levels, and none when empty", () => {
    const { unmount } = renderLog("one\ntwo");
    expect(chip("Other").textContent).toBe("Other 2");
    expect(screen.queryByRole("button", { name: /^ERROR / })).toBeNull();
    unmount();
    renderLog("");
    expect(screen.queryByRole("button", { name: /^Other / })).toBeNull();
    expect(searchBox()).toBeTruthy();
  });
});

describe("level rows", () => {
  it("sets data-level, the inherited mark and dims nothing coloured", () => {
    const { container } = renderLog();
    expect(row(container, 0).getAttribute("data-level")).toBe("info");
    expect(row(container, 5).getAttribute("data-level")).toBe("error");
    expect(row(container, 5).hasAttribute("data-inherited")).toBe(false);
    expect(row(container, 6).getAttribute("data-level")).toBe("error");
    expect(row(container, 6).hasAttribute("data-inherited")).toBe(true);
    expect(row(container, 1).getAttribute("data-level")).toBe("debug");
    expect(row(container, 1).hasAttribute("data-coloured")).toBe(false);
    expect(row(container, 24).hasAttribute("data-level")).toBe(false);
    // The level word is coloured on a plain line.
    const word = row(container, 5).querySelector("[data-level-word]");
    expect(word?.textContent).toBe("ERROR");
  });

  it("keeps an ANSI-coloured line's run colours, and its level", () => {
    const { container } = renderLog();
    const coloured = row(container, 20);
    expect(coloured.getAttribute("data-level")).toBe("warn");
    expect(coloured.hasAttribute("data-coloured")).toBe(true);
    expect(coloured.querySelector("[data-level-word]")).toBeNull();
    const run = [...coloured.querySelectorAll("[data-text] > span")].find(
      (s) => s.textContent === "warning",
    );
    expect(run?.getAttribute("style")).toContain("var(--ansi-yellow)");
  });

  it("colours a log fence by level, with no toolbar", () => {
    const { container } = render(<AnsiView chrome="pane" levels text={LOG} />);
    expect(row(container, 5).getAttribute("data-level")).toBe("error");
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /^ERROR / })).toBeNull();
  });

  it("drops a level filter on a switch to a pane, which cannot undo it", () => {
    const text = "ERROR a\nINFO b\nINFO c";
    const { container, rerender } = render(
      <AnsiView chrome="file" levels text={text} />,
    );
    fireEvent.click(chip("ERROR"));
    expect(lineIds(container)).toEqual([1, 2]);
    rerender(<AnsiView chrome="pane" levels text={text} />);
    expect(lineIds(container)).toEqual([0, 1, 2]);
  });

  it("without levels: no chips and no level attributes, but a search box", () => {
    const { container } = render(<AnsiView chrome="file" text={LOG} />);
    expect(screen.queryByRole("button", { name: /^ERROR / })).toBeNull();
    expect(container.querySelector("[data-level]")).toBeNull();
    expect(searchBox()).toBeTruthy();
  });

  it("calls a custom detector", () => {
    const detect = vi.fn((text: string) =>
      text.startsWith("!") ? { level: "error" as const, from: 0, to: 1 } : null,
    );
    const { container } = render(
      <AnsiView chrome="file" levels={detect} text={"!boom\nfine"} />,
    );
    expect(row(container, 0).getAttribute("data-level")).toBe("error");
    expect(row(container, 1).hasAttribute("data-level")).toBe(false);
    expect(chip("ERROR").textContent).toBe("ERROR 1");
  });
});

describe("search", () => {
  it("Ctrl+F inside the view focuses the search box; outside it is left alone", () => {
    render(
      <>
        <button type="button">outside</button>
        <AnsiView chrome="file" filename="server.log" levels text={LOG} />
      </>,
    );
    type("conn");
    const outside = screen.getByRole("button", { name: "outside" });
    outside.focus();
    expect(fireEvent.keyDown(outside, { key: "f", ctrlKey: true })).toBe(true);
    expect(document.activeElement).toBe(outside);
    const region = screen.getByRole("region", { name: "server.log" });
    region.focus();
    expect(fireEvent.keyDown(region, { key: "f", ctrlKey: true })).toBe(false);
    expect(document.activeElement).toBe(searchBox());
    expect(searchBox().selectionStart).toBe(0);
    expect(searchBox().selectionEnd).toBe(4);
    region.focus();
    expect(fireEvent.keyDown(region, { key: "f", metaKey: true })).toBe(false);
    expect(document.activeElement).toBe(searchBox());
  });

  it("Ctrl+F in a pane is left to the browser", () => {
    render(<AnsiView chrome="pane" levels text={LOG} />);
    const region = screen.getByRole("region");
    expect(fireEvent.keyDown(region, { key: "f", ctrlKey: true })).toBe(true);
  });

  it("Escape returns focus to the log and keeps the query", async () => {
    renderLog();
    type("conn");
    searchBox().focus();
    fireEvent.keyDown(searchBox(), { key: "Escape" });
    expect(document.activeElement).toBe(
      screen.getByRole("region", { name: "server.log" }),
    );
    expect(searchBox().value).toBe("conn");
    await counterReads("1 / 2");
  });

  it("marks matches, the current one apart, and steps through them", async () => {
    const { container } = renderLog();
    type("conn");
    await counterReads("1 / 2");
    const marks = () =>
      [...container.querySelectorAll<HTMLElement>("[data-match]")].map((m) => [
        m.closest("[data-line]")?.getAttribute("data-line"),
        m.textContent,
        m.getAttribute("data-match"),
      ]);
    expect(marks()).toEqual([
      ["3", "conn", "current"],
      ["4", "conn", ""],
    ]);
    // The mark splits the run it falls in.
    expect(row(container, 3).textContent).toBe(PLAIN[3]);
    fireEvent.keyDown(searchBox(), { key: "Enter" });
    expect(counter().textContent).toBe("2 / 2");
    expect(marks()).toEqual([
      ["3", "conn", ""],
      ["4", "conn", "current"],
    ]);
    fireEvent.keyDown(searchBox(), { key: "Enter" });
    expect(counter().textContent).toBe("1 / 2");
    fireEvent.keyDown(searchBox(), { key: "Enter", shiftKey: true });
    expect(counter().textContent).toBe("2 / 2");
    fireEvent.click(screen.getByRole("button", { name: "Previous match" }));
    expect(counter().textContent).toBe("1 / 2");
    fireEvent.click(screen.getByRole("button", { name: "Next match" }));
    expect(counter().textContent).toBe("2 / 2");
  });

  it("Enter before a new scan starts leaves no stale current match", async () => {
    const text = Array.from({ length: 400 }, (_, i) =>
      i % 20 === 0 ? `hitx ${i}` : i % 10 === 0 ? `hit ${i}` : `line ${i}`,
    ).join("\n");
    const { container } = render(<AnsiView chrome="file" text={text} />);
    type("hit");
    await counterReads("1 / 40");
    const region = screen.getByRole("region");
    region.scrollTop = PADDING + 100 * 20;
    fireEvent.scroll(region);
    type("hitx");
    // Still on the old matches: goes to "hit 100".
    fireEvent.keyDown(searchBox(), { key: "Enter" });
    // The new scan starts from where that left the view.
    await counterReads("6 / 20");
    const current = container.querySelector("[data-match='current']");
    expect(current?.closest("[data-line]")?.getAttribute("data-line")).toBe(
      "100",
    );
  });

  it("stays virtual while a scan refills only the matching lines", async () => {
    const text = Array.from({ length: 20_000 }, (_, i) =>
      i % 2 ? `hit ${i}` : `line ${i}`,
    ).join("\n");
    const { container } = render(<AnsiView chrome="file" text={text} />);
    type("hit");
    await counterReads("1 / 10,000");
    fireEvent.click(
      screen.getByRole("button", { name: "Only matching lines" }),
    );
    // Every reading moves past the slice budget, so the list refills a chunk
    // of lines at a time.
    let clock = performance.now();
    vi.spyOn(performance, "now").mockImplementation(() => (clock += 10));
    let mounted = 0;
    const observer = new MutationObserver(() => {
      mounted = Math.max(mounted, rows(container).length);
    });
    observer.observe(container, { childList: true, subtree: true });
    try {
      type("hit ");
      await counterReads("1 / 10,000");
    } finally {
      observer.disconnect();
      vi.mocked(performance.now).mockRestore();
    }
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(200);
  }, 20_000);

  it("matches case-insensitively unless Aa is on, and by regex with .*", async () => {
    renderLog();
    type("info");
    await counterReads("1 / 3");
    fireEvent.click(screen.getByRole("button", { name: "Match case" }));
    await counterReads("1 / 1");
    type("w[a-z]+ing");
    await counterReads("0 / 0");
    fireEvent.click(screen.getByRole("button", { name: "Regular expression" }));
    await counterReads("1 / 1");
  });

  it("says Invalid regex, with aria-invalid", async () => {
    renderLog();
    fireEvent.click(screen.getByRole("button", { name: "Regular expression" }));
    type("(");
    await counterReads("Invalid regex");
    expect(searchBox().getAttribute("aria-invalid")).toBe("true");
    type("x");
    await waitFor(() =>
      expect(searchBox().hasAttribute("aria-invalid")).toBe(false),
    );
  });

  it("does not search the levels the filter hides", async () => {
    renderLog();
    type("conn");
    await counterReads("1 / 2");
    fireEvent.click(chip("TRACE"));
    await counterReads("1 / 1");
  });

  it("shows only matching lines with the toggle", async () => {
    const { container } = renderLog();
    type("pool");
    await waitFor(() => expect(counter().textContent).toMatch(/ \/ 9$/), {
      timeout: 5_000,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Only matching lines" }),
    );
    expect(lineIds(container)).toEqual([3, 4, 10, 11, 15, 20]);
    expect(screen.getByText("6 of 26 lines")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Only matching lines" }),
    );
    expect(rows(container)).toHaveLength(26);
  });

  it("goes to a match near the end of a 100k-line log", async () => {
    const lines = Array.from({ length: 100_000 }, (_, i) =>
      i === 99_000 || i === 99_500
        ? `${"x".repeat(300)} INFO needle ${i}`
        : `line ${i}`,
    );
    const { container } = render(
      <AnsiView
        chrome="file"
        maxHeight="400px"
        levels
        text={lines.join("\n")}
      />,
    );
    expect(lineIds(container)).not.toContain(99_000);
    type("needle");
    await counterReads("1 / 2");
    const target = row(container, 99_000);
    expect(target.querySelector("[data-match='current']")?.textContent).toBe(
      "needle",
    );
    // The match sits past the viewport's width, so the view scrolls to it.
    const region = screen.getByRole("region");
    expect(region.scrollLeft).toBeGreaterThan(0);
    fireEvent.keyDown(searchBox(), { key: "Enter" });
    await waitFor(() =>
      expect(
        row(container, 99_500).querySelector("[data-match='current']"),
      ).toBeTruthy(),
    );
    // Mid-viewport: 10 rows of 20 above it.
    const mounted = lineIds(container);
    expect(mounted).toContain(99_490);
    expect(mounted).toContain(99_509);
  }, 20_000);

  it("goes to the first match at or below the top line", async () => {
    const text = Array.from({ length: 400 }, (_, i) =>
      i % 100 === 50 ? `hit ${i}` : `line ${i}`,
    ).join("\n");
    render(<AnsiView chrome="file" text={text} />);
    const region = screen.getByRole("region");
    region.scrollTop = PADDING + 200 * 20;
    fireEvent.scroll(region);
    type("hit");
    await counterReads("3 / 4");
  });

  it("finds a match on a wrapped row", async () => {
    const text = `${Array.from({ length: 100 }, (_, i) => `l${i}`).join("\n")}\n${"y".repeat(250)}needle`;
    const { container } = render(<AnsiView chrome="file" wrap text={text} />);
    type("needle");
    await counterReads("1 / 1");
    const marked = container.querySelector("[data-match='current']");
    expect(marked?.closest("[data-line]")?.getAttribute("data-from")).not.toBe(
      "0",
    );
  });
});

describe("filtered copy", () => {
  it("the Copy button copies the shown lines only", () => {
    renderLog();
    fireEvent.click(chip("INFO"), { shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Copy output" }));
    expect(copyToClipboard).toHaveBeenCalledWith(
      [PLAIN[0], PLAIN[2], PLAIN[12], PLAIN[15]].join("\n"),
      "Copied output",
    );
  });

  it("a selection copy skips hidden lines", () => {
    const { container } = renderLog();
    fireEvent.click(chip("ERROR"));
    const start = row(container, 3).querySelector("[data-text]") as Node;
    const end = row(container, 13).querySelector("[data-text]") as Node;
    const range = document.createRange();
    range.setStart(start, 0);
    range.setEnd(end, 0);
    const selection = window.getSelection() as Selection;
    selection.removeAllRanges();
    selection.addRange(range);
    const setData = vi.fn();
    fireEvent.copy(screen.getByRole("region", { name: "server.log" }), {
      clipboardData: { setData },
    });
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      [PLAIN[3], PLAIN[4], PLAIN[12], ""].join("\n"),
    );
  });
});

describe("anchoring", () => {
  // Odd lines are info, even lines error.
  const alternating = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      i % 2 ? `INFO line ${i}` : `ERROR line ${i}`,
    ).join("\n");

  const topRow = (region: HTMLElement) =>
    Math.round((region.scrollTop - PADDING) / 20);

  it("keeps the top line in place when a chip hides others", () => {
    const { container } = renderLog(alternating(200));
    const region = screen.getByRole("region");
    region.scrollTop = PADDING + 101 * 20;
    fireEvent.scroll(region);
    fireEvent.click(chip("ERROR"));
    expect(lineIds(container)[50]).toBe(101);
    expect(topRow(region)).toBe(50);
  });

  it("moves to the next shown line when the top one is hidden", () => {
    const { container } = renderLog(alternating(200));
    const region = screen.getByRole("region");
    region.scrollTop = PADDING + 100 * 20;
    fireEvent.scroll(region);
    fireEvent.click(chip("ERROR"));
    expect(lineIds(container)[50]).toBe(101);
    expect(topRow(region)).toBe(50);
    fireEvent.click(chip("ERROR"));
    expect(topRow(region)).toBe(101);
  });

  it("keeps the top line under StrictMode", () => {
    const { container } = render(
      <StrictMode>
        <AnsiView chrome="file" levels text={alternating(200)} />
      </StrictMode>,
    );
    const region = screen.getByRole("region");
    region.scrollTop = PADDING + 101 * 20;
    fireEvent.scroll(region);
    fireEvent.click(chip("ERROR"));
    expect(lineIds(container)[50]).toBe(101);
    expect(topRow(region)).toBe(50);
  });

  it("keeps the top line in a virtualised log", () => {
    const { container } = renderLog(alternating(20_000));
    const region = screen.getByRole("region");
    region.scrollTop = PADDING + 5001 * 20;
    fireEvent.scroll(region);
    fireEvent.click(chip("ERROR"));
    expect(screen.getByText("10,000 of 20,000 lines")).toBeTruthy();
    expect(topRow(region)).toBe(2500);
    expect(lineIds(container)).toContain(5001);
    fireEvent.click(chip("ERROR"));
    expect(topRow(region)).toBe(5001);
  });

  it("keeps the top line through a filter that hides every line", () => {
    const { container } = renderLog(alternating(200));
    const region = screen.getByRole("region");
    region.scrollTop = PADDING + 101 * 20;
    fireEvent.scroll(region);
    fireEvent.click(chip("ERROR"));
    fireEvent.click(chip("INFO"));
    expect(rows(container)).toHaveLength(0);
    fireEvent.click(chip("ERROR"));
    // Line 101 is hidden now; the next shown one takes its place.
    expect(lineIds(container)[topRow(region)]).toBe(102);
  });

  it("keeps the top line when a query with only matching lines is refined", async () => {
    // Every 10th line matches "food", the other even ones only "foo".
    const text = Array.from({ length: 400 }, (_, i) =>
      i % 10 === 0 ? `food ${i}` : i % 2 ? `bar ${i}` : `foo ${i}`,
    ).join("\n");
    const { container } = render(<AnsiView chrome="file" text={text} />);
    type("foo");
    await counterReads("1 / 200");
    fireEvent.click(
      screen.getByRole("button", { name: "Only matching lines" }),
    );
    const region = screen.getByRole("region");
    region.scrollTop = PADDING + 100 * 20;
    fireEvent.scroll(region);
    type("food");
    await counterReads("21 / 40");
    expect(lineIds(container)[topRow(region)]).toBe(200);
  });
});
