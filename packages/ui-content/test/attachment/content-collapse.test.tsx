import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ContentCollapse,
  ContentCollapseBody,
  type ContentCollapseProps,
  useContentCollapse,
} from "../../src/attachment/index.ts";
import {
  type ViewerImage,
  ViewerImageContext,
} from "../../src/attachment/viewer-image.ts";

/** The observers the body made, to be told of a change of size by hand. */
let observers: (() => void)[] = [];
let height = 0;

beforeEach(() => {
  observers = [];
  height = 1000;
  // A window 800px tall: cut at 400, drawn whole up to 600.
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    () => height,
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        observers.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(window, "scrollBy").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Probe() {
  const state = useContentCollapse();
  return (
    <span data-testid="probe">
      {state === null ? "none" : String(state.expanded)}
    </span>
  );
}

function draw(props: Omit<ContentCollapseProps, "children">, around?: string) {
  const tree = (
    <ContentCollapse {...props}>
      <Probe />
      <ContentCollapseBody>
        <p>body</p>
      </ContentCollapseBody>
    </ContentCollapse>
  );
  return render(
    around === "viewer" ? (
      <ViewerImageContext.Provider value={{} as ViewerImage}>
        {tree}
      </ViewerImageContext.Provider>
    ) : (
      tree
    ),
  );
}

const bar = () =>
  document.querySelector<HTMLButtonElement>("[data-slot=content-collapse-bar]");
const box = () =>
  document.querySelector<HTMLElement>("[data-slot=content-collapse] > div");
const fade = () =>
  document.querySelector<HTMLElement>(
    "[data-slot=content-collapse] > [aria-hidden]",
  );
const probe = () => screen.getByTestId("probe").textContent;
const classes = (el: Element | null) => el?.className.split(/\s+/) ?? [];

function resize(next: number) {
  height = next;
  act(() => {
    for (const observer of observers) observer();
  });
}

describe("ContentCollapse", () => {
  it("cuts a count known up front from the first frame", () => {
    // Not measured: a fence's line count says it is long.
    height = 0;
    draw({ collapse: true });
    expect(bar()).not.toBeNull();
    expect(classes(box())).toContain("max-h-[min(416px,50vh)]");
    expect(probe()).toBe("false");
  });

  it("cuts a measured body only past 1.5 times the cut, and again as it changes", () => {
    height = 500;
    draw({ collapse: "measure" });
    expect(bar()).toBeNull();
    expect(classes(box())).not.toContain("max-h-[min(416px,50vh)]");
    expect(classes(box())).not.toContain("max-h-[min(624px,75vh)]");

    resize(700);
    expect(bar()).not.toBeNull();
    expect(classes(box())).toContain("max-h-[min(416px,50vh)]");

    resize(550);
    expect(bar()).toBeNull();
  });

  it("measures again when the window changes", () => {
    height = 610;
    draw({ collapse: "measure" });
    expect(bar()).not.toBeNull();
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(1200);
    // Drawn whole up to 1.5 times the full 416px cut, 624.
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(bar()).toBeNull();
  });

  it("never cuts when collapse is false, and says so to the hook", () => {
    draw({ collapse: false });
    expect(bar()).toBeNull();
    expect(document.querySelector("[data-slot=content-collapse]")).toBeNull();
    expect(probe()).toBe("none");
  });

  it("is null to the hook outside any collapse", () => {
    render(<Probe />);
    expect(probe()).toBe("none");
  });

  describe("in place", () => {
    it("names the lines it would show, and controls the box", () => {
      draw({ collapse: true, lines: 1240 });
      const show = bar() as HTMLButtonElement;
      expect(show.textContent).toBe("Show all 1,240 lines");
      expect(show.getAttribute("aria-expanded")).toBe("false");
      expect(show.getAttribute("aria-haspopup")).toBeNull();
      expect(show.getAttribute("aria-controls")).toBe(box()?.id);
      expect(box()?.id).not.toBe("");
    });

    it("says Show all without a count", () => {
      draw({ collapse: true });
      expect(bar()?.textContent).toBe("Show all");
    });

    it("expands and collapses, keeping the bar where it was on screen", () => {
      vi.spyOn(
        HTMLElement.prototype,
        "getBoundingClientRect",
      ).mockImplementation(function (this: HTMLElement) {
        // The bar sits lower while the body is drawn whole.
        const top = box()?.hasAttribute("data-cut") ? 400 : 1000;
        return { top } as DOMRect;
      });
      draw({ collapse: true, lines: 40 });
      const show = bar() as HTMLButtonElement;

      fireEvent.click(show);
      expect(probe()).toBe("true");
      expect(show.getAttribute("aria-expanded")).toBe("true");
      expect(show.textContent).toBe("Show less");
      expect(classes(box())).not.toContain("max-h-[min(416px,50vh)]");
      expect(fade()).toBeNull();
      expect(window.scrollBy).not.toHaveBeenCalled();

      fireEvent.click(show);
      expect(probe()).toBe("false");
      expect(show.textContent).toBe("Show all 40 lines");
      expect(classes(box())).toContain("max-h-[min(416px,50vh)]");
      expect(window.scrollBy).toHaveBeenCalledWith(0, -600);
    });

    it("expands when something past the cut scrolls the box, keeping it in place", () => {
      draw({ collapse: true });
      const cut = box() as HTMLElement;
      cut.scrollTop = 120;
      fireEvent.scroll(cut);
      expect(probe()).toBe("true");
      expect(window.scrollBy).toHaveBeenCalledWith(0, 120);
    });

    it("ignores a scroll back to the top", () => {
      draw({ collapse: true });
      const cut = box() as HTMLElement;
      cut.scrollTop = 0;
      fireEvent.scroll(cut);
      expect(probe()).toBe("false");
    });
  });

  describe("opening the viewer", () => {
    it("opens rather than expands", () => {
      const onOpen = vi.fn();
      draw({ collapse: true, lines: 40, onOpen });
      const show = bar() as HTMLButtonElement;
      expect(show.textContent).toBe("Show all");
      expect(show.getAttribute("aria-haspopup")).toBe("dialog");
      expect(show.hasAttribute("aria-expanded")).toBe(false);
      expect(show.hasAttribute("aria-controls")).toBe(false);
      fireEvent.click(show);
      expect(onOpen).toHaveBeenCalledTimes(1);
      expect(probe()).toBe("false");
      expect(classes(box())).toContain("max-h-[min(416px,50vh)]");
    });

    it("does not expand on a scroll of the box", () => {
      draw({ collapse: true, onOpen: () => {} });
      const cut = box() as HTMLElement;
      cut.scrollTop = 120;
      fireEvent.scroll(cut);
      expect(probe()).toBe("false");
      expect(window.scrollBy).not.toHaveBeenCalled();
    });

    it("expands in place inside the viewer", () => {
      const onOpen = vi.fn();
      draw({ collapse: true, onOpen }, "viewer");
      const show = bar() as HTMLButtonElement;
      expect(show.getAttribute("aria-haspopup")).toBeNull();
      fireEvent.click(show);
      expect(onOpen).not.toHaveBeenCalled();
      expect(probe()).toBe("true");
    });
  });

  it("drops the bar and the fade from print, and the cut too", () => {
    draw({ collapse: true });
    expect(classes(bar())).toContain("print:hidden");
    expect(classes(fade())).toEqual(
      expect.arrayContaining(["print:hidden", "raymond:hidden"]),
    );
    expect(classes(box())).toContain("print:max-h-none");
  });

  it("draws the bar a row tall, a hit area tall on touch", () => {
    draw({ collapse: true });
    expect(classes(bar())).toEqual(
      expect.arrayContaining([
        "min-h-row",
        "touch:min-h-touch",
        "focus-visible:focus-ring-inset",
      ]),
    );
  });

  it("keeps what is past the cut in the document", () => {
    draw({ collapse: true });
    expect(screen.getByText("body")).toBeTruthy();
  });
});
