import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
  ContentTitleBar,
} from "@orz/ui-content";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MARKDOWN_RENDER_MAX_CHARS, markdownContent } from "../src/index.ts";

/** Stands in for `codeContent`: what draws the markdown as written. */
const source: ContentRenderer = {
  name: "source",
  accepts: (s) => s.kind === "file",
  Component: ({ source: s }) => (
    <pre data-testid="source">{s.kind === "file" ? s.name : ""}</pre>
  ),
};

const RENDERERS = [markdownContent(), source];

const doc = (text: string): ContentSource => ({
  kind: "file",
  name: "notes.md",
  load: async () => text,
});

/** A surface lending its title bar, as the viewer and the embed card do. */
function Surface({ file }: { file: ContentSource }) {
  const [bar, setBar] = useState<HTMLElement | null>(null);
  return (
    <ContentRenderers renderers={RENDERERS}>
      <div data-testid="bar" ref={setBar} />
      <ContentTitleBar source={file} target={bar}>
        <Content source={file} placement="viewer" />
      </ContentTitleBar>
    </ContentRenderers>
  );
}

const settle = () => act(async () => {});
const toggle = () => screen.getByRole("button", { name: "source" });

describe("markdownContent's source toggle", () => {
  it("sits in the lent title bar and swaps the rendered document for its source", async () => {
    render(<Surface file={doc("# Title")} />);
    await settle();
    expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
    expect(screen.getByTestId("bar").contains(toggle())).toBe(true);
    expect(toggle().getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(toggle());
    expect(screen.getByTestId("source").textContent).toBe("notes.md");
    expect(screen.queryByRole("heading")).toBeNull();
    expect(toggle().getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(toggle());
    expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
  });

  it("opens a document over the limit as its source, and renders it on request", async () => {
    const large = `# Big\n\n${"x".repeat(MARKDOWN_RENDER_MAX_CHARS)}`;
    render(<Surface file={doc(large)} />);
    await settle();
    expect(screen.getByTestId("source")).toBeTruthy();
    expect(screen.getByText("Too large to render automatically.")).toBeTruthy();
    expect(screen.queryByRole("heading")).toBeNull();

    fireEvent.click(toggle());
    expect(screen.getByRole("heading", { name: "Big" })).toBeTruthy();
  });

  it("draws no toggle for a small document no surface lends a title bar", async () => {
    render(
      <ContentRenderers renderers={RENDERERS}>
        <Content source={doc("# Title")} placement="document" />
      </ContentRenderers>,
    );
    await settle();
    expect(screen.getByRole("heading", { name: "Title" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "source" })).toBeNull();
  });

  it("puts the toggle above a large document no surface lends a title bar", async () => {
    render(
      <ContentRenderers renderers={RENDERERS}>
        <Content
          source={doc("x".repeat(MARKDOWN_RENDER_MAX_CHARS + 1))}
          placement="document"
        />
      </ContentRenderers>,
    );
    await settle();
    expect(screen.getByTestId("source")).toBeTruthy();
    expect(toggle()).toBeTruthy();
  });
});
