import {
  Content,
  type ContentProps,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
} from "@orz/ui-content";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { jsonContent } from "../src/content.tsx";
import type { JsonDocument } from "../src/types.ts";

// The view has tests of its own; here it only shows what it was handed.
vi.mock("../src/json-view.tsx", () => ({
  JsonView: ({ document }: { document: JsonDocument }) => (
    <div data-testid="tree">{JSON.stringify(document.value)}</div>
  ),
}));

/** What the renderers after this one draw: the text, as a code renderer would. */
const codeContent: ContentRenderer = {
  name: "code",
  accepts: () => true,
  Component: ({ source }: ContentProps) => (
    <pre data-testid="code">{source.kind === "file" ? source.name : ""}</pre>
  ),
};

const file = (
  name: string,
  text: string,
  overrides: Partial<Extract<ContentSource, { kind: "file" }>> = {},
): ContentSource => ({
  kind: "file",
  name,
  load: async () => text,
  ...overrides,
});

function mount(source: ContentSource) {
  return render(
    <ContentRenderers renderers={[jsonContent, codeContent]}>
      <Content source={source} placement="viewer" />
    </ContentRenderers>,
  );
}

describe("jsonContent", () => {
  it("accepts JSON, JSONC and JSON5 by name, and JSON by type, in the viewer only", () => {
    for (const name of ["a.json", "B.JSONC", "c.json5"]) {
      expect(jsonContent.accepts(file(name, ""), "viewer")).toBe(true);
    }
    for (const mime of [
      "application/json",
      "application/ld+json; charset=utf-8",
    ]) {
      expect(jsonContent.accepts(file("payload", "", { mime }), "viewer")).toBe(
        true,
      );
    }
    expect(jsonContent.accepts(file("a.json", ""), "document")).toBe(false);
    expect(jsonContent.accepts(file("a.txt", ""), "viewer")).toBe(false);
    expect(
      jsonContent.accepts(file("a.json", "", { deleted: true }), "viewer"),
    ).toBe(false);
    expect(
      jsonContent.accepts(
        { kind: "inline", text: "{}", lang: "json" },
        "viewer",
      ),
    ).toBe(false);
  });

  it("draws a file that parses as a tree, in the dialect its name says", async () => {
    mount(file("config.json5", "{a: 1, // one\n}"));
    expect((await screen.findByTestId("tree")).textContent).toBe('{"a":1}');
  });

  it("shows a file that does not parse as text, under the error", async () => {
    mount(file("config.json", '{"a": 1,}'));
    expect((await screen.findByTestId("code")).textContent).toBe("config.json");
    expect(screen.getByRole("status").textContent).toBe(
      "Not valid JSON: Trailing commas are not allowed in JSON at line 1, column 8",
    );
  });
});
