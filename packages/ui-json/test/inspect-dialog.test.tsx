import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import {
  downloadName,
  InspectDialog,
  type InspectTarget,
  segmentsOf,
} from "../src/inspect-dialog.tsx";
import { DEFAULT_LABELS } from "../src/labels.ts";

const writeText = vi.fn(async (_text: string) => {});

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  writeText.mockClear();
});

function open(target: InspectTarget) {
  const tree = vi.fn((value: unknown) => (
    <div data-testid="tree">{JSON.stringify(value)}</div>
  ));
  render(
    <InspectDialog
      target={target}
      onClose={() => {}}
      labels={DEFAULT_LABELS}
      renderTree={tree}
    />,
  );
  return { dialog: screen.getByRole("dialog"), tree };
}

describe("InspectDialog", () => {
  it("shows a string's text in segments, with its kind, size and path", () => {
    const { dialog } = open({ value: "line one\nline two", path: "$.system" });
    expect(within(dialog).getByText("string")).toBeTruthy();
    expect(within(dialog).getByText("17 chars")).toBeTruthy();
    expect(within(dialog).getByText("$.system")).toBeTruthy();
    expect(within(dialog).getByText("line one")).toBeTruthy();
    expect(within(dialog).getByText("line two")).toBeTruthy();
    expect(
      within(dialog).queryByRole("button", { name: "Copy as JSON" }),
    ).toBeNull();
  });

  it("shows a scalar as one line", () => {
    const { dialog } = open({ value: 42, path: "$.n" });
    expect(within(dialog).getByText("42")).toBeTruthy();
    expect(within(dialog).getByText("number")).toBeTruthy();
  });

  it("hands a container to the tree", () => {
    const { tree } = open({ value: { a: 1 }, path: "$.o" });
    expect(tree).toHaveBeenCalledWith({ a: 1 });
    expect(screen.getByTestId("tree").textContent).toBe('{"a":1}');
  });

  it("parses a string that holds JSON, and shows its text again", () => {
    const { dialog } = open({ value: '{"x": [1]}', path: "$.raw" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Parse as JSON" }),
    );
    expect(screen.getByTestId("tree").textContent).toBe('{"x":[1]}');
    fireEvent.click(within(dialog).getByRole("button", { name: "Show text" }));
    expect(screen.queryByTestId("tree")).toBeNull();
  });

  it("says when a string is not JSON", () => {
    const { dialog } = open({ value: "{nope", path: "$.raw" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Parse as JSON" }),
    );
    expect(within(dialog).getByText("Not valid JSON")).toBeTruthy();
  });

  it("answers Copy in place with a check", async () => {
    const { dialog } = open({ value: { a: 1 }, path: "$.o" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(dialog.querySelector("[data-icon=copied]")).toBeTruthy(),
    );
    expect(writeText).toHaveBeenCalledWith('{"a":1}');
    expect(within(dialog).getByText("Copied")).toBeTruthy();
  });

  it("names the download after the key", () => {
    const { dialog } = open({ value: "text", path: "$.system" });
    const link = within(dialog).getByRole("link", { name: "Download" });
    expect(link.getAttribute("download")).toBe("system.txt");
    expect(link.getAttribute("href")).toBe("blob:test");
    expect(downloadName("$", false)).toBe("value.json");
    expect(downloadName('$.a["b c"]', false)).toBe("b c.json");
  });
});

describe("segmentsOf", () => {
  it("splits on newlines, then every 2000 characters", () => {
    const segments = segmentsOf(`a\n${"x".repeat(4500)}`);
    expect(segments.map((s) => s.length)).toEqual([1, 2000, 2000, 500]);
  });
});
