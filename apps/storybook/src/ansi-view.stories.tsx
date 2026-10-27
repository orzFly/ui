import { largeLog, link } from "@orz/fixtures/logs.ts";
import { AnsiView, type LevelMatch, type LogLevel } from "@orz/ui-ansi";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { withWidth } from "./decorators.tsx";

const E = "\x1b[";

function hue(i: number, n: number): string {
  const h = (i / n) * 6;
  const f = (k: number) =>
    Math.round(255 * Math.max(0, Math.min(1, Math.abs(((h + k) % 6) - 3) - 1)));
  return `${E}48:2::${f(0)}:${f(4)}:${f(2)}m `;
}

const SAMPLE = [
  `${E}1m$ pnpm build${E}0m`,
  `${E}2m> tsc -p tsconfig.build.json${E}22m`,
  `docs: ${link("https://example.com/docs", "https://example.com/docs")}`,
  `[${E}32m#####${E}0m               ]  25%\r[${E}32m##########${E}0m          ]  50%\r[${E}32m####################${E}0m] 100% ${E}1;32mdone${E}0m`,
  `${E}33mwarning${E}0m: unused import ${E}1m'useMemo'${E}22m in ${E}4msrc/app.tsx${E}24m`,
  `${E}31;1merror${E}0m${E}1m TS2322:${E}0m Type 'string' is not assignable to type 'number'.`,
  `${E}4:3m${E}58;5;9mcurly underline${E}59;24m, ${E}9mstrike${E}29m, ${E}3mitalic${E}23m, ${E}7m inverse ${E}27m, ${E}53moverline${E}55m`,
  `16: ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `${E}4${i}m  `).join("")}${E}0m ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `${E}10${i}m  `).join("")}${E}0m`,
  `256: ${Array.from({ length: 36 }, (_, i) => `${E}48;5;${16 + i * 6}m `).join("")}${E}0m${Array.from({ length: 24 }, (_, i) => `${E}48;5;${232 + i}m `).join("")}${E}0m`,
  `24-bit: ${Array.from({ length: 48 }, (_, i) => hue(i, 48)).join("")}${E}0m`,
  `${E}90m  at render (src/app.tsx:12:7)${E}0m`,
  `Tests: ${E}32m41 passed${E}0m, ${E}31m1 failed${E}0m, 42 total`,
  `this text is erased${E}2K\rtext written after an erase-line`,
  `${E}1;36mInfo${E}0m bold cyan, ${E}1;34mbold blue${E}0m (the bold-is-bright toggle changes these)`,
].join("\n");

const LOG_SAMPLE = [
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

const DETECTOR_SOURCE = `import { AnsiView, type LevelDetector, type LogLevel } from "@orz/ui-ansi";

const LVL: readonly LogLevel[] = ["fatal", "error", "warn", "info", "debug", "trace"];

// Reads an app's own \`lvl:<0–5>\` prefix, 0 being fatal.
const lvlPrefix: LevelDetector = (text) => {
  const m = /^lvl:([0-5])\\b/.exec(text);
  if (!m) return null;
  return { level: LVL[Number(m[1])], from: 0, to: m[0].length };
};

<AnsiView text={log} chrome="file" filename="sync.log" levels={lvlPrefix} />`;

const LARGE = largeLog(200_000);

/**
 * Text with ANSI escapes drawn in the toolbar's terminal colours: palette 0–15 follow the theme,
 * 256-colour and 24-bit stay absolute. `levels` detects each line's log level, colours rows by it
 * and, in file chrome, filters by level and searches.
 */
const meta = {
  title: "ui-ansi/AnsiView",
  component: AnsiView,
  args: { text: SAMPLE, chrome: "pane" },
  decorators: [withWidth("max-w-4xl")],
} satisfies Meta<typeof AnsiView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The terminal pane a fence draws: no header, Copy and Wrap on hover or focus. */
export const Playground: Story = {};

/** The chrome an `.ansi` attachment draws: filename, line count, line numbers and Download. */
export const File: Story = {
  args: { chrome: "file", filename: "build.log", downloadUrl: "#" },
};

/** A `.log` attachment: every shape the default detector reads, a Java trace and a Python one. */
export const Levels: Story = {
  args: {
    text: LOG_SAMPLE,
    chrome: "file",
    levels: true,
    filename: "server.log",
    downloadUrl: "#",
  },
};

/** A detector function in place of the default, for logs with their own shape. */
export const CustomDetector: Story = {
  args: {
    text: CUSTOM,
    chrome: "file",
    filename: "sync.log",
    levels: lvlPrefix,
  },
  parameters: { docs: { source: { code: DETECTOR_SOURCE, language: "tsx" } } },
};

/** Bold text in palette colours 0–7 drawn in 8–15, as many terminals do. */
export const BoldIsBright: Story = {
  args: { boldIsBright: true },
};

/**
 * 200,000 generated lines in every detected format, with traces, `\r` progress bars, OSC 8 links
 * and a few `needle` lines: only the rows in view are mounted.
 */
export const LargeLog: Story = {
  tags: ["edge", "!autodocs"],
  args: {
    text: LARGE,
    chrome: "file",
    levels: true,
    filename: "app.log",
    downloadUrl: "#",
    maxHeight: "32rem",
  },
  argTypes: { text: { control: false } },
};
