import { act, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "../src/components/copy-button.tsx";
import {
  Toolbar,
  ToolbarButton,
  ToolbarLabel,
} from "../src/components/toolbar.tsx";
import { stubToolbarLayout } from "./stub-toolbar-layout.ts";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

const live = (container: HTMLElement) =>
  container.querySelector("[aria-live]")?.textContent;
const checked = (button: HTMLElement) => button.hasAttribute("data-copied");

async function press(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("CopyButton", () => {
  it("is an icon named Copy, which its tooltip shows", async () => {
    render(<CopyButton text="a" />);
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button.dataset.size).toBe("icon");
    expect(button.dataset.variant).toBe("ghost");
    act(() => button.focus());
    expect(
      document.querySelector("[data-slot=tooltip-content]")?.firstChild
        ?.textContent,
    ).toBe("Copy");
  });

  it("takes words after its icon, at the text size, with no tooltip", () => {
    render(
      <CopyButton text="a" size="sm" variant="outline">
        Copy token
      </CopyButton>,
    );
    const button = screen.getByRole("button", { name: "Copy token" });
    expect(button.dataset.size).toBe("sm");
    expect(button.dataset.variant).toBe("outline");
    expect(button.hasAttribute("aria-label")).toBe(false);
    expect(button.hasAttribute("data-state")).toBe(false);
  });

  it("draws the icon alone as the square of its size", () => {
    render(<CopyButton text="a" size="xs" aria-label="Copy link" />);
    expect(screen.getByRole("button", { name: "Copy link" }).dataset.size).toBe(
      "icon-xs",
    );
  });

  it("is a plain ghost button outside a toolbar, not a toolbar's flat command", () => {
    render(<CopyButton text="a" />);
    const button = screen.getByRole("button", { name: "Copy" });
    expect(button.dataset.variant).toBe("ghost");
    expect(button.className).not.toContain("raymond:border-0");
  });

  it("puts the copying on a button of the caller's own, the icon before its children", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <CopyButton text="a" asChild>
        <ToolbarButton size="icon-xs" aria-label="Copy path" onClick={onClick}>
          <span data-testid="own" />
        </ToolbarButton>
      </CopyButton>,
    );
    const button = screen.getByRole("button", { name: "Copy path" });
    expect(button.dataset.slot).toBe("toolbar-button");
    expect(button.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(button.lastElementChild?.getAttribute("data-testid")).toBe("own");
    await press(button);
    expect(onClick).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith("a");
    expect(checked(button)).toBe(true);
    expect(live(container)).toBe("Copied");
  });

  it("draws the check at the icon's size and place", async () => {
    render(
      <CopyButton
        text="a"
        icon={<svg className="size-3" data-icon="inline-start" />}
      >
        Copy
      </CopyButton>,
    );
    const button = screen.getByRole("button", { name: "Copy" });
    await press(button);
    const check = button.querySelector("svg");
    expect(check?.getAttribute("class")).toContain("size-3");
    expect(check?.getAttribute("data-icon")).toBe("inline-start");
  });

  it("copies, then shows a check and says so for 1.5 s, the time starting again on each press", async () => {
    vi.useFakeTimers();
    const { container } = render(<CopyButton text="token" />);
    const button = screen.getByRole("button", { name: "Copy" });
    await press(button);
    expect(writeText).toHaveBeenCalledWith("token");
    expect(checked(button)).toBe(true);
    expect(live(container)).toBe("Copied");
    expect(toast.success).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    await press(button);
    act(() => vi.advanceTimersByTime(1000));
    expect(checked(button)).toBe(true);
    act(() => vi.advanceTimersByTime(500));
    expect(checked(button)).toBe(false);
    expect(live(container)).toBe("");
  });

  it("reads a function's text at the press, and copies nothing when it gives none", async () => {
    let value: string | null = null;
    const { container } = render(
      <CopyButton text={() => value} copiedLabel="Token copied" />,
    );
    const button = screen.getByRole("button", { name: "Copy" });
    await press(button);
    expect(writeText).not.toHaveBeenCalled();
    expect(checked(button)).toBe(false);

    value = "late";
    await press(button);
    expect(writeText).toHaveBeenCalledWith("late");
    expect(live(container)).toBe("Token copied");
  });

  it("claims nothing when the copy fails, which toasts", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    const { container } = render(<CopyButton text="a" />);
    const button = screen.getByRole("button", { name: "Copy" });
    await press(button);
    expect(checked(button)).toBe(false);
    expect(live(container)).toBe("");
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it("leaves no timer behind once unmounted", async () => {
    vi.useFakeTimers();
    const { unmount } = render(<CopyButton text="a" />);
    await press(screen.getByRole("button", { name: "Copy" }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("starts no timer when unmounted before the copy is done", async () => {
    vi.useFakeTimers();
    let done = () => {};
    writeText.mockReturnValue(
      new Promise<void>((resolve) => {
        done = resolve;
      }),
    );
    const { unmount } = render(<CopyButton text="a" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    unmount();
    await act(async () => done());
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("CopyButton in a Toolbar", () => {
  let layout: ReturnType<typeof stubToolbarLayout>;
  beforeEach(() => {
    layout = stubToolbarLayout(1000);
  });
  afterEach(() => layout.restore());

  it("hides its words to fit, and from the ⋯ menu copies with a toast", async () => {
    render(
      <Toolbar aria-label="Token">
        <CopyButton text="token" copiedLabel="Token copied">
          <ToolbarLabel>Copy token</ToolbarLabel>
        </CopyButton>
      </Toolbar>,
    );
    await act(async () => {});
    const button = screen.getByRole("button", { name: "Copy token" });
    expect(button.dataset.size).toBe("default");
    await layout.resize(40);
    expect(button.dataset.size).toBe("icon");

    await layout.resize(10);
    const more = document.querySelector<HTMLElement>(
      "[data-slot=toolbar-overflow-trigger]",
    );
    if (!more) throw new Error("no ⋯");
    fireEvent.keyDown(more, { key: "Enter" });
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByRole("menuitem", { name: "Copy token" }));
    });
    expect(writeText).toHaveBeenCalledWith("token");
    expect(toast.success).toHaveBeenCalledWith("Token copied");
    expect(checked(button)).toBe(false);
  });
});
