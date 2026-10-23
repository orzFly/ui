import {
  Content,
  ContentRenderers,
  type ContentSource,
  type Placement,
} from "@orz/ui-content";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ANSI_PREVIEW_MAX_BYTES, logContent } from "../src/content.tsx";

// The chips belong to the view's own suite; here only what the renderer hands
// the view matters, so the stand-in prints its props.
vi.mock("../src/view/ansi-view.tsx", () => ({
  AnsiView: (props: {
    text: string;
    chrome: string;
    levels?: unknown;
    filename?: string;
    maxHeight?: string;
    className?: string;
  }) => (
    <pre
      data-testid="ansi-view"
      data-chrome={props.chrome}
      data-levels={String(props.levels)}
      data-filename={props.filename}
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

function draw(source: ContentSource, placement: Placement = "document") {
  return render(
    <ContentRenderers renderers={[logContent]}>
      <Content source={source} placement={placement} />
    </ContentRenderers>,
  );
}

describe("accepts", () => {
  it.each([
    ["a fence tagged log", inline("x", "log")],
    ["a fence tagged LOG", inline("x", "LOG")],
    ["a .log file", file("x.log")],
    ["a .LOG file", file("X.LOG")],
    [
      "a text/x-log file with parameters",
      file("out", { mime: "text/x-log; charset=utf-8" }),
    ],
  ])("takes %s", (_, source) => {
    expect(logContent.accepts(source, "document")).toBe(true);
    expect(logContent.accepts(source, "viewer")).toBe(true);
  });

  it.each([
    ["an .ansi file", file("x.ansi")],
    ["a fence tagged ansi", inline("x", "ansi")],
    ["an untagged fence", inline("x")],
  ])("refuses %s", (_, source) => {
    expect(logContent.accepts(source, "document")).toBe(false);
    expect(logContent.accepts(source, "viewer")).toBe(false);
  });

  it("is a block", () => {
    expect(logContent.display).toBe("block");
    expect(logContent.name).toBe("log");
  });
});

describe("inline", () => {
  it("draws the pane with levels, capped in a document", () => {
    draw(inline("INFO up", "log"));
    const view = screen.getByTestId("ansi-view");
    expect(view.dataset.chrome).toBe("pane");
    expect(view.dataset.levels).toBe("true");
    expect(view.dataset.maxHeight).toBe("32rem");
  });
});

describe("file", () => {
  it("shows the download link while loading, then the view with levels", async () => {
    let settle: (text: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      settle = resolve;
    });
    draw(file("server.log", { load: () => pending }), "viewer");
    expect(screen.queryByTestId("ansi-view")).toBeNull();
    expect(screen.getByRole("link", { name: /server\.log/ })).toBeTruthy();
    await act(async () => settle("ERROR down\n"));
    const view = await screen.findByTestId("ansi-view");
    expect(view.dataset.chrome).toBe("file");
    expect(view.dataset.levels).toBe("true");
    expect(view.dataset.filename).toBe("server.log");
    expect(view.className).toContain("h-(--attachment-pane-height)");
    expect(view.textContent).toBe("ERROR down");
  });

  it("does not load a file declared over the cap", () => {
    const load = vi.fn(async () => "x");
    draw(file("big.log", { size: ANSI_PREVIEW_MAX_BYTES + 1, load }));
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByText(/Too large to preview/)).toBeTruthy();
    expect(screen.queryByTestId("ansi-view")).toBeNull();
  });
});
