import { CI_RUN, type CiJob } from "@orz/fixtures/ci-run.ts";
import { binary, textFile } from "@orz/fixtures/files.ts";
import { syntheticBytes } from "@orz/fixtures/hex.ts";
import seriesText from "@orz/fixtures/patch/series.patch?raw";
import {
  PULL_REQUEST,
  PULL_REQUEST_ME,
  type PullRequestEvent,
} from "@orz/fixtures/pull-request.ts";
import type { AttachmentItem } from "@orz/ui-content/attachment";

export {
  CI_RUN,
  type CiJob,
  PULL_REQUEST,
  PULL_REQUEST_ME,
  type PullRequestEvent,
};

export interface Commit {
  /** Seven characters, as a forge shows it. */
  hash: string;
  subject: string;
  author: string;
  /** ISO 8601, UTC. */
  at: string;
  /** The commit's own `git format-patch` mail. */
  patch: string;
}

/** The pull request's commits, oldest first, cut out of the series one mail each. */
export const COMMITS: Commit[] = seriesText
  .split(/^(?=From [0-9a-f]{40} )/m)
  .filter((mail) => mail.trim() !== "")
  .map((mail) => {
    const header = (name: string) =>
      new RegExp(`^${name}: (.*)$`, "m").exec(mail)?.[1] ?? "";
    return {
      hash: mail.slice(5, 12),
      subject: header("Subject").replace(/^\[PATCH[^\]]*\]\s*/, ""),
      author: header("From").replace(/\s*<[^>]*>$/, ""),
      at: new Date(header("Date")).toISOString(),
      patch: mail,
    };
  });

/**
 * What the pull request changes as one diff, as a forge shows it: each mail's file diffs with
 * the mail around them dropped. The commits touch different files, so nothing needs merging.
 */
const DIFF = COMMITS.map(({ patch }) =>
  patch.slice(patch.indexOf("diff --git"), patch.lastIndexOf("\n-- \n") + 1),
).join("");

/** What the pull request changes: its files and its added and removed lines. */
export const STATS = (() => {
  const files = new Set<string>();
  let plus = 0;
  let minus = 0;
  for (const line of DIFF.split("\n")) {
    const file = /^diff --git a\/\S+ b\/(\S+)/.exec(line)?.[1];
    if (file) files.add(file);
    else if (line.startsWith("+") && !line.startsWith("+++")) plus++;
    else if (line.startsWith("-") && !line.startsWith("---")) minus++;
  }
  return { files: files.size, plus, minus };
})();

export interface RunFiles {
  logs: Record<string, AttachmentItem>;
  /** Every change in the pull request, as one diff. */
  diff: AttachmentItem;
  /** Each commit's mail alone, by its hash. */
  commits: Record<string, AttachmentItem>;
  cast: AttachmentItem;
  artifacts: AttachmentItem[];
}

let files: RunFiles | undefined;

/**
 * The run's files as an app would hand them to `Content`: a name and a type that pick the
 * renderer, a size, and a blob URL to download. Made on first use, in the browser: the prerender
 * has no use for blob URLs, and a tab switch should not mint new ones.
 */
export function runFiles(): RunFiles {
  if (files) return files;
  const at = (seconds: number) =>
    new Date(Date.parse(CI_RUN.startedAt) + seconds * 1000).toISOString();
  const item = (
    file: ReturnType<typeof textFile>,
    seconds: number,
  ): AttachmentItem => ({ ...file, key: file.name, createdAt: at(seconds) });
  const logs = Object.fromEntries(
    CI_RUN.jobs.map((job) => [
      job.id,
      item(textFile(`${job.id}.log`, "text/x-log", job.log), job.duration),
    ]),
  );
  const diff = item(
    textFile(`pull-${PULL_REQUEST.number}.diff`, "text/x-diff", DIFF),
    0,
  );
  const commits = Object.fromEntries(
    COMMITS.map((commit) => [
      commit.hash,
      item(textFile(`${commit.hash}.patch`, "text/x-patch", commit.patch), 0),
    ]),
  );
  const cast = item(
    textFile("test.cast", "application/x-asciicast", CI_RUN.cast),
    7,
  );
  const bytes = syntheticBytes(12 * 1024);
  const cache = item(
    binary(
      "test-cache.bin",
      "application/octet-stream",
      URL.createObjectURL(new Blob([bytes])),
      bytes.length,
    ),
    7,
  );
  files = {
    logs,
    diff,
    commits,
    cast,
    artifacts: [logs.test, cast, cache].filter(
      (artifact): artifact is AttachmentItem => artifact !== undefined,
    ),
  };
  return files;
}
