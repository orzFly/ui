import { ContentRenderers, type ContentSource } from "@orz/ui-content";
import {
  AttachmentViewerProvider,
  imageContent,
} from "@orz/ui-content/attachment";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IMAGE_PAIR_CASES } from "../../ui-codemirror/test/image-pair-cases.ts";
import {
  imagePairs,
  Markdown,
  type MarkdownPlugin,
  markdownEmbeds,
} from "../src/index.ts";
import {
  PAIR_BEFORE_AT_ATTR,
  pairLabel,
  rehypeImagePairs,
} from "../src/lib/rehype-image-pairs.ts";
import {
  rehypeSourceLines,
  SOURCE_LINE_ATTR,
} from "../src/lib/rehype-source-lines.ts";

const PLUGINS = [imagePairs()];

const compares = (root: ParentNode) =>
  root.querySelectorAll('[data-slot="media-compare"]');

const labels = (root: ParentNode) =>
  [...root.querySelectorAll('[data-slot="compare-label-name"]')].map(
    (el) => el.textContent,
  );

/** Reports a natural size for every image in `root`, as a browser does once it loads. */
function load(root: ParentNode, width = 720, height = 400) {
  for (const img of root.querySelectorAll("img")) {
    Object.defineProperty(img, "naturalWidth", { value: width });
    Object.defineProperty(img, "naturalHeight", { value: height });
    fireEvent.load(img);
  }
}

describe("imagePairs", () => {
  it.each(IMAGE_PAIR_CASES)("$name → pair: $pair", ({ markdown, pair }) => {
    const { container } = render(
      <Markdown plugins={PLUGINS}>{markdown}</Markdown>,
    );
    expect(compares(container).length > 0).toBe(pair);
  });

  it("draws one comparison in a paragraph that is a div, labelled by its alts", () => {
    const { container } = render(
      <Markdown plugins={PLUGINS}>
        {"Intro.\n\n![main](/a.png) → ![this branch](/b.png)\n"}
      </Markdown>,
    );
    expect(compares(container)).toHaveLength(1);
    const paragraph = compares(container)[0]?.closest(".markdown-paragraph");
    expect(paragraph?.tagName).toBe("DIV");
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(labels(container)).toEqual(["main", "this branch"]);
    expect(container.textContent).not.toContain("→");
    const [before, after] = container.querySelectorAll("img");
    expect(before?.getAttribute("src")).toBe("/a.png");
    expect(after?.getAttribute("src")).toBe("/b.png");
  });

  it("falls back to Before / After when the alts are file names", () => {
    const { container } = render(
      <Markdown plugins={PLUGINS}>
        {"![shot.png](/x/shot.png) -> ![](/x/next)\n"}
      </Markdown>,
    );
    expect(labels(container)).toEqual(["Before", "After"]);
  });

  it("keeps a tight list item's nested list after the pair", () => {
    const { container } = render(
      <Markdown plugins={PLUGINS}>
        {"- ![a](/a.png) → ![b](/b.png)\n  - why\n"}
      </Markdown>,
    );
    const item = container.querySelector("li");
    expect(item?.querySelector('[data-slot="media-compare"]')).not.toBeNull();
    expect(item?.querySelector("ul")?.textContent?.trim()).toBe("why");
  });

  it("keeps the paragraph's source-line stamp", () => {
    const stamp: MarkdownPlugin = {
      name: "stamp",
      rehypePlugins: [rehypeSourceLines],
    };
    const { container } = render(
      <Markdown plugins={[imagePairs(), stamp]}>
        {"Intro.\n\n![a](/a.png)\n→ ![b](/b.png)\n"}
      </Markdown>,
    );
    expect(
      container
        .querySelector(".markdown-paragraph")
        ?.getAttribute(SOURCE_LINE_ATTR),
    ).toBe("3-4");
  });

  it("carries the first image's source offset on the pair", () => {
    const fold: MarkdownPlugin = {
      name: "fold",
      rehypePlugins: [rehypeImagePairs],
    };
    const markdown = "Intro.\n\n![a](/a.png) → ![b](/b.png)\n";
    const { container } = render(
      <Markdown plugins={[fold]}>{markdown}</Markdown>,
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(1);
    expect(imgs[0]?.getAttribute(PAIR_BEFORE_AT_ATTR)).toBe(
      String(markdown.indexOf("![a]")),
    );
  });

  it("leaves the images alone without the plugin", () => {
    const { container } = render(
      <Markdown>{"![a](/a.png) → ![b](/b.png)\n"}</Markdown>,
    );
    expect(container.querySelectorAll("img")).toHaveLength(2);
    expect(compares(container)).toHaveLength(0);
  });
});

/** Files under `files/`, an image each, and one deleted. */
function resolve(href: string): ContentSource | null {
  if (!href.startsWith("files/")) return null;
  const name = href.slice("files/".length);
  return {
    kind: "file",
    name,
    mime: "image/png",
    url: `/download/${name}`,
    deleted: name === "gone.png",
  };
}

describe("imagePairs({ resolve })", () => {
  it("draws a resolved file from its url, and an alt naming it falls back", () => {
    const plugins = [imagePairs({ resolve })];
    const { container } = render(
      <Markdown plugins={plugins}>
        {"![old.png](files/old.png) → ![new design](files/new.png)\n"}
      </Markdown>,
    );
    const [before, after] = container.querySelectorAll("img");
    expect(before?.getAttribute("src")).toBe("/download/old.png");
    expect(after?.getAttribute("src")).toBe("/download/new.png");
    expect(labels(container)).toEqual(["Before", "new design"]);
  });

  it("marks a deleted file's side, and the other still draws", () => {
    const plugins = [imagePairs({ resolve })];
    const { container } = render(
      <Markdown plugins={plugins}>
        {"![v1](files/gone.png) → ![v2](files/new.png)\n"}
      </Markdown>,
    );
    expect(
      container.querySelector('[data-side="before"] [data-attachment-deleted]'),
    ).not.toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(1);
  });

  it("is left to it by markdownEmbeds, in either order", () => {
    for (const plugins of [
      [markdownEmbeds({ resolve }), imagePairs({ resolve })],
      [imagePairs({ resolve }), markdownEmbeds({ resolve })],
    ]) {
      // With an image renderer, the embeds plugin would draw either image.
      const { container, unmount } = render(
        <ContentRenderers renderers={[imageContent()]}>
          <Markdown plugins={plugins}>
            {"![v1](files/a.png) → ![v2](files/b.png)\n"}
          </Markdown>
        </ContentRenderers>,
      );
      expect(compares(container)).toHaveLength(1);
      unmount();
    }
  });
});

describe("imagePairs in the viewer", () => {
  const DOC = [
    "![v1](files/a.png) → ![v2](files/b.png)",
    "Between.",
    "![old](/c.png) -> ![new](/d.png)",
    "",
  ].join("\n\n");

  it("opens nothing outside a viewer", () => {
    const plugins = [imagePairs({ resolve })];
    const { container } = render(<Markdown plugins={plugins}>{DOC}</Markdown>);
    load(container);
    expect(screen.queryByRole("button", { name: "Open in the viewer" })).toBe(
      null,
    );
  });

  it("opens the pair clicked, paging through the document's pairs in order", () => {
    const plugins = [imagePairs({ resolve })];
    const { container } = render(
      <AttachmentViewerProvider>
        <Markdown plugins={plugins}>{DOC}</Markdown>
      </AttachmentViewerProvider>,
    );
    load(container);
    const second = compares(container)[1] as HTMLElement;
    fireEvent.click(
      within(second).getAllByRole("button", {
        name: "Open in the viewer",
      })[0] as HTMLElement,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading").textContent).toBe(
      "c.png → d.png",
    );
    expect(within(dialog).getByText("2 / 2")).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "next comparison" }),
    );
    expect(within(dialog).getByRole("heading").textContent).toBe(
      "a.png → b.png",
    );
    expect(
      within(dialog)
        .getByRole("link", { name: "Download v2" })
        .getAttribute("href"),
    ).toBe("/download/b.png");
  });

  it("pages through the pairs of every document below the provider", () => {
    const { container } = render(
      <AttachmentViewerProvider>
        <Markdown plugins={[imagePairs({ resolve })]}>
          {"![v1](files/a.png) → ![v2](files/b.png)\n"}
        </Markdown>
        <Markdown plugins={[imagePairs()]}>
          {"![old](/c.png) -> ![new](/d.png)\n"}
        </Markdown>
      </AttachmentViewerProvider>,
    );
    load(container);
    const second = compares(container)[1] as HTMLElement;
    fireEvent.click(
      within(second).getAllByRole("button", {
        name: "Open in the viewer",
      })[0] as HTMLElement,
    );
    const dialog = screen.getByRole("dialog");
    const heading = () => within(dialog).getByRole("heading").textContent;
    expect(heading()).toBe("c.png → d.png");
    expect(within(dialog).getByText("2 / 2")).toBeTruthy();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "previous comparison" }),
    );
    expect(heading()).toBe("a.png → b.png");
  });

  it("waits for both sides' sizes before it opens", () => {
    const plugins = [imagePairs()];
    render(
      <AttachmentViewerProvider>
        <Markdown plugins={plugins}>{"![a](/a.png) → ![b](/b.png)\n"}</Markdown>
      </AttachmentViewerProvider>,
    );
    expect(screen.queryByRole("button", { name: "Open in the viewer" })).toBe(
      null,
    );
  });
});

describe("pairLabel", () => {
  it("is the alt an author wrote", () => {
    expect(pairLabel(" main ", "/x/shot%201.png", "Before")).toBe("main");
  });

  it("falls back when the alt is empty", () => {
    expect(pairLabel("  ", "/x/a.png", "Before")).toBe("Before");
  });

  it("falls back when the alt is the file's name", () => {
    expect(pairLabel("shot 1", "/x/shot 1", "After")).toBe("After");
    expect(pairLabel("shot 1.png", "/x/shot%201.png", "After")).toBe("After");
    expect(pairLabel("upload", "/download/7", "After", "upload")).toBe("After");
  });

  it("falls back when the alt is a plain address's last segment", () => {
    expect(pairLabel("hero", "https://example.com/img/hero", "After")).toBe(
      "After",
    );
  });

  it("falls back when the alt ends in an image extension", () => {
    expect(pairLabel("Screenshot.JPEG", "/x/y", "Before")).toBe("Before");
  });
});
