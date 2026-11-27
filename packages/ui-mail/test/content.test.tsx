import type { ContentSource } from "@orz/ui-content";
import { Content, ContentRenderers } from "@orz/ui-content";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emlContent, MAIL_PREVIEW_MAX_BYTES } from "../src/index.ts";

/** Whether postal-mime's chunk fails to arrive. */
const chunk = vi.hoisted(() => ({ fails: false }));

vi.mock("../src/load-postal-mime.ts", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/load-postal-mime.ts")>();
  return {
    loadPostalMime: () =>
      chunk.fails
        ? Promise.reject(
            new Error("Failed to fetch dynamically imported module"),
          )
        : actual.loadPostalMime(),
  };
});

const RAW = [
  "From: alice <noreply@example.com>",
  "Subject: Hello",
  "Content-Type: text/plain",
  "",
  "Body text",
].join("\r\n");

const eml = (extra: Partial<Extract<ContentSource, { kind: "file" }>> = {}) =>
  ({
    kind: "file",
    name: "hello.eml",
    mime: "application/octet-stream",
    url: "https://app.example/files/hello.eml",
    ...extra,
  }) satisfies ContentSource;

afterEach(() => {
  vi.unstubAllGlobals();
  chunk.fails = false;
});

function draw(source: ContentSource) {
  return render(
    <ContentRenderers renderers={[emlContent]}>
      <Content source={source} placement="viewer" />
    </ContentRenderers>,
  );
}

describe("emlContent.accepts", () => {
  it.each([
    ["a .eml with a url, in the viewer", eml(), "viewer", true],
    [
      "message/rfc822 by load alone",
      eml({
        name: "fwd",
        mime: "message/rfc822",
        url: undefined,
        load: async () => RAW,
      }),
      "viewer",
      true,
    ],
    ["a .eml in a document", eml(), "document", false],
    ["a deleted .eml", eml({ deleted: true }), "viewer", false],
    [
      "a .eml with neither url nor load",
      eml({ url: undefined }),
      "viewer",
      false,
    ],
    [
      "a .eml declared text/plain",
      eml({ mime: "text/plain" }),
      "viewer",
      false,
    ],
    ["a patch", eml({ name: "fix.patch" }), "viewer", false],
    ["inline text", { kind: "inline", text: RAW }, "viewer", false],
  ] as const)("%s: %s", (_, source, placement, accepted) => {
    expect(emlContent.accepts(source as ContentSource, placement)).toBe(
      accepted,
    );
  });
});

describe("emlContent", () => {
  it("fetches the file's bytes and draws the message", async () => {
    const fetch = vi.fn(async () => new Response(RAW));
    vi.stubGlobal("fetch", fetch);
    draw(eml());
    expect((await screen.findByRole("heading")).textContent).toBe("Hello");
    expect(fetch).toHaveBeenCalledWith(
      "https://app.example/files/hello.eml",
      expect.anything(),
    );
    expect(
      screen.getByRole("region", { name: "Message text" }).textContent,
    ).toBe("Body text");
  });

  it("reads the text from load when there is no url", async () => {
    draw(eml({ url: undefined, load: async () => RAW }));
    expect((await screen.findByRole("heading")).textContent).toBe("Hello");
  });

  it("offers the download, without fetching, past the size limit", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    draw(eml({ size: MAIL_PREVIEW_MAX_BYTES + 1 }));
    expect(
      screen.getByText("Too large to preview — download to view."),
    ).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says why a fetch failed and tries again on Retry", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("", { status: 503, statusText: "Service Unavailable" }),
      )
      .mockResolvedValueOnce(new Response(RAW));
    vi.stubGlobal("fetch", fetch);
    draw(eml());
    expect(await screen.findByText("503 Service Unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findByRole("heading")).textContent).toBe("Hello");
  });

  it("says when the parser does not load, links the download, and loads it again on Retry", async () => {
    chunk.fails = true;
    vi.stubGlobal("fetch", async () => new Response(RAW));
    draw(eml());
    expect(
      await screen.findByText("Couldn't load the mail reader."),
    ).toBeTruthy();
    expect(
      screen.getByText("Failed to fetch dynamically imported module"),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "hello.eml" }).getAttribute("download"),
    ).toBe("hello.eml");
    chunk.fails = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findByRole("heading")).textContent).toBe("Hello");
  });

  it("says it cannot read a file that is no message, and links the download", async () => {
    vi.stubGlobal("fetch", async () => new Response("nothing to see"));
    draw(eml());
    expect(await screen.findByText("Couldn't read this message.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "hello.eml" }).getAttribute("download"),
    ).toBe("hello.eml");
  });
});
