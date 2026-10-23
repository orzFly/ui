import { AnsiView, type LevelMatch, type LogLevel } from "@orz/ui-ansi";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { largeLog } from "./fixtures/logs.ts";

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
