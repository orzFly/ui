import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AttachmentViewerProvider,
  attachmentCard,
  audioContent,
  type FileSource,
  htmlContent,
  imageContent,
  pdfContent,
  videoContent,
} from "../../src/attachment/index.ts";
import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type Placement,
  useContentDisplay,
} from "../../src/index.ts";
import { file, stubText } from "./fixtures.tsx";

const INNER = file("inner.txt", { size: 5 });

/** Draws `host.txt` as a document that embeds `inner.txt`, one level further down. */
const host: ContentRenderer = {
  name: "host",
  accepts: (source) => source.kind === "file" && source.name === "host.txt",
  Component: () => (
    <div data-testid="host">
      <Content source={INNER} placement="document" />
    </div>
  ),
};

const RENDERERS = [
  attachmentCard(),
  imageContent(),
  htmlContent(),
  pdfContent(),
  videoContent(),
  audioContent(),
  host,
  stubText,
];

function draw(
  source: FileSource,
  placement: Placement = "document",
  options: { provider?: boolean; className?: string } = {},
) {
  const content = (
    <Content
      source={source}
      placement={placement}
      className={options.className}
    />
  );
  return render(
    <ContentRenderers renderers={RENDERERS}>
      {options.provider === false ? (
        content
      ) : (
        <AttachmentViewerProvider>{content}</AttachmentViewerProvider>
      )}
    </ContentRenderers>,
  );
}

describe("attachmentCard", () => {
  it("frames a text file and draws the next renderer inside", () => {
    const { container } = draw(file("notes.txt", { size: 1536 }));
    const frame = container.querySelector("section");
    expect(frame?.textContent).toContain("notes.txt");
    expect(frame?.textContent).toContain("1.5 KB");
    expect(screen.getByTestId("stub").textContent).toBe("stub:notes.txt");
    expect(
      frame?.querySelector("a[download]")?.getAttribute("aria-label"),
    ).toBe("download notes.txt");
  });

  it("asks before drawing a file over maxBytes", () => {
    render(
      <ContentRenderers
        renderers={[attachmentCard({ maxBytes: 10 }), stubText]}
      >
        <Content source={file("big.txt", { size: 11 })} placement="document" />
      </ContentRenderers>,
    );
    expect(
      screen.getByText(/Large files aren't previewed automatically\./),
    ).toBeTruthy();
    expect(screen.queryByTestId("stub")).toBeNull();
    expect(screen.queryByLabelText("expand big.txt")).toBeNull();
    fireEvent.click(screen.getByText("Preview anyway"));
    expect(screen.getByTestId("stub").textContent).toBe("stub:big.txt");
  });

  it("draws the too-large note instead of the file over hardMaxBytes", () => {
    render(
      <ContentRenderers
        renderers={[
          attachmentCard({ maxBytes: 10, hardMaxBytes: 20 }),
          stubText,
        ]}
      >
        <Content source={file("big.txt", { size: 21 })} placement="document" />
      </ContentRenderers>,
    );
    expect(screen.getByText("This file is too large to preview.")).toBeTruthy();
    expect(screen.queryByText("Preview anyway")).toBeNull();
    expect(screen.queryByTestId("stub")).toBeNull();
  });

  it("does not cap a file of unknown size", () => {
    draw(file("notes.txt"));
    expect(screen.getByTestId("stub")).toBeTruthy();
  });

  it("frames at depth 1 and draws a chip at depth 2", () => {
    const { container } = draw(file("host.txt", { size: 5 }));
    // host.txt, at depth 1, is framed and drawn by `host`.
    expect(container.querySelectorAll("section")).toHaveLength(1);
    const inner = screen.getByTestId("host");
    // inner.txt, embedded inside it, is past the limit: a chip, not a frame.
    expect(inner.querySelector("section")).toBeNull();
    const chip = inner.querySelector("a");
    expect(chip?.textContent).toBe("inner.txt");
    expect(inner.querySelector("[data-testid=stub]")).toBeNull();
  });

  it("follows a raised maxDepth", () => {
    const renderers = [attachmentCard({ maxDepth: 2 }), host, stubText];
    const { container } = render(
      <ContentRenderers renderers={renderers}>
        <Content source={file("host.txt", { size: 5 })} placement="document" />
      </ContentRenderers>,
    );
    expect(container.querySelectorAll("section")).toHaveLength(2);
  });

  it("expands into the viewer inside a provider", () => {
    draw(file("notes.txt", { size: 5 }));
    fireEvent.click(screen.getByLabelText("expand notes.txt"));
    expect(screen.getByRole("dialog").textContent).toContain("stub:notes.txt");
  });

  it("draws no expand control for text of unknown size", () => {
    // The viewer would open it on the download pane.
    draw(file("notes.txt"));
    expect(screen.getByTestId("stub")).toBeTruthy();
    expect(screen.queryByLabelText("expand notes.txt")).toBeNull();
  });

  it("draws no expand controls outside a provider", () => {
    draw(file("notes.txt", { size: 5 }), "document", { provider: false });
    expect(screen.queryByLabelText("expand notes.txt")).toBeNull();
  });

  it("puts className on the frame", () => {
    const { container } = draw(file("notes.txt", { size: 5 }), "document", {
      className: "marked",
    });
    expect(container.querySelector("section")?.classList).toContain("marked");
  });

  it("leaves the viewer placement and images alone", () => {
    function Probe({
      source,
      placement,
    }: {
      source: FileSource;
      placement: Placement;
    }) {
      return <span>{String(useContentDisplay(source, placement))}</span>;
    }
    render(
      <ContentRenderers renderers={[attachmentCard()]}>
        <Probe source={file("notes.txt")} placement="viewer" />
        <Probe source={file("logo.svg")} placement="document" />
      </ContentRenderers>,
    );
    expect(screen.getAllByText("null")).toHaveLength(2);
  });
});

describe("imageContent", () => {
  it("opens the viewer on click inside a provider", () => {
    const { container } = draw(file("shot.png"));
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://app.example/files/shot.png");
    expect(img.getAttribute("alt")).toBe("shot.png");
    expect(img.classList).toContain("cursor-zoom-in");
    fireEvent.click(img);
    expect(screen.getByRole("dialog").querySelector("img")).toBeTruthy();
  });

  it("is a plain image outside a provider", () => {
    const { container } = draw(file("shot.png"), "document", {
      provider: false,
    });
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.classList).not.toContain("cursor-zoom-in");
    fireEvent.click(img);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("puts className on the <img> itself", () => {
    const { container } = draw(file("shot.png"), "document", {
      className: "marked",
    });
    expect(container.querySelector("img")?.classList).toContain("marked");
  });

  it("is inline in documents", () => {
    function Probe() {
      return <span>{useContentDisplay(file("shot.png"), "document")}</span>;
    }
    render(
      <ContentRenderers renderers={RENDERERS}>
        <Probe />
      </ContentRenderers>,
    );
    expect(screen.getByText("inline")).toBeTruthy();
  });
});

describe("the frame renderers", () => {
  it("sandboxes HTML to allow-scripts exactly", () => {
    const { container } = draw(file("demo.html"), "viewer");
    const frame = container.querySelector("iframe");
    expect(frame?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame?.getAttribute("src")).toBe(
      "https://app.example/files/demo.html",
    );
  });

  it("gives the PDF frame no sandbox", () => {
    const { container } = draw(file("paper.pdf"), "viewer");
    const frame = container.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.hasAttribute("sandbox")).toBe(false);
  });

  it("loads from the provider's viewHref, or from src when given", () => {
    const { container } = render(
      <ContentRenderers
        renderers={[
          htmlContent(),
          pdfContent({ src: (f) => `https://app.example/raw/${f.name}` }),
        ]}
      >
        <AttachmentViewerProvider
          viewHref={(f) => `https://app.example/view/${f.name}`}
        >
          <Content source={file("demo.html")} placement="viewer" />
          <Content source={file("paper.pdf")} placement="viewer" />
        </AttachmentViewerProvider>
      </ContentRenderers>,
    );
    expect(
      [...container.querySelectorAll("iframe")].map((f) =>
        f.getAttribute("src"),
      ),
    ).toEqual([
      "https://app.example/view/demo.html",
      "https://app.example/raw/paper.pdf",
    ]);
  });

  it.each([
    ["HTML", htmlContent(), "demo.html"],
    ["PDF", pdfContent(), "paper.pdf"],
  ])("refuses %s in document placement", (_, renderer, name) => {
    expect(renderer.accepts(file(name), "document")).toBe(false);
    expect(renderer.accepts(file(name), "viewer")).toBe(true);
  });
});

describe("video and audio", () => {
  it.each([
    ["video", "clip.webm"],
    ["audio", "take.ogg"],
  ])("draws %s under the shared bar, without native controls", (tag, name) => {
    const { container } = draw(file(name), "document", { className: "marked" });
    const media = container.querySelector(tag) as HTMLMediaElement;
    expect(media.hasAttribute("controls")).toBe(false);
    expect(media.getAttribute("preload")).toBe("metadata");
    expect(
      container.querySelector(`[data-slot="${tag}-player"]`)?.classList,
    ).toContain("marked");
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it.each([
    ["video", "clip.webm"],
    ["audio", "take.ogg"],
  ])("puts the name and Download over %s in a document", (_, name) => {
    draw(file(name), "document");
    expect(screen.getByText(name).getAttribute("title")).toBe(name);
    const download = screen.getByRole("link", { name: "Download" });
    expect(download.getAttribute("download")).toBe(name);
  });

  it.each([
    ["video", "clip.webm"],
    ["audio", "take.ogg"],
  ])("draws %s with no header in the viewer", (_, name) => {
    draw(file(name), "viewer");
    expect(screen.queryByRole("link", { name: "Download" })).toBeNull();
  });

  it.each([
    ["video", "clip.avi"],
    ["audio", "take.wma"],
  ])("falls through to the next renderer when %s can't play", (tag, name) => {
    const { container } = draw(
      file(name, {
        mime: tag === "video" ? "video/x-msvideo" : "audio/x-ms-wma",
      }),
      "document",
    );
    const media = container.querySelector(tag) as HTMLMediaElement;
    act(() => {
      media.dispatchEvent(new Event("error"));
    });
    expect(container.querySelector(tag)).toBeNull();
    expect(screen.getByText("This browser can't play this file.")).toBeTruthy();
  });
});

describe("every binary renderer", () => {
  it.each([
    ["image", imageContent(), "shot.png"],
    ["html", htmlContent(), "demo.html"],
    ["pdf", pdfContent(), "paper.pdf"],
    ["video", videoContent(), "clip.mp4"],
    ["audio", audioContent(), "take.mp3"],
  ])("%s refuses a file with no url", (_, renderer, name) => {
    const bare: FileSource = { kind: "file", name };
    expect(renderer.accepts(bare, "viewer")).toBe(false);
    expect(renderer.accepts(file(name), "viewer")).toBe(true);
  });

  it("refuses inline sources", () => {
    for (const renderer of RENDERERS.slice(0, 6)) {
      expect(
        renderer.accepts({ kind: "inline", text: "x", lang: "png" }, "viewer"),
      ).toBe(false);
    }
  });
});
