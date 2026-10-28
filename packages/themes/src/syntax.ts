import type {
  ColorScheme,
  SyntaxRoles,
  TextMateTheme,
  Tokens,
} from "./types.ts";

/** Each role's TextMate scopes; `entity.name.tag` reads as a keyword in markup. */
const SCOPES: Record<keyof SyntaxRoles, string[]> = {
  keyword: ["keyword", "storage", "keyword.operator", "entity.name.tag"],
  string: ["string", "string.regexp"],
  constant: [
    "constant.numeric",
    "constant.language",
    "variable.other.constant",
  ],
  function: ["entity.name.function", "support.function"],
  type: ["entity.name.type", "support.type", "entity.other.inherited-class"],
  property: [
    "variable.other.property",
    "meta.object-literal.key",
    "support.type.property-name",
    "entity.other.attribute-name",
  ],
  parameter: ["variable.parameter"],
};

/**
 * A palette's own syntax theme: one rule per role, comments and punctuation
 * in the page's muted foreground, everything else in its foreground.
 */
export function textMateTheme(
  name: string,
  scheme: ColorScheme,
  roles: SyntaxRoles,
  page: Pick<Tokens, "foreground" | "background" | "muted-foreground">,
): TextMateTheme {
  return {
    name,
    type: scheme,
    colors: {
      "editor.foreground": page.foreground,
      "editor.background": page.background,
    },
    tokenColors: [
      ...(Object.keys(SCOPES) as (keyof SyntaxRoles)[]).map((role) => ({
        scope: SCOPES[role],
        settings: { foreground: roles[role] },
      })),
      {
        scope: ["comment", "punctuation.definition.comment"],
        settings: {
          foreground: page["muted-foreground"],
          fontStyle: "italic",
        },
      },
      {
        scope: ["punctuation"],
        settings: { foreground: page["muted-foreground"] },
      },
    ],
  };
}
