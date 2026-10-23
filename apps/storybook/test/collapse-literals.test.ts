import { describe, expect, it } from "vitest";
import { collapseLongLiterals } from "../.storybook/collapse-literals.ts";

// Storybook runs the transform twice on a dynamic snippet, so every case also
// checks that a second pass changes nothing.
function collapse(code: string): string {
  const once = collapseLongLiterals(code);
  expect(collapseLongLiterals(once)).toBe(once);
  return once;
}

const LINES = Array.from(
  { length: 30 },
  (_, i) => `line ${i} fetch resolve module chunk worker cache`,
);

describe("collapseLongLiterals", () => {
  it("leaves short snippets alone", () => {
    const code = '<Button variant="outline" size="sm">Save</Button>';
    expect(collapse(code)).toBe(code);
  });

  it("cuts a long dynamic string prop to its first line", () => {
    const code = `<AnsiView\n  chrome="pane"\n  text="${LINES.join("\n")}"\n/>`;
    expect(collapse(code)).toBe(
      `<AnsiView\n  chrome="pane"\n  text="${LINES[0]}…"\n/>`,
    );
  });

  it("cuts a static string at its first escaped newline", () => {
    const code = `{\n  args: {\n    text: "a\\nb${"b".repeat(200)}"\n  }\n}`;
    expect(collapse(code)).toBe(`{\n  args: {\n    text: "a…"\n  }\n}`);
  });

  it("cuts a template literal in a static render", () => {
    const code = `{\n  render: () => <Markdown>{\`# Title\n${LINES.join("\n")}\`}</Markdown>\n}`;
    expect(collapse(code)).toBe(
      "{\n  render: () => <Markdown>{`# Title…`}</Markdown>\n}",
    );
  });

  it("cuts a wrapped JSX text child that holds backticks and braces", () => {
    const code = `<Markdown>\n  {\`# Title {x}\n${LINES.join("\n")}\n\`\`\`ts\nconst x = {};\n\`\`\`}\n</Markdown>`;
    expect(collapse(code)).toBe("<Markdown>\n  {`# Title {x}…`}\n</Markdown>");
  });

  it("cuts bare JSX text and keeps the whitespace around it", () => {
    const code = `<Markdown>\n  # Release notes\n${LINES.join("\n")}\n</Markdown>`;
    expect(collapse(code)).toBe("<Markdown>\n  # Release notes…\n</Markdown>");
  });

  it("keeps at most 80 characters of a single long line", () => {
    const code = `<Code text="${"a".repeat(200)}" />`;
    expect(collapse(code)).toBe(`<Code text="${"a".repeat(80)}…" />`);
  });

  it("drops a backslash left dangling at the cut", () => {
    const code = `"${"x".repeat(79)}\\\\${"y".repeat(100)}"`;
    expect(collapse(code)).toBe(`"${"x".repeat(79)}…"`);
  });

  it("reads an apostrophe in prose as JSX text, not as a string", () => {
    const text = "It's a long paragraph, and here's more of it. "
      .repeat(4)
      .trim();
    expect(text.length).toBeGreaterThan(170);
    expect(collapse(`<p>${text}</p>`)).toBe(
      `<p>${text.slice(0, 80).trimEnd()}…</p>`,
    );
  });

  it("keeps 160 characters and cuts 161", () => {
    const kept = `<A title="${"a".repeat(160)}" />`;
    expect(collapse(kept)).toBe(kept);
    expect(collapse(`<A title="${"a".repeat(161)}" />`)).toBe(
      `<A title="${"a".repeat(80)}…" />`,
    );
  });

  it("cuts a single-quoted string inside an array prop", () => {
    expect(collapse(`<List items={[{name: '${"q".repeat(200)}'}]} />`)).toBe(
      `<List items={[{name: '${"q".repeat(80)}…'}]} />`,
    );
  });

  it("leaves code after an arrow or a type argument alone", () => {
    const args = Array.from({ length: 40 }, (_, i) => `arg${i}`).join(", ");
    const arrow = `{\n  render: () => useThing(${args}) && <X />\n}`;
    expect(collapse(arrow)).toBe(arrow);
    const generic = `const [v, setV] = useState<string>(${"fallback ?? ".repeat(20)}"x");\n    return <Input value={v} />`;
    expect(collapse(generic)).toBe(generic);
  });

  it("cuts JSX text after a tag whose props sit on their own lines", () => {
    const code = `<Markdown\n  className="prose"\n>\n  # Notes\n${LINES.join("\n")}\n</Markdown>`;
    expect(collapse(code)).toBe(
      '<Markdown\n  className="prose"\n>\n  # Notes…\n</Markdown>',
    );
  });

  it("cuts JSX text after a bare attribute and after a self-closing tag", () => {
    const text = LINES.join("\n");
    expect(collapse(`<Dialog open>${text}</Dialog>`)).toBe(
      `<Dialog open>${LINES[0]}…</Dialog>`,
    );
    expect(collapse(`<p><br />${text}</p>`)).toBe(`<p><br />${LINES[0]}…</p>`);
  });

  it("cuts a literal of several megabytes without overflowing the stack", () => {
    const text = LINES.join("\n").repeat(10_000);
    expect(collapse(`<AnsiView text="${text}" />`)).toBe(
      `<AnsiView text="${LINES[0]}…" />`,
    );
    expect(collapse(`const log = \`${text}\`;`)).toBe(
      `const log = \`${LINES[0]}…\`;`,
    );
    expect(collapse(`const log = '${text.replaceAll("\n", "\\n")}';`)).toBe(
      `const log = '${LINES[0]}…';`,
    );
  });
});
