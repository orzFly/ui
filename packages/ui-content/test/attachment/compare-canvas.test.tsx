import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttachmentViewer,
  AttachmentViewerProvider,
  type AttachmentViewerState,
  type CompareItem,
  type ComparePair,
  useAttachmentViewer,
} from "../../src/attachment/index.ts";
import {
  type CompareMode,
  CompareModeProvider,
  useCompareMode,
} from "../../src/compare/index.ts";
import { file } from "./fixtures.tsx";

// happy-dom lays nothing out; the canvas measures as 800×600, which puts a
// 400-wide pair side by side with the second pane from x = 404.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  Element.prototype.setPointerCapture ??= () => {};
});

afterEach(() => vi.restoreAllMocks());

const image = (
  label: string,
  name: string,
  extra: Partial<CompareItem> = {},
): CompareItem => ({
  label,
  file: file(name, { mime: "image/png", size: label === "v1" ? 49152 : 53248 }),
  size: { width: 400, height: 300 },
  ...extra,
});

const pair = (name: string, afterName = name): ComparePair => ({
  before: image("v1", name),
  after: image("v2", afterName, { size: { width: 400, height: 340 } }),
});

// Wider than tall by far: images this shape stack, drawings never do.
const DRAWINGS: ComparePair = {
  title: "flow.mmd",
  before: {
    label: "v1",
    content: <svg data-side-svg="before" />,
    size: { width: 2000, height: 400 },
  },
  after: {
    label: "v2",
    content: <svg data-side-svg="after" />,
    size: { width: 2000, height: 400 },
  },
  footer: <p>mermaid · sequence</p>,
};

function Viewer({
  pairs,
  index = 0,
  mode,
}: {
  pairs: ComparePair[];
  index?: number;
  mode?: CompareMode;
}) {
  const [state, setState] = useState<AttachmentViewerState | null>({
    compare: pairs,
    index,
  });
  return (
    <CompareModeProvider defaultMode={mode}>
      <AttachmentViewer
        state={state}
        onNavigate={(i) => setState((s) => s && { ...s, index: i })}
        onClose={() => setState(null)}
      />
    </CompareModeProvider>
  );
}

const canvas = () => screen.getByTestId("compare-canvas");
const transforms = () =>
  [...canvas().querySelectorAll("img")].map((img) => img.style.transform);
const title = () => screen.getByRole("heading").textContent;

describe("the viewer's comparison", () => {
  it("draws both panes side by side with one transform", () => {
    render(<Viewer pairs={[pair("shot.png")]} />);
    expect(canvas().dataset.direction).toBe("row");
    const [a, b] = transforms();
    expect(a).toMatch(/^translate\(.+\) scale\(.+\)$/);
    expect(b).toBe(a);
  });

  it("stacks a pair far wider than tall", () => {
    const wide: ComparePair = {
      before: image("v1", "a.png", { size: { width: 2000, height: 300 } }),
      after: image("v2", "a.png", { size: { width: 2000, height: 300 } }),
    };
    render(<Viewer pairs={[wide]} />);
    expect(canvas().dataset.direction).toBe("column");
  });

  it("zooms both panes from a wheel over the second", () => {
    render(<Viewer pairs={[pair("shot.png")]} />);
    const [start] = transforms();
    fireEvent.wheel(canvas(), { clientX: 600, clientY: 150, deltaY: -200 });
    const [a, b] = transforms();
    expect(a).not.toBe(start);
    expect(b).toBe(a);
    expect(Number(canvas().dataset.zoom)).toBeGreaterThan(
      Number(canvas().dataset.fit),
    );
  });

  it("moves the swipe split from its slider, never from a drag", () => {
    render(<Viewer pairs={[pair("shot.png")]} mode="swipe" />);
    const cut = () => canvas().style.getPropertyValue("--cut");
    expect(cut()).toBe("50%");
    fireEvent.change(
      screen.getByRole("slider", {
        name: "Swipe between v1 (left) and v2 (right)",
      }),
      { target: { value: "30" } },
    );
    expect(cut()).toBe("30%");
    const at = (clientX: number) => ({
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
      clientX,
      clientY: 100,
    });
    fireEvent.pointerDown(canvas(), at(100));
    fireEvent.pointerMove(canvas(), at(300));
    fireEvent.pointerUp(canvas(), at(300));
    expect(cut()).toBe("30%");
  });

  it("fades the new side in onion skin", () => {
    render(<Viewer pairs={[pair("shot.png")]} mode="onion" />);
    expect(screen.getByRole("slider", { name: "Opacity of v2" })).toBeTruthy();
    const layer = canvas().querySelector<HTMLElement>(
      '[data-slot="compare-layer"][data-side="after"]',
    );
    expect(layer?.style.opacity).toBe("0.5");
  });

  it("writes a mode chosen in the bar to the shared mode", () => {
    let seen = "";
    function Reader() {
      [seen] = useCompareMode();
      return null;
    }
    render(
      <CompareModeProvider>
        <AttachmentViewer
          state={{ compare: [pair("shot.png")], index: 0 }}
          onNavigate={() => {}}
          onClose={() => {}}
        />
        <Reader />
      </CompareModeProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Difference" }));
    expect(seen).toBe("diff");
    expect(canvas().dataset.mode).toBe("diff");
  });

  // The render that switches to side by side runs before the canvas is
  // measured again, against the single pane an overlay mode is cut into.
  it.each(["swipe", "onion", "diff"] as const)(
    "goes from %s to side by side with both panes",
    (mode) => {
      render(<Viewer pairs={[pair("shot.png")]} mode={mode} />);
      fireEvent.click(screen.getByRole("button", { name: "Side by side" }));
      expect(canvas().dataset.mode).toBe("2up");
      expect(canvas().dataset.direction).toBe("row");
      const [a, b] = transforms();
      expect(b).toBe(a);
      fireEvent.click(screen.getByRole("button", { name: "Swipe" }));
      fireEvent.click(screen.getByRole("button", { name: "Side by side" }));
      expect(transforms()).toHaveLength(2);
    },
  );

  it("disables the zoom controls once an image fails to load", () => {
    render(<Viewer pairs={[pair("shot.png")]} />);
    const readout = () =>
      screen.getByRole("button", { name: "zoom and display options" });
    expect(readout()).not.toHaveProperty("disabled", true);
    act(() => {
      fireEvent.error(canvas().querySelectorAll("img")[1] as Element);
    });
    expect(readout()).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "zoom in" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("titles a pair by the new name, or by both when they differ", () => {
    const { unmount } = render(<Viewer pairs={[pair("login.png")]} />);
    expect(title()).toBe("login.png");
    unmount();
    render(<Viewer pairs={[pair("login.png", "sign-in.png")]} />);
    expect(title()).toBe("login.png → sign-in.png");
  });

  it("offers each side for download under its own name", () => {
    render(<Viewer pairs={[pair("login.png", "sign-in.png")]} />);
    const before = screen.getByRole("link", { name: "Download v1" });
    const after = screen.getByRole("link", { name: "Download v2" });
    expect(before.getAttribute("href")).toBe(
      "https://app.example/files/login.png",
    );
    expect(before.getAttribute("download")).toBe("login.png");
    expect(after.getAttribute("download")).toBe("sign-in.png");
    expect(screen.getByText("image/png · 48 KB → 52 KB")).toBeTruthy();
    expect(screen.queryByText("Open in new tab")).toBeNull();
  });

  it("pages through the comparisons in order and wraps round", () => {
    render(<Viewer pairs={[pair("a.png"), pair("b.png"), pair("c.png")]} />);
    expect(title()).toBe("a.png");
    expect(screen.getByText("1 / 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "next comparison" }));
    expect(title()).toBe("b.png");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(title()).toBe("c.png");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(title()).toBe("a.png");
    fireEvent.click(
      screen.getByRole("button", { name: "previous comparison" }),
    );
    expect(title()).toBe("c.png");
  });

  it("has no paging for a lone comparison", () => {
    render(<Viewer pairs={[pair("a.png")]} />);
    expect(
      screen.queryByRole("button", { name: "next comparison" }),
    ).toBeNull();
  });

  it("leaves the arrows to a focused swipe slider", () => {
    render(<Viewer pairs={[pair("a.png"), pair("b.png")]} mode="swipe" />);
    const slider = screen.getByRole("slider", {
      name: "Swipe between v1 (left) and v2 (right)",
    });
    slider.focus();
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(title()).toBe("a.png");
    // Off the slider the same key pages.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(title()).toBe("b.png");
  });

  it("opens from the provider's openCompare", () => {
    function Opener() {
      const viewer = useAttachmentViewer();
      return (
        <button
          type="button"
          onClick={() => viewer?.openCompare([pair("a.png"), pair("b.png")], 1)}
        >
          open
        </button>
      );
    }
    render(
      <AttachmentViewerProvider>
        <Opener />
      </AttachmentViewerProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "open" }));
    expect(title()).toBe("b.png");
    expect(screen.getByText("2 / 2")).toBeTruthy();
  });
});

describe("the viewer's comparison of drawings", () => {
  const drawings = () => [
    ...canvas().querySelectorAll<HTMLElement>('[data-slot="compare-drawing"]'),
  ];

  const places = () =>
    [
      ...canvas().querySelectorAll<HTMLElement>('[data-slot="compare-pane"]'),
    ].map((pane) => [pane.style.left, pane.style.top]);
  // Narrower than the page's comparison stacks at, with no styles to read a
  // root font size from.
  const narrow = () =>
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(360);

  it("stays side by side whatever the shared mode, left and right in a wide canvas", () => {
    render(<Viewer pairs={[DRAWINGS]} mode="swipe" />);
    expect(canvas().dataset.mode).toBe("2up");
    expect(canvas().dataset.direction).toBe("row");
    expect(screen.queryByRole("group", { name: "Comparison" })).toBeNull();
    expect(places()).toEqual([
      ["0px", "0px"],
      ["404px", "0px"],
    ]);
  });

  it("stacks one above the other in a canvas as narrow as a stacked page comparison", () => {
    narrow();
    render(<Viewer pairs={[DRAWINGS]} />);
    expect(canvas().dataset.direction).toBe("column");
    const [first, second] = places();
    expect(first).toEqual(["0px", "0px"]);
    expect(second?.[0]).toBe("0px");
    expect(Number.parseFloat(second?.[1] ?? "")).toBeGreaterThan(0);
  });

  it("stays stacked once maximized in a narrow canvas", () => {
    narrow();
    render(<Viewer pairs={[DRAWINGS]} />);
    fireEvent.click(screen.getByRole("button", { name: "maximize" }));
    expect(screen.getByRole("button", { name: "restore size" })).toBeTruthy();
    expect(canvas().dataset.direction).toBe("column");
  });

  it("leaves two images to their own rule in a narrow canvas", () => {
    narrow();
    const tall: ComparePair = {
      before: image("v1", "a.png", { size: { width: 300, height: 2000 } }),
      after: image("v2", "a.png", { size: { width: 300, height: 2000 } }),
    };
    render(<Viewer pairs={[tall]} />);
    expect(canvas().dataset.direction).toBe("row");
  });

  it("draws each side's content at its natural size under one transform, with no checkerboard", () => {
    render(<Viewer pairs={[DRAWINGS]} />);
    const [a, b] = drawings();
    expect(a?.querySelector('svg[data-side-svg="before"]')).not.toBeNull();
    expect(b?.querySelector('svg[data-side-svg="after"]')).not.toBeNull();
    expect(a?.style.width).toBe("2000px");
    expect(a?.style.transform).toMatch(/^translate\(.+\) scale\(.+\)$/);
    expect(b?.style.transform).toBe(a?.style.transform);
    expect(canvas().querySelectorAll("img")).toHaveLength(0);
    for (const pane of canvas().querySelectorAll('[data-slot="compare-pane"]'))
      expect(pane.querySelector('[aria-hidden="true"]')).toBeNull();
    fireEvent.wheel(canvas(), { clientX: 600, clientY: 150, deltaY: -200 });
    const [c, d] = drawings();
    expect(Number(canvas().dataset.zoom)).toBeGreaterThan(
      Number(canvas().dataset.fit),
    );
    expect(d?.style.transform).toBe(c?.style.transform);
  });

  it("titles the pair, and draws its own footer instead of downloads", () => {
    render(<Viewer pairs={[DRAWINGS, pair("b.png")]} />);
    expect(title()).toBe("flow.mmd");
    expect(screen.getByText("mermaid · sequence")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Download/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "next comparison" }));
    expect(title()).toBe("b.png");
    expect(screen.getByRole("link", { name: "Download v2" })).toBeTruthy();
  });

  it("offers only fit and 100% in the zoom menu", async () => {
    render(<Viewer pairs={[DRAWINGS]} />);
    const bar = screen.getByRole("heading").parentElement as HTMLElement;
    const readout = within(bar).getByRole("button", {
      name: "zoom and display options",
    });
    fireEvent.pointerDown(readout, { button: 0, pointerType: "mouse" });
    await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Fit0", "100%1"]);
    expect(screen.queryByText("Background")).toBeNull();
  });
});
