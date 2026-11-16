import { REPOSITORY_PATHS, repositoryFile } from "@orz/fixtures/repository.ts";
import { Badge } from "@orz/ui/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@orz/ui/components/dropdown-menu";
import { EmptyState } from "@orz/ui/components/empty-state";
import {
  FileStatusMark,
  FileTree,
  FileTreeItem,
} from "@orz/ui/components/file-tree";
import { Input } from "@orz/ui/components/input";
import { List, ListItem } from "@orz/ui/components/list";
import { NavListFrame } from "@orz/ui/components/nav-list";
import { Pane } from "@orz/ui/components/pane";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@orz/ui/components/segmented-control";
import { Skeleton } from "@orz/ui/components/skeleton";
import { ToolbarButton } from "@orz/ui/components/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import {
  type FileNode,
  type FileRowStatus,
  type FileStatus,
  fileStatuses,
  fileTreeNodes,
  fileTypeIcon,
  movePath,
} from "@orz/ui/lib/file-tree";
import { isPlainClick } from "@orz/ui/lib/link";
import type { TreeFilterMode } from "@orz/ui/lib/tree-rows";
import { asciinemaContent } from "@orz/ui-asciinema";
import { codeContent, patchContent } from "@orz/ui-code";
import { Content, ContentRenderers } from "@orz/ui-content";
import {
  audioContent,
  htmlContent,
  imageContent,
  pdfContent,
  videoContent,
} from "@orz/ui-content/attachment";
import { hexContent } from "@orz/ui-hex/content";
import { markdownContent } from "@orz/ui-markdown";
import {
  ArrowLeftIcon,
  FileXIcon,
  FolderIcon,
  ListFilterIcon,
  SearchXIcon,
} from "lucide-react";
import { type MouseEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClientOnly } from "../../hydrated.tsx";
import { hrefOf as pageHref } from "../../routes.ts";
import { setHash, useHash } from "../demo-state.ts";
import { CHANGES, changeFile, STATUS } from "./changes.ts";

// In the order the registry tries them: the media and pages first, markdown
// before codeContent, which would take it as plain text, and hexContent last,
// for whatever binary is left.
const RENDERERS = [
  imageContent(),
  videoContent(),
  audioContent(),
  pdfContent(),
  htmlContent(),
  asciinemaContent,
  markdownContent(),
  patchContent,
  codeContent,
  hexContent,
];

const PROJECT = "fetch-kit";

const MODES: { mode: TreeFilterMode; label: string }[] = [
  { mode: "hide", label: "Hide other files" },
  { mode: "expand", label: "Open folders with matches" },
  { mode: "collapse", label: "Close other folders" },
];

const LABELS: Record<FileRowStatus, string> = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
  untracked: "Untracked",
  ignored: "Ignored",
  changes: "Contains changes",
};

const BADGE = {
  added: "success",
  untracked: "success",
  renamed: "success",
  modified: "warning",
  deleted: "destructive",
  ignored: "outline",
  changes: "outline",
} as const;

/**
 * The working tree as the reader has left it: its paths, git's status of each, and where each
 * renamed or moved file came from, whose contents and diff the fixtures keep under that path.
 */
interface WorkTree {
  paths: readonly string[];
  status: Readonly<Record<string, FileStatus>>;
  origin: Readonly<Record<string, string>>;
}

const INITIAL: WorkTree = {
  paths: REPOSITORY_PATHS,
  status: STATUS,
  origin: {},
};

const under = (path: string, from: string) =>
  path === from || (from.endsWith("/") && path.startsWith(from));

/** `work` after `from` goes to `to`: each file that moves is renamed to git, unless git never had it. */
function carry(work: WorkTree, from: string, to: string): WorkTree {
  const status: Record<string, FileStatus> = {};
  for (const [path, value] of Object.entries(work.status))
    status[movePath(path, from, to)] = value;
  const origin: Record<string, string> = {};
  for (const [path, first] of Object.entries(work.origin))
    if (!under(path, from)) origin[path] = first;
  for (const path of work.paths) {
    if (path.endsWith("/") || !under(path, from)) continue;
    const next = movePath(path, from, to);
    origin[next] = work.origin[path] ?? path;
    const was = work.status[path];
    if (was !== "added" && was !== "untracked") status[next] = "renamed";
  }
  return {
    paths: work.paths.map((path) => movePath(path, from, to)),
    status,
    origin,
  };
}

/** `work` without `gone` and, for a folder, what it holds. */
const without = (work: WorkTree, gone: string): WorkTree => ({
  ...work,
  paths: work.paths.filter((path) => !under(path, gone)),
});

/** A path's last name, a folder's without its "/". */
function nameOf(path: string) {
  const bare = path.endsWith("/") ? path.slice(0, -1) : path;
  return bare.slice(bare.lastIndexOf("/") + 1);
}

/** The folder a path sits in, with its "/"; "" at the root. */
const folderOf = (path: string) =>
  path.slice(0, path.lastIndexOf("/", path.length - 2) + 1);

function findFolder(
  tree: readonly FileNode[],
  path: string,
): readonly FileNode[] | undefined {
  if (path === "") return tree;
  let nodes: readonly FileNode[] = tree;
  let found: FileNode | undefined;
  for (const id of path
    .slice(0, -1)
    .split("/")
    .map((_, i, parts) => `${parts.slice(0, i + 1).join("/")}/`)) {
    found = nodes.find((node) => node.id === id);
    if (!found) return undefined;
    nodes = found.children ?? [];
  }
  return found?.children;
}

/** The address of `path`; the root's is the demo's own page, with no hash. */
const PAGE = pageHref("/demos/repository/", import.meta.env.BASE_URL);
const hrefOf = (path: string) => (path === "" ? PAGE : `#${path}`);

/** Follows a link in place on a plain click; any other opens it as a link does. */
function go(event: MouseEvent, path: string) {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  setHash(path, { push: true });
}

/**
 * A repository's working tree: its files in a tree to filter, and the file or folder picked,
 * with what it changes. Every file and folder is a `#` link to its path.
 */
export function Repository() {
  const path = useHash();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<TreeFilterMode>("hide");
  const [work, setWork] = useState(INITIAL);
  // One row per folder, for the listings: a merged row would hide the
  // folders a listing steps through.
  const nodes = useMemo(
    () => fileTreeNodes(work.paths, { flatten: false }),
    [work.paths],
  );
  const rowStatus = useMemo(
    () => fileStatuses(nodes, work.status),
    [nodes, work.status],
  );
  const files = useMemo(
    () => work.paths.filter((p) => !p.endsWith("/")),
    [work.paths],
  );
  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle === ""
        ? 0
        : files.filter((file) => file.toLowerCase().includes(needle)).length,
    [needle, files],
  );

  // Each change says what it did and can be taken back; none asks first.
  const change = (next: WorkTree, to: string, message: string) => {
    const before = { work, path };
    setWork(next);
    if (to !== path) setHash(to, { push: false });
    toast(message, {
      action: {
        label: "Undo",
        onClick: () => {
          setWork(before.work);
          setHash(before.path, { push: false });
        },
      },
    });
  };
  const rename = (from: string, to: string) =>
    change(
      carry(work, from, to),
      movePath(path, from, to),
      `“${nameOf(from)}” renamed to “${nameOf(to)}”`,
    );
  const move = (from: string, to: string) => {
    const folder = folderOf(to);
    change(
      carry(work, from, to),
      movePath(path, from, to),
      `“${nameOf(from)}” moved to ${folder === "" ? PROJECT : `“${nameOf(folder)}”`}`,
    );
  };
  const remove = (gone: string) =>
    change(
      without(work, gone),
      under(path, gone) ? folderOf(gone) : path,
      `“${nameOf(gone)}” deleted`,
    );

  return (
    <TooltipProvider>
      <ContentRenderers renderers={RENDERERS}>
        <Pane
          purpose="app"
          className="relative flex h-full max-h-dvh min-h-0 overflow-hidden"
        >
          <Pane purpose="sidebar" edge="end" asChild>
            <aside
              aria-label={PROJECT}
              className={`flex min-h-0 flex-col gap-2 p-2 max-md:flex-1 md:w-72 md:shrink-0 lg:w-80 ${path === "" ? "" : "max-md:hidden"}`}
            >
              <NavListFrame className="flex min-h-0 flex-1 flex-col">
                <nav
                  aria-label="Repository"
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="flex items-center gap-1 p-2">
                    <Input
                      type="search"
                      aria-label="Filter files"
                      placeholder="Filter files"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="min-w-0 flex-1"
                    />
                    <DropdownMenu>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger asChild>
                            <ToolbarButton aria-label="Filter mode">
                              <ListFilterIcon />
                            </ToolbarButton>
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>Filter mode</TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent align="end" className="w-60">
                        <DropdownMenuLabel>While filtering</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={mode}
                          onValueChange={(value) =>
                            setMode(value as TreeFilterMode)
                          }
                        >
                          {MODES.map(({ mode, label }) => (
                            <DropdownMenuRadioItem key={mode} value={mode}>
                              {label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p
                    aria-live="polite"
                    className="px-3 pb-1 text-muted-foreground text-ui-sm empty:hidden"
                  >
                    {needle === ""
                      ? null
                      : matches === 1
                        ? "1 file matches"
                        : `${matches} files match`}
                  </p>
                  <div className="min-h-0 flex-1 overflow-y-auto pb-2">
                    {needle !== "" && matches === 0 && mode === "hide" ? (
                      <EmptyState
                        icon={SearchXIcon}
                        title="No files match"
                        className="px-4 py-8"
                      >
                        No path in {PROJECT} holds “{query.trim()}”.
                      </EmptyState>
                    ) : (
                      <FileTree
                        aria-label="Files"
                        paths={work.paths}
                        status={work.status}
                        current={path === "" ? undefined : path}
                        query={query}
                        filterMode={mode}
                        stickyBranches
                        onRename={rename}
                        onMove={move}
                        menu={(file, actions) => (
                          <>
                            <DropdownMenuItem
                              disabled={!actions.rename}
                              onSelect={actions.rename}
                            >
                              Rename
                              <DropdownMenuShortcut>F2</DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!actions.cut}
                              onSelect={actions.cut}
                            >
                              Cut
                              <DropdownMenuShortcut>
                                Ctrl+X
                              </DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!actions.paste}
                              onSelect={actions.paste}
                            >
                              Paste
                              <DropdownMenuShortcut>
                                Ctrl+V
                              </DropdownMenuShortcut>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => remove(file.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      >
                        {(file) => (
                          <FileTreeItem
                            href={`#${file.path}`}
                            onClick={(event) => go(event, file.path)}
                          />
                        )}
                      </FileTree>
                    )}
                  </div>
                </nav>
              </NavListFrame>
            </aside>
          </Pane>
          <div
            className={`flex min-w-0 flex-1 flex-col ${path === "" ? "max-md:hidden" : ""}`}
          >
            <Place
              key={path}
              path={path}
              nodes={nodes}
              rowStatus={rowStatus}
              files={files}
              origin={work.origin}
            />
          </div>
        </Pane>
      </ContentRenderers>
    </TooltipProvider>
  );
}

/** The file or folder at `path`: a bar with where it is, and what it holds. */
function Place({
  path,
  nodes,
  rowStatus,
  files,
  origin,
}: {
  path: string;
  nodes: readonly FileNode[];
  rowStatus: ReadonlyMap<string, FileRowStatus>;
  files: readonly string[];
  /** Where a renamed or moved file came from, the path its contents are kept under. */
  origin: Readonly<Record<string, string>>;
}) {
  const folder = path === "" || path.endsWith("/");
  const children = folder ? findFolder(nodes, path) : undefined;
  const known = folder ? children !== undefined : files.includes(path);
  const status = rowStatus.get(path);
  const first = origin[path] ?? path;
  const change = CHANGES.get(first);
  const [view, setView] = useState<"file" | "changes">(
    status === "deleted" && change ? "changes" : "file",
  );

  return (
    <>
      <Pane
        purpose="toolbar"
        edge="bottom"
        className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-2 py-2"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarButton asChild className="md:hidden">
              <a
                href={hrefOf("")}
                aria-label="Back to the files"
                onClick={(event) => go(event, "")}
              >
                <ArrowLeftIcon />
              </a>
            </ToolbarButton>
          </TooltipTrigger>
          <TooltipContent>Back to the files</TooltipContent>
        </Tooltip>
        <Breadcrumbs path={path} />
        {status && status !== "changes" && (
          <Badge variant={BADGE[status]}>{LABELS[status]}</Badge>
        )}
        {change && (
          <SegmentedControl
            aria-label="View"
            value={view}
            onValueChange={(value) => setView(value as "file" | "changes")}
            className="ml-auto"
          >
            <SegmentedControlItem value="file">File</SegmentedControlItem>
            <SegmentedControlItem value="changes">Changes</SegmentedControlItem>
          </SegmentedControl>
        )}
      </Pane>
      <Pane purpose="document" className="min-h-0 flex-1 overflow-y-auto">
        {!known ? (
          <EmptyState
            icon={FileXIcon}
            title="Not in this repository"
            className="h-full content-center p-8"
          >
            No file or folder of {PROJECT} is at “{path}”.
          </EmptyState>
        ) : children ? (
          <Listing path={path} items={children} rowStatus={rowStatus} />
        ) : view === "changes" && change ? (
          <ClientOnly fallback={<Skeleton className="m-4 h-40" />}>
            <Viewed source={changeFile(first)} />
          </ClientOnly>
        ) : status === "deleted" ? (
          <EmptyState
            icon={FileXIcon}
            title="Deleted in the working tree"
            className="h-full content-center p-8"
          >
            The file is gone from disk; git still has its last commit.
          </EmptyState>
        ) : (
          <ClientOnly fallback={<Skeleton className="m-4 h-40" />}>
            <Viewed source={repositoryFile(first)} />
          </ClientOnly>
        )}
      </Pane>
    </>
  );
}

function Viewed({ source }: { source: ReturnType<typeof repositoryFile> }) {
  return source ? (
    <Content source={source} placement="viewer" className="p-4" />
  ) : null;
}

/** The way from the project down to `path`, each folder on it a link. */
function Breadcrumbs({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  const steps = [
    { name: PROJECT, to: "" },
    ...parts.map((name, i) => ({
      name,
      to:
        parts.slice(0, i + 1).join("/") +
        (i < parts.length - 1 || path.endsWith("/") ? "/" : ""),
    })),
  ];
  return (
    <nav aria-label="Path" className="min-w-0 flex-1 px-1">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 text-ui">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          return (
            <li key={step.to} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <span aria-hidden className="text-muted-foreground">
                  /
                </span>
              )}
              {last ? (
                <span aria-current="page" className="truncate font-medium">
                  {step.name}
                </span>
              ) : (
                <a
                  href={hrefOf(step.to)}
                  onClick={(event) => go(event, step.to)}
                  className="truncate text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:focus-ring"
                >
                  {step.name}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** A folder's own files and folders, each a link, marked as the tree marks them. */
function Listing({
  path,
  items,
  rowStatus,
}: {
  path: string;
  items: readonly FileNode[];
  rowStatus: ReadonlyMap<string, FileRowStatus>;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={FolderIcon}
        title="An empty folder"
        className="h-full content-center p-8"
      >
        Nothing is in {path.slice(0, -1)} yet.
      </EmptyState>
    );
  }
  return (
    <List purpose="collection" className="p-2" asChild>
      <ul aria-label={path === "" ? PROJECT : path.slice(0, -1)}>
        {items.map((item) => {
          const Icon = item.directory ? FolderIcon : fileTypeIcon(item.name);
          const status = rowStatus.get(item.id);
          return (
            <ListItem key={item.id} asChild>
              <li>
                <a
                  href={`#${item.path}`}
                  onClick={(event) => go(event, item.path)}
                  className="flex items-center gap-2 px-3 py-2 outline-none focus-visible:focus-ring-inset touch:py-3"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span
                    className={`min-w-0 flex-1 truncate ${status === "deleted" ? "line-through" : ""}`}
                  >
                    {item.name}
                    {status && (
                      <span className="sr-only">, {LABELS[status]}</span>
                    )}
                  </span>
                  {status && (
                    <FileStatusMark status={status} label={LABELS[status]} />
                  )}
                </a>
              </li>
            </ListItem>
          );
        })}
      </ul>
    </List>
  );
}
