import type { LogLevel } from "../../src/parse/index.ts";

const E = "\x1b[";

/**
 * The UI-49 mockup's sample, with the level each line ends up with: its own,
 * `^level` for one inherited from the line above, or null for Other.
 */
export const LOG_SAMPLE: readonly [string, LogLevel | `^${LogLevel}` | null][] =
  [
    [
      "2026-10-23 09:14:02.118 INFO  [main] c.e.app.Server - Starting server on port 8080",
      "info",
    ],
    [
      "2026-10-23 09:14:02.240 DEBUG [main] c.e.app.Config - loaded 42 keys from config.yaml",
      "debug",
    ],
    [
      "2026-10-23 09:14:02.512 INFO  [main] c.e.app.Server - Listening on http://app.example:8080",
      "info",
    ],
    [
      "2026-10-23 09:14:03.007 WARN  [pool-1] c.e.db.Pool - connection slow: 812 ms to db.example",
      "warn",
    ],
    [
      "2026-10-23 09:14:03.990 TRACE [pool-1] c.e.db.Pool - acquire #17 -> conn-3",
      "trace",
    ],
    [
      "2026-10-23 09:14:04.101 ERROR [req-81] c.e.api.Handler - request failed: GET /api/items/7",
      "error",
    ],
    ["java.lang.IllegalStateException: item 7 has no owner", "^error"],
    ["\tat com.example.api.Handler.load(Handler.java:88)", "^error"],
    ["\tat com.example.api.Handler.handle(Handler.java:41)", "^error"],
    ["\t... 23 more", "^error"],
    [
      "Caused by: java.sql.SQLException: timeout after 5000 ms in pool",
      "^error",
    ],
    ["\tat com.example.db.Pool.acquire(Pool.java:120)", "^error"],
    [
      'level=info ts=2026-10-23T09:14:05Z msg="cache warmed" entries=1200',
      "info",
    ],
    [
      'level=warn ts=2026-10-23T09:14:06Z msg="retrying upload" attempt=2',
      "warn",
    ],
    [
      '{"level":"error","time":"2026-10-23T09:14:07Z","msg":"upload failed","err":"EOF"}',
      "error",
    ],
    [
      '{"level":30,"time":1761210848000,"msg":"worker pool started","pid":4121}',
      "info",
    ],
    [
      "[2026-10-23T09:14:09Z WARN  app::sync] queue depth 512 exceeds soft limit",
      "warn",
    ],
    ["<3>Oct 23 09:14:10 host-one kernel: disk I/O error on sdb", "error"],
    [
      "E1023 09:14:11.000123    4121 controller.go:212] reconcile failed: not found",
      "error",
    ],
    [
      "npm warn deprecated inflight@1.0.6: This module is not supported",
      "warn",
    ],
    [
      `${E}1m${E}33mwarning${E}0m${E}1m: unused variable: \`pool\`${E}0m`,
      "warn",
    ],
    ["Traceback (most recent call last):", "error"],
    ['  File "worker.py", line 12, in <module>', "^error"],
    ["ValueError: no errors expected here", "^error"],
    ["Done in 3.2s.", null],
    [
      "2026-10-23 09:14:12.310 FATAL [main] c.e.app.Server - out of memory, shutting down",
      "fatal",
    ],
  ];
