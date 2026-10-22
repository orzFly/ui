import { createThemeStore, ThemeProvider } from "@orz/ui/theme";
import {
  Content,
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
} from "@orz/ui-content";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mermaidContent } from "../src/content.tsx";
import type { DiagramPalette } from "../src/render.ts";

// mermaid itself cannot lay anything out under happy-dom (no getBBox), so the
// renderer is the seam: these cases pin what the block does with each answer.
const result = vi.hoisted(() => ({
  next: { ok: true, svg: "", width: 0 } as
    | { ok: true; svg: string; width: number }
    | { ok: false; error: string },
}));
const renderDiagram = vi.hoisted(() =>
  vi.fn(
    async (_source: string, _palette: DiagramPalette, _fontFamily: string) =>
      result.next,
  ),
);
vi.mock("../src/render.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/render.ts")>()),
  renderDiagram,
}));

const SVG =
  '<svg id="mermaid-1" viewBox="0 0 1360 164"><text>游戏连接或回放</text></svg>';
const DIAGRAM = "flowchart LR\n  A[游戏连接或回放] --> B[应用级服务]";
const INLINE: ContentSource = {
  kind: "inline",
  text: DIAGRAM,
  lang: "mermaid",
};

/** Accepts everything after mermaid, and shows what it was handed. */
const probe: ContentRenderer = {
  name: "probe",
  accepts: () => true,
  Component: ({ source }) => (
    <pre
      data-testid="probe"
      data-kind={source.kind}
      data-lang={source.kind === "inline" ? source.lang : undefined}
    >
      {source.kind === "inline" ? source.text : source.name}
    </pre>
  ),
};
const WITH_PROBE = [mermaidContent, probe];
const ALONE = [mermaidContent];

beforeEach(() => {
  renderDiagram.mockClear();
});

afterEach(() => {
  localStorage.clear();
});

function mount(
  source: ContentSource,
  {
    renderers = WITH_PROBE,
    className,
    wrap = (node) => node,
  }: {
    renderers?: readonly ContentRenderer[];
    className?: string;
    wrap?: (node: ReactNode) => ReactNode;
  } = {},
) {
  return render(
    wrap(
      <ContentRenderers renderers={renderers}>
        <Content source={source} placement="document" className={className} />
      </ContentRenderers>,
    ),
  ).container;
}

async function drawn(container: HTMLElement) {
  await waitFor(() => {
    expect(container.querySelector(".mermaid-diagram svg")).not.toBeNull();
  });
}

describe("mermaid sources (T-523)", () => {
  it("draws the diagram, with its source one toggle away", async () => {
    result.next = { ok: true, svg: SVG, width: 1360 };
    const container = mount(INLINE);
    await drawn(container);
    expect(renderDiagram).toHaveBeenCalledWith(
      DIAGRAM,
      expect.anything(),
      expect.anything(),
    );
    const diagram = container.querySelector<HTMLElement>(".mermaid-diagram");
    expect(diagram?.style.getPropertyValue("--diagram-width")).toBe("1360px");
    expect(screen.queryByTestId("probe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    const source = await screen.findByTestId("probe");
    expect(source.textContent).toBe(DIAGRAM);
    expect(source.dataset.lang).toBe("mermaid");
    expect(container.querySelector(".mermaid-diagram")).toBeNull();
    const back = screen.getByRole("button", { name: "Diagram" });
    expect(back.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(back);
    expect(container.querySelector(".mermaid-diagram svg")).not.toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Source" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("keeps a diagram that does not parse as source, with the error under it", async () => {
    result.next = {
      ok: false,
      error:
        "Parse error on line 2:\n...hart LR  A[开始 --> B[[结束\n----------------------^\nExpecting 'SQE', got 'SUBROUTINESTART'",
    };
    const container = mount(INLINE);
    const summary = await screen.findByText(
      "Parse error on line 2: Expecting 'SQE', got 'SUBROUTINESTART'",
    );
    expect(summary.getAttribute("title")).toBe(result.next.error);
    expect(screen.getByTestId("probe").textContent).toContain("游戏连接或回放");
    expect(container.querySelector(".mermaid-diagram")).toBeNull();
    expect(screen.queryByRole("button", { name: "Source" })).toBeNull();
  });

  it("shows the source while the renderer is still loading", async () => {
    renderDiagram.mockImplementationOnce(() => new Promise(() => {}));
    const container = mount(INLINE);
    expect((await screen.findByTestId("probe")).textContent).toContain(
      "游戏连接或回放",
    );
    expect(container.querySelector(".mermaid-diagram")).toBeNull();
  });

  it("re-renders when the theme changes", async () => {
    result.next = { ok: true, svg: SVG, width: 1360 };
    const store = createThemeStore({ storageKey: "test-theme" });
    const container = mount(INLINE, {
      wrap: (node) => <ThemeProvider store={store}>{node}</ThemeProvider>,
    });
    await drawn(container);
    const calls = renderDiagram.mock.calls.length;
    await act(async () => {
      store.setPref("solarized-dark");
    });
    await waitFor(() => {
      expect(renderDiagram.mock.calls.length).toBe(calls + 1);
    });
    store.dispose();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove("dark");
  });

  it("ignores a render that lands after a newer one started", async () => {
    let finishOld: () => void = () => {};
    renderDiagram.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = () =>
            resolve({ ok: true, svg: '<svg data-old=""></svg>', width: 10 });
        }),
    );
    result.next = { ok: true, svg: SVG, width: 1360 };
    const view = (text: string) => (
      <ContentRenderers renderers={WITH_PROBE}>
        <Content
          source={{ kind: "inline", text, lang: "mermaid" }}
          placement="document"
        />
      </ContentRenderers>
    );
    const { container, rerender } = render(view("flowchart LR\n  A"));
    rerender(view(DIAGRAM));
    await drawn(container);
    await act(async () => finishOld());
    expect(container.querySelector("svg[data-old]")).toBeNull();
    expect(
      container
        .querySelector<HTMLElement>(".mermaid-diagram")
        ?.style.getPropertyValue("--diagram-width"),
    ).toBe("1360px");
  });

  it("falls back to a plain code block for the source with nothing after it", async () => {
    renderDiagram.mockImplementationOnce(() => new Promise(() => {}));
    const container = mount(INLINE, { renderers: ALONE });
    await waitFor(() => {
      expect(
        container.querySelector("pre > code.language-mermaid")?.textContent,
      ).toBe(DIAGRAM);
    });
  });

  it("puts className on the block's root", async () => {
    result.next = { ok: true, svg: SVG, width: 1360 };
    const container = mount(INLINE, { className: "marked" });
    await drawn(container);
    const root = container.firstElementChild;
    expect(root?.classList.contains("marked")).toBe(true);
    expect(root?.classList.contains("relative")).toBe(true);
  });
});

describe("mermaid files", () => {
  function file(load: () => Promise<string>): ContentSource {
    return { kind: "file", name: "flow.mmd", load };
  }

  it("shows the fallback while the file loads, then draws it", async () => {
    result.next = { ok: true, svg: SVG, width: 1360 };
    let resolve: (text: string) => void = () => {};
    const pending = new Promise<string>((r) => {
      resolve = r;
    });
    const container = mount(
      file(() => pending),
      { className: "marked" },
    );
    const fallback = container.firstElementChild;
    expect(fallback?.textContent).toBe("flow.mmd");
    expect(fallback?.classList.contains("marked")).toBe(true);
    expect(renderDiagram).not.toHaveBeenCalled();

    await act(async () => resolve(DIAGRAM));
    await drawn(container);
    expect(renderDiagram).toHaveBeenCalledWith(
      DIAGRAM,
      expect.anything(),
      expect.anything(),
    );
    expect(container.firstElementChild?.classList.contains("marked")).toBe(
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    const source = await screen.findByTestId("probe");
    expect(source.dataset.kind).toBe("inline");
    expect(source.dataset.lang).toBe("mermaid");
    expect(source.textContent).toBe(DIAGRAM);
  });

  it("hands its source on without the file's final newline", async () => {
    result.next = { ok: true, svg: SVG, width: 1360 };
    const container = mount(file(async () => `${DIAGRAM}\n`));
    await drawn(container);
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect((await screen.findByTestId("probe")).textContent).toBe(DIAGRAM);
  });

  it("offers Retry when the file fails to load", async () => {
    result.next = { ok: true, svg: SVG, width: 1360 };
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValue(DIAGRAM);
    const container = mount(file(load), { className: "marked" });
    expect(await screen.findByText("503 Service Unavailable")).toBeTruthy();
    expect(container.firstElementChild?.classList.contains("marked")).toBe(
      true,
    );
    expect(renderDiagram).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await drawn(container);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("mermaidContent.accepts", () => {
  const inline = (lang?: string): ContentSource => ({
    kind: "inline",
    text: "",
    lang,
  });
  const named = (name: string): ContentSource => ({ kind: "file", name });

  it.each(["document", "viewer"] as const)("decides in %s placement", (at) => {
    const accepts = (source: ContentSource) =>
      mermaidContent.accepts(source, at);
    expect(accepts(inline("mermaid"))).toBe(true);
    expect(accepts(inline("Mermaid"))).toBe(true);
    expect(accepts(inline("ts"))).toBe(false);
    expect(accepts(inline())).toBe(false);
    expect(accepts(named("a.mmd"))).toBe(true);
    expect(accepts(named("B.MERMAID"))).toBe(true);
    expect(accepts(named("a.md"))).toBe(false);
  });
});

// Runs last: the block keeps the first 2D context it gets, so the stub stays
// in place for anything after it.
describe("the palette", () => {
  it("is resolved to hex, with dark read off the background", async () => {
    let pixel = [255, 255, 255, 255];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect() {},
      fillRect() {},
      fillStyle: "",
      getImageData: () => ({ data: pixel }),
    } as unknown as CanvasRenderingContext2D);
    result.next = { ok: true, svg: SVG, width: 1360 };

    mount(INLINE);
    await waitFor(() => expect(renderDiagram).toHaveBeenCalledTimes(1));
    expect(renderDiagram.mock.calls[0]?.[1]).toMatchObject({
      dark: false,
      background: "#ffffff",
    });

    pixel = [40, 42, 54, 255];
    mount(INLINE);
    await waitFor(() => expect(renderDiagram).toHaveBeenCalledTimes(2));
    expect(renderDiagram.mock.calls[1]?.[1]).toMatchObject({
      dark: true,
      background: "#282a36",
    });
  });
});
