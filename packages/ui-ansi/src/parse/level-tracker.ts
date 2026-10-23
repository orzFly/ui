import {
  detectLevel,
  LEVEL_INHERITED,
  type LevelDetector,
  type LevelMatch,
  type LogLevel,
  levelCode,
} from "./levels.ts";
import type { AnsiLine } from "./types.ts";

export type LevelCounts = Readonly<Record<LogLevel | "other", number>>;

export interface LevelTracker {
  /** Classifies `lines[from…to)`; `from` must be where the last call stopped. */
  push(
    lines: readonly Pick<AnsiLine, "text">[],
    from: number,
    to: number,
  ): void;
  /** One code per line: 0 none, 1–6 `LEVELS`, `| LEVEL_INHERITED` inherited. */
  readonly levels: Uint8Array;
  readonly count: number;
  /** An inherited line counts under its level. */
  readonly counts: LevelCounts;
}

const CONTINUATION =
  /^(?:[ \t]+\S|Caused by:|Suppressed:|\.\.\. \d+ more|[\w$]+(?:\.[\w$]+)*(?:Exception|Error|Throwable)(?::|\s|$))/;

const COUNT_KEYS = [
  "other",
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

class Tracker implements LevelTracker {
  private buffer = new Uint8Array(1024);
  private view = this.buffer.subarray(0, 0);
  private tally = new Uint32Array(COUNT_KEYS.length);
  private snapshot: LevelCounts = countsOf(this.tally);
  private reported = false;

  private readonly detect: LevelDetector;

  constructor(detect: LevelDetector) {
    this.detect = detect;
  }

  get levels(): Uint8Array {
    return this.view;
  }

  get count(): number {
    return this.view.length;
  }

  get counts(): LevelCounts {
    return this.snapshot;
  }

  push(
    lines: readonly Pick<AnsiLine, "text">[],
    from: number,
    to: number,
  ): void {
    const count = this.view.length;
    if (from !== count) {
      throw new RangeError(
        `LevelTracker: push from ${from}, but ${count} lines are classified`,
      );
    }
    if (to <= from) return;
    if (to > this.buffer.length) {
      let size = this.buffer.length * 2;
      while (size < to) size *= 2;
      const grown = new Uint8Array(size);
      grown.set(this.view);
      this.buffer = grown;
    }
    const buffer = this.buffer;
    let prev = count > 0 ? buffer[count - 1] : 0;
    for (let i = from; i < to; i++) {
      const text = lines[i].text;
      const match = this.classify(text);
      // levelCode gives 0 for a level a custom detector made up.
      let code = match ? levelCode(match.level) : 0;
      if (code === 0 && prev !== 0 && CONTINUATION.test(text)) {
        code = prev | LEVEL_INHERITED;
      }
      buffer[i] = code;
      this.tally[code & ~LEVEL_INHERITED]++;
      prev = code;
    }
    this.view = buffer.subarray(0, to);
    // A new object per push, so that a store publishing it sees a change.
    this.snapshot = countsOf(this.tally);
  }

  private classify(text: string): LevelMatch | null {
    try {
      return this.detect(text);
    } catch (error) {
      if (!this.reported) {
        this.reported = true;
        console.error("LevelTracker: the level detector threw", error);
      }
      return null;
    }
  }
}

function countsOf(tally: Uint32Array): LevelCounts {
  const counts = {} as Record<LogLevel | "other", number>;
  COUNT_KEYS.forEach((key, code) => {
    counts[key] = tally[code];
  });
  return counts;
}

export function createLevelTracker(
  detect: LevelDetector = detectLevel,
): LevelTracker {
  return new Tracker(detect);
}
