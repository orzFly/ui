import { Content, ContentRenderers, type ContentSource } from "@orz/ui-content";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEX_PREVIEW_MAX_BYTES, hexContent } from "../src/content.tsx";
import type { ByteSource } from "../src/source.ts";

// The view has tests of its own; here it only shows what it was handed.
vi.mock("../src/hex-view.tsx", () => ({
  HexView: ({
    source,
    "aria-label": label,
  }: {
    source: ByteSource;
    "aria-label"?: string;
  }) => (
    <div data-testid="hex" data-size={source.size}>
      {label}
    </div>
  ),
}));

const file = (
  overrides: Partial<Extract<ContentSource, { kind: "file" }>> = {},
): ContentSource => ({
  kind: "file",
  name: "cache.bin",
  mime: "application/octet-stream",
  url: "/files/cache.bin",
  ...overrides,
});

function mount(source: ContentSource) {
  return render(
    <ContentRenderers renderers={[hexContent]}>
      <Content source={source} placement="viewer" />
    </ContentRenderers>,
  );
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockImplementation(
    async () => new Response(new Uint8Array([0, 1, 2, 3, 4])),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("hexContent", () => {
  it("accepts a binary file with a url, in the viewer only", () => {
    expect(hexContent.accepts(file(), "viewer")).toBe(true);
    expect(hexContent.accepts(file({ name: "bundle.zip" }), "viewer")).toBe(
      true,
    );
    expect(hexContent.accepts(file(), "document")).toBe(false);
    expect(hexContent.accepts(file({ url: undefined }), "viewer")).toBe(false);
    expect(hexContent.accepts(file({ deleted: true }), "viewer")).toBe(false);
    expect(
      hexContent.accepts(
        file({ name: "notes.txt", mime: "text/plain" }),
        "viewer",
      ),
    ).toBe(false);
    expect(
      hexContent.accepts({ kind: "inline", text: "00 01" }, "viewer"),
    ).toBe(false);
  });

  it("draws the fetched bytes", async () => {
    mount(file());
    const hex = await screen.findByTestId("hex");
    expect(hex.dataset.size).toBe("5");
    expect(hex.textContent).toBe("cache.bin");
    expect(fetchMock).toHaveBeenCalledWith(
      "/files/cache.bin",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("never fetches a file declared over the cap", () => {
    mount(file({ size: HEX_PREVIEW_MAX_BYTES + 1 }));
    expect(
      screen.getByText("Too large to preview — download to view."),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not draw a file that turns out over the cap", async () => {
    const blob = new Blob([]);
    Object.defineProperty(blob, "size", { value: HEX_PREVIEW_MAX_BYTES + 1 });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      blob: async () => blob,
    } as Response);
    mount(file());
    expect(
      await screen.findByText("Too large to preview — download to view."),
    ).toBeTruthy();
    expect(screen.queryByTestId("hex")).toBeNull();
  });

  it("offers Retry when the fetch fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 503, statusText: "Service Unavailable" }),
    );
    mount(file());
    expect(await screen.findByText("503 Service Unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("hex")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
