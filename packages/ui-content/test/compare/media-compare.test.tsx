import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  type CompareMode,
  CompareModeProvider,
  type CompareSide,
  MediaCompare,
  type MediaCompareProps,
} from "../../src/compare/index.ts";

// happy-dom never fires `load`, so these hand the sizes over directly.
const side = (
  label: string,
  size: CompareSide["size"],
  failed?: boolean,
): CompareSide => ({
  label,
  content: <img src={`/${label}.png`} alt={label} />,
  size,
  failed,
});

const SAME = { width: 720, height: 400 };

function renderCompare(props: Partial<MediaCompareProps> = {}) {
  return render(
    <MediaCompare
      before={side("v2", SAME)}
      after={side("v5", SAME)}
      {...props}
    />,
  );
}

const mode = (name: string, scope: HTMLElement | Document = document) =>
  [
    ...scope.querySelectorAll<HTMLButtonElement>(
      '[aria-label="Comparison"] button',
    ),
  ].find((button) => button.getAttribute("aria-label") === name) ??
  (() => {
    throw new Error(`no ${name} button`);
  })();

const slot = (name: string, scope: ParentNode = document) =>
  scope.querySelector<HTMLElement>(`[data-slot="${name}"]`);

describe("MediaCompare", () => {
  it("starts side by side, with every mode available once both sizes are known", () => {
    renderCompare();
    expect(mode("Side by side").getAttribute("aria-pressed")).toBe("true");
    for (const name of ["Swipe", "Onion skin", "Difference"]) {
      expect(mode(name).getAttribute("aria-pressed")).toBe("false");
      expect(mode(name).disabled).toBe(false);
    }
  });

  it("offers only side by side while a size is unknown, or a side failed", () => {
    for (const [before, after] of [
      [side("v2", null), side("v5", SAME)],
      [side("v2", SAME), side("v5", null, true)],
      [side("v2", SAME, true), side("v5", SAME)],
    ] as const) {
      const { unmount } = renderCompare({ before, after });
      expect(mode("Side by side").disabled).toBe(false);
      for (const name of ["Swipe", "Onion skin", "Difference"]) {
        expect(mode(name).disabled).toBe(true);
      }
      unmount();
    }
  });

  it("swipes with a range over the stage, cutting at its value", () => {
    renderCompare();
    fireEvent.click(mode("Swipe"));
    const range = screen.getByRole("slider", {
      name: "Swipe between v2 (left) and v5 (right)",
    });
    fireEvent.change(range, { target: { value: "30" } });
    expect(slot("compare-stage")?.style.getPropertyValue("--cut")).toBe("30%");
  });

  it("fades the newer side in onion skin", () => {
    renderCompare({ mode: "onion" });
    expect(screen.getByRole("slider", { name: "Opacity of v5" })).toBeTruthy();
    const layer = document.querySelector<HTMLElement>(
      '[data-slot="compare-layer"][data-side="after"]',
    );
    expect(layer?.style.opacity).toBe("0.5");
  });

  it("says what difference shows", () => {
    renderCompare({ mode: "diff" });
    expect(screen.getByText("Unchanged pixels are black.")).toBeTruthy();
    expect(slot("compare-stage")?.dataset.mode).toBe("diff");
  });

  it("marks only the dimension the two sides disagree on", () => {
    const { container } = renderCompare({
      before: side("v2", { width: 720, height: 400 }),
      after: side("v5", { width: 720, height: 460 }),
    });
    const marked = [...container.querySelectorAll("mark[data-changed]")].map(
      (mark) => mark.textContent,
    );
    expect(marked).toEqual(["400", "460"]);
  });

  it("titles each side's name with all of it, for when a long one is cut", () => {
    const long = "Safari 18 on an iPhone 15 Pro";
    const { container } = renderCompare({ after: side(long, SAME) });
    const names = [
      ...container.querySelectorAll<HTMLElement>(
        '[data-slot="compare-label-name"]',
      ),
    ];
    expect(names.map((name) => name.title)).toEqual(["v2", long]);
    expect(names[1]?.textContent).toBe(long);
  });

  it("draws the replacement instead of a stage, with no mode pressed", () => {
    renderCompare({ replacement: <pre data-testid="source">diff</pre> });
    expect(screen.getByTestId("source")).toBeTruthy();
    expect(slot("compare-sides")).toBeNull();
    expect(
      document.querySelectorAll(
        '[aria-label="Comparison"] [aria-pressed="true"]',
      ),
    ).toHaveLength(0);
  });

  it("puts a title and actions in the head", () => {
    renderCompare({
      title: "flow.mmd",
      actions: <button type="button">Source</button>,
    });
    const head = screen
      .getByRole("button", { name: "Source" })
      .closest('[data-purpose="toolbar"]');
    expect(head?.textContent).toContain("flow.mmd");
  });

  it("draws both sides at one scale, the wider one filling the pane", () => {
    const { container } = renderCompare({
      before: side("v2", { width: 400, height: 300 }),
      after: side("v5", { width: 800, height: 300 }),
    });
    const boxes = [
      ...container.querySelectorAll<HTMLElement>('[data-slot="compare-box"]'),
    ];
    expect(boxes.map((box) => [box.style.width, box.style.maxWidth])).toEqual([
      ["50%", "400px"],
      ["100%", "800px"],
    ]);
  });

  it("sizes the side that drew when the other failed", () => {
    const { container } = renderCompare({
      before: side("v2", null, true),
      after: side("v5", { width: 1456, height: 781 }),
    });
    const [failed, drawn] = container.querySelectorAll<HTMLElement>(
      '[data-slot="compare-box"]',
    );
    expect(failed?.style.width).toBe("");
    expect(drawn?.style.maxWidth).toBe("1456px");
    expect(drawn?.style.width).toBe("100%");
  });

  it("lines the overlay's sides up at the top centre when asked", () => {
    renderCompare({
      mode: "swipe",
      align: "center",
      before: side("v2", { width: 400, height: 300 }),
      after: side("v5", { width: 800, height: 300 }),
    });
    const box = document.querySelector<HTMLElement>(
      '[data-side="before"] > :first-child',
    );
    expect(box?.style.left).toBe("25%");
    expect(box?.style.width).toBe("50%");
  });
});

describe("MediaCompare modes", () => {
  it("offers only the modes it is given, and none with one", () => {
    const { unmount } = renderCompare({ modes: ["2up", "swipe"] });
    expect(
      [...document.querySelectorAll('[aria-label="Comparison"] button')].map(
        (button) => button.getAttribute("aria-label"),
      ),
    ).toEqual(["Side by side", "Swipe"]);
    unmount();
    renderCompare({ modes: ["2up"], mode: "swipe" });
    expect(document.querySelector('[aria-label="Comparison"]')).toBeNull();
    expect(slot("compare-sides")).not.toBeNull();
  });

  it("is controlled by mode, reporting a choice", () => {
    const onModeChange = vi.fn();
    renderCompare({ mode: "2up", onModeChange });
    fireEvent.click(mode("Swipe"));
    expect(onModeChange).toHaveBeenCalledWith("swipe");
    expect(mode("Side by side").getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps its own mode outside a provider", () => {
    render(
      <>
        <div data-testid="one">
          <MediaCompare before={side("v2", SAME)} after={side("v5", SAME)} />
        </div>
        <div data-testid="two">
          <MediaCompare before={side("v2", SAME)} after={side("v5", SAME)} />
        </div>
      </>,
    );
    fireEvent.click(mode("Difference", screen.getByTestId("one")));
    expect(
      mode("Difference", screen.getByTestId("one")).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(
      mode("Side by side", screen.getByTestId("two")).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
  });

  it("switches every comparison under a CompareModeProvider together", () => {
    const changed: CompareMode[] = [];
    render(
      <CompareModeProvider onModeChange={(m) => changed.push(m)}>
        <div data-testid="one">
          <MediaCompare before={side("v2", SAME)} after={side("v5", SAME)} />
        </div>
        <div data-testid="two">
          <MediaCompare before={side("v2", SAME)} after={side("v5", SAME)} />
        </div>
      </CompareModeProvider>,
    );
    const one = screen.getByTestId("one");
    const two = screen.getByTestId("two");
    act(() => fireEvent.click(mode("Difference", one)));
    expect(mode("Difference", two).getAttribute("aria-pressed")).toBe("true");
    expect(
      document.querySelectorAll(
        '[data-slot="compare-stage"][data-mode="diff"]',
      ),
    ).toHaveLength(2);
    expect(changed).toEqual(["diff"]);
  });

  it("draws one side by side, without changing the shared mode, when it cannot overlay", () => {
    render(
      <CompareModeProvider>
        <div data-testid="ok">
          <MediaCompare before={side("v2", SAME)} after={side("v5", SAME)} />
        </div>
        <div data-testid="broken">
          <MediaCompare
            before={side("v2", null, true)}
            after={side("v5", SAME)}
          />
        </div>
      </CompareModeProvider>,
    );
    const ok = screen.getByTestId("ok");
    const broken = screen.getByTestId("broken");
    fireEvent.click(mode("Swipe", ok));
    expect(mode("Side by side", broken).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(slot("compare-sides", broken)).not.toBeNull();
    expect(mode("Swipe", ok).getAttribute("aria-pressed")).toBe("true");
  });

  it("opens the viewer from either side's picture, given onOpen", () => {
    const onOpen = vi.fn();
    const { unmount } = renderCompare({ onOpen });
    const buttons = screen.getAllByRole("button", {
      name: "Open in the viewer",
    });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1] as HTMLElement);
    expect(onOpen).toHaveBeenCalledTimes(1);
    unmount();

    renderCompare();
    expect(
      screen.queryByRole("button", { name: "Open in the viewer" }),
    ).toBeNull();
  });
});
