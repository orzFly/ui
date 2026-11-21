import type {
  ContentProps,
  ContentRenderer,
  ContentSource,
} from "@orz/ui-content";
import type { ComponentType } from "react";
import { DocumentContent } from "./loaded-document.tsx";
import { parseToml } from "./toml.ts";

/**
 * Past this a file goes to the renderers after this one: the parser reads about a megabyte in a
 * quarter of a second, on the main thread.
 */
const TOML_PREVIEW_MAX_BYTES = 8 * 1024 * 1024;

/** Lock and manifest files written in TOML without the extension; other `.lock` files are not. */
const TOML_NAMES = new Set(["cargo.lock", "poetry.lock", "uv.lock", "pipfile"]);

function isToml(source: ContentSource): boolean {
  if (source.kind !== "file") return false;
  const name = source.name.toLowerCase();
  if (name.endsWith(".toml")) return true;
  if (TOML_NAMES.has(name.slice(name.lastIndexOf("/") + 1))) return true;
  return (
    source.mime?.toLowerCase().split(";")[0]?.trim() === "application/toml"
  );
}

const parse = (text: string) => parseToml(text);

function Toml(props: ContentProps & { Next: ComponentType<ContentProps> }) {
  const { source } = props;
  if (source.kind !== "file" || !isToml(source)) return null;
  return (
    <DocumentContent
      {...props}
      source={source}
      parse={parse}
      format="TOML"
      maxBytes={TOML_PREVIEW_MAX_BYTES}
    />
  );
}

/**
 * The registry entry for TOML files: a file named `.toml`, `Cargo.lock`, `poetry.lock`,
 * `uv.lock` or `Pipfile` (in any case), or typed `application/toml`, up to 8 MB, drawn as a
 * `JsonView` in the viewer only. Text that does not parse goes to the renderers after it, under
 * the parse error, so list it before the code renderer.
 */
export const tomlContent: ContentRenderer = {
  name: "toml",
  accepts: (source, placement) =>
    placement === "viewer" &&
    source.kind === "file" &&
    !source.deleted &&
    isToml(source),
  display: "block",
  Component: Toml,
};
