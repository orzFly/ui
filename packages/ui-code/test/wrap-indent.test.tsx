import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CodeBlock,
  CodeDiffBlock,
  PatchFiles,
  PlainCodeFallback,
} from "../src/code-block.tsx";
import {
  leadingIndent,
  WRAP_INDENT_CSS,
  WRAP_LINE_STYLE,
  WRAP_MARKER_STYLE,
} from "../src/wrap-indent.ts";

type Options = {
  overflow?: string;
  unsafeCSS?: string;
  onPostRender?: (node: HTMLElement, instance: unknown, phase: string) => void;
};

// What each surface handed pierre, for the CSS it carries.
const seen = vi.hoisted(() => ({ options: [] as Options[] }));

vi.mock("@pierre/diffs", () => ({ registerCustomTheme: () => {} }));

/**
 * Draws the lines as pierre does, a [data-line] each under a pre that says
 * whether they wrap, inside a shadow root, then notifies.
 */
vi.mock("@pierre/diffs/react", () => {
  const draw = (
    node: HTMLDivElement | null,
    options: Options,
    contents: string,
  ) => {
    if (node === null) return;
    const host = document.createElement("diffs-container");
    node.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const pre = document.createElement("pre");
    pre.dataset.overflow = options.overflow ?? "scroll";
    for (const [index, text] of contents.split("\n").entries()) {
      const line = document.createElement("div");
      line.dataset.line = String(index + 1);
      line.textContent = text;
      pre.appendChild(line);
    }
    shadow.appendChild(pre);
    options.onPostRender?.(host, {}, "mount");
  };
  return {
    CodeView: ({
      items,
      options,
      containerRef,
    }: {
      items: Array<{ file?: { contents: string } }>;
      options: Options;
      containerRef?: (node: HTMLDivElement | null) => void;
    }) => {
      seen.options.push(options);
      return (
        <div
          data-testid="code-view"
          ref={(node) => {
            containerRef?.(node);
            draw(node, options, items[0]?.file?.contents ?? "");
          }}
        />
      );
    },
    MultiFileDiff: ({
      newFile,
      options,
    }: {
      newFile: { contents: string };
      options: Options;
    }) => {
      seen.options.push(options);
      return (
        <div
          data-testid="fence-diff"
          ref={(node) => draw(node, options, newFile.contents)}
        />
      );
    },
  };
});

afterEach(() => {
  seen.options = [];
});

const SNIPPET = [
  "export function sync(store: Store, remote: Remote): Promise<Report> {",
  "  for (const item of store.pending()) {",
  "\t\tawait remote.upload(item);",
  "  }",
  "}",
].join("\n");

const shadowLines = (host: HTMLElement) =>
  [
    ...(host
      .querySelector("diffs-container")
      ?.shadowRoot?.querySelectorAll("[data-line]") ?? []),
  ] as HTMLElement[];

describe("leadingIndent", () => {
  it("is null for a line that starts with its text", () => {
    expect(leadingIndent("export {}")).toBeNull();
    expect(leadingIndent("")).toBeNull();
  });

  it("counts spaces as columns and tabs at pierre's tab size", () => {
    expect(leadingIndent("    x")).toBe("calc(4ch)");
    expect(leadingIndent("\t\tx")).toBe(
      "calc(2 * var(--diffs-tab-size, 2) * 1ch)",
    );
    expect(leadingIndent("\t  x")).toBe(
      "calc(1 * var(--diffs-tab-size, 2) * 1ch + 2ch)",
    );
  });

  it("runs a tab after spaces on to the next tab stop", () => {
    expect(leadingIndent("  \tx")).toBe(
      "calc(round(up, 2ch + 0.5ch, var(--diffs-tab-size, 2) * 1ch))",
    );
  });
});

describe("the hang", () => {
  it("is one rule for pierre's lines and the plain text's", () => {
    expect(WRAP_LINE_STYLE.textIndent).toMatch(/ hanging$/);
    expect(WRAP_INDENT_CSS).toContain(
      `[data-overflow=wrap] [data-line] { text-indent: ${WRAP_LINE_STYLE.textIndent}; }`,
    );
    expect(WRAP_INDENT_CSS).toContain(`left: ${WRAP_MARKER_STYLE.left};`);
  });
});

describe("wrapped continuation rows", () => {
  it("hang each of pierre's wrapped lines from its own indentation", async () => {
    const { container } = render(
      <CodeBlock filename="sync.ts" contents={SNIPPET} />,
    );
    await screen.findByTestId("code-view");
    const lines = shadowLines(container);
    expect(
      lines.map((line) => line.style.getPropertyValue("--orz-wrap-indent")),
    ).toEqual([
      "",
      "calc(2ch)",
      "calc(2 * var(--diffs-tab-size, 2) * 1ch)",
      "calc(2ch)",
      "",
    ]);
    const css = seen.options.at(-1)?.unsafeCSS ?? "";
    expect(css).toContain("[data-overflow=wrap] [data-line] { text-indent:");
    expect(css).toContain("hanging");
    expect(css).toContain("[data-overflow=wrap] [data-line]::after");
  });

  it("leave a file that scrolls sideways alone", async () => {
    const { container } = render(
      <CodeBlock filename="sync.ts" contents={SNIPPET} lineNumbers />,
    );
    await screen.findByTestId("code-view");
    for (const line of shadowLines(container)) {
      expect(line.style.getPropertyValue("--orz-wrap-indent")).toBe("");
    }
    expect(seen.options.at(-1)?.unsafeCSS).not.toContain("hanging");
  });

  it("hang in a fence diff too", async () => {
    const { container } = render(
      <CodeDiffBlock filename="sync.ts" before="old" after={SNIPPET} />,
    );
    await screen.findByTestId("fence-diff");
    expect(
      shadowLines(container)[1]?.style.getPropertyValue("--orz-wrap-indent"),
    ).toBe("calc(2ch)");
    expect(seen.options.at(-1)?.unsafeCSS).toContain("hanging");
  });

  it("hang in a patch's diffs, and not in its commit messages", async () => {
    render(
      <PatchFiles
        patches={[]}
        messages={[]}
        text=""
        className="max-h-96"
        renderHeader={() => null}
      />,
    );
    await screen.findByTestId("code-view");
    const css = seen.options.at(-1)?.unsafeCSS ?? "";
    expect(css).toContain("hanging");
    // pierre marks a file item's pre with [data-file], and a patch's only
    // file items are its messages.
    expect(css).toContain(
      "[data-file][data-overflow] [data-line] { text-indent: 0; }",
    );
    expect(css).toContain(
      "[data-file][data-overflow] [data-line]::after { content: none; }",
    );
  });

  it("hang the same way in the plain text drawn before pierre", () => {
    const { container } = render(<PlainCodeFallback contents={SNIPPET} />);
    const code = container.querySelector("pre code");
    // The text reads and copies as written, newlines and all.
    expect(code?.textContent).toBe(SNIPPET);
    const lines = [...(code?.children ?? [])] as HTMLElement[];
    expect(lines).toHaveLength(5);
    expect(
      lines.map((line) => line.style.getPropertyValue("--orz-wrap-indent")),
    ).toEqual([
      "",
      "calc(2ch)",
      "calc(2 * var(--diffs-tab-size, 2) * 1ch)",
      "calc(2ch)",
      "",
    ]);
    for (const line of lines) {
      // happy-dom drops a `text-indent` it cannot parse, `hanging` among them,
      // so the line is held to the style pierre's lines take by its padding.
      expect(line.style.paddingInline).toBe("1ch");
      const marker = line.firstElementChild as HTMLElement;
      expect(marker.getAttribute("aria-hidden")).toBe("true");
      expect(marker.textContent).toBe("");
      expect(marker.style.position).toBe("absolute");
      expect(marker.style.width).toBe("1ch");
    }
  });

  it("leave the plain text of a file with line numbers whole", () => {
    const { container } = render(
      <PlainCodeFallback contents={SNIPPET} lineNumbers />,
    );
    const code = container.querySelectorAll("pre code")[0];
    expect(code?.children).toHaveLength(0);
    expect(code?.textContent).toBe(SNIPPET);
  });
});
