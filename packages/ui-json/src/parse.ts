import type { JsonComment, JsonDocument, NodeFacts } from "./types.ts";

/** `json` is RFC 8259; `jsonc` adds comments and trailing commas; `json5` is JSON5 1.0.0. */
export type JsonDialect = "json" | "jsonc" | "json5";

export interface JsonParseError {
  message: string;
  /** UTF-16 offset into the text. */
  offset: number;
  /** 1-based. */
  line: number;
  /** 1-based, in UTF-16 code units. */
  column: number;
}

export type ParseJsonResult =
  | { ok: true; document: JsonDocument }
  | { ok: false; error: JsonParseError };

const DIALECT_NAME: Record<JsonDialect, string> = {
  json: "JSON",
  jsonc: "JSONC",
  json5: "JSON5",
};

class Failure {
  readonly message: string;
  readonly offset: number;
  constructor(message: string, offset: number) {
    this.message = message;
    this.offset = offset;
  }
}

const isLineTerminator = (c: number) =>
  c === 0x0a || c === 0x0d || c === 0x2028 || c === 0x2029;

const isDigit = (c: number) => c >= 0x30 && c <= 0x39;

const isHexDigit = (c: number) =>
  isDigit(c) || (c >= 0x41 && c <= 0x46) || (c >= 0x61 && c <= 0x66);

const ID_START = /[\p{ID_Start}$_]/u;
const ID_PART = /[\p{ID_Continue}$\u200C\u200D]/u;
const SPACE_SEPARATOR = /\p{Zs}/u;

/** Where the parser is: what the next token may be. */
type State = "value" | "after-value" | "key-or-close" | "item-or-close";

interface Frame {
  kind: "object" | "array";
  value: Record<string, unknown> | unknown[];
  table: Map<string | number, NodeFacts>;
  /** The container's own facts, as a member of what holds it. */
  facts: NodeFacts;
  start: number;
  /** The key of the member being parsed inside this frame. */
  key: string;
  /** The facts of the member being parsed inside this frame. */
  member: NodeFacts | null;
  memberOffset: number;
  afterComma: boolean;
}

/** The key the root's facts sit under, beside a `null` container. */
export const ROOT_KEY = "$";

class Parser {
  private pos = 0;
  private readonly comments: boolean;
  private readonly json5: boolean;
  private readonly trailingCommas: boolean;
  private readonly tables = new WeakMap<
    object,
    Map<string | number, NodeFacts>
  >();
  /** Comments waiting for the member or closing bracket that follows them. */
  private pending: JsonComment[] = [];
  /** The member a comment on the same line trails. */
  private lastMember: NodeFacts | null = null;
  private lastEnd = 0;
  /** The member whose key has been read and whose value has not begun. */
  private betweenKeyAndValue: NodeFacts | null = null;

  private readonly text: string;
  private readonly dialect: JsonDialect;

  constructor(text: string, dialect: JsonDialect) {
    this.text = text;
    this.dialect = dialect;
    this.comments = dialect !== "json";
    this.json5 = dialect === "json5";
    this.trailingCommas = dialect !== "json";
  }

  private fail(message: string, offset = this.pos): never {
    throw new Failure(message, offset);
  }

  private notIn(feature: string, offset = this.pos): never {
    this.fail(
      `${feature} are not allowed in ${DIALECT_NAME[this.dialect]}`,
      offset,
    );
  }

  private unexpected(): never {
    if (this.pos >= this.text.length) this.fail("Unexpected end of input");
    const ch = String.fromCodePoint(this.text.codePointAt(this.pos) ?? 0);
    this.fail(`Unexpected character ${JSON.stringify(ch)}`);
  }

  private isSpace(c: number): boolean {
    if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) return true;
    if (!this.json5) return false;
    return (
      c === 0x0b ||
      c === 0x0c ||
      c === 0xa0 ||
      c === 0xfeff ||
      c === 0x2028 ||
      c === 0x2029 ||
      (c > 0x7f && SPACE_SEPARATOR.test(String.fromCharCode(c)))
    );
  }

  private sameLine(from: number, to: number): boolean {
    for (let i = from; i < to; i++) {
      if (isLineTerminator(this.text.charCodeAt(i))) return false;
    }
    return true;
  }

  private takePending(): JsonComment[] | undefined {
    if (this.pending.length === 0) return undefined;
    const taken = this.pending;
    this.pending = [];
    return taken;
  }

  private place(comment: JsonComment) {
    const between = this.betweenKeyAndValue;
    if (between && between.trailing === undefined) {
      between.trailing = comment;
      return;
    }
    const last = this.lastMember;
    if (
      last &&
      last.trailing === undefined &&
      this.sameLine(this.lastEnd, comment.range[0])
    ) {
      last.trailing = comment;
      return;
    }
    this.pending.push(comment);
  }

  /** Skips whitespace and comments, placing each comment. */
  private trivia() {
    const { text } = this;
    for (;;) {
      const c = text.charCodeAt(this.pos);
      if (this.isSpace(c)) {
        this.pos++;
        continue;
      }
      if (c !== 0x2f) return;
      const next = text.charCodeAt(this.pos + 1);
      if (next !== 0x2f && next !== 0x2a) return;
      if (!this.comments) this.notIn("Comments");
      const start = this.pos;
      if (next === 0x2f) {
        let end = start + 2;
        while (end < text.length && !isLineTerminator(text.charCodeAt(end))) {
          end++;
        }
        this.pos = end;
        this.place({
          text: text.slice(start, end),
          block: false,
          range: [start, end],
        });
      } else {
        const close = text.indexOf("*/", start + 2);
        if (close < 0) this.fail("Unterminated comment", start);
        const end = close + 2;
        this.pos = end;
        this.place({
          text: text.slice(start, end),
          block: true,
          range: [start, end],
        });
      }
    }
  }

  parse(): JsonDocument {
    const { text } = this;
    if (text.charCodeAt(0) === 0xfeff) this.pos = 1;
    const stack: Frame[] = [];
    this.trivia();
    const root: NodeFacts = { range: [0, 0] };
    const leading = this.takePending();
    if (leading) root.leading = leading;
    let rootValue: unknown;
    let done = false;
    // Read through `now()`: `complete` moves it from inside a closure, which
    // the compiler's narrowing does not see.
    let state: State = "value";
    const now = (): State => state;

    // The member the next value belongs to.
    let member: NodeFacts = root;
    let memberStart = this.pos;

    const complete = (value: unknown, start: number, end: number) => {
      member.range = [start, end];
      const frame = stack[stack.length - 1];
      if (!frame) {
        rootValue = value;
        done = true;
        return;
      }
      member.memberRange = [memberStart, end];
      if (frame.kind === "object") {
        const record = frame.value as Record<string, unknown>;
        if (frame.key === "__proto__") {
          Object.defineProperty(record, "__proto__", {
            value,
            writable: true,
            enumerable: true,
            configurable: true,
          });
        } else {
          record[frame.key] = value;
        }
        frame.table.set(frame.key, member);
      } else {
        const list = frame.value as unknown[];
        frame.table.set(list.length, member);
        list.push(value);
      }
      frame.member = null;
      frame.afterComma = false;
      this.lastMember = member;
      this.lastEnd = end;
      state = "after-value";
    };

    const close = (frame: Frame) => {
      const dangling = this.takePending();
      if (dangling) frame.facts.dangling = dangling;
      this.pos++;
      stack.pop();
      this.tables.set(frame.value, frame.table);
      const parent = stack[stack.length - 1];
      member = frame.facts;
      memberStart = parent ? parent.memberOffset : frame.start;
      this.lastMember = null;
      complete(frame.value, frame.start, this.pos);
    };

    const startMember = (frame: Frame) => {
      this.lastMember = null;
      member = { range: [0, 0] };
      const leadingHere = this.takePending();
      if (leadingHere) member.leading = leadingHere;
      memberStart = this.pos;
      frame.member = member;
      frame.memberOffset = this.pos;
    };

    while (!done) {
      if (now() === "value") {
        this.trivia();
        this.betweenKeyAndValue = null;
        const start = this.pos;
        const c = text.charCodeAt(start);
        if (c === 0x7b || c === 0x5b) {
          const isObject = c === 0x7b;
          const frame: Frame = {
            kind: isObject ? "object" : "array",
            value: isObject ? {} : [],
            table: new Map(),
            facts: member,
            start,
            key: "",
            member: null,
            memberOffset: start,
            afterComma: false,
          };
          stack.push(frame);
          this.pos++;
          // A comment after the opening bracket, on its line, trails the
          // container's own row; the root has no row to trail.
          this.lastMember = stack.length > 1 ? member : null;
          this.lastEnd = this.pos;
          state = isObject ? "key-or-close" : "item-or-close";
          continue;
        }
        const scalar = this.scalar();
        if (scalar.literal !== undefined) member.literal = scalar.literal;
        complete(scalar.value, start, this.pos);
        continue;
      }

      const frame = stack[stack.length - 1] as Frame;

      if (now() === "after-value") {
        this.trivia();
        const c = text.charCodeAt(this.pos);
        if (c === 0x2c) {
          this.pos++;
          frame.afterComma = true;
          state = frame.kind === "object" ? "key-or-close" : "item-or-close";
          continue;
        }
        if (c === (frame.kind === "object" ? 0x7d : 0x5d)) {
          close(frame);
          continue;
        }
        if (this.pos >= text.length) this.fail("Unexpected end of input");
        this.fail(
          frame.kind === "object"
            ? 'Expected "," or "}" after a property value'
            : 'Expected "," or "]" after an array item',
        );
      }

      const closer = now() === "key-or-close" ? 0x7d : 0x5d;
      const commaAt = this.pos - 1;
      this.trivia();
      if (text.charCodeAt(this.pos) === closer) {
        if (frame.afterComma && !this.trailingCommas) {
          this.notIn("Trailing commas", commaAt);
        }
        close(frame);
        continue;
      }
      startMember(frame);
      if (now() === "item-or-close") {
        state = "value";
        continue;
      }
      frame.key = this.key();
      this.betweenKeyAndValue = member;
      this.trivia();
      if (text.charCodeAt(this.pos) !== 0x3a) {
        if (this.pos >= text.length) this.fail("Unexpected end of input");
        this.fail('Expected ":" after a property name');
      }
      this.pos++;
      state = "value";
    }

    this.trivia();
    if (this.pos < text.length) {
      this.fail("Unexpected content after the value");
    }
    const after = this.takePending();
    if (after) root.dangling = [...(root.dangling ?? []), ...after];

    const tables = this.tables;
    return {
      value: rootValue,
      source: text,
      facts: (container, key) => {
        if (container === null) return root;
        const table = tables.get(container);
        if (!table) return undefined;
        return table.get(Array.isArray(container) ? Number(key) : key);
      },
    };
  }

  private key(): string {
    const c = this.text.charCodeAt(this.pos);
    if (c === 0x22 || c === 0x27) return this.string().value;
    if (this.pos >= this.text.length) this.fail("Unexpected end of input");
    const ch = String.fromCodePoint(this.text.codePointAt(this.pos) ?? 0);
    if (ID_START.test(ch) || ch === "\\") {
      if (!this.json5) this.notIn("Unquoted property names");
      return this.identifier();
    }
    this.fail("Expected a property name");
  }

  private identifier(): string {
    const { text } = this;
    let out = "";
    let first = true;
    for (;;) {
      const at = this.pos;
      let ch: string;
      if (text.charCodeAt(at) === 0x5c) {
        if (text.charCodeAt(at + 1) !== 0x75) this.fail("Bad escape", at);
        const hex = text.slice(at + 2, at + 6);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("Bad Unicode escape", at);
        ch = String.fromCharCode(Number.parseInt(hex, 16));
        this.pos = at + 6;
      } else {
        const code = text.codePointAt(at);
        if (code === undefined) break;
        ch = String.fromCodePoint(code);
        if (!(first ? ID_START : ID_PART).test(ch)) break;
        this.pos = at + ch.length;
      }
      if (!(first ? ID_START : ID_PART).test(ch)) {
        this.fail("Bad character in an identifier", at);
      }
      out += ch;
      first = false;
    }
    return out;
  }

  private scalar(): { value: unknown; literal?: string } {
    const { text } = this;
    const start = this.pos;
    const c = text.charCodeAt(start);
    if (c === 0x22 || c === 0x27) return this.string();
    if (isDigit(c) || c === 0x2d || c === 0x2b || c === 0x2e) {
      return this.number();
    }
    if (c === 0x49 || c === 0x4e) {
      if (this.json5) return this.number();
    }
    for (const [word, value] of WORDS) {
      if (text.startsWith(word, start)) {
        const after = text.codePointAt(start + word.length);
        if (after !== undefined && ID_PART.test(String.fromCodePoint(after))) {
          break;
        }
        this.pos = start + word.length;
        return { value };
      }
    }
    if (
      (text.startsWith("Infinity", start) || text.startsWith("NaN", start)) &&
      !this.json5
    ) {
      this.notIn("Infinity and NaN");
    }
    this.unexpected();
  }

  private number(): { value: number; literal?: string } {
    const { text } = this;
    const start = this.pos;
    let i = start;
    let sign = 1;
    const c0 = text.charCodeAt(i);
    if (c0 === 0x2b) {
      if (!this.json5) this.notIn("Leading plus signs");
      i++;
    } else if (c0 === 0x2d) {
      sign = -1;
      i++;
    }
    let value: number;
    if (text.startsWith("Infinity", i) || text.startsWith("NaN", i)) {
      if (!this.json5) this.notIn("Infinity and NaN", i);
      const infinite = text.startsWith("Infinity", i);
      i += infinite ? 8 : 3;
      value = infinite ? sign * Number.POSITIVE_INFINITY : Number.NaN;
    } else if (
      text.charCodeAt(i) === 0x30 &&
      (text.charCodeAt(i + 1) | 0x20) === 0x78
    ) {
      if (!this.json5) this.notIn("Hexadecimal numbers", i);
      let j = i + 2;
      while (isHexDigit(text.charCodeAt(j))) j++;
      if (j === i + 2) this.fail("Invalid number", start);
      value = sign * Number.parseInt(text.slice(i + 2, j), 16);
      i = j;
    } else {
      const intStart = i;
      if (text.charCodeAt(i) === 0x30) {
        i++;
        if (isDigit(text.charCodeAt(i))) {
          this.fail("Leading zeros are not allowed", intStart);
        }
      } else {
        while (isDigit(text.charCodeAt(i))) i++;
      }
      const intDigits = i - intStart;
      let fracDigits = 0;
      if (text.charCodeAt(i) === 0x2e) {
        const dot = i;
        i++;
        while (isDigit(text.charCodeAt(i))) {
          i++;
          fracDigits++;
        }
        if (fracDigits === 0 && !this.json5) {
          this.fail("Expected a digit after the decimal point", i);
        }
        if (intDigits === 0 && !this.json5) {
          this.notIn("Leading decimal points", dot);
        }
        if (intDigits === 0 && fracDigits === 0) {
          this.fail("Invalid number", start);
        }
      } else if (intDigits === 0) {
        if (i >= text.length) this.fail("Unexpected end of input");
        this.fail("Invalid number", start);
      }
      if ((text.charCodeAt(i) | 0x20) === 0x65) {
        i++;
        const s = text.charCodeAt(i);
        if (s === 0x2b || s === 0x2d) i++;
        const expStart = i;
        while (isDigit(text.charCodeAt(i))) i++;
        if (i === expStart) this.fail("Expected a digit in the exponent", i);
      }
      value = Number(text.slice(start, i));
    }
    this.pos = i;
    const written = text.slice(start, i);
    return written === String(value) ? { value } : { value, literal: written };
  }

  private string(): { value: string; literal?: string } {
    const { text } = this;
    const start = this.pos;
    const quote = text.charCodeAt(start);
    if (quote === 0x27 && !this.json5) this.notIn("Single-quoted strings");
    let i = start + 1;
    let run = i;
    const parts: string[] = [];
    let continued = false;
    for (;;) {
      if (i >= text.length) this.fail("Unterminated string", start);
      const c = text.charCodeAt(i);
      if (c === quote) {
        parts.push(text.slice(run, i));
        i++;
        break;
      }
      if (c === 0x5c) {
        parts.push(text.slice(run, i));
        const decoded = this.escape(i);
        if (decoded.continued) continued = true;
        parts.push(decoded.text);
        i = decoded.end;
        run = i;
        continue;
      }
      if (this.json5) {
        if (c === 0x0a || c === 0x0d) {
          this.fail("Line breaks in strings must be escaped", i);
        }
      } else if (c < 0x20) {
        this.fail("Bad control character in string", i);
      }
      i++;
    }
    this.pos = i;
    const value = parts.length === 1 ? (parts[0] as string) : parts.join("");
    return quote === 0x27 || continued
      ? { value, literal: text.slice(start, i) }
      : { value };
  }

  private escape(at: number): { text: string; end: number; continued?: true } {
    const { text } = this;
    const c = text.charCodeAt(at + 1);
    const simple = SIMPLE_ESCAPES[c];
    if (simple !== undefined && (this.json5 || c !== 0x27)) {
      return { text: simple, end: at + 2 };
    }
    if (c === 0x75) {
      const hex = text.slice(at + 2, at + 6);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("Bad Unicode escape", at);
      return {
        text: String.fromCharCode(Number.parseInt(hex, 16)),
        end: at + 6,
      };
    }
    if (c === 0x2f) return { text: "/", end: at + 2 };
    if (!this.json5) {
      if (Number.isNaN(c)) this.fail("Unterminated string", at);
      this.fail("Bad escape in string", at);
    }
    if (c === 0x76) return { text: "\v", end: at + 2 };
    if (c === 0x30) {
      if (isDigit(text.charCodeAt(at + 2))) this.fail("Bad escape", at);
      return { text: "\0", end: at + 2 };
    }
    if (c === 0x78) {
      const hex = text.slice(at + 2, at + 4);
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) this.fail("Bad hex escape", at);
      return {
        text: String.fromCharCode(Number.parseInt(hex, 16)),
        end: at + 4,
      };
    }
    if (isLineTerminator(c)) {
      const end = c === 0x0d && text.charCodeAt(at + 2) === 0x0a ? 3 : 2;
      return { text: "", end: at + end, continued: true };
    }
    if (isDigit(c)) this.fail("Bad escape", at);
    if (Number.isNaN(c)) this.fail("Unterminated string", at);
    const ch = String.fromCodePoint(text.codePointAt(at + 1) ?? 0);
    return { text: ch, end: at + 1 + ch.length };
  }
}

const SIMPLE_ESCAPES: Record<number, string> = {
  34: '"',
  39: "'",
  92: "\\",
  98: "\b",
  102: "\f",
  110: "\n",
  114: "\r",
  116: "\t",
};

const WORDS: [string, unknown][] = [
  ["true", true],
  ["false", false],
  ["null", null],
];

function lineAndColumn(
  text: string,
  offset: number,
): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0x0d && text.charCodeAt(i + 1) === 0x0a) continue;
    if (isLineTerminator(c)) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

/**
 * Parses JSON, JSONC or JSON5 text into a `JsonDocument`: the value, the text, and each member's
 * range, literal and comments. Never throws; a syntax error comes back with its place.
 */
export function parseJson(
  text: string,
  options: { dialect?: JsonDialect } = {},
): ParseJsonResult {
  const dialect = options.dialect ?? "json";
  const parser = new Parser(text, dialect);
  try {
    return { ok: true, document: parser.parse() };
  } catch (error) {
    const failure =
      error instanceof Failure
        ? error
        : new Failure(
            error instanceof Error ? error.message : String(error),
            text.length,
          );
    const offset = Math.min(failure.offset, text.length);
    return {
      ok: false,
      error: {
        message: failure.message,
        offset,
        ...lineAndColumn(text, offset),
      },
    };
  }
}
