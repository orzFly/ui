import { textFile } from "@orz/fixtures/files.ts";
import seriesText from "@orz/fixtures/patch/series.patch?raw";
import { REPOSITORY_STATUS } from "@orz/fixtures/repository.ts";
import type { FileStatus } from "@orz/ui/lib/file-tree";
import type { FileSource } from "@orz/ui-content/attachment";

/** One file's part of the working tree's diff. */
export interface FileChange {
  path: string;
  status: FileStatus;
  /** From `diff --git` to the file's last line. */
  diff: string;
}

/**
 * Each file the series changes, cut out of its mails: the uncommitted work is the series as one
 * diff, and git reads each file's status off its header.
 */
export const CHANGES: ReadonlyMap<string, FileChange> = new Map(
  seriesText
    .split(/^(?=From [0-9a-f]{40} )/m)
    .flatMap((mail) => {
      const end = mail.lastIndexOf("\n-- \n");
      const start = mail.indexOf("diff --git");
      if (start === -1) return [];
      return mail
        .slice(start, end === -1 ? undefined : end + 1)
        .split(/^(?=diff --git )/m);
    })
    .map((diff): [string, FileChange] => {
      const path = /^diff --git a\/\S+ b\/(\S+)/.exec(diff)?.[1] ?? "";
      const status: FileStatus = /^new file mode/m.test(diff)
        ? "added"
        : /^deleted file mode/m.test(diff)
          ? "deleted"
          : /^rename from/m.test(diff)
            ? "renamed"
            : "modified";
      return [path, { path, status, diff }];
    }),
);

/** What git says of every path: the diff's statuses over the rest. */
export const STATUS: Readonly<Record<string, FileStatus>> = {
  ...REPOSITORY_STATUS,
  ...Object.fromEntries([...CHANGES.values()].map((c) => [c.path, c.status])),
};

const patches = new Map<string, FileSource>();

/** A file's change as a patch for `Content`, made once, in the browser. */
export function changeFile(path: string): FileSource | undefined {
  const change = CHANGES.get(path);
  if (!change) return undefined;
  let file = patches.get(path);
  if (!file) {
    const name = path.slice(path.lastIndexOf("/") + 1);
    file = textFile(`${name}.diff`, "text/x-diff", change.diff);
    patches.set(path, file);
  }
  return file;
}
