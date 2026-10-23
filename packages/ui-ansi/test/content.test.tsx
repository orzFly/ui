import {
  Content,
  ContentRenderers,
  type ContentSource,
  type Placement,
} from "@orz/ui-content";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ANSI_PREVIEW_MAX_BYTES, ansiContent } from "../src/content.tsx";

// The view is covered by its own suite; here only what the renderer hands it
// matters, so the stand-in prints its props.
vi.mock("../src/view/ansi-view.tsx", () => ({
  AnsiView: (props: {
    text: string;
    chrome: string;
    filename?: string;
    downloadUrl?: string;
    maxHeight?: string;
    className?: string;
  }) => (
    <pre
      data-testid="ansi-view"
      data-chrome={props.chrome}
      data-filename={props.filename}
      data-download-url={props.downloadUrl}
      data-max-height={props.maxHeight}
      className={props.className}
    >
      {props.text}
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
  placement: Placement = "document",
  className?: string,
) {
  return render(
    <ContentRenderers renderers={[ansiContent]}>
      <Content source={source} placement={placement} className={className} />
    </ContentRenderers>,
  );
}

describe("accepts", () => {
  it.each([
    ["a fence tagged ansi", inline("x", "ansi")],
    ["a fence tagged ANSI", inline("x", "ANSI")],
    ["an .ansi file", file("x.ansi")],
    ["an .ANSI file", file("X.ANSI")],
    [
      "a text/x-ansi file with parameters",
      file("out", { mime: "text/x-ansi; charset=utf-8" }),
    ],
  ])("takes %s", (_, source) => {
    expect(ansiContent.accepts(source, "document")).toBe(true);
    expect(ansiContent.accepts(source, "viewer")).toBe(true);
  });

  it.each([
    ["a .log file", file("build.log")],
    ["a .log file under text/plain", file("build.log", { mime: "text/plain" })],
    ["a fence tagged console", inline("x", "console")],
    ["an untagged fence", inline("x")],
  ])("refuses %s", (_, source) => {
    expect(ansiContent.accepts(source, "document")).toBe(false);
    expect(ansiContent.accepts(source, "viewer")).toBe(false);
  });

  it("is a block", () => {
    expect(ansiContent.display).toBe("block");
    expect(ansiContent.name).toBe("ansi");
  });
});

describe("inline", () => {
  it("draws the pane capped in a document", () => {
    draw(inline("\x1b[31mred\x1b[0m\n", "ansi"), "document", "my-class");
    const view = screen.getByTestId("ansi-view");
    expect(view.dataset.chrome).toBe("pane");
    expect(view.dataset.maxHeight).toBe("32rem");
    expect(view.textContent).toBe("\x1b[31mred\x1b[0m\n");
    expect(view.className).toContain("my-class");
  });

  it("is not capped in the viewer", () => {
    draw(inline("x", "ansi"), "viewer");
    expect(screen.getByTestId("ansi-view").dataset.maxHeight).toBeUndefined();
  });
});

describe("file", () => {
  it("shows the download link while loading, then the view", async () => {
    let settle: (text: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      settle = resolve;
    });
    draw(file("build.ansi", { load: () => pending }));
    expect(screen.queryByTestId("ansi-view")).toBeNull();
    expect(screen.getByRole("link", { name: /build\.ansi/ })).toBeTruthy();
    await act(async () => settle("\x1b[32mok\x1b[0m\r\n"));
    const view = await screen.findByTestId("ansi-view");
    expect(view.dataset.chrome).toBe("file");
    expect(view.dataset.filename).toBe("build.ansi");
    expect(view.dataset.downloadUrl).toBe("https://app.example/build.ansi");
    expect(view.dataset.maxHeight).toBe("32rem");
    expect(view.textContent).toBe("\x1b[32mok\x1b[0m");
  });

  it("drops only one final newline", async () => {
    draw(file("x.ansi", { load: async () => "a\n\n" }));
    expect((await screen.findByTestId("ansi-view")).textContent).toBe("a\n");
  });

  it("fills the pane height in the viewer", async () => {
    draw(file("x.ansi", { load: async () => "a" }), "viewer", "my-class");
    const view = await screen.findByTestId("ansi-view");
    expect(view.dataset.maxHeight).toBeUndefined();
    expect(view.className).toContain("h-(--attachment-pane-height)");
    expect(view.className).toContain("my-class");
  });

  it("offers a retry after a failed load", async () => {
    let calls = 0;
    const load = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("offline");
      return "back";
    });
    draw(file("x.ansi", { load }));
    expect(await screen.findByText("offline")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    expect((await screen.findByTestId("ansi-view")).textContent).toBe("back");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not load a file declared over the cap", () => {
    const load = vi.fn(async () => "x");
    draw(file("big.ansi", { size: ANSI_PREVIEW_MAX_BYTES + 1, load }));
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByText(/Too large to preview/)).toBeTruthy();
    expect(screen.queryByTestId("ansi-view")).toBeNull();
  });

  it("loads a file declared at the cap", async () => {
    draw(
      file("x.ansi", { size: ANSI_PREVIEW_MAX_BYTES, load: async () => "a" }),
    );
    expect(await screen.findByTestId("ansi-view")).toBeTruthy();
  });

  it("shows the fallback for text over the cap once loaded", async () => {
    const big = "x".repeat(ANSI_PREVIEW_MAX_BYTES + 1);
    draw(file("x.ansi", { load: async () => big }));
    expect(await screen.findByText(/Too large to preview/)).toBeTruthy();
    expect(screen.queryByTestId("ansi-view")).toBeNull();
  });
});
