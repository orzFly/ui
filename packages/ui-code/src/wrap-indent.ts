import type { CSSProperties } from "react";

// A wrapped line's continuation rows hang 2ch past the line's own
// indentation, behind a faint ↳: at the indentation alone they read as new
// statements, and at 2ch alone, in code indented two spaces a level, as
// statements nested one level in (UI-251).
//
// Shared by pierre's lines, which get it through `unsafeCSS` and a custom
// property set on each line after it renders, and by the plain text drawn
// until pierre has, which takes the same values inline: the two must agree to
// the pixel, or the text jumps when the highlighting lands (UI-227).

/** Set on each line: how far its leading whitespace reaches, as a CSS length. */
const INDENT = "--orz-wrap-indent";

/** pierre's own tab stops, which the leading whitespace is laid out at. */
const TAB = "var(--diffs-tab-size, 2) * 1ch";

// pierre's [data-line] padding, at each end.
const PAD = "1ch";

// Capped at half the line's text width, so that on a narrow screen a deeply
// indented line keeps room for its continuation; past the cap the ↳ alone
// says what the row is. `text-indent` takes a percentage of the line's own
// text width, an absolute box one of the padding box around it.
const HANG = `min(calc(var(${INDENT}, 0ch) + 2ch), 50%)`;
const MARKER_LEFT = `calc(${PAD} + min(calc(var(${INDENT}, 0ch) + 2ch), calc((100% - 2 * ${PAD}) / 2)) - 2ch)`;

// One 1ch-by-1lh cell per row, the arrow standing on the text's baseline.
const ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 20'%3E%3Cpath d='M2 5v5.5h6M5.5 8l2.5 2.5-2.5 2.5' fill='none' stroke='black' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

/** The line itself: `position` holds its marker, which pierre's lines already set. */
export const WRAP_LINE_STYLE = {
  display: "block",
  position: "relative",
  paddingInline: PAD,
  textIndent: `${HANG} hanging`,
} satisfies CSSProperties;

/**
 * The ↳ down the continuation rows, from the line's second row to its last.
 * A mask over the text colour, faint on any row tint, and nothing a selection
 * copies or a screen reader reads.
 */
export const WRAP_MARKER_STYLE = {
  position: "absolute",
  top: "1lh",
  bottom: 0,
  left: MARKER_LEFT,
  width: "1ch",
  backgroundColor: "color-mix(in srgb, currentColor 30%, transparent)",
  maskImage: ARROW,
  maskSize: "1ch 1lh",
  maskRepeat: "repeat-y",
  pointerEvents: "none",
} satisfies CSSProperties;

/**
 * Where the leading whitespace of `line` ends, as a CSS length, or null when
 * it has none. Tabs run to pierre's tab stops, read from CSS rather than
 * assumed, since an app may set `--diffs-tab-size`.
 */
export function leadingIndent(line: string): string | null {
  // A tab stop, once reached; tabs and spaces after it.
  let stop: string | null = null;
  let tabs = 0;
  let spaces = 0;
  const reach = () =>
    [
      stop,
      tabs > 0 ? `${tabs} * ${TAB}` : null,
      spaces > 0 ? `${spaces}ch` : null,
    ]
      .filter((part) => part !== null)
      .join(" + ");
  for (const char of line) {
    if (char === " ") spaces++;
    else if (char !== "\t") break;
    else if (spaces === 0) tabs++;
    // A tab after spaces runs on to the next stop past them.
    else {
      stop = `round(up, ${reach()} + 0.5ch, ${TAB})`;
      tabs = 0;
      spaces = 0;
    }
  }
  if (stop === null && tabs === 0 && spaces === 0) return null;
  return `calc(${reach()})`;
}

/** The line style for `line`: its indentation, set as the custom property. */
export function wrapLineStyle(line: string): CSSProperties {
  const indent = leadingIndent(line);
  return indent === null
    ? WRAP_LINE_STYLE
    : ({ ...WRAP_LINE_STYLE, [INDENT]: indent } as CSSProperties);
}

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const declarations = (style: CSSProperties) =>
  Object.entries(style)
    .map(([name, value]) => `${kebab(name)}: ${value};`)
    .join(" ");

/**
 * The same, for pierre's shadow root, where its lines already have their
 * block, position and padding. Forced colours would paint the marker's
 * background in the page's own background, hiding it.
 */
export const WRAP_INDENT_CSS = `
[data-overflow=wrap] [data-line] { text-indent: ${WRAP_LINE_STYLE.textIndent}; }
[data-overflow=wrap] [data-line]::after { content: ""; ${declarations(WRAP_MARKER_STYLE)} }
@media (forced-colors: active) {
  [data-overflow=wrap] [data-line]::after { forced-color-adjust: none; background-color: GrayText; }
}
`;

// Lines already measured; pierre renders a line anew, unmarked, when its
// text or its highlighting changes.
const MEASURED = "data-orz-wrap-indent";

/**
 * Gives each line pierre has drawn wrapped since the last call its
 * indentation. Run after every render: pierre measures a wrapped line's
 * height after it notifies, so the line has its hang by then.
 */
export function indentWrappedLines(root: ParentNode): void {
  for (const line of root.querySelectorAll<HTMLElement>(
    `[data-overflow=wrap] [data-line]:not([${MEASURED}])`,
  )) {
    line.setAttribute(MEASURED, "");
    const indent = leadingIndent(line.textContent ?? "");
    if (indent !== null) line.style.setProperty(INDENT, indent);
  }
}
