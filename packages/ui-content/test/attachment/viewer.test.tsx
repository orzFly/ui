import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AttachmentViewer,
  AttachmentViewerProvider,
  type AttachmentViewerProviderProps,
  type AttachmentViewerState,
  type FileSource,
  htmlContent,
  TEXT_PREVIEW_MAX_BYTES,
  useAttachmentViewer,
  videoContent,
} from "../../src/attachment/index.ts";
import { ContentRenderers } from "../../src/index.ts";
import { file, stubText } from "./fixtures.tsx";

const RENDERERS = [stubText];
const HTML = [htmlContent()];
const MEDIA = [videoContent(), stubText];

const ITEMS = [
  file("a.txt", { size: 10 }),
  file("b.txt", { size: 20 }),
  file("c.txt", { size: 30 }),
];

/** The controlled viewer, holding its own index the way the provider does. */
function Controlled({ initial }: { initial: AttachmentViewerState }) {
  const [state, setState] = useState<AttachmentViewerState | null>(initial);
  return (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewer
        state={state}
        onNavigate={(index) => setState({ ...initial, index })}
        onClose={() => setState(null)}
      />
    </ContentRenderers>
  );
}

const title = () => screen.getByRole("heading").textContent;

describe("AttachmentViewer paging", () => {
  it("pages with the buttons, wrapping at both ends", () => {
    render(<Controlled initial={{ items: ITEMS, index: 0 }} />);
    expect(title()).toBe("a.txt");
    expect(screen.getByText("1 / 3")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("previous attachment"));
    expect(title()).toBe("c.txt");
    fireEvent.click(screen.getByLabelText("next attachment"));
    expect(title()).toBe("a.txt");
    fireEvent.click(screen.getByLabelText("next attachment"));
    expect(title()).toBe("b.txt");
    expect(screen.getByTestId("stub").textContent).toBe("stub:b.txt");
  });

  it("pages with the arrow keys, wrapping at both ends", () => {
    render(<Controlled initial={{ items: ITEMS, index: 2 }} />);
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "ArrowRight" });
    expect(title()).toBe("a.txt");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(title()).toBe("c.txt");
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(title()).toBe("b.txt");
  });

  it("hides the counter and the paging buttons for one item", () => {
    render(
      <Controlled initial={{ items: [ITEMS[0] as FileSource], index: 0 }} />,
    );
    expect(screen.queryByText("1 / 1")).toBeNull();
    expect(screen.queryByLabelText("next attachment")).toBeNull();
  });
});

describe("AttachmentViewer body", () => {
  const body = (f: FileSource) => {
    render(<Controlled initial={{ items: [f], index: 0 }} />);
    return screen.getByRole("dialog");
  };

  it("draws an in-cap text file through the registry", () => {
    const dialog = body(file("notes.txt", { size: TEXT_PREVIEW_MAX_BYTES }));
    expect(within(dialog).getByTestId("stub").textContent).toBe(
      "stub:notes.txt",
    );
  });

  it.each([
    ["a .zip", file("bundle.zip", { size: 10 })],
    [
      "an over-cap .txt",
      file("huge.txt", { size: TEXT_PREVIEW_MAX_BYTES + 1 }),
    ],
    ["a size-less .txt", file("notes.txt")],
  ])("shows the download pane for %s", (_, f) => {
    const dialog = body(f);
    expect(within(dialog).queryByTestId("stub")).toBeNull();
    expect(
      within(dialog).getByText("No inline preview for this file type."),
    ).toBeTruthy();
  });

  it("omits Download for a file with no url", () => {
    const dialog = body({ kind: "file", name: "bundle.zip" });
    expect(within(dialog).queryByText("Download")).toBeNull();
  });

  it("prints the type and size in the footer", () => {
    const dialog = body(file("notes.txt", { mime: "text/plain", size: 1536 }));
    expect(within(dialog).getByText("text/plain · 1.5 KB")).toBeTruthy();
  });
});

function Opener({ target, all }: { target: FileSource; all?: boolean }) {
  const viewer = useAttachmentViewer();
  return (
    <button
      type="button"
      onClick={() => (all ? viewer?.open(ITEMS, 1) : viewer?.show(target))}
    >
      open
    </button>
  );
}

function renderProvider(
  target: FileSource,
  props: Omit<AttachmentViewerProviderProps, "children"> = {},
  all = false,
) {
  render(
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider {...props}>
        <Opener target={target} all={all} />
      </AttachmentViewerProvider>
    </ContentRenderers>,
  );
  fireEvent.click(screen.getByText("open"));
  return screen.getByRole("dialog");
}

describe("AttachmentViewerProvider", () => {
  it("is absent outside a provider", () => {
    let seen: unknown = "unset";
    function Probe() {
      seen = useAttachmentViewer();
      return null;
    }
    render(<Probe />);
    expect(seen).toBeNull();
  });

  it("pages through group's set from the file's index", () => {
    const target = ITEMS[1] as FileSource;
    renderProvider(target, {
      group: (f) => ({ items: ITEMS, index: ITEMS.indexOf(f) }),
    });
    expect(title()).toBe("b.txt");
    expect(screen.getByText("2 / 3")).toBeTruthy();
  });

  it("opens a file group does not know on its own", () => {
    renderProvider(file("stray.txt", { size: 1 }), { group: () => null });
    expect(title()).toBe("stray.txt");
    expect(screen.queryByLabelText("next attachment")).toBeNull();
  });

  it("opens a set at an index", () => {
    renderProvider(ITEMS[0] as FileSource, {}, true);
    expect(title()).toBe("b.txt");
  });

  it("offers Open in new tab when viewHref gives a URL", () => {
    const dialog = renderProvider(ITEMS[0] as FileSource, {
      viewHref: (f) => `https://app.example/view/${f.name}`,
    });
    const link = within(dialog).getByText("Open in new tab").closest("a");
    expect(link?.getAttribute("href")).toBe("https://app.example/view/a.txt");
    expect(link?.getAttribute("target")).toBe("_blank");
  });

  it("leaves Open in new tab out when viewHref gives undefined", () => {
    const dialog = renderProvider(ITEMS[0] as FileSource, {
      viewHref: () => undefined,
    });
    expect(within(dialog).queryByText("Open in new tab")).toBeNull();
    expect(within(dialog).getByText("Download")).toBeTruthy();
  });

  it("applies its own text cap", () => {
    const dialog = renderProvider(file("notes.txt", { size: 100 }), {
      textPreviewMaxBytes: 99,
    });
    expect(within(dialog).queryByTestId("stub")).toBeNull();
  });
});

describe("AttachmentViewer edges", () => {
  it("draws HTML of unknown or large size in its frame", () => {
    for (const size of [undefined, TEXT_PREVIEW_MAX_BYTES * 10]) {
      const html = file("demo.html", { mime: "text/html", size });
      const { unmount } = render(
        <ContentRenderers renderers={HTML}>
          <AttachmentViewer
            state={{ items: [html], index: 0 }}
            onNavigate={() => {}}
            onClose={() => {}}
          />
        </ContentRenderers>,
      );
      expect(
        screen.getByRole("dialog").querySelector("iframe[sandbox]"),
      ).not.toBeNull();
      unmount();
    }
  });

  it("shows the download pane for text no registered renderer draws", () => {
    render(
      <AttachmentViewer
        state={{ items: [file("notes.txt", { size: 5 })], index: 0 }}
        onNavigate={() => {}}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByText("No inline preview for this file type."),
    ).toBeTruthy();
  });

  it("leaves arrow keys to a focused media element", () => {
    const onNavigate = vi.fn();
    render(
      <ContentRenderers renderers={MEDIA}>
        <AttachmentViewer
          state={{
            items: [file("clip.webm"), ITEMS[0] as FileSource],
            index: 0,
          }}
          onNavigate={onNavigate}
          onClose={() => {}}
        />
      </ContentRenderers>,
    );
    const video = screen.getByRole("dialog").querySelector("video");
    fireEvent.keyDown(video as HTMLVideoElement, { key: "ArrowRight" });
    expect(onNavigate).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("stays closed for an index outside the set", () => {
    render(
      <AttachmentViewer
        state={{ items: ITEMS, index: 3 }}
        onNavigate={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
