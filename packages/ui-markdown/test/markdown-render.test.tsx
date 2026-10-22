import { render } from "@testing-library/react";
import ReactMarkdown from "react-markdown";
import { describe, expect, it } from "vitest";
import { rehypeSourceLines } from "../src/lib/rehype-source-lines.ts";
import { Markdown } from "../src/markdown.tsx";
import type { MarkdownPlugin } from "../src/plugin.ts";

/** Stamps every block with its source lines, the way a caller anchoring selections mounts it. */
const STAMPED: readonly MarkdownPlugin[] = [
  { name: "lines", rehypePlugins: [rehypeSourceLines] },
];

/** Mount one markdown body, with no content renderers, so a fence draws as a plain pre>code. */
function mount(
  source: string,
  { plugins }: { plugins?: readonly MarkdownPlugin[] } = {},
): HTMLElement {
  const { container } = render(<Markdown plugins={plugins}>{source}</Markdown>);
  expect(container.querySelector(".markdown-body")).not.toBeNull();
  return container;
}

/** The frontmatter grid, or null when nothing recognised one. */
function gridOf(container: HTMLElement): HTMLTableElement | null {
  return container.querySelector("table.markdown-frontmatter");
}

/** Each field row as `[key, value]`, read off the rendered DOM. */
function fieldsOf(container: HTMLElement): Array<[string, string]> {
  const grid = gridOf(container);
  if (grid === null) return [];
  return [...grid.querySelectorAll("tbody > tr")].map((row) => [
    row.querySelector("th")?.textContent ?? "",
    row.querySelector("td")?.textContent ?? "",
  ]);
}

describe("frontmatter rendering", () => {
  it("renders a metadata grid, one row per field", () => {
    const container = mount(
      "---\ntitle: Frontmatter\nstatus: approved\n---\n\nBody here.\n",
    );
    const grid = gridOf(container);
    expect(grid).not.toBeNull();
    expect(grid?.querySelector("tbody")).not.toBeNull();
    // No <thead>: frontmatter has no header row, and the first field must not
    // be drawn as one.
    expect(grid?.querySelector("thead")).toBeNull();
    expect(fieldsOf(container)).toEqual([
      ["title", "Frontmatter"],
      ["status", "approved"],
    ]);
    expect(container.textContent).toContain("Body here.");
  });

  it("reads a TOML block the same way", () => {
    const container = mount(
      '+++\ntitle = "A"\nowner = "bot-one"\n+++\n\nBody.\n',
    );
    expect(fieldsOf(container)).toEqual([
      ["title", '"A"'],
      ["owner", '"bot-one"'],
    ]);
  });

  it("no longer renders the block as an <hr> and an <h2>", () => {
    const container = mount("---\ntitle: A\n---\n\nBody.\n");
    expect(container.querySelector("hr")).toBeNull();
    expect(container.querySelector("h2")).toBeNull();
  });

  // A frontmatter value parsed as prose would rewrite the metadata itself: a
  // url turned into a link, `*em*` into emphasis.
  it("leaves a value's markdown unparsed", () => {
    const source = [
      "---",
      "related: F-1",
      "homepage: https://example.com/docs",
      "note: *em* and `code`",
      "---",
      "",
      "Body.",
      "",
    ].join("\n");
    const container = mount(source);
    expect(fieldsOf(container)).toEqual([
      ["related", "F-1"],
      ["homepage", "https://example.com/docs"],
      ["note", "*em* and `code`"],
    ]);
    const grid = gridOf(container);
    for (const tag of ["a", "em", "code", "strong"]) {
      expect(grid?.querySelector(tag)).toBeNull();
    }
  });

  it("still parses the body's own emphasis", () => {
    const container = mount("---\nnote: *em*\n---\n\nBody with *em*.\n");
    expect(container.querySelector(".markdown-frontmatter em")).toBeNull();
    expect(container.querySelector("p em")?.textContent).toBe("em");
  });

  it("shows an indented continuation in its field's value cell", () => {
    const container = mount("---\nmeta:\n  nested: 1\ntitle: A\n---\n");
    expect(fieldsOf(container)).toEqual([
      ["meta", "\n  nested: 1"],
      ["title", "A"],
    ]);
  });

  it("renders nothing at all for an empty block", () => {
    const container = mount("---\n---\n\nBody.\n");
    expect(gridOf(container)).toBeNull();
    expect(container.querySelector("hr")).toBeNull();
    expect(container.textContent?.trim()).toBe("Body.");
  });

  // The other half of the fallback guard: what `remark-frontmatter` does not
  // recognise has to render exactly as plain markdown would.
  const unrecognised: Array<[string, string]> = [
    ["a leading blank line", "\n---\ntitle: A\n---\n\nBody.\n"],
    ["no closing fence", "---\ntitle: A\n\nBody.\n"],
    ["`...` as the closing fence", "---\ntitle: A\n...\n\nBody.\n"],
    ["a block mid-document", "Intro.\n\n---\ntitle: A\n---\n\nBody.\n"],
  ];

  for (const [name, source] of unrecognised) {
    it(`renders ${name} as it always did`, () => {
      const container = mount(source);
      expect(gridOf(container)).toBeNull();
      // The <hr> and the setext <h2> the source really does mean.
      expect(container.querySelector("hr")).not.toBeNull();
      expect(container.textContent).toContain("title: A");
    });
  }
});

const BLOCK =
  "<details>\n<summary>Summary text</summary>\n\nBody copy.\n\n</details>\n";

describe("<details> folds", () => {
  it("builds a fold out of the block form", () => {
    const container = mount(BLOCK);
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details?.querySelector(":scope > summary")?.textContent).toBe(
      "Summary text",
    );
    const body = container.querySelector("p");
    expect(body?.textContent).toBe("Body copy.");
    expect(details?.contains(body ?? null)).toBe(true);
  });

  it("honours <details open>", () => {
    const container = mount(BLOCK.replace("<details>", "<details open>"));
    expect(container.querySelector("details")?.hasAttribute("open")).toBe(true);
    // The unadorned form must not carry it, or the assertion above proves
    // nothing about which literal matched.
    const plain = mount(BLOCK);
    expect(plain.querySelector("details")?.hasAttribute("open")).toBe(false);
  });

  it("gives a fold no attribute but `open`", () => {
    const names = (el: Element | null) =>
      [...(el?.attributes ?? [])].map((attribute) => attribute.name);
    const plain = mount(BLOCK);
    expect(names(plain.querySelector("details"))).toEqual([]);
    expect(names(plain.querySelector("summary"))).toEqual([]);
    const expanded = mount(BLOCK.replace("<details>", "<details open>"));
    expect(names(expanded.querySelector("details"))).toEqual(["open"]);
  });

  it("nests", () => {
    const container = mount(
      "<details>\n<summary>outer</summary>\n\n" +
        "<details>\n<summary>inner</summary>\n\ndeep\n\n</details>\n\n" +
        "</details>\n",
    );
    const outer = container.querySelector("details");
    const inner = container.querySelector("details details");
    expect(outer).not.toBeNull();
    expect(inner).not.toBeNull();
    expect(outer?.querySelector(":scope > summary")?.textContent).toBe("outer");
    expect(inner?.querySelector(":scope > summary")?.textContent).toBe("inner");
    expect(container.querySelectorAll("details")).toHaveLength(2);
  });

  it.each([
    [
      "blockquote",
      "> <details>\n> <summary>s</summary>\n>\n> quoted body\n>\n> </details>\n",
      "blockquote > details",
    ],
    [
      "list item",
      "- <details>\n  <summary>s</summary>\n\n  listed body\n\n  </details>\n",
      "li > details",
    ],
    [
      "table cell",
      "| head |\n|---|\n| <details><summary>s</summary>celled body</details> |\n",
      "td > details",
    ],
  ])("forms inside a %s", (_name, source, selector) => {
    const container = mount(source);
    const details = container.querySelector(selector);
    expect(details).not.toBeNull();
    expect(details?.querySelector("summary")?.textContent).toBe("s");
    expect(details?.textContent).toContain("body");
  });

  it("leaves an unclosed <details> as source", () => {
    const container = mount("<details>\n<summary>s</summary>\n");
    expect(container.querySelector("details")).toBeNull();
    expect(container.textContent).toContain("<details>");
    expect(container.textContent).toContain("<summary>s</summary>");
  });

  it("leaves a stray </details> as source", () => {
    const container = mount("before\n\n</details>\n\nafter\n");
    expect(container.querySelector("details")).toBeNull();
    expect(container.textContent).toContain("</details>");
  });

  it("keeps a malformed close as source without inventing its tags", () => {
    const container = mount("<details><summary>a</summary><p>b</details>\n");
    // The pair that IS whitelisted still forms; `<p>` was never a candidate
    // and has to reach the reader as the four characters they typed.
    expect(container.querySelector("details > summary")?.textContent).toBe("a");
    expect(container.querySelector("p")).toBeNull();
    expect(container.textContent).toContain("<p>b");
  });

  it("rejects an open tag carrying an event handler", () => {
    const container = mount(
      "<details onclick=alert(1)>\n<summary>s</summary>\n\nbody\n\n</details>\n",
    );
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("summary")).toBeNull();
    expect(container.textContent).toContain("<details onclick=alert(1)>");
  });

  it.each([
    [
      '<details class="x">',
      '<details class="x">\n<summary>s</summary>\n\nb\n\n</details>\n',
    ],
    [
      '<details open="open">',
      '<details open="open">\n<summary>s</summary>\n\nb\n\n</details>\n',
    ],
    ["<details/>", "<details/>\n<summary>s</summary>\n\nb\n\n</details>\n"],
    [
      "<detailsfoo>",
      "<detailsfoo>\n<summary>s</summary>\n\nb\n\n</detailsfoo>\n",
    ],
    ["< details>", "< details>\n<summary>s</summary>\n\nb\n\n</details>\n"],
  ])("builds nothing from %s", (literal, source) => {
    const container = mount(source);
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector("summary")).toBeNull();
    expect(container.textContent).toContain(literal);
  });

  it("matches the tag names case-insensitively", () => {
    const container = mount(
      "<DETAILS>\n<SUMMARY>shouty</SUMMARY>\n\nbody\n\n</DETAILS>\n",
    );
    expect(container.querySelector("details > summary")?.textContent).toBe(
      "shouty",
    );
  });

  it("allows whitespace before the closing angle bracket", () => {
    const container = mount(
      "<details >\n<summary >s</summary >\n\nbody\n\n</details >\n",
    );
    expect(container.querySelector("details > summary")?.textContent).toBe("s");
  });

  it("recognises nothing inside an indented code block", () => {
    const container = mount(
      "    <details>\n    <summary>s</summary>\n    </details>\n",
    );
    expect(container.querySelector("details")).toBeNull();
    const code = container.querySelector("pre > code");
    expect(code?.textContent).toContain("<details>");
    expect(code?.textContent).toContain("</details>");
  });

  it("leaves a body with no blank line around it literal", () => {
    const container = mount(
      "<details>\n<summary>s</summary>\n**body** here\n</details>\n",
    );
    expect(container.querySelector("details > summary")?.textContent).toBe("s");
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain("**body** here");
  });

  it("leaves a <summary> outside any fold as source", () => {
    const container = mount("<summary>x</summary>\n");
    expect(container.querySelector("summary")).toBeNull();
    expect(container.textContent).toContain("<summary>x</summary>");
  });

  it("recognises nothing in an inline position", () => {
    const container = mount("text <details>x</details> more\n");
    expect(container.querySelector("details")).toBeNull();
    expect(container.textContent).toContain("<details>x</details>");
  });

  it("keeps unsupported tags inside a fold escaped", () => {
    const container = mount(
      "<details>\n<summary>s</summary>\n\n" +
        "<iframe src=x></iframe>\n\n<script>alert(1)</script>\n\n</details>\n",
    );
    expect(container.querySelector("details")).not.toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<iframe src=x></iframe>");
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("parses a summary that stands on its own line as markdown", () => {
    const container = mount(
      "<details>\n<summary>\n\n**bold** with `code`\n\n</summary>\n\nbody\n\n</details>\n",
    );
    const summary = container.querySelector("details > summary");
    expect(summary).not.toBeNull();
    expect(summary?.querySelector("strong")?.textContent).toBe("bold");
    expect(summary?.querySelector("code")?.textContent).toBe("code");
  });

  it("lets a fence inside a fold keep its own rendering", () => {
    const container = mount(
      "<details>\n<summary>s</summary>\n\n```ts\nconst a = 1;\n```\n\n</details>\n",
      { plugins: STAMPED },
    );
    const details = container.querySelector("details");
    // The fence spans source lines 4-6 and its contents open on line 5.
    const wrapper = details?.querySelector("[data-loc-content-start]");
    expect(wrapper?.getAttribute("data-loc")).toBe("4-6");
    expect(wrapper?.getAttribute("data-loc-content-start")).toBe("5");
    expect(wrapper?.querySelector("code")?.textContent).toContain(
      "const a = 1;",
    );
  });
});

describe("source-line stamps around a fold", () => {
  it("stamps the paragraphs inside a fold with their own source lines", () => {
    const container = mount(BLOCK, { plugins: STAMPED });
    const body = container.querySelector("details p");
    expect(body?.textContent).toBe("Body copy.");
    expect(body?.getAttribute("data-loc")).toBe("4-4");
  });

  it("stamps the fold itself from its open tag to its close tag", () => {
    const container = mount(BLOCK, { plugins: STAMPED });
    expect(container.querySelector("details")?.getAttribute("data-loc")).toBe(
      "1-6",
    );
  });
});

/**
 * Every plugin combination that changes the tree raw HTML passes through. The
 * whitelist is one list and cannot be a plugin's business, so a difference
 * between two rows here is a bug wherever it appears.
 */
const SURFACES: Array<[string, readonly MarkdownPlugin[] | undefined]> = [
  ["plain", undefined],
  ["stamped", STAMPED],
];

type Row = {
  /** Row number of the injection list the escaping is reviewed against. */
  n: string;
  source: string;
  /** Selectors that must find nothing: the payload did not execute. */
  absent: string[];
  /** Source text that must reach the page: the payload was not swallowed. */
  text: string;
  /** Selectors that must still find something. */
  present?: string[];
};

const ROWS: Row[] = [
  {
    n: "1",
    source: "<script>alert(1)</script>\n",
    absent: ["script"],
    text: "<script>alert(1)</script>",
  },
  {
    n: "2",
    source: "<script\n>alert(1)</script\n>\n",
    absent: ["script"],
    text: "<script\n>alert(1)</script\n>",
  },
  {
    n: "3",
    source: "<img src=x onerror=alert(1)>\n",
    absent: ["img"],
    text: "<img src=x onerror=alert(1)>",
  },
  {
    n: "4",
    source: "<IMG SRC=x OnErRoR=alert(1)>\n",
    absent: ["img"],
    text: "<IMG SRC=x OnErRoR=alert(1)>",
  },
  {
    n: "5",
    source: "<img src=x on\nerror=alert(1)>\n",
    absent: ["img"],
    text: "<img src=x on\nerror=alert(1)>",
  },
  {
    n: "6",
    source: "[a](javascript:alert(1))\n",
    absent: ["a"],
    text: "[a](javascript:alert(1))",
  },
  {
    n: "7",
    source: "[a](JaVaScRiPt:alert(1))\n",
    absent: ["a"],
    text: "[a](JaVaScRiPt:alert(1))",
  },
  {
    n: "8",
    source: "[a](data:text/html,<script>alert(1)</script>)\n",
    absent: ["a", "script"],
    text: "[a](data:text/html,<script>alert(1)</script>)",
  },
  {
    n: "9",
    source: "<javascript:alert(1)>\n",
    absent: ["a"],
    text: "<javascript:alert(1)>",
  },
  {
    n: "10",
    source: "![x](javascript:alert(1))\n",
    absent: ["img"],
    text: "![x](javascript:alert(1))",
  },
  {
    n: "11",
    source: "[a](vbscript:msgbox(1))\n",
    absent: ["a"],
    text: "[a](vbscript:msgbox(1))",
  },
  {
    n: "11b",
    source: "[a][r]\n\n[r]: javascript:alert(1)\n",
    absent: ["a"],
    // The bad URL lives on the definition line, which markdown never renders.
    text: "[a][r]",
  },
  {
    n: "12",
    source: "<style>body{background:url(javascript:alert(1))}</style>\n",
    absent: ["style"],
    text: "<style>body{background:url(javascript:alert(1))}</style>",
  },
  {
    n: "13",
    source: '<p style="width:expression(alert(1))">x</p>\n',
    absent: ["p[style]"],
    text: '<p style="width:expression(alert(1))">x</p>',
  },
  {
    n: "14",
    source: '<iframe srcdoc="<script>alert(1)</script>"></iframe>\n',
    absent: ["iframe", "script", "[srcdoc]"],
    text: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  },
  {
    n: "15",
    source: "<svg><script>alert(1)</script></svg>\n",
    absent: ["svg", "script"],
    text: "<svg><script>alert(1)</script></svg>",
  },
  {
    n: "16",
    source:
      "<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>\n",
    absent: ["svg", "foreignObject", "img"],
    text: "<svg><foreignObject><img src=x onerror=alert(1)></foreignObject></svg>",
  },
  {
    n: "17",
    source: "<math><mtext><script>alert(1)</script></mtext></math>\n",
    absent: ["math", "script"],
    text: "<math><mtext><script>alert(1)</script></mtext></math>",
  },
  {
    n: "18",
    source: "<details><summary><script>alert(1)</script></summary></details>\n",
    absent: ["script"],
    text: "<script>alert(1)</script>",
    present: ["details > summary"],
  },
  {
    n: "19",
    source: "<details><summary>a</summary><p>b</details>\n",
    absent: ["p"],
    text: "<p>b",
    present: ["details > summary"],
  },
  {
    n: "20",
    source: "&lt;script&gt;alert(1)&lt;/script&gt;\n",
    absent: ["script"],
    text: "<script>alert(1)</script>",
  },
  {
    n: "21",
    source: "&amp;lt;script&amp;gt;\n",
    absent: ["script"],
    text: "&lt;script&gt;",
  },
  {
    n: "22",
    source: "<!--<script>alert(1)</script>-->\n",
    absent: ["script"],
    text: "<!--<script>alert(1)</script>-->",
  },
  {
    n: "23",
    source: '<base href="https://evil.example/">\n\n[rel](/foo)\n',
    absent: ["base"],
    text: '<base href="https://evil.example/">',
    present: ['a[href="/foo"]'],
  },
  {
    n: "24",
    source: '<form action="https://evil.example"><button>go</button></form>\n',
    absent: ["form", "button"],
    text: '<form action="https://evil.example"><button>go</button></form>',
  },
  {
    n: "25",
    source: '<object data="javascript:alert(1)"></object>\n',
    absent: ["object"],
    text: '<object data="javascript:alert(1)"></object>',
  },
  {
    n: "26",
    source: '<a href="https://evil.example" target="_blank">x</a>\n',
    absent: ["a"],
    text: '<a href="https://evil.example" target="_blank">x</a>',
  },
  {
    n: "27",
    source: "<![CDATA[<script>alert(1)</script>]]>\n",
    absent: ["script"],
    text: "<![CDATA[<script>alert(1)</script>]]>",
  },
  {
    n: "28",
    source: "<?php echo 1; ?>\n",
    absent: [],
    text: "<?php echo 1; ?>",
  },
  {
    n: "29",
    source: "<!DOCTYPE html><script>alert(1)</script>\n",
    absent: ["script"],
    text: "<!DOCTYPE html><script>alert(1)</script>",
  },
  {
    n: "30",
    source: "<scr ipt>alert(1)</scr ipt>\n",
    absent: ["script"],
    text: "<scr ipt>alert(1)</scr ipt>",
  },
];

describe.each(SURFACES)("raw HTML on the %s surface", (_name, plugins) => {
  it.each(ROWS.map((row): [string, Row] => [row.n, row]))(
    "neither executes nor swallows injection %s",
    (_n, row) => {
      const container = mount(row.source, { plugins });
      for (const selector of row.absent) {
        expect(container.querySelector(selector)).toBeNull();
      }
      for (const selector of row.present ?? []) {
        expect(container.querySelector(selector)).not.toBeNull();
      }
      expect(container.textContent).toContain(row.text);
    },
  );
});

/**
 * What this pipeline can build out of the sources above when nothing leaks:
 * CommonMark and GFM output, the wrappers `<Markdown>` swaps in, and the two
 * tags this renderer recognises. Anything else means a byte of the source
 * was read as markup.
 */
const BUILDABLE = new Set([
  "p",
  "div",
  "a",
  "img",
  "pre",
  "code",
  "details",
  "summary",
]);

it("builds no element the whitelist does not name", () => {
  const seen = new Set<string>();
  for (const row of ROWS) {
    const container = mount(row.source, { plugins: STAMPED });
    for (const el of container.querySelectorAll(".markdown-body *")) {
      seen.add(el.tagName.toLowerCase());
    }
  }
  expect([...seen].filter((tag) => !BUILDABLE.has(tag))).toEqual([]);
  // The check is worth nothing if the sources build nothing to begin with.
  expect(seen.has("details")).toBe(true);
  expect(seen.has("summary")).toBe(true);
});

/**
 * The one third-party contract this renderer's escaping rests on. react-markdown
 * replaces every `raw` node with a text node holding its source; were that to
 * change in an upgrade, raw HTML would start reaching the DOM and every guard
 * above would go on passing, because they are all mounted behind our plugins.
 */
it("still gets raw HTML as text from react-markdown alone", () => {
  const { container } = render(
    <ReactMarkdown>{"<iframe src=x></iframe>\n"}</ReactMarkdown>,
  );
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.textContent).toContain("<iframe src=x></iframe>");
});

describe("links whose protocol the renderer refuses", () => {
  it.each([
    ["javascript:", "[a](javascript:alert(1))"],
    ["mixed case", "[a](JaVaScRiPt:alert(1))"],
    ["vbscript:", "[a](vbscript:msgbox(1))"],
    ["data:", "[a](data:text/html,<b>x</b>)"],
  ])("renders a %s link as its source", (_name, source) => {
    const container = mount(`${source}\n`);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain(source);
  });

  it("renders a rejected image as its source", () => {
    const container = mount("![x](javascript:alert(1))\n");
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("![x](javascript:alert(1))");
  });

  it("renders a reference whose definition is rejected as its source", () => {
    const container = mount("[a][r]\n\n[r]: javascript:alert(1)\n");
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("[a][r]");
    // The definition line is not rendered by markdown at all, so the URL is
    // no more visible than it is today.
    expect(container.textContent).not.toContain("javascript:alert(1)");
  });

  it.each([
    ["a relative path", "[a](/foo)", "/foo"],
    ["an https URL", "[a](https://example.com/x)", "https://example.com/x"],
    ["a mailto", "[a](mailto:alice@example.com)", "mailto:alice@example.com"],
  ])("leaves %s alone", (_name, source, href) => {
    const container = mount(`${source}\n`);
    expect(container.querySelector("a")?.getAttribute("href")).toBe(href);
  });
});
