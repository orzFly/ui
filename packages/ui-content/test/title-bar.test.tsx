import { render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { describe, expect, it } from "vitest";
import { attachmentCard } from "../src/attachment/index.ts";
import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
  useContentTitleBar,
} from "../src/index.ts";

/** Portals a "tool" button into the title bar it is lent, or draws "no bar". */
const tools: ContentRenderer = {
  name: "tools",
  accepts: (source) => source.kind === "inline" || source.name.endsWith(".t"),
  Component: ({ source }) => {
    const bar = useContentTitleBar(source);
    const label = source.kind === "inline" ? source.text : source.name;
    if (bar === undefined) return <span>no bar for {label}</span>;
    return bar === null
      ? null
      : createPortal(<button type="button">tool {label}</button>, bar);
  },
};

/** A document that embeds a fence of its own, as markdown does. */
const host: ContentRenderer = {
  name: "host",
  accepts: (source) => source.kind === "file" && source.name === "doc.md",
  Component: () => (
    <Content source={{ kind: "inline", text: "fence" }} placement="document" />
  ),
};

const file = (name: string): ContentSource => ({
  kind: "file",
  name,
  mime: "text/plain",
  size: 4,
});

function draw(source: ContentSource) {
  return render(
    <ContentRenderers renderers={[attachmentCard(), host, tools]}>
      <Content source={source} placement="document" />
    </ContentRenderers>,
  );
}

/** The card's header row, which holds its name. */
const header = () => {
  const row = document.querySelector("section")?.firstElementChild;
  if (!(row instanceof HTMLElement)) throw new Error("no header");
  return row;
};

describe("useContentTitleBar", () => {
  it("lends the card's title bar to the renderer drawing its file", async () => {
    draw(file("a.t"));
    const tool = await screen.findByRole("button", { name: "tool a.t" });
    expect(header().contains(tool)).toBe(true);
  });

  it("lends nothing to a source nested inside that file", () => {
    draw(file("doc.md"));
    expect(screen.getByText("no bar for fence")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /tool/ })).toBeNull();
  });

  it("is undefined with no surface around", () => {
    render(
      <ContentRenderers renderers={[tools]}>
        <Content source={{ kind: "inline", text: "x" }} placement="document" />
      </ContentRenderers>,
    );
    expect(screen.getByText("no bar for x")).toBeTruthy();
  });
});
