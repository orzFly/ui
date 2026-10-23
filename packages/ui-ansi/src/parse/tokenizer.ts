import { codePointCells } from "./line.ts";

/** What the tokenizer finds, in input order. */
export interface TokenSink {
  /** Printable code points `chunk[start, end)`, `cells` wide. */
  print(chunk: string, start: number, end: number, cells: number): void;
  /** `\n`, `\r`, `\b` or `\t`. */
  control(code: number): void;
  /** A CSI with no private marker and no intermediate. */
  csi(params: string, final: number): void;
  /** An OSC body, without its terminator. */
  osc(body: string): void;
}

/** How long an OSC or DCS/SOS/PM/APC body may grow before it is abandoned. */
export const STRING_MAX = 4096;
/** How long CSI parameters may grow before the sequence is dropped. */
export const CSI_PARAMS_MAX = 256;

const State = {
  Ground: 0,
  Escape: 1,
  EscapeIntermediate: 2,
  Csi: 3,
  Osc: 4,
  OscEscape: 5,
  /** DCS, SOS, PM or APC: dropped, so only its length is kept. */
  Str: 6,
  StrEscape: 7,
} as const;
type State = (typeof State)[keyof typeof State];

const BEL = 0x07;
const ESC = 0x1b;
const CAN = 0x18;
const SUB = 0x1a;

function isExecuted(c: number): boolean {
  return c === 0x0a || c === 0x0d || c === 0x08 || c === 0x09;
}

/**
 * A VT500-style escape-sequence state machine. Its state survives between
 * `push` calls, so the input may be split anywhere, even inside a surrogate
 * pair.
 */
export class Tokenizer {
  private state: State = State.Ground;
  private params = "";
  private csiDropped = false;
  private body = "";
  private bodyLength = 0;
  private highSurrogate = "";

  private readonly sink: TokenSink;

  constructor(sink: TokenSink) {
    this.sink = sink;
  }

  push(input: string): void {
    let chunk = input;
    if (this.highSurrogate !== "") {
      chunk = this.highSurrogate + chunk;
      this.highSurrogate = "";
    }
    const len = chunk.length;
    const sink = this.sink;
    let i = 0;
    while (i < len) {
      const c = chunk.charCodeAt(i);
      switch (this.state) {
        case State.Ground: {
          const start = i;
          let cells = 0;
          while (i < len) {
            const d = chunk.charCodeAt(i);
            if ((d >= 0x20 && d < 0x7f) || (d >= 0xa0 && d < 0x300)) {
              cells++;
              i++;
            } else if (d < 0x20 || (d >= 0x7f && d < 0xa0)) {
              break;
            } else if (d >= 0xd800 && d <= 0xdbff) {
              if (i + 1 === len) break;
              const e = chunk.charCodeAt(i + 1);
              if (e >= 0xdc00 && e <= 0xdfff) {
                cells += codePointCells(
                  ((d - 0xd800) << 10) + (e - 0xdc00) + 0x10000,
                );
                i += 2;
              } else {
                cells++;
                i++;
              }
            } else {
              cells += codePointCells(d);
              i++;
            }
          }
          if (i > start) sink.print(chunk, start, i, cells);
          if (i === len) break;
          const d = chunk.charCodeAt(i);
          if (d >= 0xd800 && d <= 0xdbff) {
            // A high surrogate at the very end: its pair is in the next push.
            this.highSurrogate = chunk[i] as string;
            i++;
          } else {
            if (d === ESC) this.state = State.Escape;
            else if (isExecuted(d)) sink.control(d);
            i++;
          }
          break;
        }
        case State.Escape:
          i = this.escape(c, i);
          break;
        case State.EscapeIntermediate:
          if (c >= 0x20 && c <= 0x2f) i++;
          else if (c >= 0x30 && c <= 0x7e) {
            this.state = State.Ground;
            i++;
          } else if (c === ESC) {
            this.state = State.Escape;
            i++;
          } else this.state = State.Ground;
          break;
        case State.Csi:
          if (c >= 0x30 && c <= 0x3f) {
            if (c >= 0x3c) this.csiDropped = true;
            else if (this.params.length >= CSI_PARAMS_MAX)
              this.csiDropped = true;
            else if (!this.csiDropped) this.params += chunk[i];
            i++;
          } else if (c >= 0x20 && c <= 0x2f) {
            this.csiDropped = true;
            i++;
          } else if (c >= 0x40 && c <= 0x7e) {
            this.state = State.Ground;
            if (!this.csiDropped) sink.csi(this.params, c);
            i++;
          } else if (c === ESC) {
            this.state = State.Escape;
            i++;
          } else if (c === CAN || c === SUB) {
            this.state = State.Ground;
            i++;
          } else if (c < 0x20) {
            // VT500 runs C0 controls met inside a CSI and carries on with it.
            if (isExecuted(c)) sink.control(c);
            i++;
          } else if (c === 0x7f) {
            i++;
          } else {
            this.state = State.Ground;
          }
          break;
        case State.Osc: {
          const start = i;
          const room = STRING_MAX - this.body.length;
          const stop = Math.min(len, i + room);
          while (i < stop) {
            const d = chunk.charCodeAt(i);
            if (d === BEL || d === ESC || d === CAN || d === SUB) break;
            i++;
          }
          if (i > start) this.body += chunk.slice(start, i);
          if (i === len) break;
          const d = chunk.charCodeAt(i);
          if (d === BEL) {
            this.state = State.Ground;
            sink.osc(this.body);
            this.body = "";
            i++;
          } else if (d === ESC) {
            this.state = State.OscEscape;
            i++;
          } else if (d === CAN || d === SUB) {
            this.state = State.Ground;
            this.body = "";
            i++;
          } else {
            // Past STRING_MAX: a stray `ESC ]` must not swallow the rest of a log.
            this.state = State.Ground;
            this.body = "";
          }
          break;
        }
        case State.OscEscape:
          if (c === 0x5c) {
            this.state = State.Ground;
            sink.osc(this.body);
            this.body = "";
            i++;
          } else {
            this.body = "";
            i = this.escape(c, i);
          }
          break;
        case State.Str: {
          while (i < len) {
            const d = chunk.charCodeAt(i);
            if (d === ESC || d === CAN || d === SUB) break;
            if (this.bodyLength >= STRING_MAX) break;
            this.bodyLength++;
            i++;
          }
          if (i === len) break;
          const d = chunk.charCodeAt(i);
          if (d === ESC) {
            this.state = State.StrEscape;
            i++;
          } else {
            this.state = State.Ground;
            if (d === CAN || d === SUB) i++;
          }
          break;
        }
        case State.StrEscape:
          if (c === 0x5c) {
            this.state = State.Ground;
            i++;
          } else {
            i = this.escape(c, i);
          }
          break;
      }
    }
  }

  /** Flushes a carried high surrogate and drops an unfinished sequence. */
  end(): void {
    if (this.highSurrogate !== "") {
      this.sink.print(this.highSurrogate, 0, 1, 1);
      this.highSurrogate = "";
    }
    this.state = State.Ground;
    this.params = "";
    this.body = "";
  }

  /** The character after an ESC; returns the index to read next. */
  private escape(c: number, i: number): number {
    switch (c) {
      case 0x5b:
        this.state = State.Csi;
        this.params = "";
        this.csiDropped = false;
        return i + 1;
      case 0x5d:
        this.state = State.Osc;
        this.body = "";
        return i + 1;
      case 0x50:
      case 0x58:
      case 0x5e:
      case 0x5f:
        this.state = State.Str;
        this.bodyLength = 0;
        return i + 1;
      case ESC:
        this.state = State.Escape;
        return i + 1;
    }
    if (c >= 0x20 && c <= 0x2f) {
      this.state = State.EscapeIntermediate;
      return i + 1;
    }
    this.state = State.Ground;
    // ESC and a final byte is a sequence we do not draw. Anything else ends
    // the lone ESC and is read again as ordinary input.
    return c >= 0x30 && c <= 0x7e ? i + 1 : i;
  }
}
