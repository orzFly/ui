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

import { STAGED_FILE_TYPE } from "../extensions/staged-tokens.ts";
import { isApplePlatform } from "../lib/platform.ts";
import type {
  MarkdownEditorProps,
  StagingSurface,
} from "./markdown-editor.tsx";

/**
 * Through execCommand while the box has focus, so the browser's own undo can
 * take the change back; setRangeText otherwise, which it cannot.
 */
function replace(
  el: HTMLTextAreaElement,
  from: number,
  to: number,
  insert: string,
) {
  if (from === to && insert === "") return;
  el.setSelectionRange(from, to);
  if (
    document.activeElement === el &&
    typeof document.execCommand === "function" &&
    document.execCommand(insert === "" ? "delete" : "insertText", false, insert)
  ) {
    return;
  }
  el.setRangeText(insert, from, to, "end");
}

/**
 * `MarkdownEditor` on a native textarea: the same handle, submit and cancel
 * keys, dirty tracking, file staging and paste, drop and drag-over
 * callbacks, in `@orz/ui`'s `Textarea`, so every style draws it as a field.
 * What exists only as CodeMirror extensions (completion, paste conversion,
 * image pairs, token chips, line commands, `extensions`) is absent, which is
 * the point: a phone keyboard, a screen reader or a spell checker talks to
 * an element it already knows. A staged file's placeholder is plain text
 * here, and deleting part of it unstages the file.
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
  staging,
  purpose = "field",
  className,
  ref,
}: Omit<MarkdownEditorProps, "plain" | "extensions">) {
  const area = useRef<HTMLTextAreaElement>(null);
  // Read once, like the CodeMirror editor: the textarea owns the document
  // from then on, so it is uncontrolled.
  const [baseline] = useState(initialValue);
  const userChanged = useRef(false);
  const handlers = useRef({
    onSubmit,
    onCancel,
    onChange,
    staging,
    ownerManagedDirty,
  });
  handlers.current = {
    onSubmit,
    onCancel,
    onChange,
    staging,
    ownerManagedDirty,
  };
  // Set while the surface writes, so the input events its execCommand calls
  // fire are reported once, after the last of them.
  const applying = useRef(false);
  const surfaceRef = useRef<StagingSurface | null>(null);

  useDirtySource(
    () =>
      !handlers.current.ownerManagedDirty &&
      !readOnly &&
      (area.current?.value ?? baseline).trim() !== baseline.trim(),
  );

  // Mount-only, like the CodeMirror editor's: staging is read when the box
  // first exists, and the surface reads the element live.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only by design.
  useEffect(() => {
    const el = area.current;
    if (el === null) return;
    const changed = (value: string) => {
      handlers.current.staging?.sync(value);
      handlers.current.onChange?.(value);
    };
    const surface: StagingSurface = {
      dom: el,
      doc: () => el.value,
      selection: () => ({
        from: el.selectionStart,
        to: el.selectionEnd,
        head:
          el.selectionDirection === "backward"
            ? el.selectionStart
            : el.selectionEnd,
      }),
      // A textarea has no API for this; the caret stands in.
      posAtCoords: () => null,
      change: ({ changes, cursor }) => {
        applying.current = true;
        try {
          // Last first, so the earlier positions still hold.
          for (const c of [...changes].sort((a, b) => b.from - a.from)) {
            replace(el, c.from, c.to, c.insert ?? "");
          }
          if (cursor !== undefined) el.setSelectionRange(cursor, cursor);
        } finally {
          applying.current = false;
        }
        userChanged.current = true;
        changed(el.value);
      },
    };
    surfaceRef.current = surface;
    handlers.current.staging?.bind(surface);
    if (autoFocus) el.focus();
    return () => {
      surfaceRef.current = null;
      handlers.current.staging?.bind(null);
    };
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
        handlers.current.staging?.sync(value);
        handlers.current.onChange?.(value);
      },
      append: (text: string) => {
        const el = area.current;
        if (el === null) return;
        const at = el.value.length;
        el.setRangeText(text, at, at, "end");
        el.scrollTop = el.scrollHeight;
        userChanged.current = true;
        handlers.current.staging?.sync(el.value);
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
        if (applying.current) return;
        userChanged.current = true;
        handlers.current.staging?.sync(event.currentTarget.value);
        handlers.current.onChange?.(event.currentTarget.value);
      }}
      onKeyDown={onKeyDown}
      onPaste={(event) => {
        const surface = surfaceRef.current;
        if (surface !== null) staging?.paste(event.nativeEvent, surface);
        onPaste?.(event);
      }}
      onDrop={(event) => {
        const surface = surfaceRef.current;
        if (staging !== undefined && surface !== null) {
          if (staging.drop(event.nativeEvent, surface)) return;
        } else if (
          // React types it as always there; a synthetic drop has none.
          (event.dataTransfer as DataTransfer | null)?.types.includes(
            STAGED_FILE_TYPE,
          )
        ) {
          // A staged file's drag means nothing to an editor that stages none.
          event.preventDefault();
          return;
        }
        onDrop?.(event);
      }}
      onDragOver={(event) => {
        staging?.dragOver(event.nativeEvent);
        onDragOver?.(event);
      }}
    />
  );
}
