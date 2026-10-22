import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_IMAGE_LOOK,
  parseImageLook,
} from "../../src/attachment/image-look.ts";

const KEY = "test:image-look";

// The store caches what it read at first use, so every case loads a fresh
// copy of the module, the way a page load would.
const freshStore = async () => {
  vi.resetModules();
  return await import("../../src/attachment/image-look.ts");
};

afterEach(() => localStorage.clear());

describe("parseImageLook", () => {
  it("defaults to the checkerboard and smooth scaling", () => {
    expect(parseImageLook(null)).toEqual({
      background: "checker",
      smoothing: "smooth",
    });
    expect(parseImageLook("{")).toEqual(DEFAULT_IMAGE_LOOK);
    expect(parseImageLook("[]")).toEqual(DEFAULT_IMAGE_LOOK);
  });

  it("keeps each valid field and defaults the others", () => {
    expect(
      parseImageLook('{"background":"black","smoothing":"blurry"}'),
    ).toEqual({ background: "black", smoothing: "smooth" });
  });
});

describe("useStoredImageLook", () => {
  it("writes a choice through and reads it back on the next load", async () => {
    const first = await freshStore();
    const a = renderHook(() => first.useStoredImageLook(KEY));
    act(() =>
      a.result.current[1]({ background: "black", smoothing: "smooth" }),
    );
    act(() =>
      a.result.current[1]({ ...a.result.current[0], smoothing: "pixelated" }),
    );
    expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toEqual({
      background: "black",
      smoothing: "pixelated",
    });
    a.unmount();
    const second = await freshStore();
    const b = renderHook(() => second.useStoredImageLook(KEY));
    expect(b.result.current[0]).toEqual({
      background: "black",
      smoothing: "pixelated",
    });
  });

  it("shares one value between hooks on the same key, and none across keys", async () => {
    const store = await freshStore();
    const a = renderHook(() => store.useStoredImageLook(KEY));
    const b = renderHook(() => store.useStoredImageLook(KEY));
    const other = renderHook(() => store.useStoredImageLook("test:other"));
    act(() =>
      a.result.current[1]({ background: "black", smoothing: "smooth" }),
    );
    expect(b.result.current[0].background).toBe("black");
    expect(other.result.current[0]).toEqual(DEFAULT_IMAGE_LOOK);
  });

  it("still switches when storage refuses the write", async () => {
    const store = await freshStore();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    });
    try {
      const { result } = renderHook(() => store.useStoredImageLook(KEY));
      act(() =>
        result.current[1]({ background: "black", smoothing: "smooth" }),
      );
      expect(result.current[0].background).toBe("black");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("follows a choice made in another tab", async () => {
    const store = await freshStore();
    const { result } = renderHook(() => store.useStoredImageLook(KEY));
    expect(result.current[0]).toEqual(DEFAULT_IMAGE_LOOK);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: KEY,
          newValue: '{"background":"black","smoothing":"pixelated"}',
        }),
      );
    });
    expect(result.current[0]).toEqual({
      background: "black",
      smoothing: "pixelated",
    });
  });
});
