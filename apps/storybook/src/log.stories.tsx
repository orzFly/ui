import { AnsiView, type LevelMatch, type LogLevel } from "@orz/ui-ansi";
import type { Meta, StoryObj } from "@storybook/react-vite";

const E = "\x1b[";

const SAMPLE = [
  "2026-10-23 09:14:02.118 INFO  [main] c.e.app.Server - Starting server on port 8080",
  "2026-10-23 09:14:02.240 DEBUG [main] c.e.app.Config - loaded 42 keys from config.yaml",
  "2026-10-23 09:14:02.512 INFO  [main] c.e.app.Server - Listening on http://app.example:8080",
  "2026-10-23 09:14:03.007 WARN  [pool-1] c.e.db.Pool - connection slow: 812 ms to db.example",
  "2026-10-23 09:14:03.990 TRACE [pool-1] c.e.db.Pool - acquire #17 -> conn-3",
  "2026-10-23 09:14:04.101 ERROR [req-81] c.e.api.Handler - request failed: GET /api/items/7",
  "java.lang.IllegalStateException: item 7 has no owner",
  "\tat com.example.api.Handler.load(Handler.java:88)",
  "\tat com.example.api.Handler.handle(Handler.java:41)",
  "\t... 23 more",
  "Caused by: java.sql.SQLException: timeout after 5000 ms in pool",
  "\tat com.example.db.Pool.acquire(Pool.java:120)",
  'level=info ts=2026-10-23T09:14:05Z msg="cache warmed" entries=1200',
  'level=warn ts=2026-10-23T09:14:06Z msg="retrying upload" attempt=2',
  '{"level":"error","time":"2026-10-23T09:14:07Z","msg":"upload failed","err":"EOF"}',
  '{"level":30,"time":1761210848000,"msg":"worker pool started","pid":4121}',
  "[2026-10-23T09:14:09Z WARN  app::sync] queue depth 512 exceeds soft limit",
  "<3>Oct 23 09:14:10 host-one kernel: disk I/O error on sdb",
  "E1023 09:14:11.000123    4121 controller.go:212] reconcile failed: not found",
  "npm warn deprecated inflight@1.0.6: This module is not supported",
  `${E}1m${E}33mwarning${E}0m${E}1m: unused variable: \`pool\`${E}0m`,
  "Traceback (most recent call last):",
  '  File "worker.py", line 12, in <module>',
  "ValueError: no errors expected here",
  "Done in 3.2s.",
  "2026-10-23 09:14:12.310 FATAL [main] c.e.app.Server - out of memory, shutting down",
].join("\n");

// A fixed seed, so every load of the story draws the same log.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS =
  "fetch resolve module chunk worker cache build emit bundle asset graph queue upload retry 依赖 构建 缓存 タスク".split(
    " ",
  );

// Weighted towards info and debug, as real logs are.
const LEVEL_MIX: readonly LogLevel[] = [
  "info",
  "info",
  "info",
  "info",
  "debug",
  "debug",
  "trace",
  "warn",
  "error",
];

const UPPER: Record<LogLevel, string> = {
  fatal: "FATAL",
  error: "ERROR",
  warn: "WARN ",
  info: "INFO ",
  debug: "DEBUG",
  trace: "TRACE",
};
const PINO: Record<LogLevel, number> = {
  fatal: 60,
  error: 50,
  warn: 40,
  info: 30,
  debug: 20,
  trace: 10,
};
const SYSLOG: Record<LogLevel, number> = {
  fatal: 2,
  error: 3,
  warn: 4,
  info: 6,
  debug: 7,
  trace: 7,
};
const KLOG: Record<LogLevel, string> = {
  fatal: "F",
  error: "E",
  warn: "W",
  info: "I",
  debug: "I",
  trace: "I",
};
const LOGCAT: Record<LogLevel, string> = {
  fatal: "F",
  error: "E",
  warn: "W",
  info: "I",
  debug: "D",
  trace: "V",
};
const ANSI_COLOUR: Record<LogLevel, string> = {
  fatal: "1;91",
  error: "1;31",
  warn: "33",
  info: "32",
  debug: "34",
  trace: "90",
};

function largeLog(count: number): string {
  const random = mulberry32(49);
  const pick = <T,>(items: readonly T[]) =>
    items[Math.floor(random() * items.length)];
  const message = () =>
    Array.from({ length: 3 + Math.floor(random() * 12) }, () =>
      pick(WORDS),
    ).join(" ");
  // Spread over the log, so stepping through them scrolls a long way.
  const needles = new Set([
    1_234, 31_337, 64_000, 99_999, 137_500, 163_210, 188_888, 199_000,
  ]);
  const out: string[] = [];
  let ms = 0;
  while (out.length < count) {
    const i = out.length;
    ms += Math.floor(random() * 40);
    const date = new Date(Date.UTC(2026, 9, 23, 9) + ms);
    const iso = date.toISOString();
    const clock = iso.slice(11, 23);
    const level = random() < 0.003 ? "fatal" : pick(LEVEL_MIX);
    const text = needles.has(i)
      ? `${message()} needle in line ${i + 1}`
      : message();
    if (random() < 0.01) {
      out.push(
        `${E}90m${clock}${E}0m ${E}${ANSI_COLOUR[level]}m${UPPER[level]}${E}0m ${text}`,
      );
      continue;
    }
    switch (Math.floor(random() * 12)) {
      case 0:
        out.push(
          `{"level":"${level}","time":"${iso}","msg":"${text}","host":"host-one"}`,
        );
        break;
      case 1:
        out.push(
          `{"level":${PINO[level]},"time":${date.getTime()},"msg":"${text}","pid":4121}`,
        );
        break;
      case 2:
        out.push(`level=${level} ts=${iso} msg="${text}" attempt=1`);
        break;
      case 3:
        out.push(
          `<${8 + SYSLOG[level]}>Oct 23 ${clock.slice(0, 8)} host-one app[4121]: ${text}`,
        );
        break;
      case 4:
        out.push(
          `${KLOG[level]}1023 ${clock}000    4121 controller.go:${100 + (i % 300)}] ${text}`,
        );
        break;
      case 5:
        out.push(
          random() < 0.5
            ? `${LOGCAT[level]}/Worker( 4121): ${text}`
            : `10-23 ${clock}  4121  4133 ${LOGCAT[level]} Worker: ${text}`,
        );
        break;
      case 6:
        out.push(`[${iso} ${UPPER[level]} app::sync] ${text}`);
        break;
      case 7:
        out.push(random() < 0.5 ? `${level}: ${text}` : `npm ${level} ${text}`);
        break;
      default:
        out.push(
          `2026-10-23 ${clock} ${UPPER[level]} [pool-${i % 8}] c.e.app.Worker - ${text}`,
        );
    }
    if (level === "error" && random() < 0.15) {
      if (random() < 0.5) {
        out.push(
          "java.lang.IllegalStateException: worker has no owner",
          "\tat com.example.app.Worker.run(Worker.java:88)",
          "\tat java.base/java.lang.Thread.run(Thread.java:1583)",
          "\t... 12 more",
          "Caused by: java.sql.SQLException: timeout after 5000 ms in pool",
          "\tat com.example.db.Pool.acquire(Pool.java:120)",
        );
      } else {
        out.push(
          "Traceback (most recent call last):",
          '  File "worker.py", line 12, in <module>',
          "    run(queue)",
          '  File "worker.py", line 40, in run',
          "    raise ValueError(job)",
          "ValueError: job has no owner",
        );
      }
    }
    if (random() < 0.002) out.push("", "Done in 3.2s.");
  }
  out.length = count;
  return out.join("\n");
}

const LARGE = largeLog(200_000);

const LVL: readonly LogLevel[] = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
];

/** Reads an app's own `lvl:<0–5>` prefix, 0 being fatal. */
function lvlPrefix(text: string): LevelMatch | null {
  const m = /^lvl:([0-5])\b/.exec(text);
  if (!m) return null;
  return { level: LVL[Number(m[1])], from: 0, to: m[0].length };
}

const CUSTOM = [
  "lvl:3 sync started",
  "lvl:4 cursor at 1200",
  "lvl:2 remote is 3 commits ahead",
  "lvl:1 push rejected: non-fast-forward",
  "  hint: fetch first",
  "lvl:3 retrying in 5 s",
  "lvl:5 tick",
  "lvl:0 store is corrupt, giving up",
  "sync stopped",
].join("\n");

/**
 * `AnsiView` with `levels`: each line's log level is detected, rows are coloured by it, and in
 * file chrome the toolbar filters by level and searches every line.
 */
const meta = {
  title: "ui-ansi/Log",
  component: AnsiView,
  args: { text: SAMPLE, chrome: "file", levels: true },
  decorators: [
    (Story) => (
      <div className="max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AnsiView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A `.log` attachment: every shape the default detector reads, a Java trace and a Python one. */
export const File: Story = {
  args: { filename: "server.log", downloadUrl: "#" },
};

/** 200,000 generated lines in every detected format, with traces and a few `needle` lines. */
export const LargeLog: Story = {
  name: "Large log",
  args: {
    text: LARGE,
    filename: "app.log",
    downloadUrl: "#",
    maxHeight: "32rem",
  },
};

/** A detector function in place of the default, for logs with their own shape. */
export const CustomDetector: Story = {
  name: "Custom detector",
  args: { text: CUSTOM, filename: "sync.log", levels: lvlPrefix },
};
