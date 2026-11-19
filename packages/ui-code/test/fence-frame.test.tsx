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

  it("caps a collapsible block in a focusable scroller that Expand lifts", () => {
    const { container } = render(
      <FenceFrame text={TEXT} collapsible>
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    const scroller = screen.getByRole("region", { name: "Code" });
    expect(scroller.tabIndex).toBe(0);
    expect(scroller.className).toMatch(/(^|\s)max-h-/);
    // A scroller's lines would pass under a toolbar reaching into it.
    expect(slot(container, "fence-tools")?.className).not.toContain("-mb-3");

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(scroller.hasAttribute("data-expanded")).toBe(true);
    expect(scroller.className).not.toMatch(/(^|\s)max-h-/);
    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(scroller.className).toMatch(/(^|\s)max-h-/);
  });

  it("has neither scroller nor Expand when not collapsible", () => {
    render(
      <FenceFrame text={TEXT}>
        <pre>{TEXT}</pre>
      </FenceFrame>,
    );
    expect(screen.queryByRole("region", { name: "Code" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Expand" })).toBeNull();
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
    expect(slot(container, "fence-head")?.className).toContain("select-none");
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

  it("puts `leading` in a standing header instead of the floating toolbar", () => {
    const { container } = render(
      <FenceFrame leading={<button type="button">Mode</button>}>
        <div />
      </FenceFrame>,
    );
    const head = slot(container, "fence-head");
    expect(head?.querySelector("button")?.textContent).toBe("Mode");
    expect(slot(container, "fence-tools")).toBeNull();
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
