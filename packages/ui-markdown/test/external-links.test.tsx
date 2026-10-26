import { ContentRenderers, type ContentSource } from "@orz/ui-content";
import { AttachmentViewerProvider } from "@orz/ui-content/attachment";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  attachmentLinks,
  externalLinks,
  isExternalHref,
  Markdown,
  type MarkdownPlugin,
} from "../src/index.ts";

const ORIGIN = "https://app.example";

const DOC = [
  "[elsewhere](https://example.com/page)",
  "[here](https://app.example/projects/7)",
  "[relative](/board)",
  "[mail](mailto:noreply@example.com)",
  "[fragment](#top)",
  "[file](files/notes.md)",
  "[![logo](https://example.com/logo.png)](https://example.com)",
].join("\n\n");

function resolve(href: string): ContentSource | null {
  if (!href.startsWith("files/")) return null;
  return { kind: "file", name: "notes.md", url: `${ORIGIN}/${href}` };
}

function draw(plugins: MarkdownPlugin[]) {
  render(
    <ContentRenderers renderers={[]}>
      <AttachmentViewerProvider>
        <Markdown plugins={plugins}>{DOC}</Markdown>
      </AttachmentViewerProvider>
    </ContentRenderers>,
  );
  return (name: string) => screen.getByRole("link", { name });
}

describe("externalLinks", () => {
  it("opens only links to another http(s) origin in a new tab", () => {
    const link = draw([
      attachmentLinks({ resolve }),
      externalLinks({ origin: ORIGIN }),
    ]);
    for (const name of ["elsewhere", "logo"]) {
      expect(link(name).getAttribute("target"), name).toBe("_blank");
      expect(link(name).getAttribute("rel"), name).toBe("noopener noreferrer");
    }
    for (const name of ["here", "relative", "mail", "fragment", "file"]) {
      expect(link(name).getAttribute("target"), name).toBeNull();
      expect(link(name).getAttribute("rel"), name).toBeNull();
    }
    expect(link("elsewhere").getAttribute("href")).toBe(
      "https://example.com/page",
    );
  });

  it("leaves every link in this tab when it is not in the list", () => {
    draw([attachmentLinks({ resolve })]);
    for (const a of screen.getAllByRole("link")) {
      expect(a.getAttribute("target")).toBeNull();
    }
  });
});

describe("isExternalHref", () => {
  it.each([
    ["https://github.com/o/r", true],
    ["HTTP://Other.Example/x", true],
    ["//protocol-relative.example/x", true],
    [`${ORIGIN}/projects/7`, false],
    ["/board", false],
    ["notes.md", false],
    ["#top", false],
    ["?q=1", false],
    ["mailto:noreply@example.com", false],
    ["javascript:alert(1)", false],
    [undefined, false],
  ])("%s → %s", (href, expected) => {
    expect(isExternalHref(href, ORIGIN)).toBe(expected);
  });
});
