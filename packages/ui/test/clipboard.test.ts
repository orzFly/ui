import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copyToClipboard, writeClipboard } from "../src/lib/clipboard.ts";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

describe("writeClipboard", () => {
  it("copies without a word on success", async () => {
    expect(await writeClipboard("a")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("a");
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts a failure", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    expect(await writeClipboard("a")).toBe(false);
    expect(toast.error).toHaveBeenCalledOnce();
  });
});

describe("copyToClipboard", () => {
  it("says what was copied", async () => {
    expect(await copyToClipboard("a", "Code copied")).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Code copied");
  });

  it("toasts a failure only", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    expect(await copyToClipboard("a", "Code copied")).toBe(false);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledOnce();
  });
});
