export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

/** `from`/`to`: UTF-16 offsets of the level word in the line's text, when there is one to colour. */
export interface LevelMatch {
  level: LogLevel;
  from?: number;
  to?: number;
}

export type LevelDetector = (text: string) => LevelMatch | null;

/** In code order: a level's code is its index + 1, and 0 is no level. */
export const LEVELS: readonly LogLevel[] = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
];

/** Set on a level code that a continuation line took from the line above. */
export const LEVEL_INHERITED = 0x80;

export function levelCode(level: LogLevel): number {
  return LEVELS.indexOf(level) + 1;
}

export function levelOfCode(code: number): LogLevel | null {
  return LEVELS[(code & ~LEVEL_INHERITED) - 1] ?? null;
}

/** How much of a line the detector reads. */
export const LEVEL_WINDOW = 256;

const WORDS = new Map<string, LogLevel>();
for (const [level, words] of [
  ["fatal", "fatal critical crit emerg emergency alert panic"],
  ["error", "error err severe"],
  ["warn", "warning warn"],
  ["info", "info information notice"],
  ["debug", "debug dbg fine"],
  ["trace", "trace verbose finer finest"],
] as const) {
  for (const word of words.split(" ")) WORDS.set(word, level);
}

const WORD_ALT = [...WORDS.keys()]
  .sort((a, b) => b.length - a.length)
  .join("|");

// `d`: the offsets of the value, which the row colours.
const JSON_LEVEL =
  /"(?:level|lvl|severity|loglevel)"\s*:\s*(?:"(\w+)"|(\d+))/dgi;
const LOGFMT_LEVEL = /(?:^|\s)(?:level|lvl|severity)=(?:"(\w+)"|(\w+))/dgi;
const SYSLOG = /^<(\d{1,3})>/;
const KLOG = /^([IWEF])[01]\d[0-3]\d [0-2]\d:[0-5]\d:[0-5]\d/;
// The brief form wants a tag and a colon, so that a line opening with
// "I/O error" is not read as info. logcat pads a short tag to eight cells
// before the pid.
const LOGCAT_BRIEF = /^([VDIWEFA])\/[^\s(:]+(?:\s*\(\s*\d+\))?:(?:\s|$)/;
const LOGCAT_THREADTIME =
  /^\d\d-\d\d \d\d:\d\d:\d\d\.\d{3}\s+\d+\s+\d+ ([VDIWEFA]) /d;
const TRACEBACK = /^Traceback \(most recent call last\):/;

const UPPER_WORD = new RegExp(`\\b(${WORD_ALT.toUpperCase()})\\b`, "d");
// One alternative per bracket pair, so that "(level < warn)" is not a bracket.
const BRACKETED_WORD = new RegExp(
  `\\[\\s*(${WORD_ALT})\\s*\\]|<\\s*(${WORD_ALT})\\s*>|\\(\\s*(${WORD_ALT})\\s*\\)`,
  "di",
);
const COLON_WORD = new RegExp(`\\b(${WORD_ALT}):`, "di");
// Lazy, so that a level word opening the line wins over the second word.
const LEADING_WORD = new RegExp(`^(?:\\S+[ \\t]+)??(${WORD_ALT})\\b`, "di");
/** Rule 7's forms, in tie-break order. */
const WORD_FORMS = [UPPER_WORD, BRACKETED_WORD, COLON_WORD, LEADING_WORD];

const KLOG_LEVELS: Readonly<Record<string, LogLevel>> = {
  I: "info",
  W: "warn",
  E: "error",
  F: "fatal",
};

const LOGCAT_LEVELS: Readonly<Record<string, LogLevel>> = {
  V: "trace",
  D: "debug",
  I: "info",
  W: "warn",
  E: "error",
  A: "fatal",
  F: "fatal",
};

function pinoLevel(n: number): LogLevel {
  if (n >= 60) return "fatal";
  if (n >= 50) return "error";
  if (n >= 40) return "warn";
  if (n >= 30) return "info";
  if (n >= 20) return "debug";
  return "trace";
}

function syslogLevel(severity: number): LogLevel {
  if (severity <= 2) return "fatal";
  if (severity === 3) return "error";
  if (severity === 4) return "warn";
  if (severity <= 6) return "info";
  return "debug";
}

interface Found {
  level: LogLevel;
  from: number;
  to: number;
}

/**
 * `m[group]`'s level and offsets, or null when the group is not set, is not
 * in `toLevel`, or runs into the end of a window cut from a longer line: it
 * may be the head of a longer word ("ERRORS") or number.
 */
function found(
  m: RegExpExecArray | null,
  group: number,
  toLevel: (value: string) => LogLevel | undefined,
  window: string,
  cut: boolean,
): Found | null {
  const value = m?.[group];
  if (value === undefined) return null;
  const level = toLevel(value);
  const span = m?.indices?.[group];
  if (!level || !span) return null;
  const [from, to] = span;
  if (cut && to === window.length) return null;
  return { level, from, to };
}

const wordLevel = (value: string) => WORDS.get(value.toLowerCase());
const pinoValue = (value: string) => pinoLevel(Number(value));

/** The first key whose value is a level word, or for JSON a number. */
function keyed(re: RegExp, window: string, cut: boolean): Found | null {
  re.lastIndex = 0;
  for (let m = re.exec(window); m; m = re.exec(window)) {
    const hit =
      found(m, 1, wordLevel, window, cut) ??
      found(m, 2, re === JSON_LEVEL ? pinoValue : wordLevel, window, cut);
    if (hit) return hit;
  }
  return null;
}

/** The default detector. Pure; reads at most the first 256 UTF-16 units. */
export function detectLevel(text: string): LevelMatch | null {
  const window = text.slice(0, LEVEL_WINDOW);
  const cut = text.length > LEVEL_WINDOW;

  if (window.startsWith("{")) {
    const hit = keyed(JSON_LEVEL, window, cut);
    if (hit) return hit;
  }

  const logfmt = keyed(LOGFMT_LEVEL, window, cut);
  if (logfmt) return logfmt;

  let m = SYSLOG.exec(window);
  if (m) {
    const pri = Number(m[1]);
    if (pri <= 191) {
      return { level: syslogLevel(pri % 8), from: 0, to: m[0].length };
    }
  }

  m = KLOG.exec(window);
  if (m) return { level: KLOG_LEVELS[m[1]], from: 0, to: 1 };

  m = LOGCAT_BRIEF.exec(window);
  if (m) return { level: LOGCAT_LEVELS[m[1]], from: 0, to: 1 };
  const threadtime = found(
    LOGCAT_THREADTIME.exec(window),
    1,
    (letter) => LOGCAT_LEVELS[letter],
    window,
    false,
  );
  if (threadtime) return threadtime;

  if (TRACEBACK.test(window)) return { level: "error", from: 0, to: 9 };

  let best: Found | null = null;
  for (const re of WORD_FORMS) {
    const m = re.exec(window);
    // Only BRACKETED_WORD has groups 2 and 3; elsewhere they read as unset.
    const hit =
      found(m, 1, wordLevel, window, cut) ??
      found(m, 2, wordLevel, window, cut) ??
      found(m, 3, wordLevel, window, cut);
    // Strictly earlier, so that an equal offset keeps the form listed first.
    if (hit && (!best || hit.from < best.from)) best = hit;
  }
  return best;
}
