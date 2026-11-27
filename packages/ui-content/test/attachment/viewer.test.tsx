import { writeClipboard } from "@orz/ui/lib/clipboard";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import {
  ContentRenderers,
  TEXT_PREVIEW_HARD_MAX_BYTES,
} from "../../src/index.ts";
import { file, stubText } from "./fixtures.tsx";

vi.mock("@orz/ui/lib/clipboard", () => ({ writeClipboard: vi.fn() }));

beforeEach(() => {
  vi.mocked(writeClipboard).mockReset().mockResolvedValue(true);
});

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

  it("lays its X out as the title row's last control", () => {
    render(<Controlled initial={{ items: ITEMS, index: 0 }} />);
    const row = screen.getByRole("heading").parentElement as HTMLElement;
    const close = within(row).getByRole("button", { name: "Close" });
    expect(row.lastElementChild).toBe(close);
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("asks before drawing an over-cap text file, then draws it", () => {
    const dialog = body(file("big.txt", { size: TEXT_PREVIEW_MAX_BYTES + 1 }));
    expect(within(dialog).queryByTestId("stub")).toBeNull();
    expect(
      within(dialog).getByText("Large files aren't previewed automatically."),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByText("Preview anyway"));
    expect(within(dialog).getByTestId("stub").textContent).toBe("stub:big.txt");
  });

  it("asks again for the next over-cap file it pages to", () => {
    render(
      <Controlled
        initial={{
          items: [
            file("a.txt", { size: TEXT_PREVIEW_MAX_BYTES + 1 }),
            file("b.txt", { size: TEXT_PREVIEW_MAX_BYTES + 1 }),
          ],
          index: 0,
        }}
      />,
    );
    fireEvent.click(screen.getByText("Preview anyway"));
    expect(screen.getByTestId("stub")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("next attachment"));
    expect(screen.queryByTestId("stub")).toBeNull();
    expect(screen.getByText("Preview anyway")).toBeTruthy();
  });

  it("refuses a text file over the hard cap", () => {
    const dialog = body(
      file("huge.txt", { size: TEXT_PREVIEW_HARD_MAX_BYTES + 1 }),
    );
    expect(within(dialog).queryByTestId("stub")).toBeNull();
    expect(within(dialog).queryByText("Preview anyway")).toBeNull();
    expect(
      within(dialog).getByText("This file is too large to preview."),
    ).toBeTruthy();
    expect(within(dialog).getByText("Previews stop at 10 MB.")).toBeTruthy();
    expect(within(dialog).getByText("Download")).toBeTruthy();
  });

  it.each([
    ["a .zip", file("bundle.zip", { size: 10 })],
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

  it("applies its own text caps", () => {
    const dialog = renderProvider(file("notes.txt", { size: 100 }), {
      textPreviewMaxBytes: 99,
    });
    expect(within(dialog).queryByTestId("stub")).toBeNull();
    expect(within(dialog).getByText("Preview anyway")).toBeTruthy();
  });

  it("draws a large file it is told the reader agreed to, until it pages away", () => {
    const big = file("big.txt", { size: TEXT_PREVIEW_MAX_BYTES + 1 });
    const other = file("other.txt", { size: 10 });
    function Agreed() {
      const viewer = useAttachmentViewer();
      return (
        <button
          type="button"
          onClick={() => viewer?.show(big, { previewAnyway: true })}
        >
          agreed
        </button>
      );
    }
    render(
      <ContentRenderers renderers={RENDERERS}>
        {/* The group hands back copies, as an app's own list of files would. */}
        <AttachmentViewerProvider
          group={() => ({ items: [{ ...big }, { ...other }], index: 0 })}
        >
          <Agreed />
          <Opener target={big} />
        </AttachmentViewerProvider>
      </ContentRenderers>,
    );
    fireEvent.click(screen.getByText("agreed"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByTestId("stub").textContent).toBe("stub:big.txt");
    fireEvent.click(within(dialog).getByLabelText("next attachment"));
    fireEvent.click(within(dialog).getByLabelText("previous attachment"));
    expect(within(dialog).getByText("Preview anyway")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByText("open"));
    expect(screen.getByText("Preview anyway")).toBeTruthy();
  });

  it("still refuses a file past the hard cap it is told the reader agreed to", () => {
    const huge = file("huge.txt", { size: TEXT_PREVIEW_HARD_MAX_BYTES + 1 });
    function Agreed() {
      const viewer = useAttachmentViewer();
      return (
        <button
          type="button"
          onClick={() => viewer?.show(huge, { previewAnyway: true })}
        >
          agreed
        </button>
      );
    }
    render(
      <ContentRenderers renderers={RENDERERS}>
        <AttachmentViewerProvider>
          <Agreed />
        </AttachmentViewerProvider>
      </ContentRenderers>,
    );
    fireEvent.click(screen.getByText("agreed"));
    expect(screen.getByText("This file is too large to preview.")).toBeTruthy();
    expect(screen.queryByTestId("stub")).toBeNull();
  });

  it("applies its own hard cap", () => {
    const dialog = renderProvider(file("notes.txt", { size: 100 }), {
      textPreviewMaxBytes: 10,
      textPreviewHardMaxBytes: 99,
    });
    expect(
      within(dialog).getByText("This file is too large to preview."),
    ).toBeTruthy();
    expect(within(dialog).getByText("Previews stop at 99 B.")).toBeTruthy();
  });
});

describe("AttachmentViewerProvider, controlled", () => {
  const provider = (
    props: Omit<AttachmentViewerProviderProps, "children">,
    target: FileSource = ITEMS[0] as FileSource,
  ) => (
    <ContentRenderers renderers={RENDERERS}>
      <AttachmentViewerProvider {...props}>
        <Opener target={target} />
      </AttachmentViewerProvider>
    </ContentRenderers>
  );

  it("asks the app to open rather than opening itself", () => {
    const onStateChange = vi.fn();
    render(
      provider(
        {
          state: null,
          onStateChange,
          group: (f) => ({ items: ITEMS, index: ITEMS.indexOf(f) }),
        },
        ITEMS[2] as FileSource,
      ),
    );
    fireEvent.click(screen.getByText("open"));
    expect(onStateChange).toHaveBeenCalledWith({ items: ITEMS, index: 2 });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the state it is given, and follows it", () => {
    const { rerender } = render(
      provider({ state: { items: ITEMS, index: 1 } }),
    );
    expect(title()).toBe("b.txt");
    rerender(provider({ state: { items: ITEMS, index: 2 } }));
    expect(title()).toBe("c.txt");
    rerender(provider({ state: null }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports a page and a close, and leaves both to the app", () => {
    const onStateChange = vi.fn();
    render(provider({ state: { items: ITEMS, index: 0 }, onStateChange }));
    fireEvent.click(screen.getByLabelText("next attachment"));
    expect(onStateChange).toHaveBeenLastCalledWith({ items: ITEMS, index: 1 });
    expect(title()).toBe("a.txt");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onStateChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("reports a second close the app has not answered yet", () => {
    const onStateChange = vi.fn();
    render(provider({ state: { items: ITEMS, index: 0 }, onStateChange }));
    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onStateChange.mock.calls).toEqual([[null], [null]]);
  });

  it("pages a comparison by its index", () => {
    const onStateChange = vi.fn();
    const side = (label: string) => ({
      label,
      content: <svg />,
      size: { width: 200, height: 100 },
    });
    const compare = [
      { title: "a.mmd", before: side("v1"), after: side("v2") },
      { title: "b.mmd", before: side("v2"), after: side("v3") },
    ];
    render(provider({ state: { compare, index: 0 }, onStateChange }));
    fireEvent.click(screen.getByLabelText("next comparison"));
    expect(onStateChange).toHaveBeenCalledWith({ compare, index: 1 });
  });

  it("reports its changes when it holds the state itself", () => {
    const onStateChange = vi.fn();
    render(provider({ onStateChange }));
    fireEvent.click(screen.getByText("open"));
    expect(onStateChange).toHaveBeenCalledWith({
      items: [ITEMS[0]],
      index: 0,
    });
    expect(title()).toBe("a.txt");
  });

  it("keeps its controls when an inline onStateChange changes", () => {
    const seen = new Set<unknown>();
    function Probe() {
      seen.add(useAttachmentViewer());
      return null;
    }
    const tree = () => (
      <AttachmentViewerProvider state={null} onStateChange={() => {}}>
        <Probe />
      </AttachmentViewerProvider>
    );
    const { rerender } = render(tree());
    rerender(tree());
    expect(seen.size).toBe(1);
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
    const picture = screen
      .getByRole("dialog")
      .querySelector('[data-slot="media-screen"]');
    fireEvent.keyDown(picture as HTMLElement, { key: "ArrowRight" });
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

describe("AttachmentViewer footer", () => {
  const inline = (extra: { type?: string } = {}) =>
    render(
      <Controlled
        initial={{
          items: [
            {
              kind: "inline",
              text: "flowchart LR\n  A --> B",
              lang: "mermaid",
              ...extra,
            },
          ],
          index: 0,
        }}
      />,
    );
  // The title falls back to the language too.
  const footer = () =>
    screen.getByRole("dialog").lastElementChild as HTMLElement;

  it("names inline text's language and type, and copies the text", async () => {
    inline({ type: "flowchart" });
    expect(within(footer()).getByText("mermaid · flowchart")).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(footer()).getByRole("button", { name: "Copy" }));
    });
    expect(writeClipboard).toHaveBeenCalledWith("flowchart LR\n  A --> B");
  });

  it("names inline text's language alone when it gives no type", () => {
    inline();
    expect(within(footer()).getByText("mermaid")).toBeTruthy();
  });

  it("gives every action a touch target", () => {
    const { unmount } = render(
      <ContentRenderers renderers={RENDERERS}>
        <AttachmentViewerProvider
          viewHref={(f) => `https://app.example/view/${f.name}`}
        >
          <Opener target={ITEMS[0] as FileSource} />
        </AttachmentViewerProvider>
      </ContentRenderers>,
    );
    fireEvent.click(screen.getByText("open"));
    const links = [
      screen.getByText("Open in new tab").closest("a"),
      screen.getByText("Download").closest("a"),
    ];
    for (const link of links)
      expect(link?.className).toContain("touch:hit-area");
    unmount();

    const image = (name: string) =>
      ({
        label: name,
        file: file(`${name}.png`, { mime: "image/png" }),
        size: { width: 4, height: 3 },
      }) as const;
    render(
      <Controlled
        initial={{
          compare: [{ before: image("v1"), after: image("v2") }],
          index: 0,
        }}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Download v1" }).className,
    ).toContain("touch:hit-area");
  });
});
