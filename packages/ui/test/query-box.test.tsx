import type { CompletionValue, ValueProviders } from "@orz/query";
import { act, fireEvent, render } from "@testing-library/react";
import { type FormEvent, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { todouSchema } from "../../query/test/fixtures/todou-schema.ts";
import {
  QueryBox,
  type RowSource,
  type ValueRowContent,
} from "../src/components/query-box.tsx";
import type { QueryHistoryEntry } from "../src/hooks/use-query-history.ts";

const PROVIDERS: ValueProviders = {
  label: { options: [{ value: "area:web" }, { value: "kind:bug" }] },
  status: { options: [{ value: "Todo" }, { value: "In Progress" }] },
  member: { options: [{ value: "alice" }] },
};

type Past = { q: string };

/** An app's own source of whole past queries, as a box without `history` keeps. */
function pastRows(
  entries: readonly string[],
  options: Partial<RowSource<Past>> = {},
): RowSource<Past> {
  return {
    id: "past",
    matched: false,
    yields: true,
    rows: entries.map((q) => ({ q })),
    key: (row) => row.q,
    render: (row, option) => (
      <div {...option} data-row="past">
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
  onSubmit?: (
    query: string,
    chosen: Past | undefined,
    fromHistory: boolean,
  ) => void;
  onEscape?: () => void;
  onOpenChange?: (open: boolean) => void;
  sources?: readonly RowSource<Past>[];
  limit?: number;
  providers?: ValueProviders;
  /** Load a submitted past query into the box, as an app would. */
  loadChosen?: boolean;
  onClick?: () => void;
  /** Past queries, newest first, kept as an app's history would keep them. */
  past?: readonly string[];
  onRemovePast?: (query: string) => void;
  queryHref?: (query: string) => string;
  renderValue?: (value: CompletionValue) => ValueRowContent | undefined;
  busy?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [entries, setEntries] = useState<readonly QueryHistoryEntry[]>(() =>
    (props.past ?? []).map((q, i) => ({ q, t: -i })),
  );
  return (
    <QueryBox<Past>
      schema={todouSchema}
      providers={props.providers ?? PROVIDERS}
      value={value}
      onValueChange={setValue}
      onSubmit={(query, chosen, fromHistory) => {
        props.onSubmit?.(query, chosen, fromHistory);
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
      {...(props.past === undefined
        ? {}
        : {
            history: {
              entries,
              remove: (query: string) => {
                props.onRemovePast?.(query);
                setEntries((all) => all.filter((e) => e.q !== query));
              },
            },
          })}
      {...(props.queryHref === undefined ? {} : { queryHref: props.queryHref })}
      {...(props.renderValue === undefined
        ? {}
        : { renderValue: props.renderValue })}
      {...(props.busy === undefined ? {} : { busy: props.busy })}
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
    expect(onSubmit).toHaveBeenCalledWith("har", undefined, false);
  });

  it("submits the query trimmed, and an empty one not at all", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit });
    box.type("   ");
    box.key("Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    box.type("  部署  ");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("部署", undefined, false);
  });

  it("submits an empty box from its submit row, aimed at or clicked", () => {
    // Where an empty query goes, a search page say, is the app's to decide.
    const onSubmit = vi.fn();
    const box = mount({ onSubmit });
    box.type("  ");
    const submit = box
      .options()
      .findIndex((o) => o.matches("[data-row=submit]"));
    for (let i = 0; i <= submit; i += 1) box.key("ArrowDown");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("", undefined, false);
    expect(box.listbox()).toBeNull();
    box.type("");
    fireEvent.click(
      box.container.querySelector("[data-row=submit]") as HTMLElement,
    );
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit).toHaveBeenLastCalledWith("", undefined, false);
    expect(box.listbox()).toBeNull();
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
    const box = mount({ sources: [pastRows(["plain words before"])] });
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

  it("leaves the key table under an empty word to be read, not taken on Tab", () => {
    // Taking it unaimed made a held Tab write one key after another and kept
    // focus in the box for good.
    const box = mount();
    box.type("");
    expect(box.texts()).toContain("Search for “”");
    const tab = box.key("Tab");
    expect(box.input.value).toBe("");
    expect(tab).toBe(true);
  });

  it("takes an app row's `apply` on Tab when it is highlighted", () => {
    const box = mount({ sources: [pastRows(["label:kind:bug 部署"])] });
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
        pastRows(["harness:x"], {
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
    const box = mount({ onSubmit, sources: [pastRows(["部署 失败"])] });
    box.type("部署");
    box.key("ArrowDown");
    box.key("ArrowDown");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("部署", { q: "部署 失败" }, false);
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
    const box = mount({ onSubmit, sources: [pastRows(["部署 失败"])] });
    box.type("部署");
    box.key("ArrowDown");
    box.key("ArrowDown");
    box.key("Escape");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("部署", undefined, false);
  });

  it.each(["submit", "Escape"])(
    "preselects nothing again after %s, blur and refocus",
    (how) => {
      const onSubmit = vi.fn();
      const box = mount({
        onSubmit,
        loadChosen: true,
        sources: [pastRows(["foo bar"])],
      });
      box.type("foo");
      box.key("ArrowDown");
      box.key("ArrowDown");
      if (how === "submit") {
        box.key("Enter");
        expect(onSubmit).toHaveBeenCalledWith("foo", { q: "foo bar" }, false);
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
      expect(onSubmit).toHaveBeenCalledWith("assignee:", undefined, false);
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
      sources: [pastRows(["label:old", "label:older", "label:oldest"])],
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
    const box = mount({ sources: [pastRows(["部署 失败"], { remove })] });
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
    const box = mount({ onSubmit, sources: [pastRows(["部署 失败"])] });
    box.type("部署");
    fireEvent.click(box.options()[1] as Element);
    expect(onSubmit).toHaveBeenCalledWith("部署", { q: "部署 失败" }, false);
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
    expect(onSubmit).toHaveBeenCalledWith("bu", undefined, false);
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
    expect(onSubmit).toHaveBeenCalledWith("部署", undefined, false);
    expect(outer).not.toHaveBeenCalled();
  });
});

describe("QueryBox · history", () => {
  const PAST = ["flaky test", "Flaky tests on CI", "a flaky test", "is:open"];
  const option = (box: ReturnType<typeof mount>, text: string) =>
    box.options().find((o) => o.textContent === text) as HTMLElement;
  const removeOf = (row: Element) =>
    row.querySelector("[data-slot=query-history-remove]") as HTMLElement;
  const highlighted = (box: ReturnType<typeof mount>) =>
    document.getElementById(
      box.input.getAttribute("aria-activedescendant") ?? "",
    )?.textContent;

  it("puts past queries the value begins above the submit row, those it is only part of below", () => {
    const box = mount({ past: PAST });
    box.type("flaky");
    expect(box.texts()).toEqual([
      "flaky test",
      "Flaky tests on CI",
      "Search for “flaky”",
      "a flaky test",
    ]);
  });

  it("leaves out the past query the value already is, whatever its case", () => {
    const box = mount({ past: PAST });
    box.type("Flaky Test");
    expect(box.texts()).toEqual([
      "Flaky tests on CI",
      "Search for “Flaky Test”",
      "a flaky test",
    ]);
  });

  it("lists every past query when the box is empty, open on focus", () => {
    const box = mount({ past: PAST });
    act(() => box.input.focus());
    expect(box.listbox()).not.toBeNull();
    expect(box.texts().slice(0, PAST.length + 1)).toEqual([
      ...PAST,
      "Search for “”",
    ]);
  });

  it("gives completions and the app's rows the limit first", () => {
    const past = ["label:area:web is:open", "label:kind:bug"];
    const tight = mount({ past, limit: 2 });
    tight.type("label:");
    expect(tight.texts()).toEqual([
      "area:web",
      "kind:bug",
      "Search for “label:”",
    ]);
    tight.unmount();
    const box = mount({
      past,
      limit: 4,
      sources: [pastRows(["label:mine"], { matched: true, yields: false })],
    });
    box.type("label:");
    expect(box.texts()).toEqual([
      "label:mine",
      "area:web",
      "kind:bug",
      "label:area:web is:open",
      "Search for “label:”",
    ]);
  });

  it("loads the highlighted past query whole on Tab, caret at its end", () => {
    const onSubmit = vi.fn();
    const box = mount({ past: PAST, onSubmit });
    box.type("fla");
    box.key("ArrowDown");
    box.key("Tab");
    expect(box.input.value).toBe("flaky test");
    expect(box.input.selectionStart).toBe("flaky test".length);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the highlighted past query on Enter, in place of the value", () => {
    const onSubmit = vi.fn();
    const box = mount({ past: PAST, onSubmit });
    box.type("fla");
    box.key("ArrowDown");
    box.key("ArrowDown");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("Flaky tests on CI", undefined, true);
    expect(box.input.value).toBe("Flaky tests on CI");
    expect(box.listbox()).toBeNull();
  });

  it("submits a past query from an empty box", () => {
    const onSubmit = vi.fn();
    const box = mount({ past: PAST, onSubmit });
    act(() => box.input.focus());
    box.key("ArrowDown");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("flaky test", undefined, true);
  });

  it("submits a clicked past query", () => {
    const onSubmit = vi.fn();
    const box = mount({ past: PAST, onSubmit });
    box.type("open");
    fireEvent.click(option(box, "is:open"));
    expect(onSubmit).toHaveBeenCalledWith("is:open", undefined, true);
    expect(box.input.value).toBe("is:open");
  });

  it("forgets the highlighted past query on Shift+Delete, the highlight passing to the next", () => {
    const onRemovePast = vi.fn();
    const box = mount({ past: ["one a", "one b", "one c"], onRemovePast });
    box.type("one");
    box.key("ArrowDown");
    expect(box.key("Delete", { shiftKey: true })).toBe(false);
    expect(onRemovePast).toHaveBeenLastCalledWith("one a");
    expect(box.texts()).toEqual(["one b", "one c", "Search for “one”"]);
    expect(highlighted(box)).toBe("one b");
    box.key("Delete", { shiftKey: true });
    expect(highlighted(box)).toBe("one c");
    expect(box.listbox()).not.toBeNull();
  });

  it("passes the highlight back up when the last row goes", () => {
    const box = mount({ past: ["one x9", "two x9"] });
    // Neither begins with the value, so both stand below the submit row.
    box.type("x9");
    expect(box.texts()).toEqual(["Search for “x9”", "one x9", "two x9"]);
    box.key("End");
    box.key("Delete", { shiftKey: true });
    expect(box.texts()).toEqual(["Search for “x9”", "one x9"]);
    expect(highlighted(box)).toBe("one x9");
  });

  it("passes the highlight to the next row after an app row's remove too", () => {
    const remove = vi.fn();
    const box = mount({
      sources: [pastRows(["部署 a", "部署 b"], { remove })],
    });
    box.type("部署");
    box.key("ArrowDown");
    box.key("ArrowDown");
    expect(highlighted(box)).toBe("部署 a");
    box.key("Delete", { shiftKey: true });
    expect(remove).toHaveBeenCalledWith({ q: "部署 a" });
    // The app's remove is a spy that keeps the row, so the next row is
    // still the one after it.
    expect(highlighted(box)).toBe("部署 b");
  });

  it("forgets a past query from its ×, submitting nothing and highlighting nothing", () => {
    const onSubmit = vi.fn();
    const onRemovePast = vi.fn();
    const box = mount({ past: PAST, onSubmit, onRemovePast });
    box.type("flaky");
    const row = option(box, "flaky test");
    fireEvent.mouseMove(row);
    expect(row.getAttribute("aria-selected")).toBe("true");
    expect(fireEvent.click(removeOf(row))).toBe(false);
    expect(onRemovePast).toHaveBeenCalledWith("flaky test");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(box.texts()).not.toContain("flaky test");
    expect(box.input.getAttribute("aria-activedescendant")).toBeNull();
    expect(box.listbox()).not.toBeNull();
  });

  it("draws a past query in the schema's colours, its × hidden from the tree", () => {
    const box = mount({ past: ["is:open flaky"] });
    act(() => box.input.focus());
    const row = option(box, "is:open flaky");
    expect(row.tagName).toBe("DIV");
    // Painted as the input paints it: the key in a span of its own.
    expect(row.querySelector("span span")).not.toBeNull();
    expect(removeOf(row).getAttribute("aria-hidden")).toBe("true");
    // The option's name is the query alone: no control nested in it, and
    // no label laid over it.
    expect(row.querySelector("button, a, [tabindex='0']")).toBeNull();
    expect(row.hasAttribute("aria-label")).toBe(false);
    const named = row.cloneNode(true) as HTMLElement;
    for (const hidden of named.querySelectorAll("[aria-hidden]")) {
      hidden.remove();
    }
    expect(named.textContent).toBe("is:open flaky");
  });

  it("makes each past query a link to its results, given `queryHref`", () => {
    const onSubmit = vi.fn();
    const box = mount({
      past: PAST,
      onSubmit,
      queryHref: (q) => `/search?q=${encodeURIComponent(q)}`,
    });
    box.type("open");
    const row = option(box, "is:open");
    expect(row.tagName).toBe("A");
    expect(row.getAttribute("role")).toBe("option");
    expect(row.getAttribute("href")).toBe("/search?q=is%3Aopen");
    // A modified click is the browser's: a new tab, the box still open.
    expect(fireEvent.click(row, { ctrlKey: true })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(box.listbox()).not.toBeNull();
    // A plain one is the app's, which decides where the query goes.
    expect(fireEvent.click(row)).toBe(false);
    expect(onSubmit).toHaveBeenCalledWith("is:open", undefined, true);
  });

  it("keeps a click on a link row's × from going anywhere", () => {
    const onSubmit = vi.fn();
    const box = mount({ past: PAST, onSubmit, queryHref: (q) => `#${q}` });
    box.type("open");
    const remove = removeOf(option(box, "is:open"));
    const middle = new MouseEvent("auxclick", {
      bubbles: true,
      cancelable: true,
      button: 1,
    });
    expect(fireEvent(remove, middle)).toBe(false);
    expect(fireEvent.click(remove, { metaKey: true })).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(box.texts()).not.toContain("is:open");
  });

  it("swaps primary inside the highlighted row under raymond, so a query's keys stay seen", () => {
    const box = mount({ past: PAST });
    box.type("flaky");
    box.key("ArrowDown");
    expect(option(box, "flaky test").className).toContain(
      "raymond:*:[--primary:var(--list-highlight-text)]",
    );
    expect(option(box, "a flaky test").className).not.toContain(
      "--list-highlight",
    );
  });
});

describe("QueryBox · value rows the app draws", () => {
  type Member = { value: string; hint?: string; login: string };
  const members: Member[] = [
    { value: "alice", hint: "Alice", login: "alice" },
    // The schema's own `@me`, restated with who that is.
    { value: "@ME", hint: "Alice", login: "alice" },
  ];
  const MEMBERS: ValueProviders = {
    ...PROVIDERS,
    member: { options: members },
  };

  it("draws the app's mark and words for a value, its hint still after them", () => {
    const renderValue = vi.fn(
      ({ option, spec }: CompletionValue): ValueRowContent | undefined => {
        if (spec.kind !== "named") return undefined;
        if (spec.source === "label")
          return { body: <b data-chip>{option.value}</b> };
        if (spec.source === "member")
          return {
            leading: (
              <span data-slot="avatar">{(option as Member).login[0]}</span>
            ),
          };
        return undefined;
      },
    );
    const box = mount({ providers: MEMBERS, renderValue });
    box.type("label:");
    const chip = box.options()[0]?.querySelector("[data-chip]");
    expect(chip?.textContent).toBe("area:web");
    // The words take the monospace text's place; nothing else is drawn.
    expect(box.options()[0]?.querySelector(".font-mono")).toBeNull();
    expect(box.options()[0]?.querySelector("svg")).not.toBeNull();

    box.type("assignee:");
    const row = box.options()[0] as HTMLElement;
    const lead = row.querySelector("[data-slot=query-value-leading]");
    expect(lead?.getAttribute("aria-hidden")).toBe("true");
    expect(lead?.textContent).toBe("a");
    // In the icon's place, and the value and hint as ever after it.
    expect(row.querySelector("svg")).toBeNull();
    expect(row.textContent).toBe("a@MEAlice");
    expect(renderValue).toHaveBeenCalledWith({
      option: { value: "@ME", hint: "Alice", login: "alice" },
      key: "assignee",
      spec: todouSchema.qualifiers.assignee?.value,
    });
  });

  it("offers a value its provider restates once, in the schema's place", () => {
    const box = mount({ providers: MEMBERS });
    box.type("assignee:");
    expect(box.texts()).toEqual([
      "@MEAlice",
      "aliceAlice",
      "Search for “assignee:”",
    ]);
  });

  it("draws the box's own row for what the app leaves, and asks nothing for a key", () => {
    const renderValue = vi.fn(() => undefined);
    const box = mount({ renderValue });
    box.type("har");
    expect(renderValue).not.toHaveBeenCalled();
    box.type("state:");
    expect(renderValue).toHaveBeenCalled();
    const row = box.options()[0] as HTMLElement;
    expect(row.querySelector(".font-mono")?.textContent).toBe("open");
    expect(row.querySelector("[data-slot=query-value-leading]")).toBeNull();
  });
});

describe("QueryBox · app rows that complete", () => {
  /** A word the schema cannot complete: a project's prefix, as todou's are. */
  const prefixes = (options: Partial<RowSource<Past>> = {}) =>
    pastRows([], {
      id: "prefix",
      matched: true,
      yields: false,
      completes: true,
      rows: [{ q: "ACC-" }],
      apply: () => ({ value: "ACC-", caret: 4 }),
      ...options,
    });

  it("takes the highlighted row on Enter, stays open and submits nothing", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit, sources: [prefixes()] });
    box.type("ac");
    expect(box.texts()).toEqual(["ACC-", "Search for “ac”"]);
    box.key("ArrowDown");
    box.key("Enter");
    expect(box.input.value).toBe("ACC-");
    expect(box.input.selectionStart).toBe(4);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(box.listbox()).not.toBeNull();
  });

  it("takes a clicked row the same way", () => {
    const onSubmit = vi.fn();
    const box = mount({ onSubmit, sources: [prefixes()] });
    box.type("ac");
    fireEvent.click(box.options()[0] as Element);
    expect(box.input.value).toBe("ACC-");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is what Tab takes with nothing highlighted, above the submit row only", () => {
    const box = mount({ sources: [prefixes()] });
    box.type("ac");
    box.key("Tab");
    expect(box.input.value).toBe("ACC-");
    box.unmount();
    // Below the submit row it is only there to be read, as the key table is.
    const below = mount({ sources: [prefixes({ matched: false })] });
    below.type("ac");
    expect(below.texts()).toEqual(["Search for “ac”", "ACC-"]);
    expect(below.key("Tab")).toBe(true);
    expect(below.input.value).toBe("ac");
  });

  it("submits a row whose `apply` gives nothing, as any app row", () => {
    const onSubmit = vi.fn();
    const box = mount({
      onSubmit,
      sources: [prefixes({ apply: () => null })],
    });
    box.type("ac");
    box.key("ArrowDown");
    box.key("Enter");
    expect(onSubmit).toHaveBeenCalledWith("ac", { q: "ACC-" }, false);
  });
});

describe("QueryBox · busy", () => {
  it("marks the input busy while the app waits on what it was given", () => {
    const idle = mount();
    expect(idle.input.hasAttribute("aria-busy")).toBe(false);
    idle.unmount();
    const box = mount({ busy: true });
    expect(box.input.getAttribute("aria-busy")).toBe("true");
  });
});
