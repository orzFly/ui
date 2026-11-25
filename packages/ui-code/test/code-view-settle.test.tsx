import { render, screen, waitFor } from "@testing-library/react";
import { type Ref, useImperativeHandle } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "../src/code-block.tsx";

const view = vi.hoisted(() => ({ render: vi.fn() }));

vi.mock("@pierre/diffs", () => ({ registerCustomTheme: () => {} }));

// pierre's root holds one box sized to the content, as the real view's does.
vi.mock("@pierre/diffs/react", () => ({
  CodeView: function CodeView({
    ref,
    containerRef,
  }: {
    ref?: Ref<unknown>;
    containerRef?: (node: HTMLDivElement | null) => void;
  }) {
    useImperativeHandle(ref, () => ({
      getInstance: () => ({ render: view.render }),
    }));
    return (
      <div ref={containerRef} data-testid="code-view">
        <div data-testid="content" />
      </div>
    );
  },
}));

type Callback = () => void;
const observers: { callback: Callback; targets: Element[] }[] = [];

beforeEach(() => {
  view.render.mockReset();
  observers.length = 0;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      targets: Element[] = [];
      constructor(callback: Callback) {
        observers.push({ callback, targets: this.targets });
      }
      observe(target: Element) {
        this.targets.push(target);
      }
      disconnect() {
        this.targets.length = 0;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CodeView layout", () => {
  it("lays the view out again when its content's height changes", async () => {
    render(<CodeBlock filename="a.ts" contents="const a = 1;" />);
    const content = await screen.findByTestId("content");
    const watching = await waitFor(() => {
      const found = observers.find((o) => o.targets.includes(content));
      expect(found).toBeDefined();
      return found as (typeof observers)[number];
    });
    expect(view.render).not.toHaveBeenCalled();
    watching.callback();
    expect(view.render).toHaveBeenCalledTimes(1);
  });

  it("stops watching once the view is gone", async () => {
    const { unmount } = render(
      <CodeBlock filename="a.ts" contents="const a = 1;" />,
    );
    const content = await screen.findByTestId("content");
    await waitFor(() => {
      expect(observers.some((o) => o.targets.includes(content))).toBe(true);
    });
    unmount();
    expect(observers.every((o) => o.targets.length === 0)).toBe(true);
  });
});
