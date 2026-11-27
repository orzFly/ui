import { writeClipboard } from "@orz/ui/lib/clipboard";
import { AttachmentViewerProvider } from "@orz/ui-content/attachment";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MermaidCompare } from "../src/mermaid-compare.tsx";
import type { DiagramResult } from "../src/render.ts";

// The code views stand in for themselves: what is asserted is which one is
// drawn, and with what.
vi.mock("@orz/ui-code", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@orz/ui-code")>()),
  CodeBlock: ({ contents }: { contents: string }) => (
    <pre data-testid="code">{contents}</pre>
  ),
  CodeDiffBlock: ({ before, after }: { before: string; after: string }) => (
    <pre data-testid="fence-diff">{`${before}\n---\n${after}`}</pre>
  ),
}));

// mermaid cannot lay anything out under happy-dom, so the renderer is the
// seam, answering by source.
const results = vi.hoisted(() => new Map<string, DiagramResult>());
const renderDiagram = vi.hoisted(() =>
  vi.fn(
    async (source: string): Promise<DiagramResult> =>
      results.get(source) ?? { ok: false, error: "No diagram type detected" },
  ),
);
vi.mock("../src/render.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/render.ts")>()),
  renderDiagram,
}));
vi.mock("@orz/ui/lib/clipboard", () => ({
  writeClipboard: vi.fn(async () => true),
}));

const OLD = "flowchart LR\n  A[旧]";
const NEW = "flowchart LR\n  A[新]";
const OLD_SVG = '<svg id="m1" viewBox="0 0 552 328"><text>旧</text></svg>';
const NEW_SVG = '<svg id="m2" viewBox="0 0 1360 164"><text>新</text></svg>';
const PARSE_ERROR =
  "Parse error on line 2:\n...\n---^\nExpecting 'SQE', got 'PS'";

beforeEach(() => {
  results.clear();
  results.set(OLD, { ok: true, svg: OLD_SVG, width: 552, height: 328 });
  results.set(NEW, { ok: true, svg: NEW_SVG, width: 1360, height: 164 });
  renderDiagram.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mount(node: ReactNode = <MermaidCompare before={OLD} after={NEW} />) {
  return render(node).container;
}

const drawn = (container: HTMLElement) =>
  container.querySelectorAll(".mermaid-drawing svg");

describe("MermaidCompare", () => {
  it("draws both versions side by side, with no mode control", async () => {
    const container = mount();
    await waitFor(() => expect(drawn(container)).toHaveLength(2));
    expect(renderDiagram.mock.calls.map(([source]) => source).sort()).toEqual(
      [NEW, OLD].sort(),
    );
    expect(screen.queryByTestId("fence-diff")).toBeNull();
    expect(container.querySelector('[aria-label="Comparison"]')).toBeNull();
    expect(
      [...container.querySelectorAll('[data-slot="compare-label-name"]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(["Before", "After"]);
  });

  it("tags its sides with the labels given", async () => {
    const container = mount(
      <MermaidCompare
        before={OLD}
        after={NEW}
        labels={{ before: "v1", after: "v2" }}
        title="flow.mmd"
      />,
    );
    await waitFor(() => expect(drawn(container)).toHaveLength(2));
    expect(
      [...container.querySelectorAll('[data-slot="compare-label-name"]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(["v1", "v2"]);
    expect(screen.getByText("flow.mmd")).toBeTruthy();
  });

  it("switches to the source diff and back", async () => {
    const container = mount();
    await waitFor(() => expect(drawn(container)).toHaveLength(2));
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.getByTestId("fence-diff").textContent).toBe(
      `${OLD}\n---\n${NEW}`,
    );
    expect(drawn(container)).toHaveLength(0);
    const back = screen.getByRole("button", { name: "Diagram" });
    expect(back.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(back);
    expect(drawn(container)).toHaveLength(2);
    expect(screen.queryByTestId("fence-diff")).toBeNull();
  });

  it("shows the side that does not parse as its error and source", async () => {
    results.set(OLD, { ok: false, error: PARSE_ERROR });
    const container = mount();
    await waitFor(() => expect(drawn(container)).toHaveLength(1));
    const old = container.querySelector('[data-side="before"]') as HTMLElement;
    expect(
      within(old).getByText("Parse error on line 2: Expecting 'SQE', got 'PS'"),
    ).toBeTruthy();
    expect(within(old).getByTestId("code").textContent).toBe(OLD);
    expect(
      container.querySelector('[data-side="after"] .mermaid-drawing svg'),
    ).not.toBeNull();
  });

  it("is the source diff with the error under it when neither parses", async () => {
    results.set(OLD, { ok: false, error: PARSE_ERROR });
    results.set(NEW, { ok: false, error: "No diagram type detected" });
    const container = mount();
    expect(await screen.findByText("No diagram type detected")).toBeTruthy();
    expect(screen.getByTestId("fence-diff")).toBeTruthy();
    expect(drawn(container)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Source" })).toBeNull();
  });

  it("is the source diff until both renders are back", async () => {
    renderDiagram.mockImplementation(() => new Promise(() => {}));
    try {
      const container = mount();
      expect(await screen.findByTestId("fence-diff")).toBeTruthy();
      expect(drawn(container)).toHaveLength(0);
      expect(screen.queryByRole("button", { name: "Source" })).toBeNull();
    } finally {
      renderDiagram.mockImplementation(
        async (source: string) =>
          results.get(source) ?? {
            ok: false,
            error: "No diagram type detected",
          },
      );
    }
  });

  it("opens nothing outside a viewer", async () => {
    const container = mount();
    await waitFor(() => expect(drawn(container)).toHaveLength(2));
    expect(screen.queryByRole("button", { name: "Open in the viewer" })).toBe(
      null,
    );
  });

  it("opens both, drawn, in the viewer from either picture or the toolbar", async () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
    const container = mount(
      <AttachmentViewerProvider>
        <MermaidCompare before={OLD} after={NEW} title="flow.mmd" />
      </AttachmentViewerProvider>,
    );
    await waitFor(() => expect(drawn(container)).toHaveLength(2));
    const opens = screen.getAllByRole("button", { name: "Open in the viewer" });
    // The two pictures, and the toolbar's button.
    expect(opens).toHaveLength(3);
    fireEvent.click(opens[0] as HTMLElement);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading").textContent).toBe("flow.mmd");
    expect(
      dialog.querySelectorAll(
        '[data-slot="compare-drawing"] .mermaid-drawing svg',
      ),
    ).toHaveLength(2);
    // Side by side is a drawing's only mode.
    expect(dialog.querySelector('[aria-label="Comparison"]')).toBeNull();
  });

  describe("in the viewer", () => {
    beforeEach(() => {
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
        800,
      );
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(
        600,
      );
    });

    it("names the diagrams' type in the footer, and copies either side's source", async () => {
      const container = mount(
        <AttachmentViewerProvider>
          <MermaidCompare before={OLD} after={NEW} title="flow.mmd" />
        </AttachmentViewerProvider>,
      );
      await waitFor(() => expect(drawn(container)).toHaveLength(2));
      fireEvent.click(
        screen.getAllByRole("button", {
          name: "Open in the viewer",
        })[0] as HTMLElement,
      );
      const dialog = await screen.findByRole("dialog");
      const footer = dialog.lastElementChild as HTMLElement;
      expect(within(footer).getByText("mermaid · flowchart")).toBeTruthy();
      await act(async () => {
        fireEvent.click(
          within(footer).getByRole("button", {
            name: "Copy the source of Before",
          }),
        );
      });
      expect(writeClipboard).toHaveBeenCalledWith(OLD);
    });

    it("pages through every comparison below the provider", async () => {
      const container = mount(
        <AttachmentViewerProvider>
          <MermaidCompare before={OLD} after={NEW} title="first.mmd" />
          <MermaidCompare before={OLD} after={NEW} title="second.mmd" />
        </AttachmentViewerProvider>,
      );
      await waitFor(() => expect(drawn(container)).toHaveLength(4));
      const opens = screen.getAllByRole("button", {
        name: "Open in the viewer",
      });
      // Each comparison's two pictures and its toolbar's button.
      fireEvent.click(opens[3] as HTMLElement);
      const dialog = await screen.findByRole("dialog");
      const heading = () => within(dialog).getByRole("heading").textContent;
      expect(heading()).toBe("second.mmd");
      expect(within(dialog).getByText("2 / 2")).toBeTruthy();
      fireEvent.click(
        within(dialog).getByRole("button", { name: "previous comparison" }),
      );
      expect(heading()).toBe("first.mmd");
    });
  });
});
