import { render } from "@testing-library/react";
import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";

import {
  detectLevel,
  LEVEL_INHERITED,
  LEVELS,
  levelCode,
} from "../../src/parse/levels.ts";
import { parseAnsi } from "../../src/parse/parser.ts";
import { AnsiRow, type AnsiRowProps } from "../../src/view/row.tsx";
import { createStyleCache } from "../../src/view/run-style.ts";

function renderLine(
  source: string,
  props: Partial<AnsiRowProps> & { detect?: boolean } = {},
) {
  const { lines, styles } = parseAnsi(source);
  const line = lines[0];
  const cache = createStyleCache(styles);
  const styleOf = (id: number): CSSProperties => cache(id, false);
  const { detect, ...rest } = props;
  const match = detect ? detectLevel(line.text) : undefined;
  const { container } = render(
    <AnsiRow
      lineIndex={0}
      line={line}
      from={0}
      to={line.text.length}
      styles={styles}
      styleOf={styleOf}
      gutterDigits={0}
      level={match ? levelCode(match.level) : 0}
      levelMatch={match}
      {...rest}
    />,
  );
  const row = container.querySelector<HTMLElement>("[data-line]");
  if (!row) throw new Error("no row");
  const text = row.querySelector<HTMLElement>("[data-text]");
  if (!text) throw new Error("no text");
  const fragments = [...text.children] as HTMLElement[];
  return { row, text, fragments, line };
}

const parts = (fragments: HTMLElement[]) => fragments.map((f) => f.textContent);

describe("AnsiRow levels", () => {
  it.each(LEVELS)("marks a %s line", (level) => {
    const { row } = renderLine("x", { level: levelCode(level) });
    expect(row.dataset.level).toBe(level);
    expect(row.hasAttribute("data-inherited")).toBe(false);
  });

  it("marks an inherited line", () => {
    const { row } = renderLine("    at db.example.Pool.acquire", {
      level: levelCode("error") | LEVEL_INHERITED,
    });
    expect(row.dataset.level).toBe("error");
    expect(row.hasAttribute("data-inherited")).toBe(true);
  });

  it("leaves a line without a level unmarked", () => {
    const { row } = renderLine("Done in 3.2s.");
    expect(row.hasAttribute("data-level")).toBe(false);
    expect(row.hasAttribute("data-inherited")).toBe(false);
    expect(row.hasAttribute("data-coloured")).toBe(false);
  });

  it("cuts the level word out of a plain line", () => {
    const { fragments, text, line } = renderLine(
      "09:14:03.007 WARN [pool-1] slow query on db.example",
      { detect: true },
    );
    expect(parts(fragments)).toEqual([
      "09:14:03.007 ",
      "WARN",
      " [pool-1] slow query on db.example",
    ]);
    expect(fragments.map((f) => f.hasAttribute("data-level-word"))).toEqual([
      false,
      true,
      false,
    ]);
    expect(text.textContent).toBe(line.text);
  });

  it("colours only the part of the word inside a wrapped row", () => {
    const { fragments, text } = renderLine("[error] host-one down", {
      detect: true,
      from: 3,
      to: 10,
    });
    expect(parts(fragments)).toEqual(["ror", "] ho"]);
    expect(fragments[0].hasAttribute("data-level-word")).toBe(true);
    expect(text.textContent).toBe("ror] ho");
  });

  it("leaves a coloured line's word and run colours alone", () => {
    const { row, fragments } = renderLine(
      "\x1b[31mERROR\x1b[0m connect to host-one",
      {
        detect: true,
      },
    );
    expect(row.dataset.level).toBe("error");
    expect(row.hasAttribute("data-coloured")).toBe(true);
    expect(row.querySelector("[data-level-word]")).toBeNull();
    expect(parts(fragments)).toEqual(["ERROR", " connect to host-one"]);
    expect(fragments[0].style.color).toBe("var(--ansi-red)");
  });

  it("counts inverse as coloured, and bold as not", () => {
    expect(
      renderLine("\x1b[7mWARN\x1b[0m x", { detect: true }).row.hasAttribute(
        "data-coloured",
      ),
    ).toBe(true);
    expect(
      renderLine("\x1b[1mWARN\x1b[0m x", { detect: true }).row.hasAttribute(
        "data-coloured",
      ),
    ).toBe(false);
  });
});

describe("AnsiRow marks", () => {
  it("splits a plain run around a mark", () => {
    const { fragments } = renderLine("GET app.example/health 200", {
      marks: [[4, 15, false]],
    });
    expect(parts(fragments)).toEqual(["GET ", "app.example", "/health 200"]);
    expect(fragments.map((f) => f.dataset.match)).toEqual([
      undefined,
      "",
      undefined,
    ]);
  });

  it("marks the current match apart", () => {
    const { fragments } = renderLine("ab ab ab", {
      marks: [
        [0, 2, false],
        [3, 5, true],
        [6, 8, false],
      ],
    });
    expect(fragments.map((f) => [f.textContent, f.dataset.match])).toEqual([
      ["ab", ""],
      [" ", undefined],
      ["ab", "current"],
      [" ", undefined],
      ["ab", ""],
    ]);
  });

  it("splits a mark that spans two runs, keeping each run's style", () => {
    const { fragments, text, line } = renderLine(
      "plain \x1b[32mgreen\x1b[0m tail",
      { marks: [[3, 8, false]] },
    );
    expect(parts(fragments)).toEqual(["pla", "in ", "gr", "een", " tail"]);
    expect(fragments.map((f) => f.dataset.match)).toEqual([
      undefined,
      "",
      "",
      undefined,
      undefined,
    ]);
    expect(fragments[2].style.color).toBe("var(--ansi-green)");
    expect(fragments[1].style.color).toBe("");
    expect(text.textContent).toBe(line.text);
  });

  it("splits a mark overlapping the level word", () => {
    const { fragments } = renderLine("ERROR on host-one", {
      detect: true,
      marks: [[3, 8, true]],
    });
    expect(
      fragments.map((f) => [
        f.textContent,
        f.hasAttribute("data-level-word"),
        f.dataset.match,
      ]),
    ).toEqual([
      ["ERR", true, undefined],
      ["OR", true, "current"],
      [" on", false, "current"],
      [" host-one", false, undefined],
    ]);
  });

  it("skips marks outside the row and clips those crossing it", () => {
    const { fragments, text } = renderLine("abcdefghij", {
      from: 4,
      to: 8,
      marks: [
        [0, 2, false],
        [3, 5, false],
        [7, 10, false],
      ],
    });
    expect(fragments.map((f) => [f.textContent, f.dataset.match])).toEqual([
      ["e", ""],
      ["fg", undefined],
      ["h", ""],
    ]);
    expect(text.textContent).toBe("efgh");
  });

  it("finds a row's marks among many on a long line", () => {
    const marks = Array.from(
      { length: 500 },
      (_, i) => [i * 2, i * 2 + 1, i === 301] as const,
    );
    const { fragments, text } = renderLine("a".repeat(1000), {
      from: 601,
      to: 605,
      marks,
    });
    expect(fragments.map((f) => [f.textContent, f.dataset.match])).toEqual([
      ["a", undefined],
      ["a", "current"],
      ["a", undefined],
      ["a", ""],
    ]);
    expect(text.textContent).toBe("aaaa");
  });

  it("keeps a link as a link inside a mark", () => {
    const { fragments } = renderLine(
      "\x1b]8;;https://example.com/\x07docs\x1b]8;;\x07 page",
      { marks: [[1, 3, false]] },
    );
    expect(fragments.map((f) => [f.tagName, f.textContent])).toEqual([
      ["A", "d"],
      ["A", "oc"],
      ["A", "s"],
      ["SPAN", " page"],
    ]);
    expect(fragments[1].dataset.match).toBe("");
  });
});

describe("AnsiRow gaps", () => {
  it("marks the first row of a line after a gap", () => {
    expect(renderLine("abc", { gap: true }).row.hasAttribute("data-gap")).toBe(
      true,
    );
  });

  it("leaves a wrapped line's later rows and an ungapped line unmarked", () => {
    expect(
      renderLine("abcdef", { gap: true, from: 3, to: 6 }).row.hasAttribute(
        "data-gap",
      ),
    ).toBe(false);
    expect(renderLine("abc").row.hasAttribute("data-gap")).toBe(false);
  });
});
