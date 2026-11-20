import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AttachmentViewer,
  type AttachmentViewerState,
  imageContent,
  type ViewerSource,
  ZoomCanvas,
} from "../../src/attachment/index.ts";
import {
  type ContentRenderer,
  ContentRenderers,
  useContentTitleBar,
} from "../../src/index.ts";
import { file, stubText } from "./fixtures.tsx";

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
});

afterEach(() => vi.restoreAllMocks());

/** Stands in for a diagram package: draws `diagram` text as a 1600×400 SVG. */
const diagram: ContentRenderer = {
  name: "diagram",
  accepts: (source, placement) =>
    source.kind === "inline" &&
    source.lang === "diagram" &&
    placement === "viewer",
  Component: function Diagram({ source }) {
    const toolbar = useContentTitleBar(source);
    return (
      <ZoomCanvas
        size={{ width: 1600, height: 400 }}
        toolbar={toolbar}
        data-testid="diagram-canvas"
      >
        <svg data-drawn="" width={1600} height={400} />
      </ZoomCanvas>
    );
  },
};

const RENDERERS = [diagram, imageContent(), stubText];
const FLOW: ViewerSource = {
  kind: "inline",
  lang: "diagram",
  text: "a --> b",
  title: "flow.mmd",
};

function Viewer({ items }: { items: ViewerSource[] }) {
  const [state, setState] = useState<AttachmentViewerState | null>({
    items,
    index: 0,
  });
  return (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewer
        state={state}
        onNavigate={(index) => setState({ items, index })}
        onClose={() => setState(null)}
      />
    </ContentRenderers>
  );
}

const canvas = () => screen.getByTestId("diagram-canvas");
const title = () => screen.getByRole("heading").textContent;

describe("ZoomCanvas", () => {
  it("draws inline text through a renderer in the viewer, titled by it", () => {
    render(<Viewer items={[FLOW]} />);
    expect(title()).toBe("flow.mmd");
    expect(canvas().querySelector("svg[data-drawn]")).not.toBeNull();
    expect(canvas().dataset.fit).toBe("0.5000");
  });

  it("zooms a drawn node under one transform, its box at the natural size", () => {
    render(<Viewer items={[FLOW]} />);
    const picture = canvas().querySelector<HTMLElement>(
      '[data-slot="zoom-canvas-picture"]',
    );
    expect(picture?.style.width).toBe("1600px");
    expect(picture?.style.transform).toBe("translate(0px, 200px) scale(0.5)");
    fireEvent.click(screen.getByLabelText("zoom in"));
    expect(Number(canvas().dataset.zoom)).toBeGreaterThan(0.5);
  });

  it("offers only fit and 100% without a look", async () => {
    render(<Viewer items={[FLOW]} />);
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "zoom and display options" }),
      { button: 0, pointerType: "mouse" },
    );
    await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Fit0", "100%1"]);
    expect(screen.queryByTestId("image-checker")).toBeNull();
  });

  it("keeps the widened dialog when paging to another canvas, and gives it back for text", () => {
    render(
      <Viewer
        items={[
          FLOW,
          file("shot.png", { mime: "image/png" }),
          file("a.txt", { size: 5 }),
        ]}
      />,
    );
    fireEvent.click(screen.getByLabelText("zoom in"));
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.minWidth).not.toBe("");
    fireEvent.click(screen.getByLabelText("next attachment"));
    // The image has not loaded: it asks nothing yet, and the width waits
    // for it.
    expect(screen.getByTestId("image-canvas")).toBeTruthy();
    expect(dialog.style.minWidth).not.toBe("");
    fireEvent.click(screen.getByLabelText("next attachment"));
    expect(screen.getByTestId("stub")).toBeTruthy();
    expect(dialog.style.minWidth).toBe("");
  });

  it("zooms in a box of its own outside a viewer", () => {
    render(
      <ZoomCanvas
        size={{ width: 1600, height: 400 }}
        toolbar={null}
        data-testid="diagram-canvas"
      >
        <svg />
      </ZoomCanvas>,
    );
    expect(canvas().dataset.fit).toBe("0.5000");
    fireEvent.wheel(canvas(), { clientX: 400, clientY: 100, deltaY: -200 });
    expect(Number(canvas().dataset.zoom)).toBeGreaterThan(0.5);
  });
});
