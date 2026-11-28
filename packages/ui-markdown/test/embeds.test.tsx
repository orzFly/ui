import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
} from "@orz/ui-content";
import {
  AttachmentViewerProvider,
  imageContent,
} from "@orz/ui-content/attachment";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Markdown,
  type MarkdownPlugin,
  markdownContent,
  markdownEmbeds,
} from "../src/index.ts";

/** In-memory documents, addressed as `files/<name>`: react-markdown refuses a `file:` URL. */
const FILES: Record<string, string> = {
  "outer.md": "Outer body.\n\n![inner](files/inner.md)",
  "inner.md": "Inner body.\n\n![deepest](files/deepest.md)",
  "deepest.md": "Deepest body.",
  "titled.md": "# Embedded\n\n## Embedded part",
  "lines.md": "First line\nsecond line",
};

const loaders = new Map(
  Object.entries(FILES).map(([name, text]) => [name, async () => text]),
);

function resolve(href: string): ContentSource | null {
  if (!href.startsWith("files/")) return null;
  const name = href.slice("files/".length);
  return { kind: "file", name, url: `/files/${name}`, load: loaders.get(name) };
}

/** Marks every paragraph, so a test can tell the host's plugins reached a nested document. */
const marker: MarkdownPlugin = {
  name: "marker",
  components: {
    p: ({ Next, ...props }) => <Next {...props} data-marked="" />,
  },
};

const PLUGINS = [markdownEmbeds({ resolve }), marker];
const RENDERERS = [markdownContent()];

/** Lets every pending load settle. */
const settle = () => act(async () => {});

describe("an embedded markdown file", () => {
  it("renders as a nested .markdown-body with the host's plugins", async () => {
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={PLUGINS}>{"![outer](files/outer.md)"}</Markdown>
      </ContentRenderers>,
    );
    await settle();
    const nested = container.querySelector(".markdown-body .markdown-body");
    expect(nested?.textContent).toContain("Outer body.");
    expect(nested?.querySelector("p[data-marked]")?.textContent).toBe(
      "Outer body.",
    );
  });

  it("is drawn without the host's plugins marked inherited: false (UI-236)", async () => {
    const own: MarkdownPlugin = {
      name: "own",
      inherited: false,
      components: {
        p: ({ Next, ...props }) => <Next {...props} data-own="" />,
      },
    };
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={[...PLUGINS, own]}>
          {"Host body.\n\n![outer](files/outer.md)"}
        </Markdown>
      </ContentRenderers>,
    );
    await settle();
    expect(
      [...container.querySelectorAll("p[data-own]")].map((p) => p.textContent),
    ).toEqual(["Host body."]);
    const nested = container.querySelector(".markdown-body .markdown-body");
    expect(nested?.querySelector("p[data-marked]")?.textContent).toBe(
      "Outer body.",
    );
  });

  it("is not drawn again when only the host's own plugins change (UI-236)", async () => {
    let parses = 0;
    const counting: MarkdownPlugin = {
      name: "counting",
      remarkPlugins: [
        () => (_tree: unknown, file: { value: unknown }) => {
          if (file.value === FILES["outer.md"]) parses++;
        },
      ],
    };
    const own = (): MarkdownPlugin => ({ name: "own", inherited: false });
    const tree = (plugins: MarkdownPlugin[]) => (
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={plugins}>{"![outer](files/outer.md)"}</Markdown>
      </ContentRenderers>
    );
    const { container, rerender } = render(tree([...PLUGINS, counting, own()]));
    await settle();
    const text = () =>
      container.querySelector(".markdown-body .markdown-body p")?.firstChild;
    const before = text();
    expect(parses).toBe(1);
    rerender(tree([...PLUGINS, counting, own()]));
    await settle();
    expect(parses).toBe(1);
    expect(text()).toBe(before);
  });

  it("starts its headings a level below its host's (UI-256)", async () => {
    render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={PLUGINS}>
          {"# Host\n\n![titled](files/titled.md)"}
        </Markdown>
      </ContentRenderers>,
    );
    await settle();
    expect(screen.getByRole("heading", { name: "Host" }).tagName).toBe("H1");
    expect(screen.getByRole("heading", { name: "Embedded" }).tagName).toBe(
      "H2",
    );
    expect(screen.getByRole("heading", { name: "Embedded part" }).tagName).toBe(
      "H3",
    );
  });

  it("counts its headings from the host's headingLevel", async () => {
    render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={PLUGINS} headingLevel={2}>
          {"# Host\n\n![titled](files/titled.md)"}
        </Markdown>
      </ContentRenderers>,
    );
    await settle();
    expect(screen.getByRole("heading", { name: "Host" }).tagName).toBe("H2");
    expect(screen.getByRole("heading", { name: "Embedded" }).tagName).toBe(
      "H3",
    );
  });

  it("is a link one level deeper", async () => {
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={PLUGINS}>{"![outer](files/outer.md)"}</Markdown>
      </ContentRenderers>,
    );
    await settle();
    expect(container.querySelectorAll(".markdown-body")).toHaveLength(2);
    expect(container.textContent).not.toContain("Inner body.");
    const link = container.querySelector("a[href='/files/inner.md']");
    expect(link?.textContent).toBe("inner.md");
  });

  it("is never limited in viewer placement", async () => {
    const source = resolve("files/inner.md");
    if (source === null) throw new Error("unresolved");
    const { container } = render(
      <ContentRenderers renderers={[markdownContent({ plugins: PLUGINS })]}>
        <ContentRenderers renderers={[]}>
          <Content source={source} placement="viewer" />
        </ContentRenderers>
      </ContentRenderers>,
    );
    await settle();
    expect(container.textContent).toContain("Inner body.");
    // The viewer's own document counts as the first level, so what it embeds is a link.
    expect(
      container.querySelector("a[href='/files/deepest.md']"),
    ).not.toBeNull();
  });

  it("keeps # an h1 in viewer placement, outside any <Markdown>", async () => {
    const source = resolve("files/titled.md");
    if (source === null) throw new Error("unresolved");
    render(
      <ContentRenderers renderers={RENDERERS}>
        <Content source={source} placement="viewer" />
      </ContentRenderers>,
    );
    await settle();
    expect(screen.getByRole("heading", { name: "Embedded" }).tagName).toBe(
      "H1",
    );
  });

  it("renders even at depth in viewer placement", async () => {
    const source = resolve("files/deepest.md");
    if (source === null) throw new Error("unresolved");
    function Deep() {
      return <Content source={source as ContentSource} placement="viewer" />;
    }
    const frames: ContentRenderer = {
      name: "frames",
      accepts: (s) => s.kind === "file" && s.name === "frame.bin",
      Component: () => <Deep />,
    };
    const { container } = render(
      <ContentRenderers renderers={[frames, markdownContent()]}>
        <Content
          source={{ kind: "file", name: "frame.bin" }}
          placement="document"
        />
      </ContentRenderers>,
    );
    await settle();
    expect(container.textContent).toContain("Deepest body.");
  });

  it("reads maxDepth from options before the provider", async () => {
    const { container } = render(
      <ContentRenderers
        renderers={[markdownContent({ maxDepth: 2 })]}
        maxDepth={1}
      >
        <Markdown plugins={PLUGINS}>{"![outer](files/outer.md)"}</Markdown>
      </ContentRenderers>,
    );
    await settle();
    expect(container.textContent).toContain("Inner body.");
    expect(container.textContent).not.toContain("Deepest body.");
  });
});

describe("paragraphs carrying embeds", () => {
  const chip: ContentRenderer = {
    name: "chip",
    accepts: (s) => s.kind === "file" && s.name.endsWith(".chip"),
    display: "inline",
    Component: ({ source, className }) => (
      <span data-chip="" className={className}>
        {source.kind === "file" ? source.name : ""}
      </span>
    ),
  };

  it("turns a paragraph with a block embed into div.markdown-paragraph", () => {
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={PLUGINS}>{"See ![outer](files/outer.md)"}</Markdown>
      </ContentRenderers>,
    );
    const host = container.querySelector(".markdown-body");
    expect(
      host?.querySelector(":scope > div.markdown-paragraph"),
    ).not.toBeNull();
    expect(host?.querySelector(":scope > p")).toBeNull();
  });

  it("keeps a <p> around an inline embed", () => {
    const { container } = render(
      <ContentRenderers renderers={[chip]}>
        <Markdown plugins={PLUGINS}>{"See ![a](files/a.chip) here"}</Markdown>
      </ContentRenderers>,
    );
    expect(container.querySelector("p > span[data-chip]")?.textContent).toBe(
      "a.chip",
    );
    expect(container.querySelector(".markdown-paragraph")).toBeNull();
  });

  it("draws a deleted file as the deleted mark, inside a <p>", () => {
    const deleted = markdownEmbeds({
      resolve: (href) => {
        const file = resolve(href);
        return file === null ? null : { ...file, deleted: true };
      },
    });
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={[deleted]}>
          {"See ![outer](files/outer.md)"}
        </Markdown>
      </ContentRenderers>,
    );
    const mark = container.querySelector("p > [data-attachment-deleted]");
    expect(mark?.textContent).toBe("outer.mddeleted");
    expect(container.querySelector(".markdown-paragraph")).toBeNull();
  });

  it("keeps a <p> when nothing registered accepts the embed", () => {
    const { container } = render(
      <Markdown plugins={PLUGINS}>{"See ![outer](files/outer.md)"}</Markdown>,
    );
    expect(container.querySelector("p > img")).not.toBeNull();
  });
});

describe("a block embed under breaks (UI-233)", () => {
  const chip: ContentRenderer = {
    name: "chip",
    accepts: (s) => s.kind === "file" && s.name.endsWith(".chip"),
    display: "inline",
    Component: ({ source }) => (
      <span data-chip="">{source.kind === "file" ? source.name : ""}</span>
    ),
  };
  const draw = (text: string, renderers = RENDERERS) =>
    render(
      <ContentRenderers renderers={renderers}>
        <Markdown plugins={PLUGINS} breaks>
          {text}
        </Markdown>
      </ContentRenderers>,
    ).container;
  /** Breaks in the element itself, not in a document it embeds. */
  const ownBreaks = (container: HTMLElement, selector: string) =>
    container.querySelectorAll(`.markdown-body > ${selector} > br`).length;

  it("leaves no break between two embeds on consecutive lines", () => {
    const container = draw(
      "![outer](files/outer.md)\n![inner](files/inner.md)",
    );
    expect(ownBreaks(container, ".markdown-paragraph")).toBe(0);
  });

  it("leaves no break between an embed and the text under it", () => {
    const container = draw("![outer](files/outer.md)\nafter");
    expect(ownBreaks(container, ".markdown-paragraph")).toBe(0);
    expect(container.textContent).toContain("after");
  });

  it("keeps the break between text and the embed under it", () => {
    const container = draw("before\n![outer](files/outer.md)");
    expect(ownBreaks(container, ".markdown-paragraph")).toBe(1);
  });

  it("keeps a hard break the author wrote after an embed", () => {
    const container = draw("![outer](files/outer.md)  \nafter");
    expect(ownBreaks(container, ".markdown-paragraph")).toBe(1);
  });

  it("does the same in a tight list item", () => {
    const container = draw(
      "- before\n  ![outer](files/outer.md)\n  after\n- next",
    );
    expect(ownBreaks(container, "ul > li")).toBe(1);
  });

  it("keeps the break between two inline embeds", () => {
    const container = draw("![a](files/a.chip)\n![b](files/b.chip)", [chip]);
    expect(ownBreaks(container, "p")).toBe(1);
  });

  it("draws an embedded document's own newlines as spaces", async () => {
    const container = draw("before\nafter\n\n![lines](files/lines.md)");
    await settle();
    expect(ownBreaks(container, "p")).toBe(1);
    const nested = container.querySelector(".markdown-body .markdown-body p");
    expect(nested?.textContent).toBe(FILES["lines.md"]);
    expect(nested?.querySelector("br")).toBeNull();
  });
});

describe("images that do not resolve", () => {
  it("stay an <img>", () => {
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={PLUGINS}>
          {"![logo](https://example.com/logo.png)"}
        </Markdown>
      </ContentRenderers>,
    );
    const img = container.querySelector("p > img");
    expect(img?.getAttribute("src")).toBe("https://example.com/logo.png");
    expect(img?.getAttribute("alt")).toBe("logo");
  });

  it("pass an <img>'s class on to the renderer", async () => {
    const markImages: MarkdownPlugin = {
      name: "mark-images",
      rehypePlugins: [
        () => (tree: import("hast").Root) => {
          const visit = (
            node: import("hast").Root | import("hast").Element,
          ) => {
            for (const child of node.children) {
              if (child.type !== "element") continue;
              if (child.tagName === "img")
                child.properties.className = ["added"];
              visit(child);
            }
          };
          visit(tree);
        },
      ],
    };
    const plugins = [markdownEmbeds({ resolve }), markImages];
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Markdown plugins={plugins}>{"![deepest](files/deepest.md)"}</Markdown>
      </ContentRenderers>,
    );
    await settle();
    expect(
      container.querySelector(".markdown-body .markdown-body.added")
        ?.textContent,
    ).toContain("Deepest body.");
  });
});

describe("loading", () => {
  it("shows the link while loading", () => {
    const pending: ContentSource = {
      kind: "file",
      name: "slow.md",
      url: "/files/slow.md",
      load: () => new Promise(() => {}),
    };
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Content source={pending} placement="viewer" />
      </ContentRenderers>,
    );
    expect(container.querySelector("a")?.textContent).toBe("slow.md");
  });

  it("offers Retry after a failed load, and renders once it succeeds", async () => {
    let fail = true;
    const flaky: ContentSource = {
      kind: "file",
      name: "flaky.md",
      load: async () => {
        if (fail) throw new Error("offline");
        return "Recovered.";
      },
    };
    const { container } = render(
      <ContentRenderers renderers={RENDERERS}>
        <Content source={flaky} placement="viewer" />
      </ContentRenderers>,
    );
    await settle();
    expect(container.textContent).toContain("offline");
    fail = false;
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Retry" })),
    );
    expect(container.querySelector(".markdown-body")?.textContent).toBe(
      "Recovered.",
    );
  });
});

describe("an embedded image", () => {
  const shots = (href: string): ContentSource | null =>
    href.startsWith("shots/")
      ? { kind: "file", name: href.slice(6), url: `/files/${href.slice(6)}` }
      : null;

  const draw = (markdown: string) =>
    render(
      <ContentRenderers renderers={[imageContent()]}>
        <AttachmentViewerProvider>
          <Markdown plugins={[markdownEmbeds({ resolve: shots })]}>
            {markdown}
          </Markdown>
        </AttachmentViewerProvider>
      </ContentRenderers>,
    );

  it("is a link to the file that opens the viewer", () => {
    draw("![shot](shots/a.png)");
    const link = screen.getByRole("link", { name: "a.png" });
    expect(link.getAttribute("href")).toBe("/files/a.png");
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("inside a link stays a plain image, the link's to click (UI-249)", () => {
    const { container } = draw("[![shot](shots/a.png)](https://example.com/)");
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/files/a.png");
    expect(img.getAttribute("alt")).toBe("shot");
    expect(img.hasAttribute("data-linked-image")).toBe(false);
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(img.closest("a")?.getAttribute("href")).toBe("https://example.com/");
    expect(fireEvent.click(img)).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
