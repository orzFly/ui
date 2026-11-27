import { loadTomlReader } from "./load-toml.ts";
import type { JsonParseError } from "./parse.ts";
import type { JsonDocument } from "./types.ts";

export type ParseTomlResult =
  | { ok: true; document: JsonDocument }
  | { ok: false; error: JsonParseError };

/**
 * Parses TOML 1.1 text into a `JsonDocument`: tables as objects, arrays of tables as arrays,
 * dates and times as their text, each member's range, literal and comments, and where a table
 * is written in more than one place, its `parts`. A syntax error, or a key defined twice,
 * resolves with its place. The first call fetches `toml-eslint-parser`, which the app's bundler
 * splits into a chunk of its own; the promise rejects only when that fetch fails, and the next
 * call fetches it again.
 */
export async function parseToml(text: string): Promise<ParseTomlResult> {
  const { readToml } = await loadTomlReader();
  return readToml(text);
}
