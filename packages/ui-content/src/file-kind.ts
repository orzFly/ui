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

function hasGenericType(mime: string): boolean {
  return mime === "" || mime === "application/octet-stream";
}

export function isImageFile(file: FileLike): boolean {
  const type = file.mime ?? "";
  if (type.startsWith("image/")) return true;
  // Uploads that arrived without a real content type (the CLI sent
  // application/octet-stream until T-27's hotfix) fall back to the filename.
  return hasGenericType(type) && IMAGE_EXTENSION.test(file.name);
}

/** Text by declared type, or by filename when the type is generic. */
export function isTextFile(file: FileLike): boolean {
  const type = file.mime ?? "";
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
  return file.mime === "text/markdown" || /\.(md|markdown)$/i.test(file.name);
}

export function isHtmlFile(file: FileLike): boolean {
  const type = file.mime ?? "";
  if (type === "text/html" || type === "application/xhtml+xml") return true;
  return hasGenericType(type) && /\.(html?|xhtml)$/i.test(file.name);
}

/** PDF by declared type, or by filename when the type is generic. */
export function isPdfFile(file: FileLike): boolean {
  const type = file.mime ?? "";
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
  const type = file.mime ?? "";
  if (ARCHIVE_TYPES.has(type)) return true;
  return hasGenericType(type) && ARCHIVE_EXTENSION.test(file.name);
}

/** Audio by declared type, or by filename when the type is generic. */
export function isAudioFile(file: FileLike): boolean {
  const type = file.mime ?? "";
  if (type.startsWith("audio/")) return true;
  return hasGenericType(type) && AUDIO_EXTENSION.test(file.name);
}

/** Video by declared type, or by filename when the type is generic. */
export function isVideoFile(file: FileLike): boolean {
  const type = file.mime ?? "";
  if (type.startsWith("video/")) return true;
  return hasGenericType(type) && VIDEO_EXTENSION.test(file.name);
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
