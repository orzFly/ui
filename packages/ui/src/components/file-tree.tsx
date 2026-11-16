import { FolderIcon, FolderOpenIcon, type LucideIcon } from "lucide-react";
import { Slot } from "radix-ui";
import * as React from "react";

import {
  type FileNode,
  type FileRowStatus,
  type FileStatus,
  type FileTreeOptions,
  fileMatcher,
  fileStatuses,
  fileStem,
  fileTreeNodes,
  fileTypeIcon,
  movePath,
  resolveFileRow,
} from "../lib/file-tree.ts";
import { ancestorsOf, type TreeMoveTarget } from "../lib/tree-rows.ts";
import { cn } from "../lib/utils.ts";
import { MatchedText } from "./filter-menu.tsx";
import type {
  TreeHandle,
  TreeLabels,
  TreeMenuActions,
  TreeRowState,
} from "./tree.tsx";
import { Tree, TreeItem, TreeLabel } from "./tree.tsx";

export interface FileTreeLabels {
  /** Default "A name cannot contain “/”." */
  nameHasSlash: string;
  /** Default `A file or folder named ${name} is already here.` */
  nameTaken: (name: string) => string;
}

const FILE_LABELS: FileTreeLabels = {
  nameHasSlash: "A name cannot contain “/”.",
  nameTaken: (name) => `A file or folder named ${name} is already here.`,
};

/** The folder a path sits in, with its "/"; "" at the root. */
const folderOf = (path: string) =>
  path.slice(0, path.lastIndexOf("/", path.length - 2) + 1);

/** Every path a row shows, a merged row's folders included. */
function pathsOf(nodes: readonly FileNode[]): Set<string> {
  const found = new Set<string>();
  const visit = (node: FileNode, parent: string) => {
    if (!node.directory) {
      found.add(node.id);
      return;
    }
    let path = parent;
    for (const segment of node.segments) {
      path += `${segment}/`;
      found.add(path);
    }
    for (const child of node.children ?? []) visit(child, node.id);
  };
  for (const node of nodes) visit(node, "");
  return found;
}

export interface FileStatusLabels {
  added: string;
  modified: string;
  deleted: string;
  renamed: string;
  untracked: string;
  ignored: string;
  changes: string;
}

const STATUS_LABELS: FileStatusLabels = {
  added: "Added",
  modified: "Modified",
  deleted: "Deleted",
  renamed: "Renamed",
  untracked: "Untracked",
  ignored: "Ignored",
  changes: "Contains changes",
};

interface FileTreeContext {
  statuses: ReadonlyMap<string, FileRowStatus>;
  query: string;
  labels: FileStatusLabels;
}

const FileTreeContext = React.createContext<FileTreeContext | null>(null);
const FileRowContext = React.createContext<{
  file: FileNode;
  row: TreeRowState;
} | null>(null);

type TreeProps = React.ComponentProps<typeof Tree<FileNode>>;

/**
 * A `Tree` of a repository's or a folder's files, built from their `paths`: folders first in
 * natural order, a chain of lone folders merged into one row unless `flatten` is false. A path
 * ending in "/" is a folder, listed even when empty. `children` renders a `FileTreeItem` for each
 * row. `status` marks files by path, a folder holding a change takes a dot, and an ignored folder
 * passes ignored down. `query` filters by path as `filterMode` says. `current`, `expanded` and
 * `defaultExpanded` take paths, a merged folder's standing for its row; `onExpandedChange`
 * hands back row ids, and `handle`'s `scrollToItem` and `rename` take a path. Typing jumps to a
 * row by its name. Memoize `paths`.
 *
 * `onRename` and `onMove` hand over the path before and after, a folder's ending in "/"; apply
 * them to `paths` and `status` with `movePath`. The tree refuses a name holding "/" or one its
 * folder already has, and drops into a folder, never beside a row, since it sorts; `canMove`
 * refuses more.
 */
function FileTree({
  paths,
  children,
  status,
  query = "",
  flatten = true,
  sort,
  statusLabels,
  current,
  expanded,
  defaultExpanded,
  onExpandedChange,
  handle,
  onRename,
  onMove,
  canRename,
  canDrag,
  canMove,
  labels: labelsProp,
  ...props
}: Omit<
  TreeProps,
  | "items"
  | "filter"
  | "children"
  | "textValue"
  | "onRename"
  | "onMove"
  | "canRename"
  | "canDrag"
  | "canDrop"
  | "renameValue"
  | "renameSelection"
  | "validateName"
  | "menu"
  | "labels"
> & {
  paths: readonly string[];
  children: (file: FileNode, row: TreeRowState) => React.ReactNode;
  status?: Readonly<Record<string, FileStatus>>;
  query?: string;
  flatten?: boolean;
  sort?: FileTreeOptions["sort"];
  statusLabels?: Partial<FileStatusLabels>;
  onRename?: (from: string, to: string) => void;
  onMove?: (from: string, to: string) => void;
  canRename?: (path: string) => boolean;
  canDrag?: (path: string) => boolean;
  canMove?: (from: string, to: string) => boolean;
  menu?: (file: FileNode, actions: TreeMenuActions) => React.ReactNode;
  labels?: Partial<TreeLabels & FileTreeLabels>;
}) {
  const nodes = React.useMemo(
    () => fileTreeNodes(paths, { flatten, sort }),
    [paths, flatten, sort],
  );
  const statuses = React.useMemo(
    () => fileStatuses(nodes, status ?? {}),
    [nodes, status],
  );
  const filter = React.useMemo(() => fileMatcher(query), [query]);
  const resolve = React.useCallback(
    (list: readonly string[] | undefined) =>
      list?.flatMap((path) => resolveFileRow(nodes, path) ?? []),
    [nodes],
  );
  const currentRow =
    current === undefined
      ? undefined
      : (resolveFileRow(nodes, current) ?? current);
  // Held here unless the app holds them, so a folder renamed or moved stays
  // open under its new path; opened to the current place from the first
  // render, as the tree would.
  const [inner, setInner] = React.useState<readonly string[]>(() => [
    ...(resolve(defaultExpanded) ?? []),
    ...((currentRow !== undefined && ancestorsOf(nodes, currentRow)) || []),
  ]);
  const expandedRows = React.useMemo(
    () => resolve(expanded ?? inner),
    [resolve, expanded, inner],
  );
  const labels = React.useMemo(
    () => ({ ...STATUS_LABELS, ...statusLabels }),
    [statusLabels],
  );
  const editLabels = { ...FILE_LABELS, ...labelsProp };
  const context = React.useMemo(
    () => ({ statuses, query: query.trim(), labels }),
    [statuses, query, labels],
  );
  const taken = React.useMemo(() => pathsOf(nodes), [nodes]);
  const tree = React.useRef<TreeHandle>(null);
  React.useImperativeHandle(
    handle,
    () => ({
      scrollToItem(path, align) {
        tree.current?.scrollToItem(resolveFileRow(nodes, path) ?? path, align);
      },
      rename(path) {
        tree.current?.rename(resolveFileRow(nodes, path) ?? path);
      },
    }),
    [nodes],
  );

  const pathIn = (folder: string, file: FileNode, name = file.name) =>
    `${folder}${name}${file.directory ? "/" : ""}`;
  const moved = (from: string, to: string) => {
    if (expanded === undefined)
      setInner((open) => open.map((path) => movePath(path, from, to)));
  };
  const intoFolder = (file: FileNode, target: TreeMoveTarget) => {
    const folder = target.parentId ?? "";
    return target.position === "into" && (folder === "" || folder.endsWith("/"))
      ? pathIn(folder, file)
      : undefined;
  };

  return (
    <FileTreeContext.Provider value={context}>
      <Tree
        items={nodes}
        filter={filter}
        current={currentRow}
        expanded={expandedRows}
        onExpandedChange={(next) => {
          if (expanded === undefined) setInner(next);
          onExpandedChange?.(next);
        }}
        textValue={textValue}
        handle={tree}
        labels={editLabels}
        onRename={
          onRename &&
          ((file, name) => {
            const to = pathIn(folderOf(file.id), file, name);
            moved(file.id, to);
            onRename(file.id, to);
            return to;
          })
        }
        canRename={canRename && ((file) => canRename(file.id))}
        renameValue={(file) => file.name}
        renameSelection={(file, value) => [
          0,
          file.directory ? value.length : fileStem(value),
        ]}
        validateName={(file, name) => {
          if (name.includes("/")) return editLabels.nameHasSlash;
          const to = pathIn(folderOf(file.id), file, name);
          return to !== file.id && taken.has(to)
            ? editLabels.nameTaken(name)
            : undefined;
        }}
        onMove={
          onMove &&
          ((file, target) => {
            const to = intoFolder(file, target);
            if (to === undefined) return;
            moved(file.id, to);
            onMove(file.id, to);
            return to;
          })
        }
        canDrag={canDrag && ((file) => canDrag(file.id))}
        // It sorts its rows, so a drop goes into a folder and nowhere
        // beside a row; one back into its own folder does nothing.
        canDrop={(file, target) => {
          const to = intoFolder(file, target);
          return (
            to !== undefined &&
            to !== file.id &&
            !taken.has(to) &&
            (canMove?.(file.id, to) ?? true)
          );
        }}
        {...props}
      >
        {(file, row) => (
          <FileRowContext.Provider value={{ file, row }}>
            {children(file, row)}
          </FileRowContext.Provider>
        )}
      </Tree>
    </FileTreeContext.Provider>
  );
}

const textValue = (file: FileNode) => file.segments.join(" / ");

/**
 * The status lane's mark: a letter, a dot for a folder holding changes, nothing for ignored.
 * Each status's colour rides on `data-status`.
 */
const MARK =
  "flex w-3 shrink-0 items-center justify-center text-ui-xs font-semibold tabular-nums data-[status=added]:text-success data-[status=deleted]:text-destructive data-[status=modified]:text-warning data-[status=renamed]:text-success data-[status=untracked]:text-success raymond:text-ui raymond:font-bold";

const LETTERS: Partial<Record<FileRowStatus, string>> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  untracked: "U",
};

/**
 * A file's status as a file tree's status lane draws it, for a row outside the tree (a folder's
 * listing). Hidden from a screen reader: say the status in the row's text.
 */
function FileStatusMark({
  status,
  label,
  className,
  ...props
}: React.ComponentProps<"span"> & { status: FileRowStatus; label?: string }) {
  return (
    <span
      aria-hidden
      title={label}
      data-slot="file-status-mark"
      data-status={status}
      className={cn(MARK, className)}
      {...props}
    >
      {status === "changes" ? (
        <span className="size-1.5 rounded-full bg-muted-foreground" />
      ) : (
        LETTERS[status]
      )}
    </span>
  );
}

const NAME: Partial<Record<FileRowStatus, string>> = {
  added: "text-success",
  modified: "text-warning",
  deleted: "text-destructive",
  renamed: "text-success",
  untracked: "text-success",
  // The default style draws every row muted, so an ignored one fades
  // further; raymond draws rows black, and an ignored one grey.
  ignored: "text-muted-foreground opacity-60 raymond:opacity-100",
};

/**
 * A file tree row's place: as `TreeItem`, drawn with the file's icon, name and status. `icon`
 * replaces the file-type or folder icon, and null draws none; `children`, or an `asChild`
 * link's own, follow the name.
 */
function FileTreeItem({
  icon,
  asChild = false,
  className,
  children,
  ...props
}: React.ComponentProps<typeof TreeItem> & {
  icon?: LucideIcon | null;
}) {
  const tree = React.useContext(FileTreeContext);
  const fileRow = React.useContext(FileRowContext);
  if (!tree || !fileRow)
    throw new Error("FileTreeItem renders inside a FileTree's row");
  const { file, row } = fileRow;
  const status = tree.statuses.get(file.id);
  const Icon =
    icon === undefined
      ? file.directory
        ? row.expanded
          ? FolderOpenIcon
          : FolderIcon
        : fileTypeIcon(file.name)
      : icon;
  return (
    <TreeItem
      asChild={asChild}
      data-status={status}
      className={className}
      {...props}
    >
      {Icon && (
        <Icon
          className={cn(
            status === "ignored" &&
              !row.current &&
              "text-muted-foreground opacity-60 raymond:opacity-100",
          )}
        />
      )}
      {/* The current row's name goes back to the tree's own colour, the
          place outranking the status; its mark keeps the status's. */}
      <TreeLabel
        className={cn(
          status && !row.current && NAME[status],
          status === "deleted" && "line-through",
        )}
      >
        {/* A rename changes the deepest folder alone: the field covers it
            and the folders before it stay in sight. */}
        {file.segments.map((segment, index) =>
          index < file.segments.length - 1 ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: one per merged folder, never reordered; two may share a name
            <span key={index} className="group-data-renaming/tree-row:visible">
              <MatchedText text={segment} query={tree.query} />
              <span className="text-muted-foreground/70">{" / "}</span>
            </span>
          ) : (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: as above
              key={index}
              data-rename-from={file.segments.length > 1 ? "" : undefined}
            >
              <MatchedText text={segment} query={tree.query} />
            </span>
          ),
        )}
      </TreeLabel>
      {asChild ? <Slot.Slottable>{children}</Slot.Slottable> : children}
      {status && (
        <>
          <span className="sr-only">, {tree.labels[status]}</span>
          <FileStatusMark
            status={status}
            label={tree.labels[status]}
            className="ml-auto"
          />
        </>
      )}
    </TreeItem>
  );
}

export { FileStatusMark, FileTree, FileTreeItem };
