import { Button } from "@orz/ui/components/button";
import {
  ContentFallback,
  type ContentProps,
  type ContentSource,
  useSourceText,
} from "@orz/ui-content";
import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { JsonView } from "./json-view.tsx";
import type { ParseJsonResult } from "./parse.ts";
import { WarningStrip } from "./warning-strip.tsx";

export type FileSource = Extract<ContentSource, { kind: "file" }>;

export type DocumentParse = (text: string) => ParseJsonResult;

export type DocumentContentProps = ContentProps & {
  source: FileSource;
  Next: ComponentType<ContentProps>;
  /**
   * Resolves to the parser, asked for as the text starts loading. Kept by reference: a new
   * function loads again, and a new parser parses again.
   */
  load: () => Promise<DocumentParse>;
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

type Parser =
  | { status: "loading" }
  | { status: "ready"; parse: DocumentParse }
  | { status: "error"; error: Error; retrying: boolean };

function useParser(load: () => Promise<DocumentParse>) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{
    load: () => Promise<DocumentParse>;
    attempt: number;
    parser: Parser;
  }>();
  useEffect(() => {
    let live = true;
    load().then(
      (parse) => {
        if (live) {
          setSettled({ load, attempt, parser: { status: "ready", parse } });
        }
      },
      (error: unknown) => {
        if (!live) return;
        setSettled({
          load,
          attempt,
          parser: {
            status: "error",
            error: error instanceof Error ? error : new Error(String(error)),
            retrying: false,
          },
        });
      },
    );
    return () => {
      live = false;
    };
  }, [load, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  let parser: Parser = { status: "loading" };
  if (settled?.load === load) {
    if (settled.attempt === attempt) parser = settled.parser;
    // The failure stays, its Retry disabled, until the next attempt settles.
    else if (settled.parser.status === "error") {
      parser = { ...settled.parser, retrying: true };
    }
  }
  return { parser, retry };
}

function LoadedDocument({
  source,
  placement,
  className,
  Next,
  load,
  format,
  maxBytes,
}: DocumentContentProps) {
  const text = useSourceText(source);
  const { parser, retry } = useParser(load);
  const tooLarge = text.status === "ready" && text.text.length > maxBytes;
  const parse = parser.status === "ready" ? parser.parse : undefined;
  const parsed = useMemo(
    () =>
      text.status === "ready" && !tooLarge && parse
        ? parse(text.text)
        : undefined,
    [text.status, text.text, tooLarge, parse],
  );
  if (
    text.status === "loading" ||
    (text.status === "ready" && !tooLarge && parser.status === "loading")
  ) {
    return (
      <ContentFallback
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  // A load that failed is the code renderer's to report, with its retry.
  if (text.status === "error" || tooLarge) {
    return <Next source={source} placement={placement} className={className} />;
  }
  if (parser.status === "error") {
    // The text still shows, as code, below the reason it is not a tree.
    return (
      <div className={className}>
        <WarningStrip
          className="border-b-0"
          action={
            <Button
              size="xs"
              variant="outline"
              disabled={parser.retrying}
              onClick={retry}
            >
              Retry
            </Button>
          }
        >
          Couldn't load the {format} reader: {parser.error.message}
        </WarningStrip>
        <Next source={source} placement={placement} />
      </div>
    );
  }
  if (!parsed) {
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
