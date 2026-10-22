import {
  type CompiledQuerySchema,
  defineQuerySchema,
  parseQuery,
  type ValueProviders,
} from "@orz/query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  todouQualifiers,
  todouSchema,
} from "../../query/test/fixtures/todou-schema.ts";
import { highlightQuery } from "../src/components/query-highlight.tsx";

const KNOWN: ValueProviders = {
  label: { options: [{ value: "area:web" }, { value: "kind:bug" }] },
  status: { options: [{ value: "Todo" }, { value: "In Progress" }] },
  member: { options: [{ value: "alice" }] },
};

const bracesSchema = defineQuerySchema({ ...todouQualifiers, braces: true });
const shellSchema = defineQuerySchema({
  ...todouQualifiers,
  escapes: "shell",
  braces: true,
});

function mirror(
  q: string,
  schema: CompiledQuerySchema = todouSchema,
  known: ValueProviders = KNOWN,
): HTMLElement {
  // A wrapper, not a fragment: the spans are what gets queried, and render()
  // needs one element to put them in.
  const { container } = render(
    <div>{highlightQuery(q, parseQuery(schema, q), schema, known)}</div>,
  );
  return container.firstElementChild as HTMLElement;
}

/** The mirror's spans, as `[text, className]`, in document order. */
function spans(
  q: string,
  known: ValueProviders = KNOWN,
  schema: CompiledQuerySchema = todouSchema,
): Array<[string, string]> {
  return [...mirror(q, schema, known).querySelectorAll("span")].map((s) => [
    s.textContent ?? "",
    s.getAttribute("class") ?? "",
  ]);
}

/** The top-level spans only: shell mode nests its quoting inside a value. */
function outer(
  q: string,
  schema: CompiledQuerySchema,
  known: ValueProviders = KNOWN,
): Array<[string, string]> {
  return [...mirror(q, schema, known).children].map((s) => [
    s.textContent ?? "",
    s.getAttribute("class") ?? "",
  ]);
}

describe("the mirror layer", () => {
  it("reproduces the query character for character", () => {
    for (const q of [
      "部署",
      "harness:codex is:comment 部署",
      '-label:"kind:bug",area:web 慢',
      "status:",
      'ab"cd"',
      "  a\tb  ",
    ]) {
      expect(spans(q).reduce((all, [text]) => all + text, "")).toBe(q);
    }
  });

  it("adds nothing that could take up width", () => {
    // Any padding, margin or border in here slides the mirror out of step
    // with the input it lies under, and the caret with it.
    for (const [, className] of spans('-label:"kind:bug",area:web 慢')) {
      expect(className).not.toMatch(/\b(p|m|border)[xytrbl]?-/);
    }
  });

  it("colours the key, the punctuation and the value apart", () => {
    expect(spans("harness:codex")).toEqual([
      ["harness", expect.stringContaining("text-primary")],
      [":", expect.stringContaining("text-muted-foreground")],
      ["codex", expect.any(String)],
    ]);
  });

  it("marks a value the project does not have", () => {
    const [, , value] = spans("label:不存在");
    expect(value?.[0]).toBe("不存在");
    expect(value?.[1]).toMatch(/decoration-wavy/);
  });

  it("leaves an unknown key looking like the plain text it is", () => {
    expect(spans("kind:bug")).toEqual([["kind:bug", ""]]);
    expect(spans("https://example.com")).toEqual([["https://example.com", ""]]);
  });
});

describe("value verdicts", () => {
  const valueClass = (q: string, known: ValueProviders = KNOWN) =>
    spans(q, known).at(-1)?.[1] ?? "";

  it("resolves a closed set without asking the app", () => {
    expect(valueClass("is:comments", {})).toContain("bg-primary/12");
    expect(valueClass("is:pr", {})).toContain("decoration-wavy");
    expect(valueClass("state:OPEN", {})).toContain("bg-primary/12");
  });

  it("knows the values that stand for themselves", () => {
    expect(valueClass("assignee:@me")).toContain("bg-violet-500/15");
    expect(valueClass("harness:none", {})).toContain("bg-violet-500/15");
  });

  it("compares a provided name case-insensitively", () => {
    expect(valueClass('status:"in progress"')).toContain("bg-primary/12");
    expect(valueClass("label:AREA:WEB")).toContain("bg-primary/12");
    expect(valueClass("label:nope")).toContain("decoration-wavy");
  });

  it("stays quiet while the names are still loading", () => {
    // Flashing every value amber and back as the labels arrive is worse than
    // being briefly non-committal.
    expect(valueClass("label:anything", {})).not.toContain("decoration-wavy");
    expect(
      valueClass("label:anything", { label: { options: undefined } }),
    ).not.toContain("decoration-wavy");
    // A free-form key has no list to wait for.
    expect(valueClass("harness:whatever", {})).toContain("bg-primary/12");
    expect(valueClass("session:abc", {})).toContain("bg-primary/12");
  });
});

describe("braces", () => {
  it("paints a group as one span in its worst expansion's colour", () => {
    expect(spans("label:{area:web,kind:bug}", KNOWN, bracesSchema)).toEqual([
      ["label", expect.stringContaining("text-primary")],
      [":", expect.stringContaining("text-muted-foreground")],
      ["{area:web,kind:bug}", expect.stringContaining("bg-primary/12")],
    ]);
    const [, , mixed] = spans("assignee:{@me,alice}", KNOWN, bracesSchema);
    expect(mixed?.[1]).toContain("bg-violet-500/15");
    const [, , bad] = spans("label:{area:web,nope}", KNOWN, bracesSchema);
    expect(bad?.[0]).toBe("{area:web,nope}");
    expect(bad?.[1]).toContain("decoration-wavy");
  });

  it("marks an expansion over the limit", () => {
    const q = `harness:{a,b,c,d}{a,b,c,d}{a,b,c,d,e}`;
    const [, , value] = spans(q, KNOWN, bracesSchema);
    expect(value?.[0]).toBe("{a,b,c,d}{a,b,c,d}{a,b,c,d,e}");
    expect(value?.[1]).toContain("decoration-wavy");
  });
});

describe("shell mode", () => {
  it("mutes quotes and backslashes inside the value's own span", () => {
    const q = `status:"In Progress",'Todo' label:area\\:web`;
    const top = outer(q, shellSchema);
    expect(top.map(([text]) => text)).toEqual([
      "status",
      ":",
      '"In Progress"',
      ",",
      "'Todo'",
      " ",
      "label",
      ":",
      "area\\:web",
    ]);
    expect(top[2]?.[1]).toContain("bg-primary/12");
    expect(top[8]?.[1]).toContain("bg-primary/12");

    const inner = (index: number) =>
      [...(mirror(q, shellSchema).children[index]?.children ?? [])].map((s) => [
        s.textContent,
        s.getAttribute("class") ?? "",
      ]);
    expect(inner(2)).toEqual([
      ['"', "text-muted-foreground"],
      ["In Progress", ""],
      ['"', "text-muted-foreground"],
    ]);
    expect(inner(8)).toEqual([
      ["area", ""],
      ["\\", "text-muted-foreground"],
      [":web", ""],
    ]);
  });

  it("mutes the backslashes a double-quoted value spends on escapes", () => {
    const q = `harness:"a\\"b"`;
    const value = mirror(q, shellSchema).children[2];
    expect(
      [...(value?.children ?? [])].map((s) => [
        s.textContent,
        s.getAttribute("class") ?? "",
      ]),
    ).toEqual([
      ['"', "text-muted-foreground"],
      ["a", ""],
      ["\\", "text-muted-foreground"],
      ['"b', ""],
      ['"', "text-muted-foreground"],
    ]);
  });
});

describe("tiling", () => {
  it("concatenates back to the input for a mixed corpus in every mode", () => {
    const corpus = [
      "",
      "部署 失败",
      'label:"kind:bug",area:web -state:closed "部署 失败"',
      "label:{area:web,kind:bug},@me x{a,b}",
      "label:{a, b} {,}",
      "status:'In Progress' don\\'t \"unclosed",
      `harness:"a\\"b",c\\,d label:'open`,
      "assignee:,, -meta:ns/key=v https://example.com 12:30",
      "  \t ",
      'C:\\temp ab"cd ef"gh',
    ];
    for (const schema of [todouSchema, bracesSchema, shellSchema]) {
      for (const q of corpus) {
        expect(mirror(q, schema).textContent).toBe(q);
        expect(
          outer(q, schema)
            .map(([text]) => text)
            .join(""),
        ).toBe(q);
      }
    }
  });
});
