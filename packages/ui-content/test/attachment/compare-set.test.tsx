import { fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttachmentViewer,
  AttachmentViewerProvider,
  type ComparePair,
  useAttachmentViewer,
  useViewerCompare,
} from "../../src/attachment/index.ts";
import { type ContentRenderer, ContentRenderers } from "../../src/index.ts";
import { file } from "./fixtures.tsx";

// happy-dom lays nothing out; the canvas measures as 800×600.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
});

afterEach(() => vi.restoreAllMocks());

const pair = (name: string): ComparePair => ({
  before: {
    label: "v1",
    file: file(name, { mime: "image/png" }),
    size: { width: 400, height: 300 },
  },
  after: {
    label: "v2",
    file: file(name, { mime: "image/png" }),
    size: { width: 400, height: 300 },
  },
});

const PAIRS = { a: pair("a.png"), b: pair("b.png"), c: pair("c.png") };

/** A comparison on the page: a button standing in for MediaCompare's pictures. */
function Comparison({
  name,
  value = PAIRS[name as keyof typeof PAIRS] ?? pair(`${name}.png`),
}: {
  name: string;
  value?: ComparePair | null;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const open = useViewerCompare(value, anchor);
  return (
    <div ref={anchor}>
      <button
        type="button"
        data-opens={open === undefined ? "no" : "yes"}
        onClick={open}
      >
        {name}
      </button>
    </div>
  );
}

const opener = (name: string) => screen.getByRole("button", { name });
const title = () =>
  within(screen.getByRole("dialog")).getByRole("heading").textContent;
const next = () =>
  fireEvent.click(screen.getByRole("button", { name: "next comparison" }));
const previous = () =>
  fireEvent.click(screen.getByRole("button", { name: "previous comparison" }));

describe("useViewerCompare", () => {
  it("opens the one clicked, paging through the provider's in document order", () => {
    // The first on the page mounts last.
    const page = (first: boolean) => (
      <AttachmentViewerProvider>
        {first && <Comparison name="a" />}
        <Comparison name="b" />
        <Comparison name="c" />
      </AttachmentViewerProvider>
    );
    const { rerender } = render(page(false));
    rerender(page(true));
    fireEvent.click(opener("b"));
    expect(title()).toBe("b.png");
    expect(screen.getByText("2 / 3")).toBeTruthy();
    previous();
    expect(title()).toBe("a.png");
    next();
    next();
    expect(title()).toBe("c.png");
    next();
    expect(title()).toBe("a.png");
  });

  it("opens nothing while its pair is null, and leaves it out of the others' set", () => {
    const page = (ready: boolean) => (
      <AttachmentViewerProvider>
        <Comparison name="a" />
        <Comparison name="b" value={ready ? PAIRS.b : null} />
        <Comparison name="c" />
      </AttachmentViewerProvider>
    );
    const { rerender } = render(page(false));
    expect(opener("b").dataset.opens).toBe("no");
    fireEvent.click(opener("c"));
    expect(title()).toBe("c.png");
    expect(screen.getByText("2 / 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    // Ready later, it joins without registering again.
    rerender(page(true));
    fireEvent.click(opener("c"));
    expect(screen.getByText("3 / 3")).toBeTruthy();
  });

  it("opens nothing outside a provider", () => {
    render(<Comparison name="a" />);
    expect(opener("a").dataset.opens).toBe("no");
  });

  it("leaves out a comparison the page dropped", () => {
    const page = (all: boolean) => (
      <AttachmentViewerProvider>
        {all && <Comparison name="a" />}
        <Comparison name="b" />
        <Comparison name="c" />
      </AttachmentViewerProvider>
    );
    const { rerender } = render(page(true));
    rerender(page(false));
    fireEvent.click(opener("c"));
    expect(title()).toBe("c.png");
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("pages a nested provider's comparisons apart, in its own viewer", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <AttachmentViewerProvider onStateChange={outer}>
        <Comparison name="a" />
        <AttachmentViewerProvider onStateChange={inner}>
          <Comparison name="b" />
          <Comparison name="c" />
        </AttachmentViewerProvider>
      </AttachmentViewerProvider>,
    );
    fireEvent.click(opener("c"));
    expect(inner).toHaveBeenCalledWith({
      compare: [PAIRS.b, PAIRS.c],
      index: 1,
    });
    expect(outer).not.toHaveBeenCalled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });

  it("hands a controlled provider the set and the index to show", () => {
    const onStateChange = vi.fn();
    render(
      <AttachmentViewerProvider state={null} onStateChange={onStateChange}>
        <Comparison name="a" />
        <Comparison name="b" />
      </AttachmentViewerProvider>,
    );
    fireEvent.click(opener("b"));
    expect(onStateChange).toHaveBeenCalledWith({
      compare: [PAIRS.a, PAIRS.b],
      index: 1,
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("useViewerCompare in the viewer's body", () => {
  /** A document the viewer draws, holding two comparisons. */
  const doc: ContentRenderer = {
    name: "doc",
    accepts: (source) => source.kind === "file" && source.name === "doc.md",
    Component: () => (
      <>
        <Comparison name="x" />
        <Comparison name="y" />
      </>
    ),
  };
  const DOC = file("doc.md", { size: 10 });

  function Open() {
    const viewer = useAttachmentViewer();
    return (
      <button type="button" onClick={() => viewer?.open([DOC], 0)}>
        open
      </button>
    );
  }

  const withDoc = (children: ReactNode) => (
    <ContentRenderers renderers={[doc]}>{children}</ContentRenderers>
  );

  it("pages through the document's comparisons, not the page's", () => {
    render(
      withDoc(
        <AttachmentViewerProvider>
          <Comparison name="a" />
          <Open />
        </AttachmentViewerProvider>,
      ),
    );
    fireEvent.click(opener("open"));
    fireEvent.click(opener("y"));
    expect(title()).toBe("y.png");
    expect(screen.getByText("2 / 2")).toBeTruthy();
    next();
    expect(title()).toBe("x.png");
  });

  it("opens nothing in a viewer no provider holds", () => {
    render(
      withDoc(
        <AttachmentViewer
          state={{ items: [DOC], index: 0 }}
          onNavigate={() => {}}
          onClose={() => {}}
        />,
      ),
    );
    expect(opener("x").dataset.opens).toBe("no");
  });
});
