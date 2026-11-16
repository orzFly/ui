import type { FileStatus } from "@orz/ui/lib/file-tree";
import type { FileSource } from "@orz/ui-content/attachment";
import castText from "./asciinema/session.cast?raw";
import appendixText from "./attachment/appendix.md?raw";
import zipUrl from "./attachment/bundle.zip?url&no-inline";
import chapterText from "./attachment/chapter.md?raw";
import webmUrl from "./attachment/clip.webm?url&no-inline";
import htmlText from "./attachment/demo.html?raw";
import pngUrl from "./attachment/gradient.png?url&no-inline";
import guideText from "./attachment/guide.md?raw";
import svgText from "./attachment/logo.svg?raw";
import svgUrl from "./attachment/logo.svg?url&no-inline";
import pdfUrl from "./attachment/paper.pdf?url&no-inline";
import spriteUrl from "./attachment/sprite.png?url&no-inline";
import oggUrl from "./attachment/tone.ogg?url&no-inline";
import alertsText from "./config/alerts.json?raw";
import deployText from "./config/deploy.json?raw";
import flagsText from "./config/flags.json?raw";
import { binary, textFile } from "./files.ts";

/*
 * fetch-kit, a small made-up project, as its working tree stands: the commits of
 * patch/series.patch applied and not yet committed, a secret file nobody added, a build
 * folder git ignores, and a guide deleted from disk. The files the series touches hold its
 * new side, line for line, so the file view and the diff agree.
 */

const lines = (...text: string[]) => `${text.join("\n")}\n`;

const TEXT: Record<string, [mime: string, text: string]> = {
  ".github/workflows/ci.yml": [
    "application/yaml",
    lines(
      "name: ci",
      "on: [push, pull_request]",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - run: npm ci",
      "      - run: npm test",
    ),
  ],
  ".env.local": [
    "text/plain",
    lines("API_URL=https://app.example/api", "API_TOKEN=orz_pat_fallback"),
  ],
  ".gitignore": ["text/plain", lines("dist/", "*.log")],
  LICENSE: [
    "text/plain",
    lines(
      "BSD 3-Clause License",
      "",
      "Copyright (c) 2026, the fetch-kit authors",
      "",
      "Redistribution and use in source and binary forms, with or without",
      "modification, are permitted provided that the conditions in this",
      "file are met.",
    ),
  ],
  "README.md": [
    "text/markdown",
    lines(
      "# fetch-kit",
      "",
      "## fetchTask",
      "",
      "Loads one task by id.",
      "",
      "A network error is retried once, a quarter of a second later. A second",
      "failure, or any error status from the server, rejects with the status in",
      "the message.",
    ),
  ],
  "package.json": [
    "application/json",
    lines(
      "{",
      '  "name": "fetch-kit",',
      '  "version": "0.3.0",',
      '  "type": "module",',
      '  "scripts": {',
      '    "test": "node --test"',
      "  }",
      "}",
    ),
  ],
  "config/alerts.json": ["application/json", alertsText],
  "config/deploy.json": ["application/json", deployText],
  "config/flags.json": ["application/json", flagsText],
  "docs/appendix.md": ["text/markdown", appendixText],
  "docs/chapter.md": ["text/markdown", chapterText],
  "docs/guide.md": ["text/markdown", guideText],
  // A blob, as in files.ts: Vite's dev server answers an .html asset URL with a 404.
  "docs/demo.html": ["text/html", htmlText],
  "recordings/session.cast": ["application/x-asciicast", castText],
  "src/fetch-task.ts": [
    "application/octet-stream",
    lines(
      'import { retryOnce } from "./retry.ts";',
      "",
      "export type Task = { id: string; title: string; done: boolean };",
      "",
      "export async function fetchTask(id: string): Promise<Task> {",
      "  return retryOnce(async () => {",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own template literal
      "    const response = await fetch(`/api/tasks/${id}`);",
      "    if (!response.ok) {",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the file's own template literal
      "      throw new Error(`task ${id}: ${response.status}`);",
      "    }",
      "    return response.json();",
      "  });",
      "}",
      "",
      "export function isDone(task: Task): boolean {",
      "  return task.done;",
      "}",
    ),
  ],
  "src/retry.ts": [
    "application/octet-stream",
    lines(
      "const PAUSE_MS = 250;",
      "",
      "/** Runs `attempt`, and once more after a pause if it throws. */",
      "export async function retryOnce<T>(attempt: () => Promise<T>): Promise<T> {",
      "  try {",
      "    return await attempt();",
      "  } catch {",
      "    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));",
      "    return attempt();",
      "  }",
      "}",
    ),
  ],
};

const BINARY: Record<string, [mime: string, url: string, size: number]> = {
  "dist/bundle.zip": ["application/zip", zipUrl, 182],
  "docs/paper.pdf": ["application/pdf", pdfUrl, 689],
  "docs/assets/gradient.png": ["image/png", pngUrl, 1510],
  "docs/assets/sprite.png": ["image/png", spriteUrl, 232],
  "test/fixtures/media/clip.webm": ["video/webm", webmUrl, 10556],
  "test/fixtures/media/tone.ogg": ["audio/ogg", oggUrl, 4649],
};

/** Every path in the working tree, a deleted file's included; `scripts/` is an empty folder. */
export const REPOSITORY_PATHS: readonly string[] = [
  ...Object.keys(TEXT),
  ...Object.keys(BINARY),
  "docs/assets/logo.svg",
  "docs/old-guide.md",
  "scripts/",
].sort();

/** What git says of the paths outside the series' diff, which says the rest. */
export const REPOSITORY_STATUS: Readonly<Record<string, FileStatus>> = {
  ".env.local": "untracked",
  "dist/": "ignored",
  "docs/old-guide.md": "deleted",
};

let files: Map<string, FileSource> | undefined;

/**
 * The file at `path` as an app would hand it to `Content`, or undefined for a folder, a path
 * the tree lacks and a deleted file. Made on first use, in the browser: the prerender has no use
 * for blob URLs.
 */
export function repositoryFile(path: string): FileSource | undefined {
  if (!files) {
    const name = (each: string) => each.slice(each.lastIndexOf("/") + 1);
    files = new Map([
      ...Object.entries(TEXT).map(
        ([path, [mime, text]]) =>
          [path, textFile(name(path), mime, text)] as const,
      ),
      ...Object.entries(BINARY).map(
        ([path, [mime, url, size]]) =>
          [path, binary(name(path), mime, url, size)] as const,
      ),
      [
        "docs/assets/logo.svg",
        { ...textFile("logo.svg", "image/svg+xml", svgText), url: svgUrl },
      ],
    ]);
  }
  return files.get(path);
}

/** The text of a text file at `path`, read without making a blob. */
export function repositoryText(path: string): string | undefined {
  return TEXT[path]?.[1];
}
