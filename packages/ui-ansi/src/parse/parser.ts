import { LineBuilder } from "./line.ts";
import { applySgr } from "./sgr.ts";
import { StyleTable } from "./styles.ts";
import { Tokenizer, type TokenSink } from "./tokenizer.ts";
import type { AnsiLine, AnsiParse, AnsiParser, AnsiStyle } from "./types.ts";

/** The longest OSC 8 URI that becomes a link. */
export const LINK_URI_MAX = 2048;
/**
 * The furthest one `CSI C` or `CSI G` moves. It pads with real spaces, so an
 * unbounded count would let a few bytes allocate gigabytes.
 */
export const CURSOR_MOVE_MAX = 1024;

const LINK_SCHEME = /^(?:https?|mailto):/i;

/**
 * Cached SGR transitions per state. Truecolor gradients can make every
 * parameter string distinct; past this many the rest are applied uncached.
 */
const TRANSITIONS_MAX = 256;

function firstParam(params: string, fallback: number): number {
  const n = Number.parseInt(params, 10);
  return Number.isNaN(n) ? fallback : n;
}

class Parser implements AnsiParser, TokenSink {
  readonly lines: AnsiLine[] = [];
  private readonly table = new StyleTable();
  private readonly line = new LineBuilder();
  private readonly tokenizer = new Tokenizer(this);
  private sgr: AnsiStyle = this.table.canonical({});
  // A log repeats a handful of SGR sequences; splitting, applying and
  // interning each one again was most of the parse time.
  private readonly transitions = new Map<AnsiStyle, Map<string, AnsiStyle>>();
  private readonly plainIds = new Map<AnsiStyle, number>();
  private href: string | undefined;
  // -1 until the next write needs the current style interned.
  private id = 0;
  private widest = 0;
  private ended = false;

  get styles(): readonly AnsiStyle[] {
    return this.table.styles;
  }

  get maxCells(): number {
    return this.widest;
  }

  push(chunk: string): void {
    if (this.ended) throw new Error("AnsiParser: push after end");
    this.tokenizer.push(chunk);
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.tokenizer.end();
    this.newline();
  }

  print(chunk: string, start: number, end: number, cells: number): void {
    this.line.write(chunk, start, end, cells, this.styleId());
  }

  control(code: number): void {
    switch (code) {
      case 0x0a:
        this.newline();
        break;
      case 0x0d:
        this.line.carriageReturn();
        break;
      case 0x08:
        this.line.backspace();
        break;
      case 0x09:
        this.line.tab(this.styleId());
        break;
    }
  }

  csi(params: string, final: number): void {
    switch (final) {
      case 0x6d: {
        let cached = this.transitions.get(this.sgr);
        if (!cached) {
          cached = new Map();
          this.transitions.set(this.sgr, cached);
        }
        let next = cached.get(params);
        if (!next) {
          next = this.table.canonical(
            applySgr(
              this.sgr,
              params.split(";").map((param) => param.split(":")),
            ),
          );
          if (cached.size < TRANSITIONS_MAX) cached.set(params, next);
        }
        if (next !== this.sgr) {
          this.sgr = next;
          this.id = -1;
        }
        break;
      }
      case 0x43:
        this.line.forward(this.count(params));
        break;
      case 0x44:
        this.line.backward(this.count(params));
        break;
      case 0x47:
        this.line.column(this.count(params) - 1);
        break;
      case 0x4b: {
        const mode = firstParam(params, 0);
        if (mode >= 0 && mode <= 2) this.line.erase(mode);
        break;
      }
    }
  }

  osc(body: string): void {
    if (!body.startsWith("8;")) return;
    const semicolon = body.indexOf(";", 2);
    if (semicolon < 0) return;
    const uri = body.slice(semicolon + 1);
    // A refused link still ends the one before it, so its text is not
    // credited to the wrong target.
    const href =
      uri !== "" && uri.length <= LINK_URI_MAX && LINK_SCHEME.test(uri)
        ? uri
        : undefined;
    if (href !== this.href) {
      this.href = href;
      this.id = -1;
    }
  }

  private count(params: string): number {
    return Math.min(Math.max(1, firstParam(params, 1)), CURSOR_MOVE_MAX);
  }

  private styleId(): number {
    if (this.id >= 0) return this.id;
    if (this.href !== undefined) {
      this.id = this.table.intern(this.sgr, this.href);
    } else {
      let id = this.plainIds.get(this.sgr);
      if (id === undefined) {
        id = this.table.intern(this.sgr);
        this.plainIds.set(this.sgr, id);
      }
      this.id = id;
    }
    return this.id;
  }

  private newline(): void {
    const line = this.line.finish();
    if (line.cells > this.widest) this.widest = line.cells;
    this.lines.push(line);
  }
}

/**
 * An incremental parser: `push` the text in chunks split anywhere, then
 * `end`. `lines` holds the complete lines so far.
 */
export function createAnsiParser(): AnsiParser {
  return new Parser();
}

/** Parses a whole text at once. */
export function parseAnsi(text: string): AnsiParse {
  const parser = new Parser();
  parser.push(text);
  parser.end();
  return {
    lines: parser.lines,
    styles: parser.styles,
    maxCells: parser.maxCells,
  };
}

/** The text with every escape removed and cursor moves applied, lines joined with `\n`. */
export function stripAnsi(text: string): string {
  return parseAnsi(text)
    .lines.map((line) => line.text)
    .join("\n");
}
