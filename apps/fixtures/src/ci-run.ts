import { link } from "./logs.ts";

const E = "\x1b[";
const DIM = `${E}2m`;
const RESET = `${E}0m`;
const GREEN = `${E}32m`;
const RED = `${E}31m`;
const YELLOW = `${E}33m`;
const CYAN = `${E}36m`;
const BOLD = `${E}1m`;

export type JobStatus = "passed" | "failed";

export interface CiJob {
  id: string;
  name: string;
  status: JobStatus;
  /** Seconds. */
  duration: number;
  /** The job's output, ANSI escapes and all, as the runner streamed it. */
  log: string;
}

/** Each line stamped as a runner stamps it, from 09:14:02 on. */
function stamped(start: number, lines: readonly [number, string][]): string {
  return lines
    .map(([offset, text]) => {
      const at = new Date(Date.UTC(2026, 9, 21, 9, 14, 2) + (start + offset));
      return `${DIM}${at.toISOString().slice(11, 23)}${RESET} ${text}`;
    })
    .join("\n");
}

const SETUP: [number, string][] = [
  [0, `${CYAN}INFO${RESET} runner bot-one picked up the job`],
  [41, `${CYAN}INFO${RESET} checkout 7e6f5d4 (retry-once)`],
  [880, `${CYAN}INFO${RESET} node 22.20.0, pnpm 10.28.0`],
  [1_204, "$ pnpm install --frozen-lockfile"],
  [1_610, "Lockfile is up to date, resolution step is skipped"],
  [1_702, `Packages: ${GREEN}+412${RESET}`],
  [
    3_480,
    `Progress: resolved 412, reused 412, downloaded 0, added 412, ${BOLD}done${RESET}`,
  ],
  [3_502, `${DIM}Done in 2.3s${RESET}`],
];

const LINT = stamped(0, [
  ...SETUP,
  [3_900, "$ pnpm lint"],
  [4_310, "Checked 214 files in 388ms. No fixes applied."],
  [4_330, `${CYAN}INFO${RESET} job finished: ${GREEN}passed${RESET}`],
]);

const BUILD = stamped(220, [
  ...SETUP,
  [3_910, "$ pnpm build"],
  [4_120, `${DIM}> tsc -p tsconfig.build.json${RESET}`],
  [
    9_840,
    `${YELLOW}WARN${RESET} src/fetch-task.ts: \`isDone\` is exported but never imported`,
  ],
  [11_200, `dist/ ${DIM}38 files, 61.4 kB${RESET}`],
  [11_230, `${CYAN}INFO${RESET} job finished: ${GREEN}passed${RESET}`],
]);

// What `pnpm test` printed, from the command on: the test log and the recording both replay it.
const PNPM_TEST: [number, string][] = [
  [3_920, "$ pnpm test"],
  [4_300, ""],
  [
    4_310,
    ` ${BOLD}${E}46;30m RUN ${RESET} ${CYAN}v5.0.5${RESET} ${DIM}~/project${RESET}`,
  ],
  [4_320, ""],
  [
    4_660,
    ` ${GREEN}✓${RESET} test/retry.test.ts ${DIM}(4 tests)${RESET} ${YELLOW}512ms${RESET}`,
  ],
  [
    5_010,
    ` ${GREEN}✓${RESET} test/fetch-task.test.ts ${DIM}(9 tests)${RESET} ${YELLOW}61ms${RESET}`,
  ],
  [
    5_330,
    ` ${GREEN}✓${RESET} test/is-done.test.ts ${DIM}(3 tests)${RESET} ${YELLOW}4ms${RESET}`,
  ],
  [
    5_870,
    ` ${RED}×${RESET} test/flaky.test.ts ${DIM}(1 test | ${RED}1 failed${RESET}${DIM})${RESET}`,
  ],
  [
    5_880,
    `   ${RED}→ expected ${GREEN}'ok'${RED} to be ${GREEN}'done'${RESET}`,
  ],
  [5_890, ""],
  [
    5_900,
    ` ${E}41;97m FAIL ${RESET} test/flaky.test.ts > fetchTask > settles a task`,
  ],
  [5_901, `${RED}AssertionError: expected 'ok' to be 'done'${RESET}`],
  [5_902, ""],
  [5_903, `${GREEN}- Expected${RESET}`],
  [5_904, `${RED}+ Received${RESET}`],
  [5_905, ""],
  [5_906, `${GREEN}- done${RESET}`],
  [5_907, `${RED}+ ok${RESET}`],
  [5_908, ""],
  [5_909, ` ${CYAN}❯${RESET} test/flaky.test.ts:14:31`],
  [5_910, `     12|   const task = await fetchTask("t-1");`],
  [
    5_911,
    `     13|   // The stub answers "ok" until the retry's pause has passed.`,
  ],
  [5_912, `     14|   expect(task.title).toBe("done");`],
  [5_913, `       |                               ${RED}^${RESET}`],
  [5_914, ""],
  [
    5_920,
    `${YELLOW}WARN${RESET} 1 test depends on timing; see ${link("https://example.com/docs/flaky-tests", "example.com/docs/flaky-tests")}`,
  ],
  [5_930, ""],
  [
    5_931,
    `${DIM} Test Files ${RESET} ${BOLD}${RED}1 failed${RESET}${DIM} | ${RESET}${BOLD}${GREEN}3 passed${RESET} ${DIM}(4)${RESET}`,
  ],
  [
    5_932,
    `${DIM}      Tests ${RESET} ${BOLD}${RED}1 failed${RESET}${DIM} | ${RESET}${BOLD}${GREEN}16 passed${RESET} ${DIM}(17)${RESET}`,
  ],
  [5_933, `${DIM}   Duration ${RESET} 2.01s`],
];

const TEST = stamped(410, [
  ...SETUP,
  ...PNPM_TEST,
  [5_940, ""],
  [5_950, `${RED}${BOLD}ERROR${RESET} pnpm test exited with code 1`],
  [6_020, `${CYAN}INFO${RESET} uploading 3 artifacts`],
  [6_480, `${CYAN}INFO${RESET} job finished: ${RED}failed${RESET}`],
]);

/**
 * An asciicast v2 of `lines` typed and printed at a shell prompt: the first line is the command,
 * typed a key at a time, and each line after it prints at its offset.
 */
function castOf(title: string, lines: readonly [number, string][]): string {
  const [[start, command] = [0, "$ "], ...output] = lines;
  const prompt = `${GREEN}user@ci${RESET}:${E}34m~/project${RESET}$ `;
  const events: [number, "o", string][] = [[0.2, "o", prompt]];
  let t = 0.6;
  for (const key of command.replace(/^\$ /, "")) {
    events.push([t, "o", key]);
    t += 0.08;
  }
  events.push([t + 0.3, "o", "\r\n"]);
  const typed = t + 0.3;
  for (const [offset, text] of output) {
    events.push([typed + (offset - start) / 1000, "o", `${text}\r\n`]);
  }
  events.push([(events.at(-1)?.[0] ?? typed) + 0.4, "o", prompt]);
  const header = {
    version: 2,
    width: 88,
    height: 24,
    timestamp: Date.UTC(2026, 9, 21, 9, 14, 6) / 1000,
    title,
    env: { SHELL: "/bin/bash", TERM: "xterm-256color" },
  };
  return `${[header, ...events.map(([at, kind, data]) => [Math.round(at * 1000) / 1000, kind, data])].map((line) => JSON.stringify(line)).join("\n")}\n`;
}

/** A CI run over `patch/series.patch` whose test job fails. */
export const CI_RUN = {
  id: 1284,
  workflow: "CI",
  title: "feat: retry a failed fetch once before giving up",
  branch: "retry-once",
  commit: "7e6f5d4",
  author: "alice",
  startedAt: "2026-10-21T09:14:02Z",
  /** Seconds. */
  duration: 12,
  status: "failed" as JobStatus,
  jobs: [
    { id: "lint", name: "Lint", status: "passed", duration: 5, log: LINT },
    { id: "build", name: "Build", status: "passed", duration: 11, log: BUILD },
    { id: "test", name: "Test", status: "failed", duration: 7, log: TEST },
  ] satisfies CiJob[],
  /** The test job's `pnpm test` as a terminal recording. */
  cast: castOf("Test: pnpm test", PNPM_TEST),
};
