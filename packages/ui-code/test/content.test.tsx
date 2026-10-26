import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
  TEXT_PREVIEW_HARD_MAX_BYTES,
  TEXT_PREVIEW_MAX_BYTES,
  useContentDisplay,
} from "@orz/ui-content";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { exceedsBytes } from "../src/capped-code-block.tsx";
import { codeContent } from "../src/content.tsx";

// pierre is covered by code-block-degrade; here only what the renderer hands
// CodeBlock matters, so the stand-in prints its props.
vi.mock("../src/code-block.tsx", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/code-block.tsx")>()),
  CodeBlock: ({
    filename,
    contents,
    lineNumbers,
    plain,
    offThread,
    className,
  }: {
    filename: string;
    contents: string;
    lineNumbers?: boolean;
    plain?: boolean;
    offThread?: boolean;
    className?: string;
  }) => (
    <pre
      data-testid="code-block"
      data-filename={filename}
      data-line-numbers={String(lineNumbers ?? false)}
      data-plain={String(plain ?? false)}
      data-off-thread={String(offThread ?? false)}
      className={className}
    >
      {contents}
    </pre>
  ),
}));

const inline = (text: string, lang?: string): ContentSource => ({
  kind: "inline",
  text,
  lang,
});

function file(
  name: string,
  extra: Partial<Extract<ContentSource, { kind: "file" }>> = {},
): ContentSource {
  return { kind: "file", name, url: `https://app.example/${name}`, ...extra };
}

function draw(
  source: ContentSource,
  renderers: ContentRenderer[] = [codeContent],
) {
  return render(
    <ContentRenderers renderers={renderers}>
      <Content source={source} placement="document" />
    </ContentRenderers>,
  );
}

describe("accepts", () => {
  it.each([
    ["a tagged inline source", inline("x", "ts")],
    ["an untagged inline source", inline("x")],
    ["a tag pierre does not know", inline("x", "nonsense")],
    ["a declared text type", file("notes", { mime: "text/plain" })],
    ["a text application type", file("data", { mime: "application/json" })],
    [
      "a code file under a generic type",
      file("main.rs", { mime: "application/octet-stream" }),
    ],
    ["a code file with no type", file("main.go")],
  ])("takes %s", (_, source) => {
    expect(codeContent.accepts(source, "document")).toBe(true);
    expect(codeContent.accepts(source, "viewer")).toBe(true);
  });

  it.each([
    ["an image", file("shot.png", { mime: "image/png" })],
    ["an archive", file("bundle.zip", { mime: "application/zip" })],
    ["a binary under a generic type", file("blob.bin")],
    // A declared type outranks the filename.
    ["a .ts declared as video", file("clip.ts", { mime: "video/mp2t" })],
  ])("refuses %s", (_, source) => {
    expect(codeContent.accepts(source, "document")).toBe(false);
    expect(codeContent.accepts(source, "viewer")).toBe(false);
  });

  it("is block content", () => {
    function Display() {
      return <span>{useContentDisplay(inline("x"), "document")}</span>;
    }
    render(
      <ContentRenderers renderers={[codeContent]}>
        <Display />
      </ContentRenderers>,
    );
    expect(screen.getByText("block")).toBeTruthy();
  });
});

describe("inline sources", () => {
  it("draws a snippet named after the language tag", () => {
    draw(inline("let x = 1;", "typescript"));
    const block = screen.getByTestId("code-block");
    expect(block.dataset.filename).toBe("snippet.ts");
    expect(block.dataset.lineNumbers).toBe("false");
    expect(block.textContent).toBe("let x = 1;");
  });

  it("names an untagged snippet as plain text", () => {
    draw(inline("plain"));
    expect(screen.getByTestId("code-block").dataset.filename).toBe(
      "snippet.txt",
    );
  });

  it("puts className on its root", () => {
    const { container } = render(
      <ContentRenderers renderers={[codeContent]}>
        <Content
          source={inline("x", "ts")}
          placement="document"
          className="marked"
        />
      </ContentRenderers>,
    );
    expect(container.firstElementChild?.className).toBe("marked");
  });

  it("is the code view a narrower renderer's Next reaches", () => {
    const diagram: ContentRenderer = {
      name: "diagram",
      accepts: (source) =>
        source.kind === "inline" && source.lang === "mermaid",
      Component: ({ source, placement, Next }) => (
        <figure>
          <Next source={source} placement={placement} />
        </figure>
      ),
    };
    const { container } = draw(inline("graph TD", "mermaid"), [
      diagram,
      codeContent,
    ]);
    const block = container.querySelector("figure [data-testid=code-block]");
    expect(block?.getAttribute("data-filename")).toBe("snippet.mermaid");
  });
});

describe("files", () => {
  it("draws the loaded text with the file's name and line numbers", async () => {
    draw(file("main.py", { load: async () => "print(1)" }));
    const block = await screen.findByTestId("code-block");
    expect(block.dataset.filename).toBe("main.py");
    expect(block.dataset.lineNumbers).toBe("true");
    expect(block.textContent).toBe("print(1)");
  });

  it("drops one final newline, and only one", async () => {
    draw(file("main.py", { load: async () => "print(1)\n\n" }));
    const block = await screen.findByTestId("code-block");
    expect(block.textContent).toBe("print(1)\n");
  });

  it("drops a CRLF ending as one newline", async () => {
    draw(file("run.bat", { load: async () => "echo 1\r\n" }));
    expect((await screen.findByTestId("code-block")).textContent).toBe(
      "echo 1",
    );
  });

  it("keeps className on its root while loading, failed and ready", async () => {
    let settle: (text: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      settle = resolve;
    });
    const { container } = render(
      <ContentRenderers renderers={[codeContent]}>
        <Content
          source={file("main.py", { load: () => pending })}
          placement="viewer"
          className="marked"
        />
        <Content
          source={file("lost.py", {
            load: () => Promise.reject(new Error("gone")),
          })}
          placement="viewer"
          className="marked"
        />
      </ContentRenderers>,
    );
    const roots = () =>
      [...container.children].map((element) => element.className);
    expect(roots()).toEqual(["marked", "marked"]);
    await screen.findByText("gone");
    await act(async () => settle("print(1)"));
    await screen.findByTestId("code-block");
    expect(roots()).toEqual(["marked", "marked"]);
  });

  it("shows the download link while loading", () => {
    draw(file("main.py", { load: () => new Promise<string>(() => {}) }));
    const link = screen.getByRole("link", { name: "main.py" });
    expect(link.getAttribute("href")).toBe("https://app.example/main.py");
    expect(screen.queryByTestId("code-block")).toBeNull();
  });

  it("offers a retry after a failed load", async () => {
    let attempt = 0;
    const load = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("offline");
      return "fn main() {}";
    });
    draw(file("main.rs", { load }));
    expect(await screen.findByText("offline")).toBeTruthy();
    expect(screen.getByRole("link", { name: "main.rs" })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    const block = await screen.findByTestId("code-block");
    expect(block.textContent).toBe("fn main() {}");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("leaves a file it refuses to the fallback", () => {
    draw(file("bundle.zip", { mime: "application/zip" }));
    expect(screen.getByRole("link", { name: "bundle.zip" })).toBeTruthy();
    expect(screen.queryByTestId("code-block")).toBeNull();
  });
});

describe("size cap", () => {
  const huge = "x".repeat(TEXT_PREVIEW_MAX_BYTES + 1);

  it("does not load a file declared over the hard cap", () => {
    const load = vi.fn(async () => "print(1)");
    draw(file("big.py", { size: TEXT_PREVIEW_HARD_MAX_BYTES + 1, load }));
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "big.py" })).toBeTruthy();
    expect(screen.getByText("This file is too large to preview.")).toBeTruthy();
    expect(screen.queryByTestId("code-block")).toBeNull();
  });

  it("loads a file declared over the cap, and draws it plain in a capped box", async () => {
    draw(
      file("big.py", {
        size: TEXT_PREVIEW_MAX_BYTES + 1,
        load: async () => huge,
      }),
    );
    const block = await screen.findByTestId("code-block");
    expect(block.dataset.plain).toBe("true");
    expect(block.dataset.lineNumbers).toBe("true");
    expect(block.className).toBe("max-h-80 overflow-hidden");
  });

  it("caps a plain file to the viewer's pane", async () => {
    render(
      <ContentRenderers renderers={[codeContent]}>
        <Content
          source={file("big.py", { load: async () => huge })}
          placement="viewer"
        />
      </ContentRenderers>,
    );
    const block = await screen.findByTestId("code-block");
    expect(block.className).toBe(
      "max-h-(--attachment-pane-height) overflow-auto",
    );
  });

  it("loads a file declared at the cap", async () => {
    draw(
      file("edge.py", {
        size: TEXT_PREVIEW_MAX_BYTES,
        load: async () => "print(1)",
      }),
    );
    const block = await screen.findByTestId("code-block");
    expect(block.textContent).toBe("print(1)");
    expect(block.dataset.plain).toBe("false");
    // Highlighted off the main thread, inside the same cap plain text gets.
    expect(block.dataset.offThread).toBe("true");
    expect(block.className).toBe("max-h-80 overflow-hidden");
  });

  it("draws a file of unknown size plain once it loads over the cap", async () => {
    draw(file("big.py", { load: async () => huge }));
    const block = await screen.findByTestId("code-block");
    expect(block.dataset.plain).toBe("true");
    expect(block.textContent).toBe(huge);
  });

  it("draws an inline source over the cap plain", () => {
    draw(inline(huge, "ts"));
    const block = screen.getByTestId("code-block");
    expect(block.dataset.plain).toBe("true");
    expect(block.dataset.offThread).toBe("false");
    expect(block.textContent).toBe(huge);
  });
});

describe("exceedsBytes", () => {
  it("counts UTF-8 bytes, not UTF-16 units", () => {
    expect(exceedsBytes("abc", 3)).toBe(false);
    expect(exceedsBytes("abcd", 3)).toBe(true);
    // é is two bytes, 中 three, 😀 four (two surrogates).
    expect(exceedsBytes("é", 1)).toBe(true);
    expect(exceedsBytes("é", 2)).toBe(false);
    expect(exceedsBytes("中中", 5)).toBe(true);
    expect(exceedsBytes("中中", 6)).toBe(false);
    expect(exceedsBytes("😀", 3)).toBe(true);
    expect(exceedsBytes("😀", 4)).toBe(false);
  });
});
