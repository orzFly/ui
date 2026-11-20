import { undo } from "@codemirror/commands";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownEditor } from "../src/components/markdown-editor.tsx";
import { cmPressKey, cmView } from "./cm.ts";
import { IMAGE_PAIR_CASES } from "./image-pair-cases.ts";

const A = "![a](/a.png)";
const B = "![b](/b.png)";

function editor(doc: string) {
  const view = render(<MarkdownEditor initialValue={doc} />);
  return { root: view.container, cm: () => cmView(view.container) };
}

/** Put `text` in at `at` the way a paste or a drop does. */
function insert(
  root: ParentNode,
  at: number,
  text: string,
  userEvent = "input.paste",
) {
  const view = cmView(root);
  act(() => {
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
      userEvent,
    });
  });
}

function offer(root: ParentNode): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(".cm-image-pair-offer button");
}

const arrows = (root: ParentNode) =>
  [...root.querySelectorAll(".cm-image-pair-arrow")].map(
    (el) => el.textContent,
  );

describe("the green arrow", () => {
  it.each(IMAGE_PAIR_CASES)("$name → pair: $pair", ({ markdown, pair }) => {
    const { root } = editor(markdown);
    expect(arrows(root).length > 0).toBe(pair);
  });

  it("follows an edit that makes or breaks a pair", () => {
    const { root, cm } = editor(`${A} ${B}\n`);
    expect(arrows(root)).toEqual([]);
    act(() => {
      cm().dispatch({ changes: { from: A.length, insert: " ->" } });
    });
    expect(arrows(root)).toEqual(["->"]);
    expect(
      root.querySelector(".cm-image-pair-arrow")?.getAttribute("title"),
    ).toBe("Shown as a comparison");
  });
});

describe("the offer to compare", () => {
  it("joins a pasted image to the lone one above, as one undo step", () => {
    const { root, cm } = editor(`${A}\n\n`);
    insert(root, cm().state.doc.length, B);
    const button = offer(root);
    expect(button?.textContent).toBe("Compare with the image above");
    act(() => button?.click());
    expect(cm().state.doc.toString()).toBe(`${A} → ${B}`);
    expect(cm().state.selection.main.head).toBe(`${A} → ${B}`.length);
    expect(offer(root)).toBeNull();
    expect(arrows(root)).toEqual(["→"]);
    act(() => {
      undo(cm());
    });
    expect(cm().state.doc.toString()).toBe(`${A}\n\n${B}`);
  });

  it("joins a second image pasted on the first one's line", () => {
    const { root, cm } = editor(`${A} `);
    insert(root, cm().state.doc.length, B);
    const button = offer(root);
    expect(button?.textContent).toBe("Compare with the image before");
    act(() => button?.click());
    expect(cm().state.doc.toString()).toBe(`${A} → ${B}`);
  });

  it("offers nothing for a second image pasted into a sentence", () => {
    const { root, cm } = editor(`see ${A} `);
    insert(root, cm().state.doc.length, B);
    expect(offer(root)).toBeNull();
  });

  it("keeps a list item's prefix", () => {
    const { root, cm } = editor(`- ${A}\n\n  `);
    insert(root, cm().state.doc.length, B);
    act(() => offer(root)?.click());
    expect(cm().state.doc.toString()).toBe(`- ${A} → ${B}`);
    expect(arrows(root)).toEqual(["→"]);
  });

  it("keeps a quote's prefix", () => {
    const { root, cm } = editor(`> ${A}\n>\n> `);
    insert(root, cm().state.doc.length, B);
    act(() => offer(root)?.click());
    expect(cm().state.doc.toString()).toBe(`> ${A} → ${B}`);
    expect(arrows(root)).toEqual(["→"]);
  });

  it("offers to compare two images dropped at once", () => {
    const { root } = editor("");
    insert(root, 0, `${A}\n\n${B}`, "input.drop");
    expect(offer(root)?.textContent).toBe("Compare");
    act(() => offer(root)?.click());
    expect(cmView(root).state.doc.toString()).toBe(`${A} → ${B}`);
  });

  it("offers nothing above text, above a pair, or for typed text", () => {
    const cases: Array<[string, string]> = [
      ["Some words.\n\n", "input.paste"],
      [`${A} ${A}\n\n`, "input.paste"],
      [`${A}\n\n`, "input.type"],
    ];
    for (const [doc, userEvent] of cases) {
      const { root, cm } = editor(doc);
      insert(root, cm().state.doc.length, B, userEvent);
      expect(offer(root), `${JSON.stringify(doc)} ${userEvent}`).toBeNull();
    }
  });

  it("offers for any image a paste puts in, not only an uploaded file's", () => {
    const { root, cm } = editor("![a](https://example.com/a.png)\n\n");
    insert(root, cm().state.doc.length, "![b](https://example.com/b.png)");
    expect(offer(root)?.textContent).toBe("Compare with the image above");
  });

  it("stands aside while the paste's own options are up", () => {
    const { root, cm } = editor(`${A}\n\n`);
    const data = new DataTransfer();
    data.setData("text/plain", `${B}\nand a second line`);
    const event = new ClipboardEvent("paste", {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      cm().dispatch({ selection: { anchor: cm().state.doc.length } });
      cm().contentDOM.dispatchEvent(event);
    });
    expect(root.querySelector(".cm-paste-options")).not.toBeNull();
    expect(offer(root)).toBeNull();
  });

  it("goes away on the next edit or caret move", () => {
    const typed = editor(`${A}\n\n`);
    insert(typed.root, typed.cm().state.doc.length, B);
    act(() => {
      typed.cm().dispatch({ changes: { from: 0, insert: "x" } });
    });
    expect(offer(typed.root)).toBeNull();

    const moved = editor(`${A}\n\n`);
    insert(moved.root, moved.cm().state.doc.length, B);
    act(() => {
      moved.cm().dispatch({ selection: { anchor: 0 } });
    });
    expect(offer(moved.root)).toBeNull();
  });

  it("is reachable with Mod-. and Escape goes back to the text", () => {
    const { root, cm } = editor(`${A}\n\n`);
    insert(root, cm().state.doc.length, B);
    const end = cm().state.doc.length;
    act(() => {
      cmPressKey(root, ".", { ctrlKey: true });
    });
    expect(document.activeElement).toBe(offer(root));
    act(() => {
      offer(root)?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(document.activeElement).toBe(cm().contentDOM);
    expect(cm().state.selection.main.head).toBe(end);
  });
});
