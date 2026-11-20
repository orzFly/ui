import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  useSourceText,
} from "@orz/ui-content";
import { type ComponentType, useMemo } from "react";
import { JsonView } from "./json-view.tsx";
import { type JsonDialect, parseJson } from "./parse.ts";
import { WarningStrip } from "./warning-strip.tsx";

/**
 * Past this a file goes to the renderers after this one: the text is held and parsed whole
 * before the tree is drawn.
 */
const JSON_PREVIEW_MAX_BYTES = 64 * 1024 * 1024;

const DIALECT_NAME: Record<JsonDialect, string> = {
  json: "JSON",
  jsonc: "JSONC",
  json5: "JSON5",
};

type FileSource = Extract<ContentSource, { kind: "file" }>;

/** The dialect a file is read in: its extension's, or JSON when only its type said JSON. */
function dialectOf(source: ContentSource): JsonDialect | null {
  if (source.kind !== "file") return null;
  const name = source.name.toLowerCase();
  if (name.endsWith(".json5")) return "json5";
  if (name.endsWith(".jsonc")) return "jsonc";
  if (name.endsWith(".json")) return "json";
  const mime = source.mime?.toLowerCase().split(";")[0]?.trim();
  if (mime === "application/json" || mime === "application/ld+json") {
    return "json";
  }
  return null;
}

type JsonProps = ContentProps & { Next: ComponentType<ContentProps> };

function LoadedJson({
  source,
  placement,
  className,
  Next,
  dialect,
}: JsonProps & { source: FileSource; dialect: JsonDialect }) {
  const text = useSourceText(source);
  const parsed = useMemo(
    () =>
      text.status === "ready" ? parseJson(text.text, { dialect }) : undefined,
    [text.status, text.text, dialect],
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
  if (text.status === "error" || !parsed) {
    // A load that failed is the code renderer's to report, with its retry.
    return <Next source={source} placement={placement} className={className} />;
  }
  if (!parsed.ok) {
    const { message, line, column } = parsed.error;
    // Reading again would fail the same way, so there is no retry: the text still shows, as
    // code, below what was wrong with it.
    return (
      <div className={className}>
        <WarningStrip className="border-b-0">
          Not valid {DIALECT_NAME[dialect]}: {message} at line {line}, column{" "}
          {column}
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

function Json(props: JsonProps) {
  const { source, placement, className, Next } = props;
  const dialect = dialectOf(source);
  if (source.kind !== "file" || dialect === null) return null;
  if (source.size !== undefined && source.size > JSON_PREVIEW_MAX_BYTES) {
    return <Next source={source} placement={placement} className={className} />;
  }
  return <LoadedJson {...props} source={source} dialect={dialect} />;
}

/**
 * The registry entry for JSON files: a file named `.json`, `.jsonc` or `.json5`, or typed
 * `application/json` or `application/ld+json`, drawn as a `JsonView` in the viewer only. Text
 * that does not parse goes to the renderers after it, under the parse error, so list it before
 * the code renderer.
 */
export const jsonContent: ContentRenderer = {
  name: "json",
  accepts: (source, placement) =>
    placement === "viewer" &&
    source.kind === "file" &&
    !source.deleted &&
    dialectOf(source) !== null,
  display: "block",
  Component: Json,
};
