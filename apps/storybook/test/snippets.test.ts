import { describe, expect, it } from "vitest";
import { registrationSnippet } from "../src/snippets.ts";

describe("registrationSnippet", () => {
  it("imports the renderers and what the body uses, and keeps the renderers in a constant", () => {
    expect(
      registrationSnippet({
        renderers: [
          ["@orz/ui-ansi", "ansiContent"],
          ["@orz/ui-code", "codeContent"],
        ],
        uses: [["@orz/ui-markdown", "Markdown"]],
        body: "<Markdown>{source}</Markdown>",
      }),
    ).toBe(
      [
        'import { ansiContent } from "@orz/ui-ansi";',
        'import { codeContent } from "@orz/ui-code";',
        'import { ContentRenderers } from "@orz/ui-content";',
        'import { Markdown } from "@orz/ui-markdown";',
        "",
        "const renderers = [ansiContent, codeContent];",
        "",
        "<ContentRenderers renderers={renderers}>",
        "  <Markdown>{source}</Markdown>",
        "</ContentRenderers>",
      ].join("\n"),
    );
  });

  it("merges names from one module and indents a multi-line body", () => {
    expect(
      registrationSnippet({
        renderers: [["@orz/ui-content/attachment", "imageContent()"]],
        uses: [
          ["@orz/ui-content", "Content"],
          ["@orz/ui-content/attachment", "AttachmentViewerProvider"],
        ],
        body: "<AttachmentViewerProvider>\n  <Content source={file} />\n</AttachmentViewerProvider>",
      }),
    ).toBe(
      [
        'import { Content, ContentRenderers } from "@orz/ui-content";',
        'import { AttachmentViewerProvider, imageContent } from "@orz/ui-content/attachment";',
        "",
        "const renderers = [imageContent()];",
        "",
        "<ContentRenderers renderers={renderers}>",
        "  <AttachmentViewerProvider>",
        "    <Content source={file} />",
        "  </AttachmentViewerProvider>",
        "</ContentRenderers>",
      ].join("\n"),
    );
  });
});
