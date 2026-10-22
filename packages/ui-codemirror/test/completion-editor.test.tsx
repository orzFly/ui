import { setTimeout as delay } from "node:timers/promises";
import {
  type Completion,
  type CompletionSource,
  completionStatus,
  currentCompletions,
  hasNextSnippetField,
  startCompletion,
} from "@codemirror/autocomplete";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownEditor } from "../src/components/markdown-editor.tsx";
import { completionWith } from "../src/extensions/completion.ts";
import {
  applyWithSpace,
  pendingSpaceAt,
} from "../src/extensions/completion-space.ts";
import { commandCompletionSource } from "../src/extensions/slash-commands.ts";
import { createCommandRegistry } from "../src/lib/slash-commands.ts";
import {
  cmGetValue,
  cmInput,
  cmPressKey,
  cmType,
  cmView,
  handleViewInput,
} from "./cm.ts";

/**
 * `completionWith` on a real MarkdownEditor: tag templates, snippet fields,
 * the keys the panel owns and the ones it leaves to the browser. Key
 * ownership is asserted through `defaultPrevented`, because focus movement
 * is a browser default action that happy-dom does not perform.
 */

// Independent expected document: importing the production template would hide
// broken blank lines and field numbering from this assertion.
const BLOCK =
  "<details>\n<summary>\n\nTitle\n\n</summary>\n\nBody\n\n</details>\n";

/**
 * Long enough to cover both of upstream's delays: `activateOnTypingDelay`
 * before the panel opens, and the `interactionDelay` within which
 * `acceptCompletion` refuses so that a fast typist accepts nothing by
 * accident.
 */
const settle = () => delay(200);

/** A caller's own source: one `@alice` row, accepted with a trailing space. */
const mentionStub: CompletionSource = (context) => {
  const match = context.matchBefore(/@\w*$/);
  if (match === null) return null;
  const options: Completion[] = [
    { label: "@alice", type: "mention", apply: applyWithSpace("@alice") },
  ];
  return { from: match.from, options, validFor: /^@\w*$/ };
};

function editor(onCancel?: () => void, sources = [mentionStub]) {
  return render(
    <MarkdownEditor
      ariaLabel="Body"
      onCancel={onCancel}
      extensions={completionWith(sources)}
    />,
  );
}

async function active(root: ParentNode) {
  await waitFor(() =>
    expect(completionStatus(cmView(root).state)).toBe("active"),
  );
  await settle();
}

async function panelFor(root: ParentNode, text = "<") {
  act(() => cmType(root, text));
  await active(root);
}

function selected(root: ParentNode) {
  const { state } = cmView(root);
  const { from, to } = state.selection.main;
  return state.sliceDoc(from, to);
}

async function insertBlock(root: ParentNode, text = "<") {
  await panelFor(root, text);
  cmPressKey(root, "Tab");
}

const labels = (root: ParentNode) =>
  currentCompletions(cmView(root).state).map((item) => item.label);

describe("details completion and snippet fields", () => {
  it("inserts the exact rich-text template and traverses title, body and exit in both directions", async () => {
    const { container } = editor();
    await panelFor(container);
    expect(labels(container)).toEqual(["<details>"]);
    cmPressKey(container, "Tab");
    expect(cmGetValue(container)).toBe(BLOCK);
    expect(selected(container)).toBe("Title");
    cmPressKey(container, "Tab");
    expect(selected(container)).toBe("Body");
    cmPressKey(container, "Tab", { shiftKey: true });
    expect(selected(container)).toBe("Title");
    cmPressKey(container, "Tab");
    cmPressKey(container, "Tab");
    expect(cmView(container).state.selection.main.head).toBe(BLOCK.length);
    expect(hasNextSnippetField(cmView(container).state)).toBe(false);
    expect(cmPressKey(container, "Tab").defaultPrevented).toBe(false);
    expect(
      cmPressKey(container, "Tab", { shiftKey: true }).defaultPrevented,
    ).toBe(false);
  });

  it.each(["<details", "<DETAILS", "<details>\n<", "<details>\n\nbody\n\n<"])(
    "offers the template in HTML context %j",
    async (text) => {
      const { container } = editor();
      await panelFor(container, text);
      expect(labels(container)).toContain("<details>");
    },
  );

  it("keeps a matching caller row and selects the tag first", async () => {
    const detour: CompletionSource = (context) => {
      const match = context.matchBefore(/\w+$/);
      return match === null
        ? null
        : { from: match.from, options: [{ label: "detour/" }] };
    };
    const { container } = editor(undefined, [detour]);
    await panelFor(container, "<det");
    expect(labels(container)[0]).toBe("<details>");
    expect(labels(container)).toContain("detour/");
    cmPressKey(container, "Enter");
    expect(cmGetValue(container)).toBe(BLOCK);
  });

  it("ignores boost for unfiltered sources and preserves their relative order", async () => {
    // Deliberately oppose boost and source order. An upstream switch to boost
    // must fail here even if <details> still happens to render first.
    const sources: CompletionSource[] = [-99, 99, 0].map(
      (boost, index) => (context) => ({
        from: 0,
        to: context.pos,
        filter: false,
        options: [{ label: `candidate-${index}`, boost }],
      }),
    );
    const { container } = render(
      <MarkdownEditor extensions={completionWith(sources)} />,
    );
    await panelFor(container, "candidate");
    expect(labels(container)).toEqual([
      "candidate-0",
      "candidate-1",
      "candidate-2",
    ]);
  });

  it("fills both fields with Markdown", async () => {
    const { container } = editor();
    await insertBlock(container);
    act(() => cmInput(container, "**bold** and `code`"));
    cmPressKey(container, "Tab");
    act(() => cmInput(container, "**body**"));
    expect(cmGetValue(container)).toBe(
      BLOCK.replace("Title", "**bold** and `code`").replace("Body", "**body**"),
    );
  });

  it.each([
    ["- item\n  <", "  "],
    ["1. item\n   <", "   "],
    ["- outer\n  - inner\n    <", "    "],
  ])(
    "indents the whole template in a list continuation %j",
    async (text, indent) => {
      const { container } = editor();
      await insertBlock(container, text);
      const prefix = text.slice(0, -1 - indent.length);
      // snippet() copies the trigger line's indentation onto every later line,
      // blank ones included, which is what keeps the block inside the item.
      const indented = BLOCK.split("\n")
        .map((line) => `${indent}${line}`)
        .join("\n");
      expect(cmGetValue(container)).toBe(`${prefix}${indented}`);
    },
  );

  it("accepts a title mention before Tab moves the snippet and preserves pending-space punctuation", async () => {
    const { container } = editor();
    await insertBlock(container);
    act(() => cmInput(container, "@ali"));
    await active(container);
    cmPressKey(container, "Tab");
    expect(cmGetValue(container)).toBe(BLOCK.replace("Title", "@alice "));
    expect(pendingSpaceAt(cmView(container).state)).not.toBeNull();
    act(() => expect(cmInput(container, "，")).toBe(true));
    expect(cmGetValue(container)).toBe(BLOCK.replace("Title", "@alice，"));
    cmPressKey(container, "Tab");
    expect(selected(container)).toBe("Body");
  });

  it("still trims a pending mention space on Enter inside the template", async () => {
    const { container } = editor();
    await insertBlock(container);
    act(() => cmInput(container, "@ali"));
    await active(container);
    cmPressKey(container, "Enter");
    expect(cmGetValue(container)).toBe(BLOCK.replace("Title", "@alice "));
    cmPressKey(container, "Enter");
    expect(cmGetValue(container)).toBe(BLOCK.replace("Title", "@alice\n"));
  });

  it("spends Escape on the panel, then snippet, then the enclosing cancel action", async () => {
    const cancel = vi.fn();
    const { container } = editor(cancel);
    await insertBlock(container);
    act(() => cmInput(container, "@ali"));
    await active(container);
    cmPressKey(container, "Escape");
    expect(completionStatus(cmView(container).state)).toBeNull();
    expect(hasNextSnippetField(cmView(container).state)).toBe(true);
    expect(cancel).not.toHaveBeenCalled();
    cmPressKey(container, "Escape");
    expect(hasNextSnippetField(cmView(container).state)).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
    cmPressKey(container, "Escape");
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("ordinary Markdown outside the tag trigger", () => {
  it.each([
    "```html\n<",
    "~~~\n<",
    "- item\n  ```html\n  <",
    "    <",
    "\t<",
    "<!--\n<",
    "<!-- comment\n<",
    "a < b",
    "x<",
    "a <",
    "- <",
    "> <",
    "| <",
    "\\<",
    "\u00a0<",
    "<https://example.com",
    "<HARD",
    "<details>",
  ])("leaves %j unchanged without a tag candidate", async (text) => {
    const { container } = editor();
    act(() => cmType(container, text));
    await settle();
    expect(
      currentCompletions(cmView(container).state).some(
        (item) => item.type === "tag",
      ),
    ).toBe(false);
    expect(completionStatus(cmView(container).state)).toBeNull();
    expect(cmGetValue(container)).toBe(text);
  });

  it("does not offer a template before existing line content", async () => {
    const { container } = editor();
    act(() =>
      cmView(container).dispatch({
        changes: { from: 0, insert: "<tail" },
        selection: { anchor: 1 },
        userEvent: "input.type",
      }),
    );
    await settle();
    expect(completionStatus(cmView(container).state)).toBeNull();
    expect(cmGetValue(container)).toBe("<tail");
  });

  it("closes the tag panel when ordinary HTML or an autolink continues", async () => {
    const { container } = editor();
    await panelFor(container);
    act(() => cmInput(container, "https://example.com>"));
    await settle();
    expect(completionStatus(cmView(container).state)).toBeNull();
    expect(cmGetValue(container)).toBe("<https://example.com>");
  });

  it("leaves a literal < followed by a newline after Escape", async () => {
    const { container } = editor();
    await panelFor(container);
    cmPressKey(container, "Escape");
    cmPressKey(container, "Enter");
    expect(cmGetValue(container)).toBe("<\n");
  });

  it("does not open on paste, even when the cursor is after the first <", async () => {
    const { container } = editor();
    const text = "<details>\n<summary>x</summary>\n";
    act(() =>
      cmView(container).dispatch({
        changes: { from: 0, insert: text },
        selection: { anchor: 1 },
        userEvent: "input.paste",
      }),
    );
    await settle();
    expect(completionStatus(cmView(container).state)).toBeNull();
    expect(cmGetValue(container)).toBe(text);
  });

  it("does not intercept the composing DOM input path or accept a snippet during composition", async () => {
    const { container } = editor();
    const view = cmView(container);
    fireEvent.compositionStart(view.contentDOM);
    expect(view.composing).toBe(false);
    const dispatch = vi.spyOn(view, "dispatch");
    expect(handleViewInput(view, "<")).toBe(false);
    expect(view.composing).toBe(true); // helper increment matches applyDOMChangeInner
    expect(dispatch).not.toHaveBeenCalled();
    dispatch.mockRestore();
    // This is the default DOM input transaction after handlers decline it.
    act(() =>
      view.dispatch({
        changes: { from: 0, insert: "<" },
        selection: { anchor: 1 },
        userEvent: "input.type.compose",
      }),
    );
    cmPressKey(container, "Enter");
    expect(cmGetValue(container)).toBe("<");
    fireEvent.compositionEnd(view.contentDOM);
    // After composition the ordinary source is usable; no custom IME state
    // machine or proactive snippet insertion lives in the input handler.
    act(() => startCompletion(view));
    await active(container);
    expect(labels(container)).toContain("<details>");
  });
});

describe("the completion panel's keys", () => {
  it("accepts a caller row on Tab", async () => {
    const view = editor();
    await panelFor(view.container, "hi @");
    const event = cmPressKey(view.container, "Tab");
    expect(cmGetValue(view.container)).toBe("hi @alice ");
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the pending space through completion's effect transactions", async () => {
    const view = editor();
    await panelFor(view.container, "hi @");
    cmPressKey(view.container, "Tab");
    await waitFor(() =>
      expect(completionStatus(cmView(view.container).state)).toBeNull(),
    );
    await settle();
    startCompletion(cmView(view.container));

    const handled = cmInput(view.container, "，");
    expect(cmGetValue(view.container)).toBe("hi @alice，");
    expect(handled).toBe(true);
  });

  it("leaves Tab to the browser with no panel open", async () => {
    const view = editor();
    cmType(view.container, "plain prose");
    // Waiting out the delays first, so this is a source that ran and found
    // nothing rather than one that had not started yet.
    await settle();
    expect(completionStatus(cmView(view.container).state)).toBeNull();
    const event = cmPressKey(view.container, "Tab");
    expect(cmGetValue(view.container)).toBe("plain prose");
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves Shift-Tab alone, so focus still walks backwards", async () => {
    const view = editor();
    await panelFor(view.container, "hi @");
    const event = cmPressKey(view.container, "Tab", { shiftKey: true });
    expect(cmGetValue(view.container)).toBe("hi @");
    expect(event.defaultPrevented).toBe(false);
  });

  it("lets the open panel consume Enter without inserting a newline", async () => {
    const view = editor();
    await panelFor(view.container, "hi @");
    const event = cmPressKey(view.container, "Enter");
    expect(event.defaultPrevented).toBe(true);
    expect(cmGetValue(view.container)).toBe("hi @alice ");
    cmPressKey(view.container, "Enter");
    expect(cmGetValue(view.container)).toBe("hi @alice\n");
  });
});

const commandRegistry = createCommandRegistry([
  {
    name: "hide-all",
    argument: "optional",
    detail: "hide every comment before this one",
    candidates: ["force"],
    summarize: () => "hide every comment",
    compile: (argument: string) =>
      argument === "" || argument === "force" ? { force: argument } : null,
  },
]);

const commandExtensions = completionWith([
  commandCompletionSource(() => commandRegistry),
]);

describe("the slash panel's keys", () => {
  it("ends the command on Enter rather than reaching force", async () => {
    const view = render(
      <MarkdownEditor ariaLabel="Body" extensions={commandExtensions} />,
    );
    await panelFor(view.container, "/hide-all ");
    cmPressKey(view.container, "Enter");
    expect(cmGetValue(view.container)).toBe("/hide-all \n");
  });

  it("reaches force one row down, so nothing was dropped", async () => {
    const view = render(
      <MarkdownEditor ariaLabel="Body" extensions={commandExtensions} />,
    );
    await panelFor(view.container, "/hide-all ");
    cmPressKey(view.container, "ArrowDown");
    cmPressKey(view.container, "Enter");
    expect(cmGetValue(view.container)).toBe("/hide-all force");
  });
});
