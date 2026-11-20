import { hasUnsavedWork } from "@orz/ui/lib/unsaved-guard";
import { fireEvent, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "../src/components/markdown-editor.tsx";

function box(root: ParentNode, index = 0): HTMLTextAreaElement {
  const found = root.querySelectorAll<HTMLTextAreaElement>(
    'textarea[data-slot="markdown-editor"]',
  );
  const el = found[index];
  if (el === undefined) throw new Error(`no plain editor at ${index}`);
  return el;
}

/** What typing does: the value changes, then `input` fires. */
function type(el: HTMLTextAreaElement, value: string) {
  el.value = value;
  fireEvent.input(el);
}

describe("MarkdownEditor plain", () => {
  it("mounts a textarea in place of CodeMirror", () => {
    const view = render(<MarkdownEditor plain initialValue="# hi" />);
    expect(box(view.container).value).toBe("# hi");
    expect(view.container.querySelector(".cm-editor")).toBeNull();
  });

  it("reads plain once, at mount", () => {
    const view = render(<MarkdownEditor plain initialValue="draft" />);
    type(box(view.container), "draft and more");
    view.rerender(<MarkdownEditor plain={false} initialValue="draft" />);
    expect(view.container.querySelector(".cm-editor")).toBeNull();
    expect(box(view.container).value).toBe("draft and more");
  });

  it("reads and writes through the same handle", () => {
    const ref = createRef<MarkdownEditorHandle>();
    const onChange = vi.fn();
    const view = render(
      <MarkdownEditor plain ref={ref} initialValue="a" onChange={onChange} />,
    );
    expect(ref.current?.getValue()).toBe("a");
    expect(ref.current?.userChanged()).toBe(false);
    ref.current?.setValue("b");
    expect(box(view.container).value).toBe("b");
    expect(onChange).toHaveBeenLastCalledWith("b");
    ref.current?.append(" c");
    expect(box(view.container).value).toBe("b c");
    expect(ref.current?.userChanged()).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith("b c");
    expect(ref.current?.dismissCompletion()).toBe(false);
  });

  it("counts setValue as the CodeMirror editor does", () => {
    const answers = [true, false].map((plain) => {
      const ref = createRef<MarkdownEditorHandle>();
      const view = render(
        <MarkdownEditor plain={plain} ref={ref} initialValue="a" />,
      );
      ref.current?.setValue("b");
      const answer = ref.current?.userChanged();
      view.unmount();
      return answer;
    });
    expect(answers[0]).toBe(answers[1]);
  });

  it("reports typing through onChange and marks the reader's change", () => {
    const ref = createRef<MarkdownEditorHandle>();
    const onChange = vi.fn();
    const view = render(<MarkdownEditor plain ref={ref} onChange={onChange} />);
    type(box(view.container), "typed");
    expect(onChange).toHaveBeenLastCalledWith("typed");
    expect(ref.current?.userChanged()).toBe(true);
  });

  it("submits on Mod-Enter with the current text, and cancels on Escape", () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const view = render(
      <MarkdownEditor plain onSubmit={onSubmit} onCancel={onCancel} />,
    );
    const el = box(view.container);
    type(el, "ship it");
    expect(fireEvent.keyDown(el, { key: "Enter", ctrlKey: true })).toBe(false);
    expect(onSubmit).toHaveBeenCalledWith("ship it");
    fireEvent.keyDown(el, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("swallows Mod-Enter with no onSubmit, and leaves Escape without onCancel", () => {
    const view = render(<MarkdownEditor plain />);
    const el = box(view.container);
    expect(fireEvent.keyDown(el, { key: "Enter", ctrlKey: true })).toBe(false);
    expect(fireEvent.keyDown(el, { key: "Escape" })).toBe(true);
  });

  it("leaves a plain Enter to the textarea", () => {
    const onSubmit = vi.fn();
    const view = render(<MarkdownEditor plain onSubmit={onSubmit} />);
    expect(fireEvent.keyDown(box(view.container), { key: "Enter" })).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("is dirty only while the text differs from what it opened with", () => {
    const view = render(<MarkdownEditor plain initialValue="start" />);
    expect(hasUnsavedWork()).toBe(false);
    type(box(view.container), "start and more");
    expect(hasUnsavedWork()).toBe(true);
    type(box(view.container), "start");
    expect(hasUnsavedWork()).toBe(false);
  });

  it("registers no dirty source for an owner that manages it", () => {
    const view = render(
      <MarkdownEditor plain ownerManagedDirty initialValue="start" />,
    );
    type(box(view.container), "changed");
    expect(hasUnsavedWork()).toBe(false);
  });

  it("hands paste, drop and drag-over to the caller", () => {
    const onPaste = vi.fn();
    const onDrop = vi.fn();
    const onDragOver = vi.fn();
    const view = render(
      <MarkdownEditor
        plain
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={onDragOver}
      />,
    );
    const el = box(view.container);
    fireEvent.paste(el);
    fireEvent.drop(el);
    fireEvent.dragOver(el);
    expect(onPaste).toHaveBeenCalledOnce();
    expect(onDrop).toHaveBeenCalledOnce();
    expect(onDragOver).toHaveBeenCalledOnce();
  });
});
