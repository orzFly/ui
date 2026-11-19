import { Textarea } from "@orz/ui/components/textarea";
import { useDirtySource } from "@orz/ui/lib/unsaved-guard";
import { cn } from "@orz/ui/lib/utils";
import {
  type KeyboardEvent,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { isApplePlatform } from "../lib/platform.ts";
import type {
  MarkdownEditorHandle,
  MarkdownEditorProps,
} from "./markdown-editor.tsx";

/**
 * `MarkdownEditor` on a native textarea: the same handle, submit and cancel
 * keys, dirty tracking and paste, drop and drag-over callbacks, in `@orz/ui`'s
 * `Textarea`, so every style draws it as a field. What exists only as
 * CodeMirror extensions (completion, paste conversion, image pairs, line
 * commands, `extensions`) is absent, which is the point: a phone keyboard,
 * a screen reader or a spell checker talks to an element it already knows.
 *
 * `MarkdownEditor` mounts it for `plain`; mount it directly only where the
 * CodeMirror editor is never wanted.
 */
export function PlainMarkdownEditor({
  initialValue = "",
  placeholder,
  ariaLabel,
  autoFocus = false,
  readOnly = false,
  ownerManagedDirty = false,
  onSubmit,
  onCancel,
  onChange,
  onPaste,
  onDrop,
  onDragOver,
  purpose = "field",
  className,
  ref,
}: Omit<MarkdownEditorProps, "plain" | "extensions">) {
  const area = useRef<HTMLTextAreaElement>(null);
  // Read once, like the CodeMirror editor: the textarea owns the document
  // from then on, so it is uncontrolled.
  const [baseline] = useState(initialValue);
  const userChanged = useRef(false);
  const handlers = useRef({ onSubmit, onCancel, onChange, ownerManagedDirty });
  handlers.current = { onSubmit, onCancel, onChange, ownerManagedDirty };

  useDirtySource(
    () =>
      !handlers.current.ownerManagedDirty &&
      !readOnly &&
      (area.current?.value ?? baseline).trim() !== baseline.trim(),
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only, as CodeEditor's autoFocus is.
  useEffect(() => {
    if (autoFocus) area.current?.focus();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => area.current?.value ?? "",
      // Counted as the reader's change, as CodeEditorHandle documents for
      // the CodeMirror editor's setValue, so the two editors answer alike.
      setValue: (value: string) => {
        const el = area.current;
        if (el === null) return;
        el.value = value;
        userChanged.current = true;
        handlers.current.onChange?.(value);
      },
      append: (text: string) => {
        const el = area.current;
        if (el === null) return;
        const at = el.value.length;
        el.setRangeText(text, at, at, "end");
        el.scrollTop = el.scrollHeight;
        userChanged.current = true;
        handlers.current.onChange?.(el.value);
      },
      focus: () => area.current?.focus(),
      userChanged: () => userChanged.current,
      // No completion panel to close.
      dismissCompletion: () => false,
    }),
    [],
  );

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // An IME's Enter confirms the composition; it is not a submit.
    if (event.nativeEvent.isComposing) return;
    const mod = isApplePlatform() ? event.metaKey : event.ctrlKey;
    if (event.key === "Enter" && mod) {
      // Swallowed whether or not anyone listens, as in the CodeMirror editor.
      event.preventDefault();
      handlers.current.onSubmit?.(event.currentTarget.value);
      return;
    }
    if (event.key === "Escape" && handlers.current.onCancel !== undefined) {
      event.preventDefault();
      handlers.current.onCancel();
    }
  }

  return (
    <Textarea
      ref={area}
      data-slot="markdown-editor"
      data-plain=""
      data-read-only={readOnly ? "true" : undefined}
      data-purpose={purpose}
      defaultValue={baseline}
      placeholder={placeholder}
      aria-label={ariaLabel}
      readOnly={readOnly}
      autoCapitalize="sentences"
      className={cn(
        "min-h-0 overflow-auto",
        // As CodeEditor's document: no frame of its own, the caret alone,
        // and under raymond the well left to a document pane around it.
        purpose === "document" &&
          "rounded-none border-transparent bg-transparent [--focus-width:0px] dark:bg-transparent raymond:in-data-[purpose=document]:shadow-none",
        readOnly && "opacity-50 raymond:bg-(--3d-face) raymond:opacity-100",
        className,
      )}
      onInput={(event) => {
        userChanged.current = true;
        handlers.current.onChange?.(event.currentTarget.value);
      }}
      onKeyDown={onKeyDown}
      onPaste={(event) => onPaste?.(event)}
      onDrop={(event) => onDrop?.(event)}
      onDragOver={(event) => onDragOver?.(event)}
    />
  );
}
