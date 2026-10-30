import { Button } from "@orz/ui/components/button";
import { ModuleMarker } from "@orz/ui/components/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@orz/ui/components/popover";
import { cn } from "@orz/ui/lib/utils";
import type {
  CodeViewItem,
  FileDiffMetadata,
  ParsedPatch,
} from "@pierre/diffs";
import type { CodeViewHandle } from "@pierre/diffs/react";
import {
  ChevronDownIcon,
  CodeIcon,
  FileDiffIcon,
  GitCommitHorizontalIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CappedCodeBlock } from "./capped-code-block.tsx";
import {
  LoadingCodeFallback,
  PATCH_HEADER_HEIGHT,
  PatchFiles,
  parsePatch,
  patchCommitId,
  patchFileId,
} from "./code-block.tsx";
import {
  formatCommitDate,
  type PatchCommit,
  parsePatchCommit,
} from "./patch-commit.ts";

type Parsed =
  | { kind: "pending" }
  | { kind: "patch"; patches: ParsedPatch[] }
  | { kind: "invalid" }
  // The parser's chunk never arrived (offline): nothing is known about the
  // text, so it is not called invalid.
  | { kind: "unavailable" };

type Stat = { plus: number; minus: number };

function countLines(file: FileDiffMetadata): Stat {
  let plus = 0;
  let minus = 0;
  for (const hunk of file.hunks) {
    plus += hunk.additionLines;
    minus += hunk.deletionLines;
  }
  return { plus, minus };
}

function Counts({ plus, minus }: Stat) {
  return (
    <span className="shrink-0 space-x-1 font-mono text-ui-sm tabular-nums">
      {plus > 0 && <span className="diff-addition-text">+{plus}</span>}
      {minus > 0 && <span className="diff-deletion-text">−{minus}</span>}
    </span>
  );
}

function fileLabel(file: FileDiffMetadata): string {
  return file.prevName !== undefined && file.prevName !== file.name
    ? `${file.prevName} → ${file.name}`
    : file.name;
}

const HEADER_ROW = "flex min-w-0 items-center gap-2 px-3 text-ui";

function CommitHeader({ commit }: { commit: PatchCommit }) {
  const date =
    commit.date === undefined ? undefined : formatCommitDate(commit.date);
  return (
    <div className={HEADER_ROW} style={{ height: PATCH_HEADER_HEIGHT }}>
      <GitCommitHorizontalIcon className="size-4 shrink-0 text-muted-foreground" />
      {commit.series !== undefined && (
        <span className="shrink-0 rounded-chip border px-1.5 text-ui-2xs leading-4 text-muted-foreground tabular-nums">
          {commit.series}
        </span>
      )}
      <span className="min-w-0 truncate font-medium" title={commit.subject}>
        {commit.subject === "" ? "Message" : commit.subject}
      </span>
      <span className="ml-auto shrink-0 text-ui-sm text-muted-foreground">
        {commit.author}
        {commit.author && date ? " · " : null}
        {date && <time>{date}</time>}
        {commit.hash !== undefined && (
          <span className="ml-2 font-mono">{commit.hash.slice(0, 7)}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Changed lines past which a file's diff waits behind "Load diff". Not a speed
 * limit — a 40,000-line file drew in 0.1 s — but a reading one: a generated
 * file that size buries the files around it.
 */
export const LARGE_DIFF_LINES = 2000;

function FileHeader({
  file,
  stat,
  onLoad,
}: {
  file: FileDiffMetadata;
  stat: Stat;
  /** Present while the diff is held back. */
  onLoad?: () => void;
}) {
  const label = fileLabel(file);
  return (
    <div className={HEADER_ROW} style={{ height: PATCH_HEADER_HEIGHT }}>
      <FileDiffIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate font-mono text-ui-sm" title={label}>
        {label}
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {onLoad !== undefined && (
          <Button type="button" size="xs" variant="outline" onClick={onLoad}>
            Load diff
          </Button>
        )}
        <Counts {...stat} />
      </span>
    </div>
  );
}

function FileList({
  files,
  stats,
  onJump,
}: {
  files: FileDiffMetadata[];
  stats: Stat[];
  /** Absent where nothing could scroll to the file. */
  onJump?: (index: number) => void;
}) {
  return (
    <ul className="divide-y text-ui-sm">
      {files.map((file, index) => {
        // A long path gives up its directories, never the file's own name.
        const slash = file.name.lastIndexOf("/");
        const row = (
          <>
            <span className="flex min-w-0 font-mono">
              <span className="min-w-0 truncate text-muted-foreground">
                {file.name.slice(0, slash + 1)}
              </span>
              <span className="shrink-0">{file.name.slice(slash + 1)}</span>
            </span>
            <Counts {...(stats[index] ?? { plus: 0, minus: 0 })} />
          </>
        );
        const rowClass =
          "flex w-full items-center justify-between gap-3 px-2.5 py-1.5";
        return (
          // Two entries may name one file (a multi-commit patch); the
          // position is what tells them apart.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <li key={index} title={fileLabel(file)}>
            {onJump !== undefined ? (
              <button
                type="button"
                onClick={() => onJump(index)}
                className={cn(
                  rowClass,
                  "cursor-pointer text-left hover:bg-muted",
                )}
              >
                {row}
              </button>
            ) : (
              <div className={rowClass}>{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function FilesMenu({
  files,
  stats,
  onJump,
}: {
  files: FileDiffMetadata[];
  stats: Stat[];
  onJump?: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const total = stats.reduce(
    (sum, s) => ({ plus: sum.plus + s.plus, minus: sum.minus + s.minus }),
    { plus: 0, minus: 0 },
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="font-normal text-muted-foreground"
        >
          <span className="tabular-nums">{files.length} files</span>
          <Counts {...total} />
          <ChevronDownIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[55vh] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto p-0"
      >
        <FileList
          files={files}
          stats={stats}
          onJump={
            onJump === undefined
              ? undefined
              : (index) => {
                  setOpen(false);
                  onJump(index);
                }
          }
        />
      </PopoverContent>
    </Popover>
  );
}

/** How the diffs' box is capped; see `PatchView`'s `fit`. */
const FIT_CLASS = {
  flow: "max-h-[70vh] overflow-auto",
  // Not --attachment-pane-height: maximized, that is 100%, which resolves
  // against the auto-height wrappers in between to no cap at all, and the
  // view lays out every line. The 3.5rem leaves room for a frame's own bar
  // inside the 75vh pane.
  pane: "max-h-[calc(75vh-3.5rem)] overflow-auto",
  // Any cap past the card's own works: the card hides the rest, and the
  // reader expands the card rather than scrolling inside it. A card capped
  // taller than the screen, or not at all, cuts the patch at one screen.
  clipped: "max-h-screen overflow-hidden",
} as const;

export type PatchViewProps = {
  /** Names the raw view's highlighting. */
  filename: string;
  text: string;
  /** Line numbers on the raw view, as whole files have them. */
  lineNumbers?: boolean;
  /**
   * Say so when the text is not a patch. A file named .patch promised one; a
   * fence tagged `diff` holding a bare +/- snippet never did.
   */
  invalidNote?: boolean;
  /**
   * The box the diffs scroll in, which has to be capped for the view to
   * virtualize. `flow` (default): within a document, up to 70vh. `pane`: the
   * attachment viewer, within its 75vh pane. `clipped`: inside a card that
   * hides its overflow below one screen, so the diffs do not scroll and the
   * file list does not jump, since nothing the reader can do would scroll
   * back.
   */
  fit?: keyof typeof FIT_CLASS;
  /**
   * Where the surrounding title bar takes the controls (`useContentTitleBar`);
   * null until it has mounted. Undefined, the patch draws a bar of its own.
   */
  titleBar?: HTMLElement | null;
};

/**
 * A unified diff drawn as one diff per file, each commit's subject, author and
 * message above its files. The file list and the way back to the text as
 * written are controls of the surface around it: a card or viewer lends a spot
 * in its title bar, and a fence, which has none, gets a frame with one.
 * Text that does not parse cleanly stays that text: see `parsePatch` for why a
 * half-parsed patch is never drawn.
 */
export function PatchView({
  filename,
  text,
  lineNumbers = false,
  invalidNote = false,
  fit = "flow",
  titleBar,
}: PatchViewProps) {
  const [parsed, setParsed] = useState<Parsed>({ kind: "pending" });
  const [raw, setRaw] = useState(false);
  const [loaded, setLoaded] = useState<ReadonlySet<number>>(() => new Set());
  const view = useRef<CodeViewHandle<undefined, undefined>>(null);

  useEffect(() => {
    let live = true;
    setParsed({ kind: "pending" });
    setLoaded(new Set());
    // A fence body arrives without its last newline. The patch's own
    // "\ No newline at end of file" markers carry that fact, not this one.
    parsePatch(text.endsWith("\n") ? text : `${text}\n`).then(
      (patches) => {
        if (live) {
          setParsed(
            patches === null ? { kind: "invalid" } : { kind: "patch", patches },
          );
        }
      },
      () => {
        if (live) setParsed({ kind: "unavailable" });
      },
    );
    return () => {
      live = false;
    };
  }, [text]);

  const patches = parsed.kind === "patch" ? parsed.patches : null;
  const drawn = useMemo(() => {
    if (patches === null) return null;
    const files = patches.flatMap((patch) => patch.files);
    const stats = files.map(countLines);
    const commits = patches.map((patch) =>
      parsePatchCommit(patch.patchMetadata ?? ""),
    );
    const messages = commits.map((commit) => commit?.body ?? null);
    // A lone file is what the reader opened the patch for.
    const large = new Set<number>();
    if (files.length > 1) {
      stats.forEach((stat, index) => {
        if (stat.plus + stat.minus > LARGE_DIFF_LINES) large.add(index);
      });
    }
    return { files, stats, commits, messages, large };
  }, [patches]);
  const collapsed = useMemo(() => {
    const held = new Set<number>();
    for (const index of drawn?.large ?? []) {
      if (!loaded.has(index)) held.add(index);
    }
    return held;
  }, [drawn, loaded]);
  const headers = useMemo(() => {
    const rows = new Map<string, ReactNode>();
    if (drawn === null) return rows;
    drawn.commits.forEach((commit, index) => {
      if (commit !== null) {
        rows.set(patchCommitId(index), <CommitHeader commit={commit} />);
      }
    });
    drawn.files.forEach((file, index) => {
      rows.set(
        patchFileId(index),
        <FileHeader
          file={file}
          stat={drawn.stats[index] ?? { plus: 0, minus: 0 }}
          onLoad={
            collapsed.has(index)
              ? () => setLoaded((shown) => new Set(shown).add(index))
              : undefined
          }
        />,
      );
    });
    return rows;
  }, [drawn, collapsed]);

  if (parsed.kind === "pending") {
    return <LoadingCodeFallback contents={text} className={FIT_CLASS[fit]} />;
  }
  if (patches === null || drawn === null) {
    return (
      <>
        {parsed.kind === "invalid" && invalidNote && (
          <p className="mb-2 text-ui-sm text-muted-foreground">
            Not a valid patch — showing the text.
          </p>
        )}
        <CappedCodeBlock
          filename={filename}
          contents={text}
          lineNumbers={lineNumbers}
        />
      </>
    );
  }

  const { files, stats, messages } = drawn;
  const controls = (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      {files.length > 1 && !raw && (
        <FilesMenu
          files={files}
          stats={stats}
          onJump={
            fit === "clipped"
              ? undefined
              : (index) =>
                  view.current?.scrollTo({
                    type: "item",
                    id: patchFileId(index),
                    align: "start",
                  })
          }
        />
      )}
      <Button
        type="button"
        size="xs"
        variant="ghost"
        aria-pressed={raw}
        title={raw ? "Back to the diff" : "The patch as written"}
        className={cn(
          "font-normal text-muted-foreground",
          raw && "bg-muted text-foreground",
        )}
        onClick={() => setRaw((shown) => !shown)}
      >
        <CodeIcon />
        raw
      </Button>
    </span>
  );
  const body = raw ? (
    <CappedCodeBlock
      filename={filename}
      contents={text}
      lineNumbers={lineNumbers}
    />
  ) : (
    <PatchFiles
      patches={patches}
      messages={messages}
      collapsedFiles={collapsed}
      text={text}
      viewRef={view}
      renderHeader={(item: CodeViewItem<undefined>) => headers.get(item.id)}
      className={FIT_CLASS[fit]}
    />
  );

  if (titleBar !== undefined) {
    return (
      <>
        {titleBar !== null && createPortal(controls, titleBar)}
        {body}
      </>
    );
  }
  return (
    <div className="overflow-hidden rounded-frame ring-1 ring-border">
      <div className="flex items-center gap-2 border-b bg-muted py-1 pr-1.5 pl-2 text-ui-sm text-muted-foreground">
        <ModuleMarker icon={<FileDiffIcon />} />
        <span className="font-bold text-foreground">patch</span>
        <span className="ml-auto" />
        {controls}
      </div>
      <div className="p-2">{body}</div>
    </div>
  );
}
