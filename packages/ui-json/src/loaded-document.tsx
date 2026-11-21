import {
  ContentFallback,
  type ContentProps,
  type ContentSource,
  useSourceText,
} from "@orz/ui-content";
import { type ComponentType, useMemo } from "react";
import { JsonView } from "./json-view.tsx";
import type { ParseJsonResult } from "./parse.ts";
import { WarningStrip } from "./warning-strip.tsx";

export type FileSource = Extract<ContentSource, { kind: "file" }>;

export type DocumentContentProps = ContentProps & {
  source: FileSource;
  Next: ComponentType<ContentProps>;
  /** Kept by reference: a new function parses again. */
  parse: (text: string) => ParseJsonResult;
  /** The format's name in the parse error: "Not valid YAML: …". */
  format: string;
  /** Past this a file goes to `Next`, by its size or, unknown, by its text's length. */
  maxBytes: number;
};

/** A file's text, parsed and drawn as a `JsonView`, for the content renderers. */
export function DocumentContent(props: DocumentContentProps) {
  const { source, placement, className, Next, maxBytes } = props;
  // Before the text is read: the text is held and parsed whole before the tree is drawn.
  if (source.size !== undefined && source.size > maxBytes) {
    return <Next source={source} placement={placement} className={className} />;
  }
  return <LoadedDocument {...props} />;
}

function LoadedDocument({
  source,
  placement,
  className,
  Next,
  parse,
  format,
  maxBytes,
}: DocumentContentProps) {
  const text = useSourceText(source);
  const tooLarge = text.status === "ready" && text.text.length > maxBytes;
  const parsed = useMemo(
    () => (text.status === "ready" && !tooLarge ? parse(text.text) : undefined),
    [text.status, text.text, tooLarge, parse],
  );
  if (text.status === "loading") {
    return (
      <ContentFallback
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  // A load that failed is the code renderer's to report, with its retry.
  if (text.status === "error" || !parsed) {
    return <Next source={source} placement={placement} className={className} />;
  }
  if (!parsed.ok) {
    const { message, line, column } = parsed.error;
    // Reading again would fail the same way, so there is no retry: the text still shows, as
    // code, below what was wrong with it.
    return (
      <div className={className}>
        <WarningStrip className="border-b-0">
          Not valid {format}: {message} at line {line}, column {column}
        </WarningStrip>
        <Next source={source} placement={placement} />
      </div>
    );
  }
  // The view fills its parent; the viewer sets the pane's height.
  return (
    <div
      className={className}
      style={{ height: "var(--attachment-pane-height)" }}
    >
      <JsonView document={parsed.document} fill />
    </div>
  );
}
