import { describe, expect, it } from "vitest";
import { textMateTheme } from "../src/index.ts";

const roles = {
  keyword: "#000001",
  string: "#000002",
  constant: "#000003",
  function: "#000004",
  type: "#000005",
  property: "#000006",
  parameter: "#000007",
};
const page = {
  foreground: "#111111",
  background: "#eeeeee",
  "muted-foreground": "#666666",
};

describe("textMateTheme", () => {
  const theme = textMateTheme("orz-test-light", "light", roles, page);
  const colourOf = (scope: string) =>
    theme.tokenColors.find((rule) => rule.scope.includes(scope))?.settings;

  it("names the theme and its side, with the page as the editor colours", () => {
    expect(theme.name).toBe("orz-test-light");
    expect(theme.type).toBe("light");
    expect(theme.colors).toEqual({
      "editor.foreground": "#111111",
      "editor.background": "#eeeeee",
    });
  });

  it("gives each role one rule over its scopes", () => {
    expect(
      Object.fromEntries(
        theme.tokenColors.map((rule) => [rule.settings.foreground, rule.scope]),
      ),
    ).toMatchObject({
      "#000001": ["keyword", "storage", "keyword.operator", "entity.name.tag"],
      "#000002": ["string", "string.regexp"],
      "#000003": [
        "constant.numeric",
        "constant.language",
        "variable.other.constant",
      ],
      "#000004": ["entity.name.function", "support.function"],
      "#000005": [
        "entity.name.type",
        "support.type",
        "entity.other.inherited-class",
      ],
      "#000006": [
        "variable.other.property",
        "meta.object-literal.key",
        "support.type.property-name",
        "entity.other.attribute-name",
      ],
      "#000007": ["variable.parameter"],
    });
  });

  it("writes comments in italic and punctuation plain, both muted", () => {
    expect(colourOf("comment")).toEqual({
      foreground: "#666666",
      fontStyle: "italic",
    });
    expect(colourOf("punctuation")).toEqual({ foreground: "#666666" });
  });

  it("survives a JSON round trip", () => {
    expect(JSON.parse(JSON.stringify(theme))).toEqual(theme);
  });
});
