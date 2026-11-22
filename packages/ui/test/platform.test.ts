import { afterEach, describe, expect, it, vi } from "vitest";
import { isApplePlatform } from "../src/lib/platform.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const stub = (platform: string, userAgentData?: { platform: string }) =>
  vi.stubGlobal("navigator", { platform, userAgentData });

describe("isApplePlatform", () => {
  it.each(["MacIntel", "iPhone", "iPad"])("is true on %s", (platform) => {
    stub(platform);
    expect(isApplePlatform()).toBe(true);
  });

  it("reads userAgentData first", () => {
    stub("", { platform: "macOS" });
    expect(isApplePlatform()).toBe(true);
    stub("MacIntel", { platform: "Windows" });
    expect(isApplePlatform()).toBe(false);
  });

  it.each(["Win32", "Linux x86_64"])("is false on %s", (platform) => {
    stub(platform);
    expect(isApplePlatform()).toBe(false);
  });
});
