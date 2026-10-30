import type { ValueProviders } from "@orz/query";
import { act, fireEvent, render } from "@testing-library/react";
import { type FormEvent, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { todouSchema } from "../../query/test/fixtures/todou-schema.ts";
import { QueryBox, type RowSource } from "../src/components/query-box.tsx";

const PROVIDERS: ValueProviders = {
  label: { options: [{ value: "area:web" }, { value: "kind:bug" }] },
  status: { options: [{ value: "Todo" }, { value: "In Progress" }] },
  member: { options: [{ value: "alice" }] },
};

type Past = { q: string };

/** A history-like source: rows that are whole past queries. */
function history(
  entries: readonly string[],
  options: Partial<RowSource<Past>> = {},
): RowSource<Past> {
  return {
    id: "history",
    matched: false,
    yields: true,
    rows: entries.map((q) => ({ q })),
    key: (row) => row.q,
    render: (row, option) => (
      <div {...option} data-row="history">
        {row.q}
      </div>
    ),
    apply: (row) => ({ value: row.q, caret: row.q.length }),
    ...options,
  };
}

function Harness({
  initial = "",
  ...props
}: {
  initial?: string;
  onSubmit?: (query: string, chosen: Past | undefined) => void;
  onEscape?: () => void;
  onOpenChange?: (open: boolean) => void;
  sources?: readonly RowSource<Past>[];
  limit?: number;
  providers?: ValueProviders;
  /** Load a submitted past query into the box, as an app would. */
  loadChosen?: boolean;
  onClick?: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <QueryBox<Past>
      schema={todouSchema}
      providers={props.providers ?? PROVIDERS}
      value={value}
      onValueChange={setValue}
      onSubmit={(query, chosen) => {
        props.onSubmit?.(query, chosen);
        if (props.loadChosen && chosen !== undefined) setValue(chosen.q);
      }}
      renderSubmitRow={(query, option) => (
        <div {...option} data-row="submit">
          Search for “{query}”
        </div>
      )}
      inputProps={{
        "aria-label": "Search",
        ...(props.onClick === undefined ? {} : { onClick: props.onClick }),
      }}
      {...(props.onEscape === undefined ? {} : { onEscape: props.onEscape })}
      {...(props.onOpenChange === undefined
        ? {}
        : { onOpenChange: props.onOpenChange })}
      {...(props.sources === undefined ? {} : { sources: props.sources })}
      {...(props.limit === undefined ? {} : { limit: props.limit })}
    />
  );
}

function mount(props: Parameters<typeof Harness>[0] = {}) {
  const utils = render(<Harness {...props} />);
  const input = utils.getByLabelText("Search") as HTMLInputElement;
  const options = () => [
    ...utils.container.querySelectorAll('[role="option"]'),
  ];
  const texts = () => options().map((o) => o.textContent ?? "");
  const listbox = () => utils.container.querySelector('[role="listbox"]');
  /** The box only offers anything while it has focus. */
  const type = (value: string, caret = value.length) => {
    act(() => input.focus());
    fireEvent.change(input, { target: { value } });
    input.setSelectionRange(caret, caret);
    fireEvent.select(input);
  };
  const key = (k: string, init: Record<string, unknown> = {}) =>
    fireEvent.keyDown(input, { key: k, ...init });
  return { ...utils, input, options, texts, listbox, type, key };
}

describe("QueryBox · keyboard model", () => {
  it("preselects nothing, so Enter submits what was typed", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit });
    box.type("har");
    expect(box.texts()[0]).toContain("harness:");
    expect(
      box.options().map((o) => o.getAttribute("aria-selected")),
    ).not.toContain("true");
    expect(box.input.getAttribute("aria-activedescendant")).toBeNull();
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("har", undefined);
  });

  it("submits the query trimmed, and an empty one not at all", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit });
    box.type("   ");
    box.key("Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    box.type("  部署  ");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("部署", undefined);
  });

  it("takes the first completion on Tab with nothing highlighted", () => {
    const box = mount();
    box.type("部署 har");
    box.key("Tab");
    expect(box.input.value).toBe("部署 harness:");
  });

  it("takes the highlighted completion on Tab", () => {
    const box = mount();
    box.type("label:");
    expect(box.texts().slice(0, 2)).toEqual(["area:web", "kind:bug"]);
    box.key("ArrowDown");
    box.key("ArrowDown");
    box.key("Tab");
    expect(box.input.value).toBe("label:kind:bug ");
  });

  it("never falls back to the submit row or an app row on Tab", () => {
    // An unaimed Tab means "finish the word I am typing"; a whole past query
    // is a long way from that, and the submit row is not an offer at all.
    const box = mount({ sources: [history(["plain words before"])] });
    box.type("plain words");
    expect(box.texts()).toEqual([
      "Search for “plain words”",
      "plain words before",
    ]);
    const tab = box.key("Tab");
    expect(box.input.value).toBe("plain words");
    // Not prevented: Tab moves focus on as it always does.
    expect(tab).toBe(true);
  });

  it("takes an app row's `apply` on Tab when it is highlighted", () => {
    const box = mount({ sources: [history(["label:kind:bug 部署"])] });
    box.type("部");
    box.key("ArrowDown");
    box.key("ArrowDown");
    expect(box.options()[1]?.getAttribute("aria-selected")).toBe("true");
    box.key("Tab");
    expect(box.input.value).toBe("label:kind:bug 部署");
    expect(box.input.selectionStart).toBe("label:kind:bug 部署".length);
  });

  it("falls back to the first completion when an app row cannot apply", () => {
    const box = mount({
      sources: [
        history(["harness:x"], {
          apply: () => null,
          matched: true,
          yields: false,
        }),
      ],
    });
    box.type("har");
    expect(box.texts()[0]).toBe("harness:x");
    box.key("ArrowDown");
    box.key("Tab");
    expect(box.input.value).toBe("harness:");
  });

  it("takes a completion on Enter and does not submit", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit });
    box.type("har");
    box.key("ArrowDown");
    box.key("Enter");
    expect(box.input.value).toBe("harness:");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the highlighted app row as chosen", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit, sources: [history(["部署 失败"])] });
    box.type("部署");
    box.key("ArrowDown");
    box.key("ArrowDown");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("部署", { q: "部署 失败" });
    // Submitting closes the panel.
    expect(box.listbox()).toBeNull();
  });

  it("closes on Escape, and hands the second Escape to the app", () => {
    const onEscape = vi.fn();
    const box = mount({ onEscape });
    box.type("plain words");
    expect(box.listbox()).not.toBeNull();
    box.key("Escape");
    expect(box.listbox()).toBeNull();
    expect(onEscape).not.toHaveBeenCalled();
    box.key("Escape");
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("reopens once the query changes after Escape", () => {
    const box = mount();
    box.type("plain");
    box.key("Escape");
    expect(box.listbox()).toBeNull();
    fireEvent.change(box.input, { target: { value: "plain words" } });
    expect(box.listbox()).not.toBeNull();
  });

  it("submits the plain query after Escape, not an invisible highlight", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit, sources: [history(["部署 失败"])] });
    box.type("部署");
    box.key("ArrowDown");
    box.key("ArrowDown");
    box.key("Escape");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("部署", undefined);
  });

  it.each(["submit", "Escape"])(
    "preselects nothing again after %s, blur and refocus",
    (how) => {
      const onSubmit = vi.fn();
      const box = mount({
        onSubmit,
        loadChosen: true,
        sources: [history(["foo bar"])],
      });
      box.type("foo");
      box.key("ArrowDown");
      box.key("ArrowDown");
      if (how === "submit") {
        box.key("Enter");
        expect(onSubmit).toHaveBeenCalledWith("foo", { q: "foo bar" });
        expect(box.input.value).toBe("foo bar");
      } else {
        box.key("Escape");
      }
      act(() => box.input.blur());
      act(() => box.input.focus());
      expect(box.listbox()).not.toBeNull();
      expect(box.input.getAttribute("aria-activedescendant")).toBeNull();
      expect(
        box.options().map((o) => o.getAttribute("aria-selected")),
      ).not.toContain("true");
    },
  );

  it("keeps the highlight on its row when a search answer lands above it", async () => {
    vi.useFakeTimers();
    try {
      let answer: (rows: { value: string }[]) => void = () => {};
      const search = vi.fn(
        () =>
          new Promise<{ value: string }[]>((resolve) => {
            answer = resolve;
          }),
      );
      const onSubmit = vi.fn();
      const box = mount({ onSubmit, providers: { member: { search } } });
      box.type("assignee:");
      const submitRow = () =>
        box.container.querySelector('[data-row="submit"]')?.id;
      box.key("End");
      expect(box.input.getAttribute("aria-activedescendant")).toBe(submitRow());
      await act(() => vi.advanceTimersByTimeAsync(150));
      expect(search).toHaveBeenCalledOnce();
      await act(async () => answer([{ value: "alice" }]));
      expect(box.texts()).toContain("alice");
      expect(box.input.getAttribute("aria-activedescendant")).toBe(submitRow());
      box.key("Enter");
      expect(onSubmit).toHaveBeenCalledWith("assignee:", undefined);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns to nothing highlighted when ArrowUp leaves the first row", () => {
    const box = mount();
    box.type("label:");
    box.key("ArrowDown");
    expect(box.input.getAttribute("aria-activedescendant")).toBe(
      box.options()[0]?.id,
    );
    box.key("ArrowUp");
    expect(box.input.getAttribute("aria-activedescendant")).toBeNull();
    // And no further: another ArrowUp does not wrap to the bottom.
    box.key("ArrowUp");
    expect(box.input.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("jumps to the ends on Home and End", () => {
    const box = mount();
    box.type("label:");
    const last = box.options().at(-1);
    box.key("End");
    expect(box.input.getAttribute("aria-activedescendant")).toBe(last?.id);
    box.key("Home");
    expect(box.input.getAttribute("aria-activedescendant")).toBe(
      box.options()[0]?.id,
    );
  });
});

describe("QueryBox · focus stays in the input", () => {
  it("walks the rows with aria-activedescendant", () => {
    const box = mount();
    box.type("label:");
    box.key("ArrowDown");
    box.key("ArrowDown");
    const second = box.options()[1] as HTMLElement;
    expect(box.input.getAttribute("aria-activedescendant")).toBe(second.id);
    expect(second.getAttribute("aria-selected")).toBe("true");
    expect(second.tabIndex).toBe(-1);
    expect(document.activeElement).toBe(box.input);
  });

  it("cancels the mousedown that would blur the input", () => {
    const box = mount();
    box.type("label:");
    const row = box.options()[0] as HTMLElement;
    expect(fireEvent.mouseDown(row)).toBe(false);
  });

  it("ignores a blur into the panel, and closes on any other", () => {
    const box = mount();
    box.type("label:");
    fireEvent.blur(box.input, { relatedTarget: box.options()[0] });
    expect(box.listbox()).not.toBeNull();
    fireEvent.blur(box.input, { relatedTarget: document.body });
    expect(box.listbox()).toBeNull();
  });

  it("rewrites the query when a completion is clicked, caret after it", () => {
    const box = mount();
    box.type("label:kind");
    expect(box.texts()[0]).toBe("kind:bug");
    fireEvent.click(box.options()[0] as Element);
    // With the space that ends the word, so the next term can just be typed.
    expect(box.input.value).toBe("label:kind:bug ");
    expect(box.input.selectionStart).toBe(15);
    expect(document.activeElement).toBe(box.input);
  });

  it("places the caret where the completion says, mid-query", () => {
    const box = mount();
    box.type("har 部署", 3);
    box.key("Tab");
    expect(box.input.value).toBe("harness: 部署");
    expect(box.input.selectionStart).toBe(8);
  });
});

describe("QueryBox · the panel", () => {
  it("measures its height against the viewport before paint", () => {
    const box = mount();
    box.type("label:");
    const panel = box.listbox() as HTMLElement;
    const top = panel.getBoundingClientRect().top;
    expect(panel.style.maxHeight).toBe(`${window.innerHeight - top - 8}px`);
  });

  it("scrolls the highlighted row into view", () => {
    const scroll = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scroll;
    try {
      const box = mount();
      box.type("label:");
      box.key("End");
      expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
      expect(scroll.mock.contexts.at(-1)).toBe(box.options().at(-1));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("is a combobox with no browser drop-down of its own", () => {
    const box = mount();
    expect(box.input.getAttribute("autocomplete")).toBe("off");
    expect(box.input.getAttribute("role")).toBe("combobox");
    expect(box.input.getAttribute("aria-autocomplete")).toBe("list");
    expect(box.input.getAttribute("aria-expanded")).toBe("false");
    box.type("label:");
    expect(box.input.getAttribute("aria-expanded")).toBe("true");
    expect(box.input.getAttribute("aria-controls")).toBe(box.listbox()?.id);
  });

  it("gives two boxes listboxes of their own", () => {
    const { getAllByLabelText } = render(
      <>
        <Harness />
        <Harness />
      </>,
    );
    const ids = getAllByLabelText("Search").map((i) =>
      i.getAttribute("aria-controls"),
    );
    expect(new Set(ids).size).toBe(2);
  });

  it("keeps the submit row first when nothing is being completed", () => {
    const box = mount();
    box.type("部署 ");
    expect(box.texts()[0]).toBe("Search for “部署”");
    // The keys are still listed below, which is how the syntax is found.
    expect(box.texts()).toContain("harness:which agent wrote it");
  });

  it("lifts a real completion above the submit row", () => {
    const box = mount();
    box.type("label:");
    expect(box.texts()).toEqual([
      "area:web",
      "kind:bug",
      "Search for “label:”",
    ]);
  });

  it("spends the limit on matched rows first and lets yielding rows take the rest", () => {
    const box = mount({
      limit: 3,
      sources: [history(["label:old", "label:older", "label:oldest"])],
    });
    box.type("label:");
    expect(box.texts()).toEqual([
      "area:web",
      "kind:bug",
      "Search for “label:”",
      "label:old",
    ]);
  });

  it("removes the highlighted app row on Shift+Delete, panel still open", () => {
    const remove = vi.fn();
    const box = mount({ sources: [history(["部署 失败"], { remove })] });
    box.type("部署");
    box.key("ArrowDown");
    box.key("ArrowDown");
    const event = box.key("Delete", { shiftKey: true });
    expect(remove).toHaveBeenCalledWith({ q: "部署 失败" });
    expect(event).toBe(false);
    expect(box.listbox()).not.toBeNull();
  });

  it("leaves Shift+Delete alone on a row that cannot be removed", () => {
    const box = mount();
    box.type("label:");
    box.key("ArrowDown");
    expect(box.key("Delete", { shiftKey: true })).toBe(true);
  });

  it("submits a clicked app row as chosen", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit, sources: [history(["部署 失败"])] });
    box.type("部署");
    fireEvent.click(box.options()[1] as Element);
    expect(onSubmit).toHaveBeenCalledWith("部署", { q: "部署 失败" });
  });

  it("paints the query behind the input through the schema", () => {
    const box = mount();
    box.type("label:nope");
    const mirror = box.container.querySelector("[aria-hidden]") as HTMLElement;
    expect(mirror.textContent).toBe("label:nope");
    expect(mirror.querySelector(".decoration-wavy")?.textContent).toBe("nope");
  });
});

describe("QueryBox · inputProps", () => {
  it("calls the app's own click handler on the input", () => {
    const onClick = vi.fn();
    const box = mount({ onClick });
    fireEvent.click(box.input);
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("QueryBox · onOpenChange", () => {
  it("reports each transition once", () => {
    const onOpenChange = vi.fn();
    const box = mount({ onOpenChange });
    expect(onOpenChange).not.toHaveBeenCalled();
    box.type("部署");
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    fireEvent.change(box.input, { target: { value: "部署 失败" } });
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    box.key("Escape");
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    fireEvent.change(box.input, { target: { value: "部署" } });
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
    fireEvent.blur(box.input, { relatedTarget: document.body });
    expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false]]);
  });
});

describe("QueryBox · IME", () => {
  it("does not submit on the Enter that commits a composition", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit });
    box.type("bu");
    fireEvent.compositionStart(box.input);
    box.key("Enter", { isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.compositionEnd(box.input);

    // Safari ends the composition first and reports the key as 229.
    box.key("Enter", { keyCode: 229 });
    expect(onSubmit).not.toHaveBeenCalled();

    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("bu", undefined);
  });

  it("leaves every key to the IME while it composes", () => {
    const onEscape = vi.fn();
    const box = mount({ onEscape });
    box.type("plain");
    box.key("Escape", { isComposing: true });
    box.key("Escape", { isComposing: true });
    expect(box.listbox()).not.toBeNull();
    expect(onEscape).not.toHaveBeenCalled();
    box.type("har");
    box.key("Tab", { isComposing: true });
    expect(box.input.value).toBe("har");
    box.key("ArrowDown", { keyCode: 229 });
    expect(box.input.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("shows the input's own text while composing", () => {
    const box = mount();
    box.type("部");
    fireEvent.compositionStart(box.input);
    expect(box.input.className).toContain("text-foreground");
    fireEvent.compositionEnd(box.input);
    expect(box.input.className).toContain("text-transparent");
  });
});

describe("QueryBox · in a form", () => {
  it("is a field of the enclosing form, which Enter does not submit", () => {
    const onSubmit = vi.fn();
    const outer = vi.fn((e: FormEvent) => e.preventDefault());
    const utils = render(
      <form onSubmit={outer}>
        <Harness onSubmit={onSubmit} />
      </form>,
    );
    expect(utils.container.querySelectorAll("form")).toHaveLength(1);
    const input = utils.getByLabelText("Search");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "部署" } });
    // `false` is a prevented default, so no implicit submission follows.
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    expect(onSubmit).toHaveBeenCalledWith("部署", undefined);
    expect(outer).not.toHaveBeenCalled();
  });
});
