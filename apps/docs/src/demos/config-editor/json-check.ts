/** The first thing wrong with a JSON document, and where. */
export interface JsonProblem {
  /** Offsets into the text; `to` is past the end, and equals `from` at the end of the file. */
  from: number;
  to: number;
  /** 1-based. */
  line: number;
  message: string;
}

class Failure {
  readonly from: number;
  readonly to: number;
  readonly message: string;
  constructor(from: number, to: number, message: string) {
    this.from = from;
    this.to = to;
    this.message = message;
  }
}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WORD = /[A-Za-z_$][\w$-]*/y;
const ESCAPE = /\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})/y;

/**
 * Checks `text` the way `JSON.parse` would, but says what it found in words that read the same in
 * every browser — `JSON.parse`'s messages and positions differ between engines — and where, so
 * the editor can mark it.
 */
export function checkJson(text: string): JsonProblem | null {
  let at = 0;
  const fail = (message: string, from = at, to = from + 1): never => {
    throw new Failure(from, Math.min(to, text.length), message);
  };
  const unexpected = (): never =>
    at >= text.length
      ? fail("Unexpected end of file")
      : fail(`Unexpected "${text[at]}"`);
  const space = () => {
    while (at < text.length && " \t\n\r".includes(text[at] ?? "")) at += 1;
  };
  const match = (pattern: RegExp) => {
    pattern.lastIndex = at;
    return pattern.exec(text)?.[0];
  };

  const string = () => {
    const start = at;
    at += 1;
    while (true) {
      const char = text[at];
      if (char === undefined || char === "\n") {
        fail("Unterminated string", start, at);
      } else if (char === '"') {
        at += 1;
        return;
      } else if (char === "\\") {
        const sequence = match(ESCAPE);
        if (sequence === undefined) fail("Invalid escape", at, at + 2);
        at += sequence?.length ?? 0;
      } else if (char < " ") {
        fail("Control character in a string");
      } else {
        at += 1;
      }
    }
  };

  const value = (): void => {
    space();
    const char = text[at];
    if (char === "{") object();
    else if (char === "[") array();
    else if (char === '"') string();
    else scalar();
  };

  const scalar = () => {
    const number = match(NUMBER);
    if (number !== undefined) {
      at += number.length;
      return;
    }
    for (const word of ["true", "false", "null"]) {
      if (text.startsWith(word, at)) {
        at += word.length;
        return;
      }
    }
    const word = match(WORD);
    if (word !== undefined) fail(`Unexpected "${word}"`, at, at + word.length);
    unexpected();
  };

  const object = () => {
    at += 1;
    space();
    if (text[at] === "}") {
      at += 1;
      return;
    }
    let comma = -1;
    while (true) {
      space();
      if (text[at] !== '"') {
        if (text[at] === "}" && comma >= 0) fail("Trailing comma", comma);
        const word = match(WORD);
        if (word !== undefined) {
          fail("Property names need double quotes", at, at + word.length);
        }
        unexpected();
      }
      string();
      space();
      if (text[at] !== ":") fail('Expected ":" after the property name');
      at += 1;
      value();
      space();
      if (text[at] === "}") {
        at += 1;
        return;
      }
      if (text[at] !== ",") fail('Expected "," or "}"');
      comma = at;
      at += 1;
    }
  };

  const array = () => {
    at += 1;
    space();
    if (text[at] === "]") {
      at += 1;
      return;
    }
    while (true) {
      const comma = at - 1;
      space();
      if (text[at] === "]" && text[comma] === ",")
        fail("Trailing comma", comma);
      value();
      space();
      if (text[at] === "]") {
        at += 1;
        return;
      }
      if (text[at] !== ",") fail('Expected "," or "]"');
      at += 1;
    }
  };

  try {
    space();
    if (at === text.length) fail("The file is empty", at);
    value();
    space();
    if (at < text.length) fail(`Unexpected "${text[at]}" after the end`);
    return null;
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    return {
      from: error.from,
      to: error.to,
      line: text.slice(0, error.from).split("\n").length,
      message: error.message,
    };
  }
}
