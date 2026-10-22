import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
} from "@orz/ui-content";
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

  it("keeps a <p> when nothing registered accepts the embed", () => {
    const { container } = render(
      <Markdown plugins={PLUGINS}>{"See ![outer](files/outer.md)"}</Markdown>,
    );
    expect(container.querySelector("p > img")).not.toBeNull();
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
