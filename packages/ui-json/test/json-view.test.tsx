import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

import { JsonView } from "../src/json-view.tsx";
import { parseJson } from "../src/parse.ts";
import { ROW_BUDGET } from "../src/tree.ts";
import type { JsonSelection } from "../src/types.ts";

const value = {
  model: "model-large",
  stream: true,
  messages: [
    { role: "user", content: "hi" },
    { role: "assistant", content: "yo" },
  ],
  metadata: { user_id: "claude-agent", tier: 2 },
};

const writeText = vi.fn(async (_text: string) => {});
const rect = (height: number, width = 800) =>
  ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON() {},
  }) as DOMRect;

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  // happy-dom lays nothing out: give the tree a viewport and the probe a row.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.getAttribute("role") === "tree") return rect(600);
      return rect(22);
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.getAttribute("role") === "tree" ? 600 : 22;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
});

afterEach(() => {
  vi.restoreAllMocks();
  writeText.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
});

const tree = () => screen.getByRole("tree");
const rowOf = (path: string) =>
  document.querySelector<HTMLElement>(`[data-path='${path}']`);
const part = (path: string, name: "key" | "value" | "gutter") =>
  rowOf(path)?.querySelector<HTMLElement>(`[data-part=${name}]`) as HTMLElement;
const paths = () =>
  [...document.querySelectorAll<HTMLElement>("[data-row]")].map(
    (el) => el.dataset.path,
  );

function pressOn(el: Element, init: PointerEventInit = {}) {
  fireEvent.pointerDown(el, {
    button: 0,
    pointerType: "mouse",
    pointerId: 1,
    ...init,
  });
  fireEvent.pointerUp(el, { pointerId: 1, pointerType: "mouse" });
  fireEvent.click(el, init);
}

function key(keyName: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(tree(), { key: keyName, ...init });
}

function renderControlled(initial: JsonSelection | null = null) {
  const changes: (JsonSelection | null)[] = [];
  const result = render(
    <JsonView
      value={value}
      defaultSelection={initial}
      onSelectionChange={(s) => changes.push(s)}
    />,
  );
  return { ...result, changes, last: () => changes.at(-1) };
}

describe("JsonView rows", () => {
  it("lists the top level of a value, the root hidden", () => {
    render(<JsonView value={value} />);
    expect(paths()).toEqual([
      "$.model",
      "$.stream",
      "$.messages",
      "$.metadata",
    ]);
    expect(rowOf("$.messages")?.textContent).toContain("[2 items]");
    expect(rowOf("$.model")?.textContent).toContain('"model-large"');
  });

  it("shows a JSON5 document's comments and literals", () => {
    const parsed = parseJson("// head\n{\n  // about n\n  n: 0x1F, // hex\n}", {
      dialect: "json5",
    });
    if (!parsed.ok) throw new Error();
    render(<JsonView document={parsed.document} />);
    expect(paths()).toEqual(["$#c0", "$.n#c0", "$.n"]);
    expect(rowOf("$#c0")?.textContent).toBe("// head");
    expect(rowOf("$.n")?.textContent).toContain("0x1F");
    expect(rowOf("$.n")?.textContent).toContain("// hex");
  });

  it("opens a container with one click on its value", () => {
    render(<JsonView value={value} />);
    pressOn(part("$.metadata", "value"));
    expect(paths()).toContain("$.metadata.user_id");
    pressOn(part("$.metadata", "value"));
    expect(paths()).not.toContain("$.metadata.user_id");
  });
});

describe("JsonView selection by pointer", () => {
  it("selects the key, the value or the member by where the press lands", () => {
    const { last } = renderControlled();
    pressOn(part("$.model", "key"));
    expect(last()).toEqual({ type: "key", path: "$.model" });
    pressOn(part("$.model", "value"));
    expect(last()).toEqual({ type: "value", path: "$.model" });
    pressOn(part("$.stream", "gutter"));
    expect(last()).toEqual({
      type: "members",
      anchor: "$.stream",
      focus: "$.stream",
    });
  });

  it("extends a range with Shift", () => {
    const { last } = renderControlled();
    pressOn(part("$.model", "value"));
    pressOn(part("$.metadata", "value"), { shiftKey: true });
    expect(last()).toEqual({
      type: "members",
      anchor: "$.model",
      focus: "$.metadata",
    });
  });

  it("moves a selection inside a container to it when it collapses", () => {
    const { last } = renderControlled();
    pressOn(part("$.metadata", "value"));
    pressOn(part("$.metadata.tier", "key"));
    expect(last()).toEqual({ type: "key", path: "$.metadata.tier" });
    pressOn(
      part("$.metadata", "gutter").querySelector("[data-chevron]") as Element,
    );
    expect(last()).toEqual({
      type: "members",
      anchor: "$.metadata",
      focus: "$.metadata",
    });
  });
});

describe("JsonView keyboard", () => {
  it("walks rows and columns with the arrows", () => {
    const { last } = renderControlled({ type: "key", path: "$.model" });
    key("ArrowDown");
    expect(last()).toEqual({ type: "key", path: "$.stream" });
    key("ArrowRight");
    expect(last()).toEqual({ type: "value", path: "$.stream" });
    key("ArrowLeft");
    expect(last()).toEqual({ type: "key", path: "$.stream" });
    key("ArrowLeft");
    expect(last()).toEqual({ type: "members", anchor: "$", focus: "$" });
  });

  it("expands with → and collapses with ←", () => {
    renderControlled({ type: "value", path: "$.metadata" });
    key("ArrowRight");
    expect(paths()).toContain("$.metadata.tier");
    key("ArrowLeft");
    expect(paths()).not.toContain("$.metadata.tier");
  });

  it("extends with Shift+↓, selects all with Ctrl+A, and goes Home and End", () => {
    const { last } = renderControlled({ type: "value", path: "$.model" });
    key("ArrowDown", { shiftKey: true });
    expect(last()).toEqual({
      type: "members",
      anchor: "$.model",
      focus: "$.stream",
    });
    key("a", { ctrlKey: true });
    expect(last()).toEqual({ type: "value", path: "$" });
    key("End");
    expect(last()).toEqual({ type: "value", path: "$.metadata" });
    key("Home");
    expect(last()).toEqual({ type: "value", path: "$.model" });
  });

  it("clears with Escape and focuses the search with Ctrl+F", () => {
    const { last } = renderControlled({ type: "value", path: "$.model" });
    key("Escape");
    expect(last()).toBeNull();
    key("f", { ctrlKey: true });
    expect(document.activeElement).toBe(
      screen.getByRole("searchbox", { name: "Search keys and values" }),
    );
  });

  it("copies the selection with Ctrl+C and Ctrl+Shift+C, and toasts", async () => {
    renderControlled({ type: "value", path: "$.metadata" });
    key("c", { ctrlKey: true });
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        JSON.stringify(value.metadata, null, 2),
      ),
    );
    expect(toast.success).toHaveBeenCalledWith("Copied the value");
    key("C", { ctrlKey: true, shiftKey: true });
    await waitFor(() =>
      expect(writeText).toHaveBeenLastCalledWith(
        JSON.stringify(value.metadata),
      ),
    );
  });

  it("opens Inspect with Enter", async () => {
    renderControlled({ type: "value", path: "$.model" });
    key("Enter");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("$.model")).toBeTruthy();
  });
});

describe("JsonView menu", () => {
  const items = () =>
    screen.getAllByRole("menuitem").map((item) => item.textContent);

  it("opens from ⋯, from a right-click and from Shift+F10 alike", async () => {
    renderControlled({ type: "value", path: "$.metadata" });
    const button = screen.getByRole("button", {
      name: "Actions for $.metadata",
    });
    fireEvent.pointerDown(button, { button: 0, pointerType: "mouse" });
    await screen.findByRole("menu");
    const fromButton = items();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());

    fireEvent.contextMenu(part("$.metadata", "value"), {
      clientX: 120,
      clientY: 80,
    });
    await screen.findByRole("menu");
    expect(items()).toEqual(fromButton);
    // A right-click's menu stands where the pointer was, not at the row's ⋯.
    const anchor = document.querySelector<HTMLElement>(
      "[data-slot=json-point-menu-anchor]",
    );
    expect(anchor?.style.left).toBe("120px");
    expect(anchor?.style.top).toBe("80px");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(
      document.querySelector("[data-slot=json-point-menu-anchor]"),
    ).toBeNull();

    key("F10", { shiftKey: true });
    await screen.findByRole("menu");
    expect(items()).toEqual(fromButton);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(fromButton).toContain("Expand subtree");
    expect(fromButton).not.toContain("Copy source");
  });

  it("names a range's count and offers Copy source with a source", async () => {
    const parsed = parseJson('{"a": 1, "b": 2, "c": 3}');
    if (!parsed.ok) throw new Error();
    render(
      <JsonView
        document={parsed.document}
        defaultSelection={{ type: "members", anchor: "$.a", focus: "$.b" }}
      />,
    );
    fireEvent.contextMenu(part("$.a", "value"));
    await screen.findByRole("menu");
    expect(items()).toContain("Copy 2 membersCtrl+C");
    expect(items()).toContain("Copy source");
    expect(items()).not.toContain("Copy path");
  });
});

describe("JsonView props", () => {
  it("follows a controlled selection and wrap", () => {
    const { rerender } = render(
      <JsonView
        value={value}
        selection={{ type: "key", path: "$.model" }}
        wrap
      />,
    );
    expect(part("$.model", "key").hasAttribute("data-in-selection")).toBe(true);
    expect(
      screen
        .getByRole("button", { name: "Wrap long strings" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    rerender(
      <JsonView
        value={value}
        selection={{ type: "value", path: "$.model" }}
        wrap={false}
      />,
    );
    expect(part("$.model", "key").hasAttribute("data-in-selection")).toBe(
      false,
    );
  });

  it("starts over on a new value", () => {
    const { rerender } = render(<JsonView value={value} />);
    pressOn(part("$.metadata", "value"));
    expect(paths()).toContain("$.metadata.tier");
    rerender(<JsonView value={{ ...value }} />);
    expect(paths()).not.toContain("$.metadata.tier");
  });

  it("drops a selection that names nothing", () => {
    const onSelectionChange = vi.fn();
    render(
      <JsonView
        value={value}
        selection={{ type: "value", path: "$.gone" }}
        onSelectionChange={onSelectionChange}
      />,
    );
    expect(onSelectionChange).toHaveBeenCalledWith(null);
  });

  it("takes its labels", () => {
    render(
      <JsonView
        value={value}
        labels={{ items: (n) => `[${n} 项]`, collapseAll: "折叠全部" }}
      />,
    );
    expect(rowOf("$.messages")?.textContent).toContain("[2 项]");
    expect(screen.getByRole("button", { name: "折叠全部" })).toBeTruthy();
  });

  it("warns over the row budget, until dismissed", () => {
    render(
      <JsonView value={Array.from({ length: ROW_BUDGET + 5 }, (_, i) => i)} />,
    );
    const status = screen.getByText(/Showing the first 20,000 rows/);
    expect(status).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/Showing the first/)).toBeNull();
  });

  it("answers the toolbar's Copy document in place", async () => {
    render(<JsonView value={value} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy document" }));
    await waitFor(() =>
      expect(document.querySelector("[data-icon=copied]")).toBeTruthy(),
    );
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(value, null, 2));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("filters rows by search", async () => {
    vi.useFakeTimers();
    try {
      render(<JsonView value={value} />);
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "tier" },
      });
      act(() => vi.advanceTimersByTime(200));
      expect(paths()).toEqual(["$.metadata", "$.metadata.tier"]);
      expect(screen.getByText("1 match")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
