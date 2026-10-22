import type { CustomTheme } from "@orz/themes";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `{ base: { theme } }` or `{ tokens }`, the two shapes a side or its terminal takes. */
function sourceOk(value: unknown): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  if (value.base !== undefined) {
    return isObject(value.base) && typeof value.base.theme === "string";
  }
  return isObject(value.tokens);
}

function sideOk(value: unknown): boolean {
  if (!sourceOk(value)) return false;
  // composeTheme reads a terminal without checking it, and a side of its own
  // tokens has nothing else to take one from.
  if (value.terminal !== undefined) return sourceOk(value.terminal);
  return value.base !== undefined;
}

function customOk(value: unknown): value is CustomTheme {
  if (!isObject(value)) return false;
  const { id, label, light, dark } = value;
  if (typeof id !== "string" || typeof label !== "string") return false;
  if (light === undefined && dark === undefined) return false;
  return (
    (light === undefined || sideOk(light)) &&
    (dark === undefined || sideOk(dark))
  );
}

/**
 * The custom themes stored as JSON, keeping each entry whose shape
 * `composeTheme` can read and dropping the rest; `[]` for anything that is
 * not a JSON array.
 */
export function parseCustomThemes(raw: string | null): CustomTheme[] {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return Array.isArray(parsed) ? parsed.filter(customOk) : [];
}
