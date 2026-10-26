import { ContentRenderers, type ContentSource } from "@orz/ui-content";
import { AttachmentViewerProvider } from "@orz/ui-content/attachment";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { attachmentLinks, Markdown, markdownContent } from "../src/index.ts";

function resolve(href: string): ContentSource | null {
  if (!href.startsWith("files/")) return null;
  const name = href.slice("files/".length);
  return {
    kind: "file",
    name,
    size: 12,
    url: `https://app.example/files/${name}`,
    load: async () => `# ${name}`,
  };
}

const PLUGINS = [attachmentLinks({ resolve })];
const RENDERERS = [markdownContent()];

function draw(markdown: string) {
  return render(
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider>
        <Markdown plugins={PLUGINS}>{markdown}</Markdown>
      </AttachmentViewerProvider>
    </ContentRenderers>,
  );
}

describe("attachmentLinks", () => {
  it("draws a resolved link as a chip that opens the viewer", () => {
    draw("See [the notes](files/notes.md).");
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe(
      "https://app.example/files/notes.md",
    );
    expect(link.getAttribute("title")).toBe("notes.md");
    expect(link.textContent).toBe("the notes");
    expect(link.querySelector("svg")).not.toBeNull();
    fireEvent.click(link);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("leaves an unresolved link to the next plugin", () => {
    draw("See [elsewhere](https://example.com/page).");
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("https://example.com/page");
    expect(link.getAttribute("title")).toBeNull();
    expect(link.querySelector("svg")).toBeNull();
  });

  it("draws a link to a deleted file as the deleted mark", () => {
    render(
      <Markdown
        plugins={[
          attachmentLinks({
            resolve: (href) => {
              const file = resolve(href);
              return file === null ? null : { ...file, deleted: true };
            },
          }),
        ]}
      >
        {"See [the notes](files/notes.md)."}
      </Markdown>,
    );
    expect(screen.queryByRole("link")).toBeNull();
    const mark = document.querySelector("[data-attachment-deleted]");
    expect(mark?.textContent).toBe("notes.mddeleted");
  });
});
