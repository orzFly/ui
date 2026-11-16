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
  fileTreeNodes,
  fileTypeIcon,
  resolveFileRow,
} from "../lib/file-tree.ts";
import { cn } from "../lib/utils.ts";
import { MatchedText } from "./filter-menu.tsx";
import type { TreeHandle, TreeRowState } from "./tree.tsx";
import { Tree, TreeItem, TreeLabel } from "./tree.tsx";

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
 * hands back row ids, and `handle`'s `scrollToItem` takes a path. Typing jumps to a row by its
 * name. Memoize `paths`.
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
  handle,
  ...props
}: Omit<TreeProps, "items" | "filter" | "children" | "textValue"> & {
  paths: readonly string[];
  children: (file: FileNode, row: TreeRowState) => React.ReactNode;
  status?: Readonly<Record<string, FileStatus>>;
  query?: string;
  flatten?: boolean;
  sort?: FileTreeOptions["sort"];
  statusLabels?: Partial<FileStatusLabels>;
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
  const expandedRows = React.useMemo(
    () => resolve(expanded),
    [resolve, expanded],
  );
  const labels = React.useMemo(
    () => ({ ...STATUS_LABELS, ...statusLabels }),
    [statusLabels],
  );
  const context = React.useMemo(
    () => ({ statuses, query: query.trim(), labels }),
    [statuses, query, labels],
  );
  const tree = React.useRef<TreeHandle>(null);
  React.useImperativeHandle(
    handle,
    () => ({
      scrollToItem(path, align) {
        tree.current?.scrollToItem(resolveFileRow(nodes, path) ?? path, align);
      },
    }),
    [nodes],
  );
  return (
    <FileTreeContext.Provider value={context}>
      <Tree
        items={nodes}
        filter={filter}
        current={
          current === undefined
            ? undefined
            : (resolveFileRow(nodes, current) ?? current)
        }
        expanded={expandedRows}
        defaultExpanded={resolve(defaultExpanded)}
        textValue={textValue}
        handle={tree}
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
        {file.segments.map((segment, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one per merged folder, never reordered; two may share a name
          <React.Fragment key={index}>
            {index > 0 && (
              <span className="text-muted-foreground/70">{" / "}</span>
            )}
            <MatchedText text={segment} query={tree.query} />
          </React.Fragment>
        ))}
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
