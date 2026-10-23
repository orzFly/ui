import type { ContentSource } from "@orz/ui-content";
import type { FileSource } from "@orz/ui-content/attachment";
import appendixText from "./attachment/appendix.md?raw";
import zipUrl from "./attachment/bundle.zip?url&no-inline";
import chapterText from "./attachment/chapter.md?raw";
import webmUrl from "./attachment/clip.webm?url&no-inline";
import htmlText from "./attachment/demo.html?raw";
import tsText from "./attachment/fetch-task.ts?raw";
import pngUrl from "./attachment/gradient.png?url&no-inline";
import guideText from "./attachment/guide.md?raw";
import svgText from "./attachment/logo.svg?raw";
import svgUrl from "./attachment/logo.svg?url&no-inline";
import pdfUrl from "./attachment/paper.pdf?url&no-inline";
import spriteUrl from "./attachment/sprite.png?url&no-inline";
import oggUrl from "./attachment/tone.ogg?url&no-inline";
import seriesText from "./patch/series.patch?raw";

/**
 * A text file as an app would describe one: a `url` to download (a blob, here) and a `load` for
 * the renderers that need the text.
 */
export function textFile(name: string, mime: string, text: string): FileSource {
  const blob = new Blob([text], { type: mime });
  return {
    kind: "file",
    name,
    mime,
    size: blob.size,
    url: URL.createObjectURL(blob),
    load: async () => text,
  };
}

export const binary = (
  name: string,
  mime: string,
  url: string,
  size: number,
): FileSource => ({ kind: "file", name, mime, size, url });

export const PLAIN_DIFF = `diff --git a/src/retry.ts b/src/retry.ts
index d1e5c0a..e2f6a1b 100644
--- a/src/retry.ts
+++ b/src/retry.ts
@@ -1,4 +1,4 @@
-const PAUSE_MS = 250;
+const PAUSE_MS = 500;
 
 /** Runs \`attempt\`, and once more after a pause if it throws. */
 export async function retryOnce<T>(attempt: () => Promise<T>): Promise<T> {
`;

export const FILES: Record<string, FileSource> = {
  "gradient.png": binary("gradient.png", "image/png", pngUrl, 1510),
  // Tiny and transparent: zoomed in, it shows the checkerboard and pixelated scaling.
  "sprite.png": binary("sprite.png", "image/png", spriteUrl, 232),
  "logo.svg": {
    ...textFile("logo.svg", "image/svg+xml", svgText),
    url: svgUrl,
  },
  // A blob, not a served asset: Vite's dev server answers an .html asset URL
  // with a 404. The sandboxed frame still runs it on an opaque origin.
  "demo.html": textFile("demo.html", "text/html", htmlText),
  "paper.pdf": binary("paper.pdf", "application/pdf", pdfUrl, 689),
  "clip.webm": binary("clip.webm", "video/webm", webmUrl, 10556),
  "tone.ogg": binary("tone.ogg", "audio/ogg", oggUrl, 4649),
  "guide.md": textFile("guide.md", "text/markdown", guideText),
  "chapter.md": textFile("chapter.md", "text/markdown", chapterText),
  "appendix.md": textFile("appendix.md", "text/markdown", appendixText),
  // Uploaded with a generic type: the name alone makes it text.
  "fetch-task.ts": textFile(
    "fetch-task.ts",
    "application/octet-stream",
    tsText,
  ),
  "bundle.zip": binary("bundle.zip", "application/zip", zipUrl, 182),
  "series.patch": textFile("series.patch", "text/x-patch", seriesText),
  // The CLI uploads code under a generic type; the name makes it a patch.
  "pause.diff": textFile("pause.diff", "application/octet-stream", PLAIN_DIFF),
  "notes.patch": textFile(
    "notes.patch",
    "text/x-patch",
    "Not a diff at all, just notes\nsomeone saved as .patch.\n",
  ),
};

export const file = (name: string) => FILES[name] as FileSource;

/** Every kind the viewer knows, plus one it does not. */
export const MIXED = [
  "gradient.png",
  "sprite.png",
  "logo.svg",
  "demo.html",
  "paper.pdf",
  "clip.webm",
  "tone.ogg",
  "guide.md",
  "fetch-task.ts",
  "bundle.zip",
].map(file);

export const PATCHES = ["series.patch", "pause.diff", "notes.patch"].map(file);

export function resolve(href: string): ContentSource | null {
  if (!href.startsWith("files/")) return null;
  return FILES[href.slice("files/".length)] ?? null;
}

/** Pages a file opened on its own through the mixed set, when it is in it. */
export function group(target: FileSource) {
  const index = MIXED.findIndex((f) => f.name === target.name);
  return index === -1 ? null : { items: MIXED, index };
}
