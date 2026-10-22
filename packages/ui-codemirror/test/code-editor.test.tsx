import {
  autocompletion,
  type CompletionSource,
  completionStatus,
  startCompletion,
} from "@codemirror/autocomplete";
import { undo } from "@codemirror/commands";
import type { EditorView } from "@codemirror/view";
import { hasUnsavedWork } from "@orz/ui/lib/unsaved-guard";
import { render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  CodeEditor,
  type CodeEditorHandle,
  PROGRAMMATIC_USER_EVENT,
} from "../src/components/code-editor.tsx";
import { cmPlaceholder, cmSetValue, cmView } from "./cm.ts";

function mount(initialValue = "start") {
  const ref = createRef<CodeEditorHandle>();
  const view = render(<CodeEditor ref={ref} initialValue={initialValue} />);
  const handle = ref.current;
  if (handle === null) throw new Error("CodeEditor exposed no handle");
  return { view, handle, cm: cmView(view.container) };
}

describe("CodeEditor provenance", () => {
  it("leaves a write tagged as programmatic out of userChanged", () => {
    const { handle, cm } = mount();
    cm.dispatch({
      changes: { from: 0, insert: "machine: " },
      userEvent: PROGRAMMATIC_USER_EVENT,
    });
    expect(handle.getValue()).toBe("machine: start");
    expect(handle.userChanged()).toBe(false);
  });

  it("counts a typed change", () => {
    const { view, handle } = mount();
    expect(handle.userChanged()).toBe(false);
    cmSetValue(view.container, "typed");
    expect(handle.userChanged()).toBe(true);
  });

  it("counts a move.* transaction, which no whitelist of input events names", () => {
    const { handle, cm } = mount("a\nb");
    cm.dispatch({
      changes: { from: 0, to: 3, insert: "b\na" },
      userEvent: "move.line",
    });
    expect(handle.userChanged()).toBe(true);
  });

  it("counts a batch that mixes one unannotated change with tagged ones", () => {
    const { handle, cm } = mount();
    const tagged = cm.state.update({
      changes: { from: 0, insert: "a" },
      userEvent: PROGRAMMATIC_USER_EVENT,
    });
    const unannotated = tagged.state.update({
      changes: { from: 0, insert: "b" },
    });
    const taggedAgain = unannotated.state.update({
      changes: { from: 0, insert: "c" },
      userEvent: PROGRAMMATIC_USER_EVENT,
    });
    // One view update carrying all three, as a batched dispatch produces.
    cm.update([tagged, unannotated, taggedAgain]);
    expect(cm.state.doc.toString()).toBe("cbastart");
    expect(handle.userChanged()).toBe(true);
  });

  it("counts setValue, which is deliberately unannotated", () => {
    const { handle } = mount();
    handle.setValue("replaced");
    expect(handle.getValue()).toBe("replaced");
    expect(handle.userChanged()).toBe(true);
  });

  it("counts append and leaves the caret after the appended text", () => {
    const { handle, cm } = mount();
    handle.append(" and more");
    expect(handle.getValue()).toBe("start and more");
    expect(cm.state.selection.main.head).toBe("start and more".length);
    expect(handle.userChanged()).toBe(true);
  });

  it("hands the view out on mount and takes it back on unmount", () => {
    const onView = vi.fn<(view: EditorView | null) => void>();
    const view = render(<CodeEditor onView={onView} />);
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView.mock.calls[0]?.[0]).toBe(cmView(view.container));
    view.unmount();
    expect(onView).toHaveBeenLastCalledWith(null);
  });
});

describe("CodeEditor", () => {
  it("reconfigures readOnly and placeholder without rebuilding the view", () => {
    const view = render(<CodeEditor placeholder="first" />);
    const cm = cmView(view.container);
    cmSetValue(view.container, "kept in history");

    view.rerender(<CodeEditor placeholder="second" readOnly />);
    expect(cmView(view.container)).toBe(cm);
    expect(cm.state.readOnly).toBe(true);

    view.rerender(<CodeEditor placeholder="second" />);
    expect(cm.state.readOnly).toBe(false);
    undo(cm);
    expect(cm.state.doc.toString()).toBe("");
    expect(cmPlaceholder(view.container)).toBe("second");
  });

  it("registers a dirty source", () => {
    const view = render(<CodeEditor initialValue="start" />);
    cmSetValue(view.container, "edited");
    expect(hasUnsavedWork()).toBe(true);
  });

  it("registers none when its owner manages the dirty state", () => {
    const view = render(<CodeEditor initialValue="start" ownerManagedDirty />);
    cmSetValue(view.container, "edited");
    expect(hasUnsavedWork()).toBe(false);
  });

  it("keeps the same handle across a re-render with new props", () => {
    const ref = createRef<CodeEditorHandle>();
    const view = render(<CodeEditor ref={ref} placeholder="first" />);
    const first = ref.current;
    view.rerender(<CodeEditor ref={ref} placeholder="second" readOnly />);
    expect(first).not.toBeNull();
    expect(ref.current).toBe(first);
  });

  it("reports whether dismissCompletion closed an open panel", async () => {
    const source: CompletionSource = (context) => ({
      from: context.pos,
      options: [{ label: "alpha" }, { label: "beta" }],
    });
    const ref = createRef<CodeEditorHandle>();
    const view = render(
      <CodeEditor
        ref={ref}
        extensions={autocompletion({ override: [source] })}
      />,
    );
    const cm = cmView(view.container);
    expect(ref.current?.dismissCompletion()).toBe(false);

    startCompletion(cm);
    await waitFor(() => expect(completionStatus(cm.state)).toBe("active"));
    expect(ref.current?.dismissCompletion()).toBe(true);
    expect(completionStatus(cm.state)).toBeNull();
    expect(ref.current?.dismissCompletion()).toBe(false);
  });
});
