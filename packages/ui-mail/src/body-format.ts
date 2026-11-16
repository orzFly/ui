/**
 * postal-mime unwraps `format=flowed` text but does not say whether the body was flowed, and that
 * is what decides whether the plain body may wrap. So this reads the MIME headers again, and only
 * the headers: no part is decoded.
 */

/** postal-mime's `maxNestingDepth` default, past which it rejects the message anyway. */
const MAX_DEPTH = 256;

type Headers = Map<string, string>;

type Line = { start: number; end: number };

/** Unfolds the header block starting at `lines[from]`; returns the headers and the body's first line. */
function readHeaders(
  text: string,
  lines: Line[],
  from: number,
  to: number,
): { headers: Headers; body: number } {
  const headers: Headers = new Map();
  let name: string | null = null;
  let i = from;
  for (; i < to; i++) {
    const line = lines[i] as Line;
    const value = text.slice(line.start, line.end);
    if (value === "") {
      i++;
      break;
    }
    // RFC 5322 §2.2.3: a line opening with white space continues the one before.
    if ((value[0] === " " || value[0] === "\t") && name !== null) {
      headers.set(name, `${headers.get(name) ?? ""} ${value.trim()}`);
      continue;
    }
    const colon = value.indexOf(":");
    if (colon <= 0) continue;
    name = value.slice(0, colon).trim().toLowerCase();
    // The first of a repeated header wins, as postal-mime reads Content-Type.
    if (!headers.has(name)) headers.set(name, value.slice(colon + 1).trim());
    else name = null;
  }
  return { headers, body: i };
}

/** A header's value and its parameters (RFC 2045 §5.1), names lowercased. */
function parseValue(header: string | undefined): {
  value: string;
  params: Map<string, string>;
} {
  const params = new Map<string, string>();
  if (header === undefined) return { value: "", params };
  const semi = header.indexOf(";");
  const value = (semi === -1 ? header : header.slice(0, semi))
    .trim()
    .toLowerCase();
  if (semi !== -1) {
    const re = /;\s*([^\s=;]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s;]*))/g;
    for (const match of header.slice(semi).matchAll(re)) {
      const key = (match[1] as string).toLowerCase();
      const quoted = match[2];
      if (!params.has(key)) {
        params.set(
          key,
          quoted !== undefined
            ? quoted.replace(/\\(.)/g, "$1")
            : (match[3] ?? ""),
        );
      }
    }
  }
  return { value, params };
}

/**
 * The format of the first body text in lines `[from, to)`: true or false once a `text/plain`
 * part that is not an attachment is found, undefined when this part holds none.
 */
function scan(
  text: string,
  lines: Line[],
  from: number,
  to: number,
  depth: number,
): boolean | undefined {
  if (depth > MAX_DEPTH) return undefined;
  const { headers, body } = readHeaders(text, lines, from, to);
  const type = parseValue(headers.get("content-type"));
  const disposition = parseValue(headers.get("content-disposition"));
  // A part without a Content-Type is text/plain (RFC 2045 §5.2).
  const mime = type.value === "" ? "text/plain" : type.value;

  if (mime === "text/plain") {
    if (disposition.value === "attachment") return undefined;
    return type.params.get("format")?.toLowerCase() === "flowed";
  }

  const boundary = type.params.get("boundary");
  if (!mime.startsWith("multipart/") || !boundary) return undefined;
  const open = `--${boundary}`;
  const close = `--${boundary}--`;
  let partStart: number | null = null;
  for (let i = body; i < to; i++) {
    const line = lines[i] as Line;
    // Only a line that starts with the delimiter is worth slicing.
    if (text.charCodeAt(line.start) !== 45) continue;
    // RFC 2046 §5.1.1 allows white space after a delimiter.
    const value = text.slice(line.start, line.end).trimEnd();
    if (value !== open && value !== close) continue;
    if (partStart !== null) {
      const found = scan(text, lines, partStart, i, depth + 1);
      if (found !== undefined) return found;
    }
    if (value === close) return undefined;
    partStart = i + 1;
  }
  return undefined;
}

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  for (;;) {
    const lf = text.indexOf("\n", start);
    if (lf === -1) {
      lines.push({ start, end: text.length });
      return lines;
    }
    const end = lf > start && text.charCodeAt(lf - 1) === 13 ? lf - 1 : lf;
    lines.push({ start, end });
    start = lf + 1;
  }
}

/**
 * Whether the message's body text is `format=flowed` (RFC 3676): the first `text/plain` part that
 * is not an attachment, in a message of any nesting, declares it.
 */
export function isFlowedBody(raw: ArrayBuffer | Uint8Array | string): boolean {
  // Headers and boundaries are ASCII, so latin1 finds them whatever the
  // bodies' charsets, and every byte maps to one character.
  const text =
    typeof raw === "string" ? raw : new TextDecoder("latin1").decode(raw);
  const lines = splitLines(text);
  return scan(text, lines, 0, lines.length, 0) ?? false;
}
