import type {
  ContentProps,
  ContentRenderer,
  ContentSource,
} from "@orz/ui-content";
import type { ComponentType } from "react";
import { DocumentContent, type DocumentParse } from "./loaded-document.tsx";
import { type JsonDialect, parseJson } from "./parse.ts";

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

const PARSE: Record<JsonDialect, DocumentParse> = {
  json: (text) => parseJson(text, { dialect: "json" }),
  jsonc: (text) => parseJson(text, { dialect: "jsonc" }),
  json5: (text) => parseJson(text, { dialect: "json5" }),
};

// The JSON parser is this package's own, already loaded.
const LOAD: Record<JsonDialect, () => Promise<DocumentParse>> = {
  json: async () => PARSE.json,
  jsonc: async () => PARSE.jsonc,
  json5: async () => PARSE.json5,
};

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

function Json(props: ContentProps & { Next: ComponentType<ContentProps> }) {
  const { source } = props;
  const dialect = dialectOf(source);
  if (source.kind !== "file" || dialect === null) return null;
  return (
    <DocumentContent
      {...props}
      source={source}
      load={LOAD[dialect]}
      format={DIALECT_NAME[dialect]}
      maxBytes={JSON_PREVIEW_MAX_BYTES}
    />
  );
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
