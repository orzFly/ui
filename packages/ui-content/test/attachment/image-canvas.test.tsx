import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AttachmentViewer,
  type AttachmentViewerState,
  type FileSource,
  type ImageLook,
  imageContent,
} from "../../src/attachment/index.ts";
import {
  type ContentRenderer,
  ContentRenderers,
  type Placement,
  useContentTitleBar,
} from "../../src/index.ts";
import { file, stubText } from "./fixtures.tsx";

const RENDERERS = [imageContent(), stubText];
const SHOT = file("shot.png", { mime: "image/png" });

function Viewer({
  items,
  imageLook,
  onImageLookChange,
}: {
  items: FileSource[];
  imageLook?: ImageLook;
  onImageLookChange?: (look: ImageLook) => void;
}) {
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
        imageLook={imageLook}
        onImageLookChange={onImageLookChange}
      />
    </ContentRenderers>
  );
}

/** happy-dom never decodes an image, so hand the canvas a size and a load. */
function load(img: HTMLImageElement, w = 1600, h = 1200) {
  Object.defineProperty(img, "naturalWidth", { value: w });
  Object.defineProperty(img, "naturalHeight", { value: h });
  act(() => {
    fireEvent.load(img);
  });
}

const canvas = () => screen.getByTestId("image-canvas");
const titleBar = () => screen.getByRole("heading").parentElement as HTMLElement;

describe("the viewer's image", () => {
  it("draws on a canvas, with its zoom controls in the title bar", () => {
    render(<Viewer items={[SHOT]} />);
    const img = canvas().querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(SHOT.url);
    expect(img.getAttribute("alt")).toBe("shot.png");
    const bar = within(titleBar());
    expect(bar.getByLabelText("zoom in")).toBeTruthy();
    expect(bar.getByLabelText("zoom out")).toBeTruthy();
    expect(bar.getByLabelText("zoom and display options")).toBeTruthy();
  });

  it("leaves the controls disabled until the image has a size", () => {
    render(<Viewer items={[SHOT]} />);
    const options = screen.getByLabelText("zoom and display options");
    expect((options as HTMLButtonElement).disabled).toBe(true);
    load(canvas().querySelector("img") as HTMLImageElement);
    expect((options as HTMLButtonElement).disabled).toBe(false);
    expect(options.textContent).toMatch(/%$/);
  });

  it("falls back to a plain image with no controls when it fails to load", () => {
    render(<Viewer items={[SHOT]} />);
    act(() => {
      fireEvent.error(canvas().querySelector("img") as HTMLImageElement);
    });
    expect(screen.queryByTestId("image-canvas")).toBeNull();
    expect(screen.getByRole("dialog").querySelector("img")).toBeTruthy();
    expect(screen.queryByLabelText("zoom in")).toBeNull();
  });

  it("takes the title bar away when paging to a file that is not an image", () => {
    render(<Viewer items={[SHOT, file("notes.txt", { size: 5 })]} />);
    expect(screen.getByLabelText("zoom in")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("next attachment"));
    expect(screen.getByTestId("stub")).toBeTruthy();
    expect(screen.queryByLabelText("zoom in")).toBeNull();
  });

  it("grows with the zoom, but holds its height while the pointer is on the title-bar controls", () => {
    vi.useFakeTimers();
    try {
      render(
        <Viewer items={[SHOT, file("other.png", { mime: "image/png" })]} />,
      );
      const el = canvas();
      Object.defineProperty(el, "clientWidth", { value: 800 });
      Object.defineProperty(el, "clientHeight", { value: 600 });
      load(el.querySelector("img") as HTMLImageElement);
      expect(el.style.height).toBe("600px");

      const region = screen.getByLabelText("next attachment")
        .parentElement as HTMLElement;
      fireEvent.pointerEnter(region, { pointerType: "mouse" });
      fireEvent.click(screen.getByLabelText("zoom in"));
      expect(el.style.height).toBe("600px");

      // Leaving lets go only after a delay, so a trip over the image
      // between two controls is not a leave.
      fireEvent.pointerLeave(region, { pointerType: "mouse" });
      act(() => {
        vi.advanceTimersByTime(399);
      });
      expect(el.style.height).toBe("600px");
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(el.style.height).toBe("750px");
    } finally {
      vi.useRealTimers();
    }
  });

  it("lets go of a held height at once on a key press", () => {
    render(<Viewer items={[SHOT, file("other.png", { mime: "image/png" })]} />);
    const el = canvas();
    Object.defineProperty(el, "clientWidth", { value: 800 });
    Object.defineProperty(el, "clientHeight", { value: 600 });
    load(el.querySelector("img") as HTMLImageElement);
    const region = screen.getByLabelText("next attachment")
      .parentElement as HTMLElement;
    fireEvent.pointerEnter(region, { pointerType: "mouse" });
    fireEvent.click(screen.getByLabelText("zoom in"));
    fireEvent.pointerLeave(region, { pointerType: "mouse" });
    fireEvent.keyDown(window, { key: "Shift" });
    expect(el.style.height).toBe("750px");
  });
});

describe("image look", () => {
  it("paints the checkerboard under the image by default", () => {
    render(<Viewer items={[SHOT]} />);
    load(canvas().querySelector("img") as HTMLImageElement);
    expect(screen.getByTestId("image-checker")).toBeTruthy();
    expect(canvas().classList).not.toContain("bg-black");
  });

  it("fills the canvas black when the controlled look says so", () => {
    render(
      <Viewer
        items={[SHOT]}
        imageLook={{ background: "black", smoothing: "smooth" }}
      />,
    );
    load(canvas().querySelector("img") as HTMLImageElement);
    expect(screen.queryByTestId("image-checker")).toBeNull();
    expect(canvas().classList).toContain("bg-black");
  });

  it("reports a choice from the menu, and keeps it across paging when uncontrolled", () => {
    const onChange = vi.fn();
    render(
      <Viewer
        items={[SHOT, file("other.png", { mime: "image/png" })]}
        onImageLookChange={onChange}
      />,
    );
    load(canvas().querySelector("img") as HTMLImageElement);
    const trigger = screen.getByLabelText("zoom and display options");
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Black" }));
    expect(onChange).toHaveBeenCalledWith({
      background: "black",
      smoothing: "smooth",
    });
    expect(canvas().classList).toContain("bg-black");
    fireEvent.click(screen.getByLabelText("next attachment"));
    expect(canvas().classList).toContain("bg-black");
  });
});

describe("the viewer's title bar", () => {
  it("is lent to the renderer drawing the file, and to nothing nested in it", () => {
    const seen: Record<string, HTMLElement | null | undefined> = {};
    const outer = file("x.bin");
    const probe: ContentRenderer = {
      name: "probe",
      accepts: (source, placement: Placement) =>
        source.kind === "file" && placement === "viewer",
      Component: ({ source }) => {
        seen.outer = useContentTitleBar(source);
        return <Nested />;
      },
    };
    function Nested() {
      seen.nested = useContentTitleBar({ ...outer });
      return null;
    }
    render(
      <ContentRenderers renderers={[probe]}>
        <AttachmentViewer
          state={{ items: [outer], index: 0 }}
          onNavigate={() => {}}
          onClose={() => {}}
        />
      </ContentRenderers>,
    );
    expect(seen.nested).toBeUndefined();
    expect(seen.outer).toBeTruthy();
    expect(titleBar().contains(seen.outer as HTMLElement)).toBe(true);
  });
});
