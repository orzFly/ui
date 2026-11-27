import { writeClipboard } from "@orz/ui/lib/clipboard";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FenceFrame, useInFenceFrame } from "../src/fence-frame.tsx";

// Its own toast on a failure is @orz/ui's to test; the frame only has to
// claim nothing when it fails.
vi.mock("@orz/ui/lib/clipboard", () => ({ writeClipboard: vi.fn() }));

beforeEach(() => {
  vi.mocked(writeClipboard).mockReset().mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const TEXT = "const a = 1;\nconst b = 2;";

const slot = (root: Element, name: string) =>
  root.querySelector(`[data-slot=${name}]`);

function liveText(container: HTMLElement): string {
  return container.querySelector("[aria-live]")?.textContent ?? "";
}

describe("FenceFrame", () => {
  it("floats a toolbar with the language and Copy, and no header", () => {
    const { container } = render(
      <FenceFrame text={TEXT} lang="ts">
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    const tools = slot(container, "fence-tools");
    expect(tools?.textContent).toContain("ts");
    expect(tools?.className).toContain("select-none");
    // Floats only where hover hides it, so a block at rest reserves no row;
    // without hover it would sit on the first line for good.
    expect(tools?.className).toContain("can-hover:absolute");
    expect(tools?.className).toContain("can-hover:opacity-0");
    expect(tools?.className).not.toMatch(/(^|\s)(absolute|opacity-0)\b/);
    expect(tools?.hasAttribute("data-always")).toBe(false);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(slot(container, "fence-head")).toBeNull();
  });

  it("copies the text and says so on the button for 1.5 s", async () => {
    vi.useFakeTimers();
    const { container } = render(
      <FenceFrame text={TEXT} lang="ts">
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    const copy = screen.getByRole("button", { name: "Copy" });
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(writeClipboard).toHaveBeenCalledWith(TEXT);
    expect(copy.querySelector("[data-icon=copied]")).not.toBeNull();
    expect(liveText(container)).toBe("Copied");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(copy.querySelector("[data-icon=copied]")).toBeNull();
    expect(liveText(container)).toBe("");
  });

  it("claims nothing when there is no clipboard", async () => {
    vi.mocked(writeClipboard).mockResolvedValue(false);
    const { container } = render(
      <FenceFrame text={TEXT}>
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    const copy = screen.getByRole("button", { name: "Copy" });
    await act(async () => {
      fireEvent.click(copy);
    });
    expect(copy.querySelector("[data-icon=copied]")).toBeNull();
    expect(liveText(container)).toBe("");
  });

  it("cuts a collapsible block behind a bar that names its lines and shows them in place", () => {
    const { container } = render(
      <FenceFrame text={TEXT} collapsible>
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    const bar = screen.getByRole("button", { name: "Show all 2 lines" });
    expect(bar.dataset.slot).toBe("content-collapse-bar");
    expect(slot(container, "content-collapse")?.textContent).toBe(TEXT);
    // No scroller to tab to, and no Expand above.
    expect(container.querySelector("[tabindex]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand" })).toBeNull();
    // Nothing scrolls under a toolbar reaching into the content.
    expect(slot(container, "fence-tools")?.className).toContain("-mb-3");

    fireEvent.click(bar);
    expect(bar.getAttribute("aria-expanded")).toBe("true");
    expect(bar.textContent).toBe("Show less");
  });

  it("has no bar when not collapsible", () => {
    render(
      <FenceFrame text={TEXT}>
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull();
  });

  it("measures a block whose length is not known up front", () => {
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
      1000,
    );
    render(
      <FenceFrame text={TEXT} collapsible="measure">
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    // A measured block is not counted in lines.
    expect(screen.getByRole("button", { name: "Show all" })).toBeTruthy();
  });

  it("opens the block from ⤢ and from its bar, given onOpen", () => {
    const onOpen = vi.fn();
    render(
      <FenceFrame text={TEXT} icon={<span />} collapsible onOpen={onOpen}>
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    const open = screen.getByRole("button", { name: "Open in the viewer" });
    // After the block's own controls, before Copy.
    expect(open.nextElementSibling?.getAttribute("aria-label")).toBe("Copy");
    fireEvent.click(open);
    const bar = screen.getByRole("button", { name: "Show all" });
    expect(bar.getAttribute("aria-haspopup")).toBe("dialog");
    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(bar.hasAttribute("aria-expanded")).toBe(false);
  });

  it("heads a named block with a download of it, and revokes it on unmount", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:x");
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    const { container, unmount } = render(
      <FenceFrame text={TEXT} lang="yaml" title="compose.yaml">
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    const link = container.querySelector('a[download="compose.yaml"]');
    expect(link?.getAttribute("href")).toBe("blob:x");
    expect(link?.textContent).toBe("compose.yaml");
    const head = slot(container, "content-header");
    expect(head?.className).toContain("select-none");
    // A code file's icon, in the module marker.
    expect(
      slot(head as Element, "module-marker")?.querySelector("svg"),
    ).not.toBeNull();
    expect(slot(container, "fence-tools")).toBeNull();
    // The filename says what the language would.
    expect(
      [...container.querySelectorAll("span")].some(
        (span) => span.textContent === "yaml",
      ),
    ).toBe(false);
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();

    unmount();
    expect(revoke).toHaveBeenCalledWith("blob:x");
  });

  it("keeps the toolbar up, in a row of its own, when asked to", () => {
    const { container } = render(
      <FenceFrame text={TEXT} toolbarAlwaysVisible>
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    const tools = slot(container, "fence-tools");
    expect(tools?.hasAttribute("data-always")).toBe(true);
    // Never hidden, so never over the content.
    expect(tools?.className).not.toContain("absolute");
    expect(tools?.className).not.toContain("opacity-0");
  });

  it("has no Copy when it is given no text", () => {
    render(
      <FenceFrame lang="ts">
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
  });

  it("heads a block given an icon, naming it by its language, muted", () => {
    const { container } = render(
      <FenceFrame icon={<svg data-testid="icon" />} lang="patch">
        <div />
      </FenceFrame>,
    );
    const head = slot(container, "content-header");
    expect(
      slot(head as Element, "module-marker")?.contains(
        screen.getByTestId("icon"),
      ),
    ).toBe(true);
    const lang = screen.getByText("patch");
    expect(head?.contains(lang)).toBe(true);
    expect(lang.className).not.toContain("text-foreground");
    expect(slot(container, "fence-tools")).toBeNull();
  });

  it("leaves its controls' hit areas whole inside the frame on touch", () => {
    const { container } = render(
      <>
        <FenceFrame text={TEXT} lang="ts">
          <div />
        </FenceFrame>
        <FenceFrame text={TEXT} title="a.ts">
          <div />
        </FenceFrame>
      </>,
    );
    const classes = (el: Element | null) => el?.className.split(/\s+/) ?? [];
    // Down from the top, and a hit area tall; the buttons' own room keeps
    // them in from the side.
    const tools = classes(slot(container, "fence-tools"));
    expect(tools).toContain("touch:mt-hit-xs");
    expect(tools).not.toContain("touch:mr-hit-xs");
    const head = classes(slot(container, "content-header"));
    expect(head).toContain("touch:min-h-touch");
    expect(head).not.toContain("touch:pr-hit-xs");
    for (const button of container.querySelectorAll("button")) {
      expect(classes(button)).toContain("mx-(--hit-room)");
    }
  });

  it("tells its content it is framed", () => {
    function Probe() {
      return <span data-testid="probe">{String(useInFenceFrame())}</span>;
    }
    render(
      <>
        <Probe />
        <FenceFrame>
          <Probe />
        </FenceFrame>
      </>,
    );
    expect(screen.getAllByTestId("probe").map((el) => el.textContent)).toEqual([
      "false",
      "true",
    ]);
  });
});
