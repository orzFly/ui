import { type ContentRenderer, ContentRenderers } from "@orz/ui-content";
import { render } from "@testing-library/react";
import type { Root as HastRoot } from "hast";
import type { Root as MdastRoot } from "mdast";
import { describe, expect, it } from "vitest";
import { Markdown, type MarkdownPlugin } from "../src/index.ts";
import { rehypeSourceLines } from "../src/lib/rehype-source-lines.ts";

const lines: MarkdownPlugin = {
  name: "lines",
  rehypePlugins: [rehypeSourceLines],
};
const LINES = [lines];

function wrapH2(name: string): MarkdownPlugin {
  return {
    name,
    components: {
      h2: ({ Next, ...props }) => (
        <section data-wrap={name}>
          <Next {...props} />
        </section>
      ),
    },
  };
}

function wrapFence(name: string): MarkdownPlugin {
  return {
    name,
    fence: ({ Next, ...props }) => (
      <div data-fence={name} data-lang={props.lang ?? ""}>
        <Next {...props} />
      </div>
    ),
  };
}

describe("plugin order", () => {
  it("makes the first plugin's element wrapper outermost", () => {
    const plugins = [wrapH2("a"), wrapH2("b")];
    const { container } = render(
      <Markdown plugins={plugins}>{"## Title"}</Markdown>,
    );
    const outer = container.querySelector(".markdown-body > section");
    expect(outer?.getAttribute("data-wrap")).toBe("a");
    expect(
      outer?.querySelector(":scope > section")?.getAttribute("data-wrap"),
    ).toBe("b");
    expect(outer?.querySelector(":scope > section > h2")?.textContent).toBe(
      "Title",
    );
  });

  it("strips node off the plain element at the bottom of the chain", () => {
    const plugins = [wrapH2("a")];
    const { container } = render(
      <Markdown plugins={plugins}>{"## Title"}</Markdown>,
    );
    expect(container.querySelector("h2")?.hasAttribute("node")).toBe(false);
  });

  it("makes the first plugin's fence wrapper outermost, the registry innermost", () => {
    const plugins = [wrapFence("a"), wrapFence("b")];
    const { container } = render(
      <Markdown plugins={plugins}>{"```ts\nlet a = 1;\n```"}</Markdown>,
    );
    const outer = container.querySelector(".markdown-fence > [data-fence]");
    expect(outer?.getAttribute("data-fence")).toBe("a");
    expect(outer?.getAttribute("data-lang")).toBe("ts");
    const inner = outer?.querySelector(":scope > [data-fence]");
    expect(inner?.getAttribute("data-fence")).toBe("b");
    expect(inner?.querySelector(":scope > pre > code")?.textContent).toBe(
      "let a = 1;",
    );
  });

  it("hands a plugin's element wrapper the hast node", () => {
    const seen: string[] = [];
    const plugins: MarkdownPlugin[] = [
      {
        name: "probe",
        components: {
          a: ({ Next, node, ...props }) => {
            seen.push(node?.tagName ?? "none");
            return <Next {...props} />;
          },
        },
      },
    ];
    render(<Markdown plugins={plugins}>{"[x](https://example.com)"}</Markdown>);
    expect(seen).toContain("a");
  });
});

describe("plugin passes", () => {
  it("runs a remark pass after the frontmatter table is built", () => {
    const types: string[] = [];
    const plugins: MarkdownPlugin[] = [
      {
        name: "probe",
        remarkPlugins: [
          () => (tree: MdastRoot) => {
            for (const child of tree.children) types.push(child.type);
          },
        ],
      },
    ];
    render(
      <Markdown plugins={plugins}>{"---\ntitle: A\n---\n\nBody."}</Markdown>,
    );
    expect(types).toContain("frontmatter");
  });

  it("runs a rehype pass after the folds are built", () => {
    const tags: string[] = [];
    const plugins: MarkdownPlugin[] = [
      {
        name: "probe",
        rehypePlugins: [
          () => (tree: HastRoot) => {
            for (const child of tree.children) {
              if (child.type === "element") tags.push(child.tagName);
            }
          },
        ],
      },
    ];
    render(
      <Markdown plugins={plugins}>
        {"<details>\n<summary>More</summary>\n\nInside.\n\n</details>"}
      </Markdown>,
    );
    expect(tags).toContain("details");
  });
});

describe("fences", () => {
  const fenceOf = (container: HTMLElement) =>
    container.querySelector(".markdown-fence");

  it("stamps a fenced block from its opening marker, contents one line in", () => {
    const { container } = render(
      <Markdown plugins={LINES}>{"Intro.\n\n```ts\na\nb\n```"}</Markdown>,
    );
    const fence = fenceOf(container);
    expect(fence?.getAttribute("data-loc")).toBe("3-6");
    expect(fence?.getAttribute("data-loc-content-start")).toBe("4");
  });

  it("stamps an indented block with its contents on its first line", () => {
    const { container } = render(
      <Markdown plugins={LINES}>{"Intro.\n\n    a\n    b"}</Markdown>,
    );
    const fence = fenceOf(container);
    expect(fence?.getAttribute("data-loc")).toBe("3-4");
    expect(fence?.getAttribute("data-loc-content-start")).toBe("3");
  });

  it("stamps a fence inside a blockquote from the line count", () => {
    const { container } = render(
      <Markdown plugins={LINES}>{"> ```ts\n> a\n> ```"}</Markdown>,
    );
    const fence = fenceOf(container);
    expect(fence?.getAttribute("data-loc")).toBe("1-3");
    expect(fence?.getAttribute("data-loc-content-start")).toBe("2");
  });

  it("carries the <pre>'s classes over to the wrapper", () => {
    const plugins: MarkdownPlugin[] = [
      {
        name: "mark",
        rehypePlugins: [
          () => (tree: HastRoot) => {
            for (const child of tree.children) {
              if (child.type === "element" && child.tagName === "pre") {
                child.properties.className = ["changed"];
              }
            }
          },
        ],
      },
    ];
    const { container } = render(
      <Markdown plugins={plugins}>{"```\nx\n```"}</Markdown>,
    );
    expect(fenceOf(container)?.className).toBe("markdown-fence changed");
  });

  it("falls back to <pre><code> with no renderer registered", () => {
    const { container } = render(
      <Markdown>{"```ts\nlet a = 1;\n```"}</Markdown>,
    );
    const code = container.querySelector(".markdown-fence > pre > code");
    expect(code?.textContent).toBe("let a = 1;");
    expect(code?.className).toBe("language-ts");
  });

  it("hands a fence to a registered renderer, language and all", () => {
    const echo: ContentRenderer = {
      name: "echo",
      accepts: (source) => source.kind === "inline",
      Component: ({ source }) =>
        source.kind === "inline" ? (
          <output data-lang={source.lang ?? ""}>{source.text}</output>
        ) : null,
    };
    const renderers = [echo];
    const { container } = render(
      <ContentRenderers renderers={renderers}>
        <Markdown>{"```Mermaid\ngraph\n```\n\n    indented"}</Markdown>
      </ContentRenderers>,
    );
    const drawn = [...container.querySelectorAll(".markdown-fence > output")];
    expect(drawn.map((el) => el.getAttribute("data-lang"))).toEqual([
      "Mermaid",
      "",
    ]);
    expect(drawn.map((el) => el.textContent)).toEqual(["graph", "indented"]);
  });

  it("leaves a <pre> that is not a plain fence as it is", () => {
    const plugins: MarkdownPlugin[] = [
      {
        name: "bare-pre",
        rehypePlugins: [
          () => (tree: HastRoot) => {
            tree.children.push({
              type: "element",
              tagName: "pre",
              properties: {},
              children: [{ type: "text", value: "bare" }],
            });
          },
        ],
      },
    ];
    const { container } = render(<Markdown plugins={plugins}>{"x"}</Markdown>);
    expect(container.querySelector(".markdown-fence")).toBeNull();
    expect(container.querySelector(".markdown-body > pre")?.textContent).toBe(
      "bare",
    );
  });
});

describe("the root", () => {
  it("adds className to .markdown-body and forwards ref", () => {
    let node: HTMLDivElement | null = null;
    const { container } = render(
      <Markdown
        className="prose-tight"
        ref={(el) => {
          node = el;
        }}
      >
        {"x"}
      </Markdown>,
    );
    const root = container.querySelector(".markdown-body");
    expect(root?.className).toBe("markdown-body prose-tight");
    expect(node).toBe(root);
  });
});

describe("identity (T-60)", () => {
  it("keeps the same text node when the parent re-renders with the same plugins", () => {
    const plugins = [wrapH2("a"), wrapFence("f")];
    const tree = (label: string) => (
      <div>
        <span>{label}</span>
        <Markdown plugins={plugins}>
          {"## Title\n\nSome *text*.\n\n```\ncode\n```"}
        </Markdown>
      </div>
    );
    const { container, rerender } = render(tree("one"));
    const textOf = () => ({
      heading: container.querySelector("h2")?.firstChild,
      paragraph: container.querySelector("p")?.firstChild,
      fence: container.querySelector(".markdown-fence code")?.firstChild,
    });
    const before = textOf();
    expect(before.heading?.nodeType).toBe(Node.TEXT_NODE);
    rerender(tree("two"));
    const after = textOf();
    expect(after.heading).toBe(before.heading);
    expect(after.paragraph).toBe(before.paragraph);
    expect(after.fence).toBe(before.fence);
  });
});
