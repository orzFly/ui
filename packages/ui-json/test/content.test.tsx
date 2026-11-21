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
import { yamlContent } from "../src/yaml-content.tsx";

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

function mountYaml(source: ContentSource) {
  return render(
    <ContentRenderers renderers={[jsonContent, yamlContent, codeContent]}>
      <Content source={source} placement="viewer" />
    </ContentRenderers>,
  );
}

describe("yamlContent", () => {
  it("accepts YAML by name and by type, in the viewer only", () => {
    for (const name of ["a.yaml", "B.YML", "ci.yml"]) {
      expect(yamlContent.accepts(file(name, ""), "viewer")).toBe(true);
    }
    for (const mime of [
      "application/yaml",
      "application/x-yaml; charset=utf-8",
      "text/yaml",
      "text/x-yaml",
    ]) {
      expect(yamlContent.accepts(file("payload", "", { mime }), "viewer")).toBe(
        true,
      );
    }
    expect(yamlContent.accepts(file("a.yaml", ""), "document")).toBe(false);
    expect(yamlContent.accepts(file("a.json", ""), "viewer")).toBe(false);
    expect(yamlContent.accepts(file("a.yamlx", ""), "viewer")).toBe(false);
    expect(
      yamlContent.accepts(file("a.yaml", "", { deleted: true }), "viewer"),
    ).toBe(false);
    expect(
      yamlContent.accepts(
        { kind: "inline", text: "a: 1", lang: "yaml" },
        "viewer",
      ),
    ).toBe(false);
  });

  it("draws a file that parses as a tree", async () => {
    mountYaml(file("ci.yml", "a: 1 # one\nb: [x, y]\n"));
    expect((await screen.findByTestId("tree")).textContent).toBe(
      '{"a":1,"b":["x","y"]}',
    );
  });

  it("shows a file that does not parse as text, under the error", async () => {
    mountYaml(file("ci.yaml", "a: 1\n b: 2\n"));
    expect((await screen.findByTestId("code")).textContent).toBe("ci.yaml");
    expect(screen.getByRole("status").textContent).toMatch(
      /^Not valid YAML: .+ at line 1, column 4$/,
    );
  });

  it("leaves a file over 2 MB to the renderers after it, without reading it", async () => {
    const load = vi.fn(async () => "a: 1\n");
    mountYaml(file("big.yaml", "", { size: 2 * 1024 * 1024 + 1, load }));
    expect((await screen.findByTestId("code")).textContent).toBe("big.yaml");
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByTestId("tree")).toBeNull();
  });

  it("leaves a file of unknown size whose text is over 2 MB to the renderers after it", async () => {
    mountYaml(file("big.yaml", `a: "${"x".repeat(2 * 1024 * 1024)}"\n`));
    expect((await screen.findByTestId("code")).textContent).toBe("big.yaml");
    expect(screen.queryByTestId("tree")).toBeNull();
  });
});
