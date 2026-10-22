import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type DiagramPalette,
  errorSummary,
  renderDiagram,
  viewBoxWidth,
} from "../src/render.ts";

const mermaid = vi.hoisted(() => ({
  failImports: 0,
  imports: 0,
  initialize: vi.fn(
    (_config: { themeVariables: { background: string } }) => {},
  ),
  parse: vi.fn(async (_source: string) => true),
  render: vi.fn(async (id: string, _source: string) => ({
    svg: `<svg id="${id}" viewBox="0 0 120 40"></svg>`,
  })),
}));

vi.mock("mermaid", () => {
  mermaid.imports++;
  if (mermaid.failImports > 0) {
    mermaid.failImports--;
    throw new Error("Failed to fetch dynamically imported module");
  }
  return {
    default: {
      initialize: mermaid.initialize,
      parse: mermaid.parse,
      render: mermaid.render,
    },
  };
});

const LIGHT: DiagramPalette = {
  dark: false,
  background: "#ffffff",
  foreground: "#000000",
  muted: "#eeeeee",
  mutedForeground: "#666666",
  border: "#dddddd",
};
const DARK: DiagramPalette = { ...LIGHT, dark: true, background: "#000000" };

beforeEach(() => {
  mermaid.initialize.mockClear();
  mermaid.render.mockClear();
});

describe("renderDiagram", () => {
  // Runs first: once an import has succeeded, the module stays memoised.
  it("reports a chunk that fails to load, and fetches it again next time", async () => {
    mermaid.failImports = 1;
    const failed = await renderDiagram("flowchart LR\n A --> B", LIGHT, "sans");
    expect(failed).toEqual({
      ok: false,
      error: expect.any(String),
    });

    const drawn = await renderDiagram("flowchart LR\n A --> B", LIGHT, "sans");
    expect(drawn).toEqual({ ok: true, svg: expect.any(String), width: 120 });
    expect(mermaid.imports).toBe(2);
  });

  it("does not initialize for one palette while another is still rendering", async () => {
    let finish: () => void = () => {};
    mermaid.render.mockImplementationOnce(
      (id) =>
        new Promise((resolve) => {
          finish = () => resolve({ svg: `<svg id="${id}"></svg>` });
        }),
    );
    const first = renderDiagram("flowchart LR\n A", LIGHT, "sans");
    const second = renderDiagram("flowchart LR\n B", DARK, "sans");
    await vi.waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(1));
    expect(mermaid.initialize).toHaveBeenCalledTimes(1);

    finish();
    await Promise.all([first, second]);
    expect(
      mermaid.initialize.mock.calls.map(
        ([config]) => config.themeVariables.background,
      ),
    ).toEqual(["#ffffff", "#000000"]);
    expect(mermaid.render).toHaveBeenCalledTimes(2);
  });
});

describe("mermaid helpers", () => {
  it("reads the natural width off the viewBox", () => {
    expect(viewBoxWidth('<svg viewBox="4 4 1360.5 164">')).toBe(1360.5);
    expect(viewBoxWidth("<svg>")).toBe(0);
  });

  it("keeps a single-line error as it is", () => {
    expect(errorSummary("No diagram type detected")).toBe(
      "No diagram type detected",
    );
  });

  it("sums up a parse error as where it failed and what it got", () => {
    expect(
      errorSummary(
        "Parse error on line 2:\n...hart LR  A[开始 --> B[[结束\n----------------------^\nExpecting 'SQE', got 'SUBROUTINESTART'",
      ),
    ).toBe("Parse error on line 2: Expecting 'SQE', got 'SUBROUTINESTART'");
  });
});
