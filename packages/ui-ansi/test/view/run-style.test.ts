import { describe, expect, it } from "vitest";

import type { AnsiStyle } from "../../src/parse/types.ts";
import { createStyleCache, styleToCss } from "../../src/view/run-style.ts";

const FG = "var(--terminal-foreground)";
const BG = "var(--terminal-background)";

describe("styleToCss", () => {
  it("leaves the empty style to inherit the block's defaults", () => {
    expect(styleToCss({}, false)).toEqual({});
  });

  it("maps palette 0–15 to the theme's ANSI variables", () => {
    expect(styleToCss({ fg: { kind: "palette", index: 1 } }, false)).toEqual({
      color: "var(--ansi-red)",
    });
    expect(styleToCss({ bg: { kind: "palette", index: 8 } }, false)).toEqual({
      backgroundColor: "var(--ansi-bright-black)",
    });
    expect(
      styleToCss({ fg: { kind: "palette", index: 15 } }, false).color,
    ).toBe("var(--ansi-bright-white)");
  });

  it("maps palette 16–255 to xterm's cube and greys", () => {
    expect(
      styleToCss({ fg: { kind: "palette", index: 16 } }, false).color,
    ).toBe("rgb(0 0 0)");
    expect(
      styleToCss({ fg: { kind: "palette", index: 196 } }, false).color,
    ).toBe("rgb(255 0 0)");
    expect(
      styleToCss({ fg: { kind: "palette", index: 67 } }, false).color,
    ).toBe("rgb(95 135 175)");
    expect(
      styleToCss({ fg: { kind: "palette", index: 232 } }, false).color,
    ).toBe("rgb(8 8 8)");
    expect(
      styleToCss({ fg: { kind: "palette", index: 255 } }, false).color,
    ).toBe("rgb(238 238 238)");
  });

  it("uses RGB as is", () => {
    expect(
      styleToCss({ bg: { kind: "rgb", r: 1, g: 2, b: 3 } }, false),
    ).toEqual({
      backgroundColor: "rgb(1 2 3)",
    });
  });

  it("maps bold and italic", () => {
    expect(styleToCss({ bold: true, italic: true }, false)).toEqual({
      fontWeight: 700,
      fontStyle: "italic",
    });
  });

  describe("boldIsBright", () => {
    const bold = (fg: AnsiStyle["fg"]) =>
      styleToCss({ bold: true, fg }, true).color;

    it("brightens palette 0–7", () => {
      expect(bold({ kind: "palette", index: 1 })).toBe(
        "var(--ansi-bright-red)",
      );
      expect(bold({ kind: "palette", index: 0 })).toBe(
        "var(--ansi-bright-black)",
      );
      expect(bold({ kind: "palette", index: 7 })).toBe(
        "var(--ansi-bright-white)",
      );
    });

    it("leaves bright, 256-colour and RGB foregrounds alone", () => {
      expect(bold({ kind: "palette", index: 9 })).toBe(
        "var(--ansi-bright-red)",
      );
      expect(bold({ kind: "palette", index: 16 })).toBe("rgb(0 0 0)");
      expect(bold({ kind: "rgb", r: 10, g: 20, b: 30 })).toBe("rgb(10 20 30)");
    });

    it("needs bold, and is off unless asked for", () => {
      expect(
        styleToCss({ fg: { kind: "palette", index: 1 } }, true).color,
      ).toBe("var(--ansi-red)");
      expect(
        styleToCss({ bold: true, fg: { kind: "palette", index: 1 } }, false)
          .color,
      ).toBe("var(--ansi-red)");
    });

    it("leaves the background alone", () => {
      expect(
        styleToCss({ bold: true, bg: { kind: "palette", index: 1 } }, true)
          .backgroundColor,
      ).toBe("var(--ansi-red)");
    });

    it("brightens the foreground before inverse swaps it", () => {
      expect(
        styleToCss(
          { bold: true, inverse: true, fg: { kind: "palette", index: 2 } },
          true,
        ),
      ).toMatchObject({
        color: BG,
        backgroundColor: "var(--ansi-bright-green)",
      });
    });
  });

  describe("inverse", () => {
    const red = { kind: "palette", index: 1 } as const;
    const blue = { kind: "palette", index: 4 } as const;

    it("swaps both colours", () => {
      expect(styleToCss({ inverse: true, fg: red, bg: blue }, false)).toEqual({
        color: "var(--ansi-blue)",
        backgroundColor: "var(--ansi-red)",
      });
    });

    it("fills in the default background for an unset background", () => {
      expect(styleToCss({ inverse: true, fg: red }, false)).toEqual({
        color: BG,
        backgroundColor: "var(--ansi-red)",
      });
    });

    it("fills in the default foreground for an unset foreground", () => {
      expect(styleToCss({ inverse: true, bg: blue }, false)).toEqual({
        color: "var(--ansi-blue)",
        backgroundColor: FG,
      });
    });

    it("swaps the two defaults when both are unset", () => {
      expect(styleToCss({ inverse: true }, false)).toEqual({
        color: BG,
        backgroundColor: FG,
      });
    });
  });

  describe("dim", () => {
    it("mixes the default foreground toward the background", () => {
      expect(styleToCss({ dim: true }, false)).toEqual({
        color: `color-mix(in oklab, ${FG} 60%, ${BG})`,
      });
    });

    it("mixes a set foreground and leaves the background undimmed", () => {
      expect(
        styleToCss(
          {
            dim: true,
            fg: { kind: "palette", index: 1 },
            bg: { kind: "palette", index: 4 },
          },
          false,
        ),
      ).toEqual({
        color: `color-mix(in oklab, var(--ansi-red) 60%, ${BG})`,
        backgroundColor: "var(--ansi-blue)",
      });
    });

    it("mixes the foreground inverse produced", () => {
      expect(
        styleToCss(
          { dim: true, inverse: true, bg: { kind: "palette", index: 4 } },
          false,
        ).color,
      ).toBe(`color-mix(in oklab, var(--ansi-blue) 60%, ${BG})`);
    });
  });

  describe("hidden", () => {
    it("makes the text transparent", () => {
      expect(
        styleToCss({ hidden: true, fg: { kind: "palette", index: 1 } }, false),
      ).toEqual({
        color: "transparent",
      });
    });

    it("wins over dim and keeps inverse's background", () => {
      expect(
        styleToCss({ hidden: true, dim: true, inverse: true }, false),
      ).toEqual({
        color: "transparent",
        backgroundColor: FG,
      });
    });
  });

  describe("decorations", () => {
    it.each([
      ["single", "solid"],
      ["double", "double"],
      ["curly", "wavy"],
      ["dotted", "dotted"],
      ["dashed", "dashed"],
    ] as const)("maps a %s underline to %s", (underline, cssStyle) => {
      expect(styleToCss({ underline }, false)).toEqual({
        textDecorationLine: "underline",
        textDecorationStyle: cssStyle,
      });
    });

    it("colours the underline", () => {
      expect(
        styleToCss(
          {
            underline: "single",
            underlineColor: { kind: "rgb", r: 1, g: 2, b: 3 },
          },
          false,
        ),
      ).toMatchObject({ textDecorationColor: "rgb(1 2 3)" });
    });

    it("ignores an underline colour without an underline", () => {
      expect(
        styleToCss({ underlineColor: { kind: "palette", index: 1 } }, false),
      ).toEqual({});
    });

    it("maps strike and overline", () => {
      expect(styleToCss({ strike: true }, false)).toEqual({
        textDecorationLine: "line-through",
      });
      expect(styleToCss({ overline: true }, false)).toEqual({
        textDecorationLine: "overline",
      });
    });

    it("combines every line into one value", () => {
      expect(
        styleToCss({ underline: "curly", strike: true, overline: true }, false),
      ).toMatchObject({
        textDecorationLine: "underline line-through overline",
      });
    });
  });

  describe("links", () => {
    it("get a dotted underline", () => {
      expect(styleToCss({ href: "https://example.com/" }, false)).toEqual({
        textDecorationLine: "underline",
        textDecorationStyle: "dotted",
      });
    });

    it("keep the run's own underline", () => {
      expect(
        styleToCss(
          { href: "https://example.com/", underline: "double" },
          false,
        ),
      ).toEqual({
        textDecorationLine: "underline",
        textDecorationStyle: "double",
      });
    });

    it("combine the dotted underline with strike", () => {
      expect(
        styleToCss({ href: "https://example.com/", strike: true }, false),
      ).toEqual({
        textDecorationLine: "underline line-through",
        textDecorationStyle: "dotted",
      });
    });
  });

  it("ignores blink", () => {
    expect(styleToCss({ blink: true }, false)).toEqual({});
  });
});

describe("createStyleCache", () => {
  it("returns the same object per style id and boldIsBright", () => {
    const styles: AnsiStyle[] = [
      {},
      { bold: true, fg: { kind: "palette", index: 1 } },
    ];
    const css = createStyleCache(styles);
    expect(css(1, false)).toBe(css(1, false));
    expect(css(1, true)).toBe(css(1, true));
    expect(css(1, false).color).toBe("var(--ansi-red)");
    expect(css(1, true).color).toBe("var(--ansi-bright-red)");
    expect(css(0, false)).toEqual({});
  });

  it("sees styles interned after it was made", () => {
    const styles: AnsiStyle[] = [{}];
    const css = createStyleCache(styles);
    styles.push({ italic: true });
    expect(css(1, false)).toEqual({ fontStyle: "italic" });
  });

  it("does not pin an id requested before its style is interned", () => {
    const styles: AnsiStyle[] = [{}];
    const css = createStyleCache(styles);
    expect(css(1, false)).toEqual({});
    styles.push({ bold: true });
    expect(css(1, false)).toEqual({ fontWeight: 700 });
  });

  it("keeps cached entries for each boldIsBright apart", () => {
    const styles: AnsiStyle[] = [
      {},
      { bold: true, fg: { kind: "palette", index: 3 } },
    ];
    const css = createStyleCache(styles);
    expect(css(1, true)).not.toBe(css(1, false));
    expect(css(0, true)).not.toBe(css(1, false));
  });
});
