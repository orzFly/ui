/**
 * What kind of file a source is. Pure module (no React) so every renderer's `accepts` shares one
 * answer — `hasGenericType`, "a declared content type outranks the filename", is the rule a second
 * copy elsewhere would fork.
 */

/** Spelled as a file `ContentSource` spells it, so one passes straight in. */
export type FileLike = { name: string; mime?: string };

const IMAGE_EXTENSION = /\.(png|jpe?g|gif|webp|avif|svg)$/i;

// Text formats the CLI/browser labels with an application/* type.
const TEXT_APPLICATION_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "application/x-ndjson",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/toml",
  "application/javascript",
  "application/x-javascript",
  "application/typescript",
  "application/sql",
  "application/x-sh",
]);

// The CLI's extension→mime table only covers a handful of formats, so code
// files usually upload as application/octet-stream and only the filename
// says they are text.
const TEXT_EXTENSION =
  /\.(txt|log|md|markdown|csv|tsv|json|jsonc|json5|jsonl|ndjson|ya?ml|toml|ini|cfg|conf|env|xml|html?|css|scss|less|diff|patch|ts|tsx|mts|cts|js|jsx|mjs|cjs|py|rb|rs|go|java|kt|kts|c|h|cpp|hpp|cc|hh|cs|php|swift|scala|clj|ex|exs|erl|hs|ml|lua|pl|r|jl|nix|zig|sql|graphql|proto|sh|bash|zsh|fish|ps1|bat|cmd|vue|svelte|astro|tex|lock|mmd|mermaid)$/i;

/** The bare type: `Text/HTML; charset=utf-8` and `text/html` are one type. */
function mimeOf(file: FileLike): string {
  return (file.mime ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

function hasGenericType(mime: string): boolean {
  return mime === "" || mime === "application/octet-stream";
}

export function isImageFile(file: FileLike): boolean {
  const type = mimeOf(file);
  if (type.startsWith("image/")) return true;
  // Uploads that arrived without a real content type (the CLI sent
  // application/octet-stream until T-27's hotfix) fall back to the filename.
  return hasGenericType(type) && IMAGE_EXTENSION.test(file.name);
}

/** Text by declared type, or by filename when the type is generic. */
export function isTextFile(file: FileLike): boolean {
  const type = mimeOf(file);
  if (type.startsWith("text/")) return true;
  if (TEXT_APPLICATION_TYPES.has(type)) return true;
  return hasGenericType(type) && TEXT_EXTENSION.test(file.name);
}

/**
 * Files whose image-syntax reference embeds a document card rather than an
 * `<img>`. Images keep winning ties like .svg, which is both.
 */
export function isTextEmbed(file: FileLike): boolean {
  return !isImageFile(file) && isTextFile(file);
}

export function isMarkdownFile(file: FileLike): boolean {
  return (
    mimeOf(file) === "text/markdown" || /\.(md|markdown)$/i.test(file.name)
  );
}

// What browsers on Linux declare for .patch and .diff, from shared-mime-info.
const PATCH_TYPES = new Set(["text/x-patch", "text/x-diff"]);

/**
 * A unified diff, by declared type, or by filename when the type is generic: a `.patch` someone
 * uploaded as text/plain keeps the plain text view it asked for.
 */
export function isPatchFile(file: FileLike): boolean {
  const type = mimeOf(file);
  if (PATCH_TYPES.has(type)) return true;
  return hasGenericType(type) && /\.(patch|diff)$/i.test(file.name);
}

export function isHtmlFile(file: FileLike): boolean {
  const type = mimeOf(file);
  if (type === "text/html" || type === "application/xhtml+xml") return true;
  return hasGenericType(type) && /\.(html?|xhtml)$/i.test(file.name);
}

/** PDF by declared type, or by filename when the type is generic. */
export function isPdfFile(file: FileLike): boolean {
  const type = mimeOf(file);
  if (type === "application/pdf") return true;
  return hasGenericType(type) && /\.pdf$/i.test(file.name);
}

// Archive types as the CLI, the browser and the common upload tools spell
// them; the same format arrives under several names depending on which one
// did the labelling.
const ARCHIVE_TYPES = new Set([
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/x-7z-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-bzip2",
  "application/x-xz",
  "application/zstd",
]);

const ARCHIVE_EXTENSION = /\.(zip|tar|gz|tgz|bz2|tbz|tbz2|xz|txz|7z|rar|zst)$/i;

const AUDIO_EXTENSION = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|wma|aif|aiff)$/i;

/**
 * `ts` is deliberately missing: it is MPEG transport stream and TypeScript
 * both, and TEXT_EXTENSION claims it. A source file the CLI uploaded as
 * application/octet-stream must not come back as a video.
 */
const VIDEO_EXTENSION = /\.(mp4|m4v|webm|mov|mkv|avi|wmv|flv|mpg|mpeg)$/i;

/** Archive by declared type, or by filename when the type is generic. */
export function isArchiveFile(file: FileLike): boolean {
  const type = mimeOf(file);
  if (ARCHIVE_TYPES.has(type)) return true;
  return hasGenericType(type) && ARCHIVE_EXTENSION.test(file.name);
}

/** Audio by declared type, or by filename when the type is generic. */
export function isAudioFile(file: FileLike): boolean {
  const type = mimeOf(file);
  if (type.startsWith("audio/")) return true;
  return hasGenericType(type) && AUDIO_EXTENSION.test(file.name);
}

/** Video by declared type, or by filename when the type is generic. */
export function isVideoFile(file: FileLike): boolean {
  const type = mimeOf(file);
  if (type.startsWith("video/")) return true;
  return hasGenericType(type) && VIDEO_EXTENSION.test(file.name);
}

/**
 * Highlighting a multi-megabyte file would freeze the tab (T-31), so bigger
 * text files only preview when asked, and then as plain text.
 */
export const TEXT_PREVIEW_MAX_BYTES = 1024 * 1024;

/**
 * Past this nothing previews. Measured in Chromium under load: plain text at
 * 10 MiB blocked the tab for 1.5 s in its longest task, at 20 MiB for 2.9 s,
 * at 50 MiB for 6.9 s.
 */
export const TEXT_PREVIEW_HARD_MAX_BYTES = 10 * 1024 * 1024;

export type TextPreviewLimits = {
  /** Previews on its own up to this. Default `TEXT_PREVIEW_MAX_BYTES`. */
  max?: number;
  /** Never previews past this. Default `TEXT_PREVIEW_HARD_MAX_BYTES`. */
  hardMax?: number;
};

/**
 * Whether a text file of this size previews on its own, waits to be asked,
 * or never previews. A patch skips the asking: its view is virtualized per
 * file, and a 20 MiB one blocked the tab for 0.6 s at most where the code
 * view took 10 s or more over 1 MiB of highlighted text.
 */
export function textPreviewGate(
  file: FileLike & { size: number },
  {
    max = TEXT_PREVIEW_MAX_BYTES,
    hardMax = TEXT_PREVIEW_HARD_MAX_BYTES,
  }: TextPreviewLimits = {},
): "auto" | "ask" | "refuse" {
  if (file.size > hardMax) return "refuse";
  if (file.size <= max || isPatchFile(file)) return "auto";
  return "ask";
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
