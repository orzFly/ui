import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
} from "@orz/ui-content";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asciinemaContent, CAST_MAX_BYTES } from "../src/content.tsx";

// The player has tests of its own; here it only shows what it was handed.
vi.mock("../src/asciinema-player.tsx", () => ({
  AsciinemaPlayer: ({ cast, header }: { cast: string; header?: ReactNode }) => (
    <div data-testid="player" data-length={cast.length}>
      {header}
    </div>
  ),
}));

const CAST = [
  { version: 2, width: 80, height: 20, title: "Build and test" },
  [0.5, "o", "$ pnpm test\r\n"],
]
  .map((row) => JSON.stringify(row))
  .join("\n");

/** Accepts everything after asciinema, and shows what it was handed. */
const next: ContentRenderer = {
  name: "next",
  accepts: () => true,
  Component: ({ source }) => (
    <span data-testid="next">
      {source.kind === "file" ? source.name : source.text}
    </span>
  ),
};

function mount(source: ContentSource) {
  return render(
    <ContentRenderers renderers={[asciinemaContent, next]}>
      <Content source={source} placement="document" />
    </ContentRenderers>,
  );
}

const file = (
  overrides: Partial<Extract<ContentSource, { kind: "file" }>> = {},
): ContentSource => ({ kind: "file", name: "session.cast", ...overrides });

let load: ReturnType<typeof vi.fn<(signal: AbortSignal) => Promise<string>>>;

beforeEach(() => {
  load = vi.fn(async () => CAST);
});

describe("asciinemaContent", () => {
  it("accepts .cast files and application/x-asciicast, never inline sources", () => {
    const accepts = (source: ContentSource) =>
      asciinemaContent.accepts(source, "document");
    expect(accepts({ kind: "file", name: "demo.CAST" })).toBe(true);
    expect(
      accepts({ kind: "file", name: "x", mime: "application/x-asciicast" }),
    ).toBe(true);
    expect(asciinemaContent.accepts(file(), "viewer")).toBe(true);
    expect(accepts({ kind: "file", name: "demo.txt" })).toBe(false);
    for (const lang of [undefined, "cast", "asciinema", "json"]) {
      expect(accepts({ kind: "inline", text: CAST, lang })).toBe(false);
    }
  });

  it("never loads a file declared over the cap", () => {
    mount(file({ size: CAST_MAX_BYTES + 1, url: "/session.cast", load }));
    expect(
      screen.getByText("Too large to preview — download to view."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "session.cast" })).toBeTruthy();
    expect(load).not.toHaveBeenCalled();
    expect(screen.queryByTestId("player")).toBeNull();
  });

  it("does not play a file that turns out over the cap", async () => {
    const big = `${CAST}\n${" ".repeat(CAST_MAX_BYTES)}`;
    mount(file({ load: async () => big }));
    expect(
      await screen.findByText("Too large to preview — download to view."),
    ).toBeTruthy();
    expect(screen.queryByTestId("player")).toBeNull();
  });

  it("shows the file's fallback while it loads", () => {
    load.mockImplementation(() => new Promise(() => {}));
    mount(file({ url: "/session.cast", load }));
    expect(screen.getByRole("link", { name: "session.cast" })).toBeTruthy();
    expect(screen.queryByTestId("player")).toBeNull();
  });

  it("offers Retry when the load fails", async () => {
    load.mockRejectedValueOnce(new Error("503 Service Unavailable"));
    mount(file({ load }));
    expect(await screen.findByText("503 Service Unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByTestId("player")).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("hands a cast that does not scan on to the next renderer, with the reason", async () => {
    load.mockResolvedValueOnce('{"version": 2, "width": 80, "height": 24}\nhi');
    mount(file({ load }));
    expect((await screen.findByTestId("next")).textContent).toBe(
      "session.cast",
    );
    expect(screen.getByText("Line 2: not an event")).toBeTruthy();
    expect(screen.queryByTestId("player")).toBeNull();
  });

  it("plays a cast under a header with its title and a Download link", async () => {
    mount(file({ url: "/files/session.cast", load }));
    const player = await screen.findByTestId("player");
    expect(player.dataset.length).toBe(String(CAST.length));
    const title = screen.getByText("Build and test");
    expect(title.getAttribute("title")).toBe("session.cast");
    const download = screen.getByRole("link", { name: "Download" });
    expect(download.getAttribute("href")).toBe("/files/session.cast");
    expect(download.getAttribute("download")).toBe("session.cast");
  });

  it("names an untitled cast by its file, and offers no Download without a url", async () => {
    load.mockResolvedValueOnce(CAST.replace(',"title":"Build and test"', ""));
    mount(file({ load }));
    await screen.findByTestId("player");
    expect(screen.getByText("session.cast")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });
});
