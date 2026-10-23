import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("asciinema-player");
  vi.resetModules();
});

describe("loadPlayer", () => {
  it("imports the player once", async () => {
    const factory = vi.fn(() => ({ create: () => null }));
    vi.doMock("asciinema-player", factory);
    const { loadPlayer } = await import("../src/load-player.ts");
    const first = await loadPlayer();
    expect(await loadPlayer()).toBe(first);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("imports again after a failed import", async () => {
    let fail = true;
    vi.doMock("asciinema-player", () => {
      if (fail) throw new Error("chunk failed");
      return { create: () => null };
    });
    const { loadPlayer } = await import("../src/load-player.ts");
    await expect(loadPlayer()).rejects.toThrow();
    fail = false;
    // vitest's registry keeps the failed module; a browser refetches the chunk.
    vi.resetModules();
    await expect(loadPlayer()).resolves.toHaveProperty("create");
  });
});
