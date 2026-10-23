/** What the control bar and the content renderer need to know about a cast, read without playing it. */
export type CastInfo = {
  version: 1 | 2 | 3;
  cols: number;
  rows: number;
  title?: string;
  /** Seconds, after the idle-time cap: the timeline the player shows. */
  duration: number;
  markers: { time: number; label: string }[];
};

export type CastError = { error: string };

type Header = Record<string, unknown>;

function isRecord(value: unknown): value is Header {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function sizeOf(
  cols: unknown,
  rows: unknown,
): { cols: number; rows: number } | undefined {
  const c = positiveInt(cols);
  const r = positiveInt(rows);
  return c === undefined || r === undefined ? undefined : { cols: c, rows: r };
}

function titleOf(header: Header): { title?: string } {
  return typeof header.title === "string" && header.title !== ""
    ? { title: header.title }
    : {};
}

/**
 * Applies the idle-time cap the way asciinema-player does: every gap between consecutive events
 * — whatever their code, since the player keeps them all in its timeline — and the gap before
 * the first one, is limited to `limit` seconds.
 */
function timeline(limit: number | undefined) {
  let previous = 0;
  let shift = 0;
  return (time: number): number => {
    const gap = time - previous;
    previous = time;
    if (limit !== undefined && gap > limit) shift += gap - limit;
    return time - shift;
  };
}

function idleLimit(header: Header): number | undefined {
  // Coerced the way the player multiplies it into milliseconds: null caps every
  // gap to 0 and "2" to 2 s there, and anything NaN caps none.
  if (header.idle_time_limit === undefined) return undefined;
  const limit = Number(header.idle_time_limit);
  return Number.isNaN(limit) ? undefined : limit;
}

function scanV1(header: Header): CastInfo | CastError {
  const size = sizeOf(header.width, header.height);
  if (size === undefined) return { error: "Line 1: missing or invalid size" };
  if (!Array.isArray(header.stdout)) {
    return { error: "Line 1: missing stdout" };
  }
  // The player ignores a v1 header's idle_time_limit, so the cap is not applied here either.
  let time = 0;
  for (const [index, frame] of header.stdout.entries()) {
    if (!Array.isArray(frame) || typeof frame[0] !== "number") {
      return {
        error: `Line 1: stdout frame ${index + 1} is not [delay, data]`,
      };
    }
    time += frame[0];
  }
  if (header.stdout.length === 0) return { error: "No events" };
  return {
    version: 1,
    ...size,
    ...titleOf(header),
    duration: time,
    markers: [],
  };
}

function scanLines(
  version: 2 | 3,
  header: Header,
  lines: string[],
): CastInfo | CastError {
  const term = isRecord(header.term) ? header.term : {};
  const size =
    version === 2
      ? sizeOf(header.width, header.height)
      : sizeOf(term.cols, term.rows);
  if (size === undefined) return { error: "Line 1: missing or invalid size" };
  const capped = timeline(idleLimit(header));
  const markers: CastInfo["markers"] = [];
  let absolute = 0;
  let duration: number | undefined;
  for (let i = 1; i < lines.length; i++) {
    const line = (lines[i] ?? "").trim();
    if (line === "" || (version === 3 && line.startsWith("#"))) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      event = undefined;
    }
    if (
      !Array.isArray(event) ||
      typeof event[0] !== "number" ||
      typeof event[1] !== "string"
    ) {
      return { error: `Line ${i + 1}: not an event` };
    }
    // v2 times are absolute, v3 times are the interval since the previous event.
    absolute = version === 2 ? event[0] : absolute + event[0];
    const time = capped(absolute);
    duration = time;
    if (event[1] === "m") {
      markers.push({
        time,
        label: typeof event[2] === "string" ? event[2] : "",
      });
    }
  }
  if (duration === undefined) return { error: "No events" };
  return { version, ...size, ...titleOf(header), duration, markers };
}

/**
 * Reads a cast's size, title, duration and markers, without parsing its output. asciinema-player
 * never reports markers and swallows its own load errors, so this is also where a cast that would
 * not play is caught. An error names the line it stopped at.
 */
export function scanCast(text: string): CastInfo | CastError {
  if (text.trim() === "") return { error: "Empty recording" };
  const lines = text.split("\n");
  const first = (lines[0] ?? "").trim();
  let header: unknown;
  try {
    header = JSON.parse(first);
  } catch {
    // v1 is one JSON object, usually pretty-printed over many lines.
    try {
      header = JSON.parse(text);
    } catch {
      return { error: "Line 1: not JSON" };
    }
    if (!isRecord(header) || header.version !== 1) {
      return { error: "Line 1: not an asciicast header" };
    }
    return scanV1(header);
  }
  if (!isRecord(header)) return { error: "Line 1: not an asciicast header" };
  switch (header.version) {
    case 1:
      return scanV1(header);
    case 2:
    case 3:
      return scanLines(header.version, header, lines);
    default:
      return {
        error: `Line 1: unsupported asciicast version ${JSON.stringify(header.version)}`,
      };
  }
}

export function isCastError(scan: CastInfo | CastError): scan is CastError {
  return "error" in scan;
}
