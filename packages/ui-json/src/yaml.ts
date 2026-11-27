import { loadYamlReader } from "./load-yaml.ts";
import type { JsonParseError } from "./parse.ts";
import type { JsonDocument } from "./types.ts";

export type ParseYamlResult =
  | { ok: true; document: JsonDocument }
  | { ok: false; error: JsonParseError };

export interface ParseYamlOptions {
  /**
   * `yaml`'s own guard against alias expansion, with its rule and its default, 100. Past it the
   * parse fails with "Excessive alias count indicates a resource exhaustion attack". -1 turns
   * it off.
   */
  maxAliasCount?: number;
}

/**
 * Parses YAML text (one document or a stream) into a `JsonDocument`: the value, the text, and
 * each member's range, literal, comments, anchor, tag and alias. Text that does not parse
 * resolves to the error and its place. The first call fetches the `yaml` package, which the
 * app's bundler splits into a chunk of its own; the promise rejects only when that fetch fails,
 * and the next call fetches it again.
 */
export async function parseYaml(
  text: string,
  options: ParseYamlOptions = {},
): Promise<ParseYamlResult> {
  const { readYaml } = await loadYamlReader();
  return readYaml(text, options);
}
