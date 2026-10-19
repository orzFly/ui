import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  hasUnsavedWork,
  type NavigationContext,
  registerDirtySource,
  useDirtySource,
} from "../src/lib/unsaved-guard.ts";

// The registry is module state shared by every test in this file, so each
// registration is undone here rather than trusted to the test that made it.
const unregister: Array<() => void> = [];
afterEach(() => {
  for (const undo of unregister.splice(0)) undo();
});

const NAVIGATION: NavigationContext = {
  current: { routeId: "/doc/$id", params: { id: "1" } },
  next: { routeId: "/doc/$id/history", params: { id: "1" } },
};

describe("hasUnsavedWork", () => {
  it("is false with nothing registered", () => {
    expect(hasUnsavedWork()).toBe(false);
    expect(hasUnsavedWork(NAVIGATION)).toBe(false);
  });

  it("is true while any source is dirty, and false once it is clean", () => {
    let dirty = true;
    unregister.push(registerDirtySource(() => false));
    unregister.push(registerDirtySource(() => dirty));
    expect(hasUnsavedWork()).toBe(true);
    dirty = false;
    expect(hasUnsavedWork()).toBe(false);
  });

  it("lets a source that survives the navigation stand aside", () => {
    unregister.push(
      registerDirtySource(
        () => true,
        (navigation) => navigation.next.params.id === "1",
      ),
    );
    expect(hasUnsavedWork(NAVIGATION)).toBe(false);
    expect(
      hasUnsavedWork({
        ...NAVIGATION,
        next: { routeId: "/doc/$id", params: { id: "2" } },
      }),
    ).toBe(true);
  });

  it("ignores survives on unload, where there is no navigation to survive", () => {
    unregister.push(
      registerDirtySource(
        () => true,
        () => true,
      ),
    );
    expect(hasUnsavedWork()).toBe(true);
  });

  it("forgets a source once it is unregistered", () => {
    registerDirtySource(() => true)();
    expect(hasUnsavedWork()).toBe(false);
  });
});

describe("useDirtySource", () => {
  it("registers for the component's lifetime and reads the latest predicate", () => {
    const view = renderHook(({ dirty }) => useDirtySource(() => dirty), {
      initialProps: { dirty: false },
    });
    expect(hasUnsavedWork()).toBe(false);

    view.rerender({ dirty: true });
    expect(hasUnsavedWork()).toBe(true);

    view.unmount();
    expect(hasUnsavedWork()).toBe(false);
  });
});
