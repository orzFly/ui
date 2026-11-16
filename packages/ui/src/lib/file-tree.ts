import {
  AppWindowIcon,
  FileArchiveIcon,
  FileBracesIcon,
  FileCodeIcon,
  FileCogIcon,
  FileDiffIcon,
  FileHeadphoneIcon,
  FileIcon,
  FileKeyIcon,
  FileLockIcon,
  FilePlayIcon,
  FileSpreadsheetIcon,
  FileTerminalIcon,
  FileTextIcon,
  FileTypeIcon,
  ImageIcon,
  type LucideIcon,
  MailIcon,
} from "lucide-react";
import type { TreeNode } from "./tree-rows.ts";

export type FileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "untracked"
  | "ignored";

/** What a row's status lane shows: the node's own status, or that something under a folder changed. */
export type FileRowStatus = FileStatus | "changes";

export interface FileNode extends TreeNode<FileNode> {
  /** The row's path: a folder's ends in "/"; a merged row's is its deepest folder's. */
  id: string;
  path: string;
  name: string;
  /** The names the row shows, one per merged folder; `[name]` when nothing merged. */
  segments: readonly string[];
  directory: boolean;
  children?: readonly FileNode[];
}

export interface FileTreeOptions {
  /** Merges a folder whose one child is a folder into one row. Default true. */
  flatten?: boolean;
  /** false keeps the order given; default is folders first, then names in natural order. */
  sort?: false | ((a: FileNode, b: FileNode) => number);
}

/** "/a//b" and "./a/b" are "a/b"; a trailing "/" stays; undefined for an empty path. */
export function normalizePath(path: string): string | undefined {
  const parts = path.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.length === 0) return undefined;
  return parts.join("/") + (path.endsWith("/") ? "/" : "");
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const byKind = (a: FileNode, b: FileNode) =>
  Number(b.directory) - Number(a.directory) || collator.compare(a.name, b.name);

interface Folder {
  /** Keyed by the name, a folder's with its "/", so `x` and `x/` stand apart. */
  entries: Map<string, Folder | null>;
}

/**
 * The roots of a tree of `paths`: a folder for each path that ends in "/" and for each that
 * holds another, a file for the rest. Empty paths are skipped and repeated ones count once.
 */
export function fileTreeNodes(
  paths: readonly string[],
  { flatten = true, sort = byKind }: FileTreeOptions = {},
): FileNode[] {
  const root: Folder = { entries: new Map() };
  for (const raw of paths) {
    const path = normalizePath(raw);
    if (path === undefined) continue;
    const directory = path.endsWith("/");
    const names = (directory ? path.slice(0, -1) : path).split("/");
    let folder = root;
    names.forEach((name, index) => {
      if (index === names.length - 1 && !directory) {
        if (!folder.entries.has(name)) folder.entries.set(name, null);
        return;
      }
      const key = `${name}/`;
      let next = folder.entries.get(key);
      if (!next) {
        next = { entries: new Map() };
        folder.entries.set(key, next);
      }
      folder = next;
    });
  }

  const build = (folder: Folder, prefix: string): FileNode[] => {
    const nodes = [...folder.entries].map(([key, sub]): FileNode => {
      const path = prefix + key;
      const name = sub ? key.slice(0, -1) : key;
      return sub
        ? {
            id: path,
            path,
            name,
            segments: [name],
            directory: true,
            children: build(sub, path),
          }
        : { id: path, path, name, segments: [name], directory: false };
    });
    if (sort) nodes.sort(sort);
    return flatten ? nodes.map(merge) : nodes;
  };
  return build(root, "");
}

/** A folder and the chain of lone folders below it, as one row. */
function merge(node: FileNode): FileNode {
  let row = node;
  while (row.children?.length === 1 && row.children[0]?.directory) {
    const [only] = row.children;
    row = { ...only, segments: [...row.segments, ...only.segments] };
  }
  return row;
}

// Every path a row stands for, by the node array it came from: a merged
// row's folders all lead to it.
const rowIndexes = new WeakMap<readonly FileNode[], Map<string, string>>();

function rowIndex(nodes: readonly FileNode[]): Map<string, string> {
  const cached = rowIndexes.get(nodes);
  if (cached) return cached;
  const found = new Map<string, string>();
  const visit = (node: FileNode, parent: string) => {
    let path = parent;
    for (const segment of node.segments.slice(0, -1)) {
      path += `${segment}/`;
      found.set(path, node.id);
    }
    found.set(node.id, node.id);
    for (const child of node.children ?? []) visit(child, node.id);
  };
  for (const node of nodes) visit(node, "");
  rowIndexes.set(nodes, found);
  return found;
}

/** The id of the row that shows `path`: its own, or a merged row's that took in its folder. */
export function resolveFileRow(
  nodes: readonly FileNode[],
  path: string,
): string | undefined {
  const normal = normalizePath(path);
  if (normal === undefined) return undefined;
  const index = rowIndex(nodes);
  return (
    index.get(normal) ??
    (normal.endsWith("/") ? undefined : index.get(`${normal}/`))
  );
}

/** What each row's status lane shows, by row id; a row with nothing to show is absent. */
export function fileStatuses(
  nodes: readonly FileNode[],
  status: Readonly<Record<string, FileStatus>>,
): ReadonlyMap<string, FileRowStatus> {
  // A merged row takes every status written for one of its folders; an
  // ignored one outranks the rest, since everything below it is ignored.
  const own = new Map<string, FileStatus>();
  for (const [path, value] of Object.entries(status)) {
    const id = resolveFileRow(nodes, path);
    if (id === undefined || own.get(id) === "ignored") continue;
    own.set(id, value);
  }

  const shown = new Map<string, FileRowStatus>();
  /** Whether the node, or anything below it, shows a status other than ignored. */
  const visit = (node: FileNode, ignored: boolean): boolean => {
    const mine = own.get(node.id);
    if (!node.directory) {
      const value = mine ?? (ignored ? "ignored" : undefined);
      if (value) shown.set(node.id, value);
      return value !== undefined && value !== "ignored";
    }
    const below = ignored || mine === "ignored";
    let changed = mine !== undefined && mine !== "ignored";
    for (const child of node.children ?? []) {
      if (visit(child, below)) changed = true;
    }
    if (below) shown.set(node.id, "ignored");
    else if (changed) shown.set(node.id, "changes");
    return changed;
  };
  for (const node of nodes) visit(node, false);
  return shown;
}

// The image, HTML, patch, archive, audio, video and mail names are @orz/ui-content's
// (src/file-kind.ts), which @orz/ui cannot import; its icon test holds the
// two tables to one icon for each.
const IMAGE = /^(png|jpe?g|gif|webp|avif|svg)$/;
const ARCHIVE = /^(zip|tar|gz|tgz|bz2|tbz|tbz2|xz|txz|7z|rar|zst)$/;
const AUDIO = /^(mp3|wav|ogg|oga|m4a|aac|flac|opus|wma|aif|aiff)$/;
const VIDEO = /^(mp4|m4v|webm|mov|mkv|avi|wmv|flv|mpg|mpeg)$/;

const NAMES: Record<string, LucideIcon> = {
  "package.json": FileBracesIcon,
  "pnpm-lock.yaml": FileLockIcon,
  "package-lock.json": FileLockIcon,
  "bun.lockb": FileLockIcon,
  dockerfile: FileCogIcon,
  containerfile: FileCogIcon,
  makefile: FileTerminalIcon,
  ".gitignore": FileCogIcon,
  ".gitattributes": FileCogIcon,
  ".gitmodules": FileCogIcon,
  ".editorconfig": FileCogIcon,
  ".dockerignore": FileCogIcon,
  ".npmrc": FileCogIcon,
  ".nvmrc": FileCogIcon,
  license: FileTextIcon,
  licence: FileTextIcon,
  copying: FileTextIcon,
};

const EXTENSIONS: Record<string, LucideIcon> = {
  ...table(AppWindowIcon, "html htm xhtml"),
  ...table(FileDiffIcon, "patch diff"),
  ...table(
    FileCodeIcon,
    "ts tsx mts cts js jsx mjs cjs py rb rs go java kt kts c h cpp hpp cc hh cs php swift scala clj ex exs erl hs ml lua pl r jl nix zig sql graphql proto vue svelte astro css scss less xml",
  ),
  // A declaration file holds types, not code that runs.
  ...table(FileTypeIcon, "d.ts d.mts d.cts ttf otf woff woff2 eot"),
  ...table(FileBracesIcon, "json jsonc json5 jsonl ndjson"),
  ...table(FileTextIcon, "txt log md markdown mdx rst adoc tex"),
  ...table(FileCogIcon, "yml yaml toml ini cfg conf properties"),
  ...table(FileLockIcon, "lock"),
  ...table(FileKeyIcon, "pem key crt cer p12"),
  ...table(FileTerminalIcon, "sh bash zsh fish ps1 bat cmd"),
  ...table(FileSpreadsheetIcon, "csv tsv xls xlsx ods"),
  ...table(MailIcon, "eml"),
};

function table(icon: LucideIcon, extensions: string) {
  return Object.fromEntries(extensions.split(" ").map((ext) => [ext, icon]));
}

/**
 * The icon for a file's type: by its whole name (`package.json`, `.gitignore`), then a `.env`
 * name, then its longest known extension (`.d.ts` before `.ts`), else `FileIcon`. Case is
 * ignored.
 */
export function fileTypeIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  const named = NAMES[lower];
  if (named) return named;
  if (lower === ".env" || lower.startsWith(".env.")) return FileKeyIcon;
  // From the first dot past a leading one, so the longest extension is tried first.
  for (
    let dot = lower.indexOf(".", 1);
    dot !== -1;
    dot = lower.indexOf(".", dot + 1)
  ) {
    const ext = lower.slice(dot + 1);
    const icon = EXTENSIONS[ext];
    if (icon) return icon;
    if (IMAGE.test(ext)) return ImageIcon;
    if (ARCHIVE.test(ext)) return FileArchiveIcon;
    if (AUDIO.test(ext)) return FileHeadphoneIcon;
    if (VIDEO.test(ext)) return FilePlayIcon;
  }
  return FileIcon;
}

/** `path` after one rename or move of `from` to `to`; a path not under `from` is returned as it is. */
export function movePath(path: string, from: string, to: string): string {
  if (path === from) return to;
  // Only a folder holds other paths; `a/x` is not under `a/x/`.
  if (from.endsWith("/") && path.startsWith(from))
    return to + path.slice(from.length);
  return path;
}

/** The end of a file name's stem: before its last ".", or its length when it has none or only a leading one. */
export function fileStem(name: string): number {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? dot : name.length;
}

/** Matches a node whose path holds `query`, trimmed, in any case; undefined for a blank query. */
export function fileMatcher(
  query: string,
): ((node: FileNode) => boolean) | undefined {
  const needle = query.trim().toLowerCase();
  if (needle === "") return undefined;
  return (node) => node.path.toLowerCase().includes(needle);
}
