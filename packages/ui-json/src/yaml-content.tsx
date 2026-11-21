import type {
  ContentProps,
  ContentRenderer,
  ContentSource,
} from "@orz/ui-content";
import type { ComponentType } from "react";
import { DocumentContent } from "./loaded-document.tsx";
import { parseYaml } from "./yaml.ts";

/**
 * Past this a file goes to the renderers after this one: `yaml` reads about a megabyte in a
 * second and a half, on the main thread.
 */
const YAML_PREVIEW_MAX_BYTES = 2 * 1024 * 1024;

const YAML_MIMES = new Set([
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "text/x-yaml",
]);

function isYaml(source: ContentSource): boolean {
  if (source.kind !== "file") return false;
  const name = source.name.toLowerCase();
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return true;
  const mime = source.mime?.toLowerCase().split(";")[0]?.trim();
  return mime !== undefined && YAML_MIMES.has(mime);
}

const parse = (text: string) => parseYaml(text);

function Yaml(props: ContentProps & { Next: ComponentType<ContentProps> }) {
  const { source } = props;
  if (source.kind !== "file" || !isYaml(source)) return null;
  return (
    <DocumentContent
      {...props}
      source={source}
      parse={parse}
      format="YAML"
      maxBytes={YAML_PREVIEW_MAX_BYTES}
    />
  );
}

/**
 * The registry entry for YAML files: a file named `.yaml` or `.yml`, or typed
 * `application/yaml`, `application/x-yaml`, `text/yaml` or `text/x-yaml`, up to 2 MB, drawn as
 * a `JsonView` in the viewer only. Text that does not parse goes to the renderers after it,
 * under the parse error, so list it before the code renderer.
 */
export const yamlContent: ContentRenderer = {
  name: "yaml",
  accepts: (source, placement) =>
    placement === "viewer" &&
    source.kind === "file" &&
    !source.deleted &&
    isYaml(source),
  display: "block",
  Component: Yaml,
};
