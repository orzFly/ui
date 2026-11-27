import { fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentCard } from "../../src/attachment/index.ts";
import { type ContentSource, useContentTitleBar } from "../../src/index.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Every element measures `height`, in a window 800px tall: past 1.5 times the cut at 600. */
function measure(height: number) {
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
    height,
  );
}

const bar = () => document.querySelector("[data-slot=content-collapse-bar]");

const SOURCE: ContentSource = { kind: "file", name: "a.t" };

/** Portals a "tool" button into the title bar lent for `SOURCE`. */
function Tool() {
  const target = useContentTitleBar(SOURCE);
  return target
    ? createPortal(<button type="button">tool</button>, target)
    : null;
}

describe("DocumentCard", () => {
  it("draws the title bar's controls, header actions, download and expand in that order", async () => {
    const { container } = render(
      <DocumentCard
        name="spec.md"
        meta="1.5 KB"
        headerActions={<button type="button">v3</button>}
        titleBarFor={SOURCE}
        downloadUrl="https://app.example/files/spec.md"
        onExpand={() => {}}
      >
        <Tool />
      </DocumentCard>,
    );
    await screen.findByRole("button", { name: "tool" });
    const header = container.querySelector(
      "[data-slot=content-header]",
    ) as HTMLElement;
    const labels = [...header.querySelectorAll("button, a")]
      .map((el) => el.getAttribute("aria-label") ?? el.textContent)
      // The name, which opens the viewer too.
      .slice(1);
    expect(labels).toEqual([
      "tool",
      "v3",
      "download spec.md",
      "expand spec.md",
    ]);
    expect(screen.getByText("1.5 KB")).toBeTruthy();
    expect(header.querySelector("[data-slot=module-marker] svg")).not.toBe(
      null,
    );
  });

  it("draws download and expand as small toolbar buttons, download still a link", () => {
    render(
      <DocumentCard
        name="spec.md"
        downloadUrl="https://app.example/files/spec.md"
        onExpand={() => {}}
      >
        body
      </DocumentCard>,
    );
    const download = screen.getByLabelText("download spec.md");
    expect(download.tagName).toBe("A");
    expect(download.getAttribute("href")).toBe(
      "https://app.example/files/spec.md",
    );
    const expand = screen.getByLabelText("expand spec.md");
    expect(expand.tagName).toBe("BUTTON");
    for (const control of [download, expand]) {
      expect(control.dataset.slot).toBe("toolbar-button");
      expect(control.dataset.size).toBe("icon-xs");
      // An icon button's hit area and the room it keeps beside it on touch.
      expect(control.className.split(/\s+/)).toEqual(
        expect.arrayContaining(["touch:hit-area", "mx-(--hit-room)"]),
      );
    }
  });

  it("calls onExpand from the name and the expand button", () => {
    const onExpand = vi.fn();
    render(
      <DocumentCard name="spec.md" onExpand={onExpand}>
        body
      </DocumentCard>,
    );
    fireEvent.click(screen.getByLabelText("expand spec.md"));
    fireEvent.click(screen.getByText("spec.md"));
    expect(onExpand).toHaveBeenCalledTimes(2);
  });

  it("draws no expand controls without onExpand", () => {
    render(<DocumentCard name="spec.md">body</DocumentCard>);
    expect(screen.queryByLabelText("expand spec.md")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("spec.md").tagName).toBe("SPAN");
  });

  it("opens a long body in the viewer from its bar", () => {
    measure(1000);
    const onExpand = vi.fn();
    render(
      <DocumentCard name="spec.md" onExpand={onExpand}>
        body
      </DocumentCard>,
    );
    const show = screen.getByRole("button", { name: "Show all" });
    expect(show).toBe(bar());
    expect(show.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(show);
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Show less" })).toBeNull();
    expect(screen.queryByText("Show full document")).toBeNull();
  });

  it("shows the rest of a long body in place without onExpand", () => {
    measure(1000);
    render(<DocumentCard name="spec.md">body</DocumentCard>);
    const show = screen.getByRole("button", { name: "Show all" });
    expect(show.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(show);
    expect(show.getAttribute("aria-expanded")).toBe("true");
    expect(show.textContent).toBe("Show less");
  });

  it("draws a short body whole, with no bar", () => {
    measure(500);
    render(<DocumentCard name="spec.md">body</DocumentCard>);
    expect(bar()).toBeNull();
  });

  it("puts className on the frame", () => {
    const { container } = render(
      <DocumentCard name="spec.md" className="marked">
        body
      </DocumentCard>,
    );
    const frame = container.firstElementChild as HTMLElement;
    expect(frame.dataset.slot).toBe("content-frame");
    expect(frame.classList.contains("marked")).toBe(true);
  });

  it("pads its body, but not around a view that fills it", () => {
    render(
      <DocumentCard name="spec.md">
        <div data-content-flush="" data-testid="flush" />
      </DocumentCard>,
    );
    // Drawn by CSS: the padding gives way to a flush child.
    const body = screen.getByTestId("flush").parentElement as HTMLElement;
    expect(body.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["p-3", "has-[>[data-content-flush]]:p-0"]),
    );
  });
});
