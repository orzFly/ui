/** Past this many characters, a literal in a code preview is cut. */
const LIMIT = 160;
/** How much of its first line a cut literal keeps. */
const HEAD = 80;

// Leftmost match wins, and each match runs to its own closing delimiter, so a
// quote inside a template, or a `>` inside a string, never opens a literal.
// In order: JSX text holding < > { or }, which the dynamic snippet wraps as
// {`…`} without escaping the backticks inside, so it ends at the first `};
// a template literal; a double-quoted string or attribute; a single-quoted
// string, which an apostrophe in prose ("it's") does not open; and bare JSX
// text, which the dynamic snippet prints with no quotes at all.
// Bare text must follow a tag's own `>`: an arrow's `=>` or a type argument's
// `>` (`useState<T>(`) is code, and cutting there would swallow it. A tag ends
// after its name or a bare attribute (its `<` not glued to an identifier, as a
// type argument's is), after a quoted or braced value or `/`, or on a line of
// its own, where the dynamic snippet puts it after props it wrapped.
// A quoted body is written as runs between escapes, not as a repeated
// (char|escape) group: V8 backtracks through such a group one character at a
// time, and a literal of a few megabytes (`AnsiView/LargeLog`'s text)
// overflows its stack.
const LITERAL =
  /\{`([\s\S]*?)`\}|`([^`\\]*(?:\\[\s\S][^`\\]*)*)`|"([^"\\]*(?:\\[\s\S][^"\\]*)*)"|(?<![\w$])'([^'\\\n]*(?:\\[\s\S][^'\\\n]*)*)'|(?<!=)(?<=(?:^|[^\w$.])<\/?(?:[A-Za-z][\w.:-]*(?:\s[^<>]*)?)?|["'}/]|^[ \t]*)>([^<>{}]+)</gm;

function shorten(content: string): string {
  const body = content.trim();
  if (body.length <= LIMIT) return content;
  const lead = content.slice(0, content.length - content.trimStart().length);
  const trail = content.slice(content.trimEnd().length);
  // A static snippet is regenerated source, where a newline is the escape \n.
  const line = body
    .split(/\r?\n|\\n/, 1)[0]
    .slice(0, HEAD)
    .trimEnd();
  // An odd run of backslashes at the cut would escape the closing quote, and
  // the next pass would read on past it.
  const head = line.replace(/\\+$/, (run) =>
    run.length % 2 === 0 ? run : run.slice(1),
  );
  return `${lead}${head}…${trail}`;
}

/** Cuts every string, template literal and JSX text in a code preview longer than LIMIT to the start of its first line and an ellipsis. */
export function collapseLongLiterals(code: string): string {
  return code.replace(
    LITERAL,
    (
      _match,
      wrapped?: string,
      template?: string,
      double?: string,
      single?: string,
      text?: string,
    ) => {
      if (wrapped !== undefined) return `{\`${shorten(wrapped)}\`}`;
      if (template !== undefined) return `\`${shorten(template)}\``;
      if (double !== undefined) return `"${shorten(double)}"`;
      if (single !== undefined) return `'${shorten(single)}'`;
      return `>${shorten(text ?? "")}<`;
    },
  );
}
