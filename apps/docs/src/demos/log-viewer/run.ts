import { CI_RUN, type CiJob } from "@orz/fixtures/ci-run.ts";
import { binary, textFile } from "@orz/fixtures/files.ts";
import { syntheticBytes } from "@orz/fixtures/hex.ts";
import seriesText from "@orz/fixtures/patch/series.patch?raw";
import type { AttachmentItem } from "@orz/ui-content/attachment";

export { CI_RUN, type CiJob };

export interface RunFiles {
  logs: Record<string, AttachmentItem>;
  patch: AttachmentItem;
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
  const patch = item(textFile("series.patch", "text/x-patch", seriesText), 0);
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
    patch,
    cast,
    artifacts: [logs.test, cast, cache].filter(
      (artifact): artifact is AttachmentItem => artifact !== undefined,
    ),
  };
  return files;
}
