import { Button } from "@orz/ui/components/button";
import { copyToClipboard } from "@orz/ui/lib/clipboard";
import { cn } from "@orz/ui/lib/utils";
import {
  type ColorScheme,
  type TextMateTheme,
  type Theme,
  useTheme,
} from "@orz/ui/theme";
import type { CodeViewItem, ParsedPatch, PostRenderPhase } from "@pierre/diffs";
import type {
  CodeViewHandle,
  CodeViewProps,
  MultiFileDiffProps,
} from "@pierre/diffs/react";
import { CopyIcon } from "lucide-react";
import {
  Component,
  type ComponentType,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type CodeWorkerFactory,
  useCodeWorkerFactory,
} from "./code-worker.tsx";
import { ensureSyntaxTheme, loadPierre } from "./syntax-registry.ts";
import {
  indentWrappedLines,
  WRAP_INDENT_CSS,
  WRAP_MARKER_STYLE,
  wrapLineStyle,
} from "./wrap-indent.ts";

type Chunk<P> =
  | { status: "loaded"; Component: ComponentType<P> }
  | { status: "failed"; error: unknown };

/**
 * A component fetched in its own chunk on first render, drawing `fallback`
 * until it arrives.
 *
 * Not `lazy()`, because suspending throws away far more than the code block.
 * On a page's first load the nearest boundary that has never shown its
 * content is often the app shell's, and React does not commit a retry that
 * suspends within 300 ms of that boundary's fallback: when the chunk lands it
 * renders the whole page again from scratch, every component above the block
 * and a long document's markdown parse included.
 *
 * Not `useSyncExternalStore` either: a store that changes while a concurrent
 * render is yielding fails React's consistency check, and the whole render is
 * redone synchronously. The chunk landing mid-render is exactly that change.
 */
function chunkComponent<P extends object>(
  load: () => Promise<ComponentType<P>>,
): ComponentType<P & { fallback?: ReactNode }> {
  let chunk: Chunk<P> | undefined;
  let settled: Promise<Chunk<P>> | undefined;
  const start = () => {
    settled ??= load().then(
      (Component): Chunk<P> => {
        chunk = { status: "loaded", Component };
        return chunk;
      },
      (error: unknown): Chunk<P> => {
        chunk = { status: "failed", error };
        return chunk;
      },
    );
    return settled;
  };
  return function ChunkComponent({
    fallback = null,
    ...props
  }: P & { fallback?: ReactNode }) {
    const [current, setCurrent] = useState(chunk);
    const waiting = current === undefined;
    // Started from render, as lazy() does, so the fetch is not held back
    // until the page commits. Not on a server, which draws the fallback the
    // client's first render draws too: no chunk is there yet as a page
    // hydrates.
    if (waiting && typeof document !== "undefined") void start();
    useEffect(() => {
      if (!waiting) return;
      let live = true;
      void start().then((next) => {
        if (live) setCurrent(next);
      });
      return () => {
        live = false;
      };
    }, [waiting]);
    // Rethrown as lazy() would, so CodeViewBoundary still turns a chunk that
    // never arrives (offline) into plain text.
    if (current?.status === "failed") throw current.error;
    if (current?.status !== "loaded") return fallback;
    return <current.Component {...(props as P)} />;
  };
}

type CodeViewComponentProps = CodeViewProps<undefined, undefined> & {
  ref?: Ref<CodeViewHandle<undefined, undefined>>;
};

function setRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref != null) ref.current = value;
}

/**
 * pierre's CodeView, laid out again whenever its content's height changes.
 *
 * pierre measures each wrapped line at the width it is drawn at and keeps that height for lines
 * it stops drawing. It lays out again when its box or the items it draws change size, but not
 * when measuring those items moves others into its window. So when a box's width collapses and
 * comes back (a pane dragged shut, a headless screenshot that lays the page out at 1×1), the
 * lines it measured meanwhile are a character wide and hundreds of pixels tall. The items it
 * draws again measure back to size, but those their shrinking pulls into view stay undrawn, and
 * the drawn ones sit low in the box (UI-217).
 */
function settling(
  CodeView: ComponentType<CodeViewComponentProps>,
): ComponentType<CodeViewComponentProps> {
  return function SettlingCodeView({
    ref,
    containerRef,
    ...props
  }: CodeViewComponentProps) {
    const view = useRef<CodeViewHandle<undefined, undefined> | null>(null);
    const [root, setRoot] = useState<HTMLDivElement | null>(null);
    const viewRef = useCallback(
      (handle: CodeViewHandle<undefined, undefined> | null) => {
        view.current = handle;
        setRef(ref, handle);
      },
      [ref],
    );
    const rootRef = useCallback(
      (node: HTMLDivElement | null) => {
        setRoot(node);
        setRef(containerRef, node);
      },
      [containerRef],
    );
    useEffect(() => {
      if (root === null || typeof ResizeObserver === "undefined") return;
      // The root's children are what pierre sizes to the content: the root
      // itself is capped by the caller, and pierre already watches it.
      const observer = new ResizeObserver(() =>
        view.current?.getInstance()?.render(),
      );
      for (const child of root.children) observer.observe(child);
      return () => observer.disconnect();
    }, [root]);
    return <CodeView {...props} ref={viewRef} containerRef={rootRef} />;
  };
}

// @pierre/diffs is the heaviest dependency in the web bundle (T-24). Every
// value import goes through chunkComponent() here so the library lands in its
// own chunk, fetched the first time a code surface actually renders; the rest
// of the app must only use type imports. Each loader waits for loadPierre()
// too, so a palette's own syntax theme is registered before the first view.
const LazyCodeView = chunkComponent(() =>
  Promise.all([import("@pierre/diffs/react"), loadPierre()]).then(([m]) =>
    settling(m.CodeView as ComponentType<CodeViewComponentProps>),
  ),
);

/**
 * CodeView with its tokenizing moved into pierre's worker pool, started from
 * the factory a `CodeWorkerProvider` lends. pierre tokenizes the whole file
 * even when only a screenful of lines is drawn: 1 MiB of log held the tab for
 * 9.3 s on the main thread, 0.2 s with the worker. The lines show as plain
 * text at once, and their colours follow.
 */
const LazyWorkerCodeView = chunkComponent(() =>
  Promise.all([import("@pierre/diffs/react"), loadPierre()]).then(([m]) => {
    const CodeView = settling(
      m.CodeView as ComponentType<CodeViewComponentProps>,
    );
    // The pool keeps the theme it was created with and overrides each
    // view's own; a theme switch while it lives has to reach it here.
    function ThemeSync({ theme }: { theme: SyntaxTheme }) {
      const pool = m.useWorkerPool();
      useEffect(() => {
        pool?.setRenderOptions({ theme }).catch(() => {});
      }, [pool, theme]);
      return null;
    }
    function WorkerCodeView({
      workerFactory,
      ...props
    }: CodeViewComponentProps & { workerFactory: CodeWorkerFactory }) {
      const theme = useSyntaxTheme();
      const [poolOptions] = useState(() => ({
        workerFactory,
        // One file is open at a time; each worker loads its own highlighter.
        poolSize: 2,
      }));
      const [highlighterOptions] = useState(() => ({
        theme,
        preferredHighlighter: PIERRE_HIGHLIGHTER,
      }));
      return (
        <m.WorkerPoolContextProvider
          poolOptions={poolOptions}
          highlighterOptions={highlighterOptions}
        >
          <ThemeSync theme={theme} />
          <CodeView {...props} />
        </m.WorkerPoolContextProvider>
      );
    }
    return WorkerCodeView;
  }),
);

/**
 * pierre's `MultiFileDiff`, fetched in its own chunk the first time one
 * renders. It draws `fallback` (nothing by default) until the chunk arrives
 * rather than suspending, so it needs no `<Suspense>` above it and a page's
 * first render is not thrown away waiting for it.
 */
export const LazyMultiFileDiff = chunkComponent(() =>
  Promise.all([import("@pierre/diffs/react"), loadPierre()]).then(
    ([m]) =>
      m.MultiFileDiff as ComponentType<
        MultiFileDiffProps<undefined, undefined>
      >,
  ),
);

/**
 * A unified diff split into commits and their files, or null when the text is
 * not one. Strict on purpose: pierre's lenient mode skips a hunk whose counts
 * do not add up and carries on, so the reader would be shown a patch with a
 * change silently missing. Text before the first file — a commit message — is
 * no reason to refuse; a patch with no file in it is.
 */
export async function parsePatch(text: string): Promise<ParsedPatch[] | null> {
  const { parsePatchFiles } = await import("@pierre/diffs");
  try {
    const patches = parsePatchFiles(text, undefined, true);
    return patches.some((patch) => patch.files.length > 0) ? patches : null;
  } catch {
    return null;
  }
}

export const PIERRE_THEME = {
  dark: "pierre-dark",
  light: "pierre-light",
} as const;

/**
 * "system" makes pierre inject no color-scheme pin of its own; the actual
 * scheme is forced from the outer tree by the `diffs-container` rules in
 * this package's styles.css, which follow the app theme (T-36). Options objects that
 * captured this value at module scope stay correct for the same reason.
 */
export const PIERRE_THEME_TYPE = "system" as const;

export type SyntaxTheme = { light: string; dark: string };

// Keyed by the pair, so every surface on the page hands pierre the same
// object identity across renders (props-stability guidance below).
const SYNTAX_THEMES = new Map<string, SyntaxTheme>();

function syntaxOf(
  theme: Theme,
  scheme: ColorScheme,
  variant: string | undefined,
): string | TextMateTheme | undefined {
  const palette = theme[scheme];
  const variants = palette?.variants;
  const picked =
    variant !== undefined && variants && Object.hasOwn(variants, variant)
      ? variants[variant]
      : undefined;
  return picked?.syntax ?? palette?.syntax;
}

/**
 * Syntax token colors for the active theme (T-144). Under "system" each slot
 * takes its own palette's shiki theme, because the light/dark choice is then
 * made by CSS light-dark() inside the shadow root rather than by a React
 * render. A pinned mode or a one-palette theme fills both slots from the side
 * on screen: the slot the browser will not paint is irrelevant. A palette
 * with no shiki theme keeps that slot of pierre's own pair, and one that
 * carries its own theme object has it registered with pierre under its name.
 */
export function useSyntaxTheme(): SyntaxTheme {
  const { pref, theme, colorScheme } = useTheme();
  const variant = pref.ui?.variant;
  const both = pref.ui?.mode === "system" && theme.light && theme.dark;
  const nameOf = (scheme: ColorScheme) => {
    const syntax = syntaxOf(theme, scheme, variant);
    return typeof syntax === "object" ? ensureSyntaxTheme(syntax) : syntax;
  };
  const light = nameOf(both ? "light" : colorScheme) ?? PIERRE_THEME.light;
  const dark = nameOf(both ? "dark" : colorScheme) ?? PIERRE_THEME.dark;
  const key = `${light}\0${dark}`;
  let cached = SYNTAX_THEMES.get(key);
  if (cached === undefined) {
    cached =
      light === PIERRE_THEME.light && dark === PIERRE_THEME.dark
        ? PIERRE_THEME
        : { light, dark };
    SYNTAX_THEMES.set(key, cached);
  }
  return cached;
}

// pierre's own font stack, not the page's monospace, which resolves to a
// different face and would shift every glyph when pierre lands.
const PIERRE_FONT_FAMILY =
  'var(--diffs-font-family, "SF Mono", Monaco, Consolas, "Ubuntu Mono", "Liberation Mono", "Courier New", monospace)';

// `.markdown-body pre` and `code`, which a fence sits inside, draw a grey box,
// padding and smaller type that pierre never draws; each class here beats them.
const PLAIN_PRE =
  "m-0 rounded-none bg-transparent p-0 [font:inherit] raymond:shadow-none";

// A block per line carries the line's own hang. The newlines stay in the text
// between the blocks, so it copies and reads as written.
function wrappedLines(contents: string): ReactNode {
  const lines = contents.split("\n");
  return lines.map((line, index) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position
    <span key={index} style={wrapLineStyle(line)}>
      <span aria-hidden style={WRAP_MARKER_STYLE} />
      {index < lines.length - 1 ? `${line}\n` : line}
    </span>
  ));
}

/**
 * The code, unhighlighted, drawn as pierre draws it: what every code surface
 * shows until pierre has drawn, and for good when it cannot. Anything else
 * jumps when the highlighting arrives (UI-227). So, as pierre: its 8px layout
 * margin, left unpainted, then its background (`diffs-container`'s, in
 * styles.css) with 8px above and below the lines; its font at 13px on 20px
 * lines with tabs two wide, or what pierre's `--diffs-*` properties make them;
 * 1ch either side of a line. A snippet wraps, hanging each line's continuation
 * rows as pierre does; a file scrolls sideways beside its line numbers, which
 * take pierre's gutter: 2ch before, at least 3ch wide, 1ch and its 2px rule
 * after, the foreground mixed 65% into the background.
 */
export function PlainCodeFallback({
  contents,
  lineNumbers = false,
  className,
}: {
  contents: string;
  lineNumbers?: boolean;
  /** The view's own: it caps the height, around the margin as pierre's root does. */
  className?: string;
}) {
  return (
    <div className={className}>
      <div
        className="my-2 flex bg-(--plain-code-bg) py-2 text-[length:var(--diffs-font-size,13px)] leading-[var(--diffs-line-height,20px)] text-foreground [--plain-code-bg:var(--background)] [tab-size:var(--diffs-tab-size,2)] raymond:[--plain-code-bg:var(--window)]"
        style={{ fontFamily: PIERRE_FONT_FAMILY }}
      >
        {lineNumbers && (
          <pre
            aria-hidden
            className={cn(
              PLAIN_PRE,
              "box-content min-w-[var(--diffs-min-number-column-width,3ch)] shrink-0 border-r-2 border-transparent pr-[1ch] pl-[2ch] text-right text-[color-mix(in_lab,var(--foreground)_65%,var(--plain-code-bg))] select-none",
            )}
          >
            {Array.from(
              { length: contents.split("\n").length },
              (_, index) => index + 1,
            ).join("\n")}
          </pre>
        )}
        <pre
          className={cn(
            PLAIN_PRE,
            "min-w-0 flex-1",
            lineNumbers
              ? "overflow-x-auto px-[1ch]"
              : "wrap-anywhere whitespace-pre-wrap",
          )}
        >
          <code className={PLAIN_PRE}>
            {lineNumbers ? contents : wrappedLines(contents)}
          </code>
        </pre>
      </div>
    </div>
  );
}

// Storybook's a11y check (axe's color-contrast) runs over whatever a story
// shows when it renders, which for a long file is this stand-in: it held the
// tab 51 ms over 500 lines, 4 s over 10,000, and past a minute over the
// CodeWorkerProvider story's 45,000 (UI-134).
const LOADING_LINES = 500;

/**
 * What a code surface shows until pierre has drawn: the code unhighlighted,
 * in the box the view will take, and only its start. Laid out whole, a long
 * file's stand-in costs what the view's virtualization saves — 45,000 lines
 * made the page 744,814px tall — and the view replaces it before the reader
 * has scrolled far.
 */
export function LoadingCodeFallback({
  contents,
  lineNumbers,
  className,
}: {
  contents: string;
  lineNumbers?: boolean;
  className?: string;
}) {
  let end = -1;
  for (let line = 0; line < LOADING_LINES; line++) {
    end = contents.indexOf("\n", end + 1);
    if (end === -1) break;
  }
  return (
    <PlainCodeFallback
      contents={end === -1 ? contents : contents.slice(0, end)}
      lineNumbers={lineNumbers}
      className={className}
    />
  );
}

// Keyed by the div CodeView renders into, so the module-level onPostRender
// below can find which block a failed <diffs-container> belongs to. A WeakMap
// because the entry is only ever reachable through a live node.
const DEGRADE_HANDLERS = new WeakMap<Element, () => void>();
// Options are cached at module scope; readiness belongs to the mounted block,
// just like degradation, rather than to a closure in an options object.
const READY_HANDLERS = new WeakMap<Element, () => void>();

/**
 * pierre's own posture on a highlighter failure is to paint the exception
 * message and its JS stack into the shadow root and carry on, which puts a
 * stack trace where the reader expects code (T-177). An ErrorBoundary cannot
 * take that over: the failing render happens partly on an async path, where a
 * rethrow would only become an unhandled rejection and leave the block blank.
 * `emitPostRender` does run right after the error is painted, in the same
 * task, so spotting the wrapper here swaps in plain text before the next
 * paint — the stack never reaches the screen.
 */
function handlePostRender(container: HTMLElement): void {
  const shadow = container.shadowRoot;
  if (shadow?.querySelector("[data-error-wrapper]") != null) {
    for (
      let node: Element | null = container;
      node;
      node = node.parentElement
    ) {
      const degrade = DEGRADE_HANDLERS.get(node);
      if (degrade !== undefined) {
        degrade();
        return;
      }
    }
  }
  if (shadow != null) indentWrappedLines(shadow);
  if (shadow?.querySelector("[data-line]") != null) {
    for (
      let node: Element | null = container;
      node;
      node = node.parentElement
    ) {
      const ready = READY_HANDLERS.get(node);
      if (ready !== undefined) {
        ready();
        return;
      }
    }
  }
}

const DRAWN_DIFF_CONTAINERS = new WeakSet<HTMLElement>();

/**
 * A ref detached and reattached — StrictMode in dev, or a Suspense boundary
 * above re-suspending — cleans pierre's diff instance up and hands the same
 * `diffs-container` to a new one, which hydrates whatever the old one left
 * there instead of rendering. Left an empty `<pre>` before the highlighter
 * loaded, it never renders at all (UI-110); left plain lines while the shared
 * highlighter was up but the file's grammar was not, it takes them for
 * highlighted output and never starts that load, so the diff stays
 * uncoloured. A second mount on a container therefore redraws; a first mount
 * costs nothing extra.
 */
function handleFenceDiffPostRender(
  container: HTMLElement,
  instance: { rerender: () => void },
  phase: PostRenderPhase,
): void {
  if (phase === "unmount") return;
  if (phase === "mount") {
    if (DRAWN_DIFF_CONTAINERS.has(container)) instance.rerender();
    else DRAWN_DIFF_CONTAINERS.add(container);
  }
  handlePostRender(container);
}

/**
 * pierre defaults to "shiki-js", which transpiles the TextMate grammars'
 * Oniguruma patterns into native RegExp through oniguruma-to-es. That
 * transpiler is a recursive-descent pass over patterns, and the TypeScript
 * grammar's giant lookaheads overflow SpiderMonkey's much shallower stack:
 * Firefox rendered `too much recursion` in place of every `ts` fence
 * (T-177). The wasm build is real Oniguruma and never runs that pass.
 *
 * pierre's highlighter is a module singleton whose engine is fixed by
 * whichever surface creates it first, so every options object in the app has
 * to name the same one — snippets, files, and the revision diff alike.
 */
export const PIERRE_HIGHLIGHTER = "shiki-wasm" as const;

// Module-scope per the library's props-stability guidance — now one object
// per theme rather than one overall, so a surface only re-renders when the
// theme it is rendered under actually changes.
const SNIPPET_OPTIONS = new Map<
  SyntaxTheme,
  CodeViewProps<undefined, undefined>["options"]
>();
const FILE_OPTIONS = new Map<
  SyntaxTheme,
  CodeViewProps<undefined, undefined>["options"]
>();
const FENCE_DIFF_OPTIONS = new Map<
  SyntaxTheme,
  MultiFileDiffProps<undefined, undefined>["options"]
>();

const PATCH_OPTIONS = new Map<
  SyntaxTheme,
  Map<number, CodeViewProps<undefined, undefined>["options"]>
>();

// theme.css's selected text, which stops at the shadow root: the custom
// properties cross it, the rule does not.
const SELECTION_CSS = `
::selection {
  background-color: var(--selection);
  color: var(--selection-foreground);
}
`;

// The only file items in a patch view are commit messages, and a message's
// line numbers count nothing the reader can use. pierre's own
// disableLineNumbers would take them off the diffs as well. A message is
// prose, so its rows wrap flush: the hang and ↳ that part a statement from its
// continuation would only break the left edge a reader's eye returns to.
const COMMIT_MESSAGE_CSS = `
[data-file] [data-gutter-buffer], [data-file] [data-column-number] {
  min-width: 0; padding: 0; border-right: 0;
}
[data-file] [data-column-number]::before { min-width: 0; }
[data-file] [data-line-number-content] { display: none; }
[data-file] [data-line] { min-height: 1lh; }
[data-file][data-overflow] [data-line] { text-indent: 0; }
[data-file][data-overflow] [data-line]::after { content: none; }
`;

// pierre rounds "N unmodified lines" in its own layers, and a value from
// outside reaches its shadow root only through a custom property: a style
// that sets --orz-diffs-square on the container (styles.css) gets the band
// square. Where style queries are unsupported it stays rounded.
const SQUARE_SEPARATOR_CSS = `
@container style(--orz-diffs-square: 1) {
  [data-separator-wrapper], [data-separator-content], [data-expand-button] {
    border-radius: 0;
  }
}
`;

/**
 * px; the header rows `PatchFiles` callers draw must be exactly
 * `var(--patch-header-height)` tall, which is this with a pointer.
 */
const PATCH_HEADER_HEIGHT = 36;
// On touch a header row is the touch spacing tall: the box the diffs scroll in
// clips a shorter row's controls at its top and bottom, and the row pinned
// to its top. Literal, for Tailwind to find; pierre reserves the height
// without measuring, so PatchFiles reads it back off its box.
const PATCH_HEADER_ROOM =
  "[--patch-header-height:36px] touch:[--patch-header-height:var(--spacing-touch)]";

function patchOptions(
  theme: SyntaxTheme,
  headerHeight: number,
): CodeViewProps<undefined, undefined>["options"] {
  const byHeight = PATCH_OPTIONS.get(theme) ?? new Map();
  PATCH_OPTIONS.set(theme, byHeight);
  const cached = byHeight.get(headerHeight);
  if (cached) return cached;
  // The fence diff's look, with a header row per item: a patch is a list of
  // files, and the header is the only place each one is named.
  const options = {
    theme,
    themeType: PIERRE_THEME_TYPE,
    diffStyle: "unified",
    overflow: "wrap",
    preferredHighlighter: PIERRE_HIGHLIGHTER,
    onPostRender: handlePostRender,
    unsafeCSS:
      SELECTION_CSS +
      COMMIT_MESSAGE_CSS +
      SQUARE_SEPARATOR_CSS +
      WRAP_INDENT_CSS,
    layout: { paddingTop: 0, paddingBottom: 0, gap: 8 },
    itemMetrics: { diffHeaderHeight: headerHeight },
    // Each item's header row stays pinned to the top of the box while the
    // item scrolls under it: halfway down a long file the reader still sees
    // which file it is, and the controls on its row.
    stickyHeaders: true,
  } as const;
  byHeight.set(headerHeight, options);
  return options;
}

function snippetOptions(
  theme: SyntaxTheme,
): CodeViewProps<undefined, undefined>["options"] {
  const cached = SNIPPET_OPTIONS.get(theme);
  if (cached) return cached;
  const options = {
    theme,
    themeType: PIERRE_THEME_TYPE,
    disableFileHeader: true,
    disableLineNumbers: true,
    overflow: "wrap",
    preferredHighlighter: PIERRE_HIGHLIGHTER,
    unsafeCSS: SELECTION_CSS + WRAP_INDENT_CSS,
    onPostRender: handlePostRender,
  } as const;
  SNIPPET_OPTIONS.set(theme, options);
  return options;
}

function fileOptions(
  theme: SyntaxTheme,
): CodeViewProps<undefined, undefined>["options"] {
  const cached = FILE_OPTIONS.get(theme);
  if (cached) return cached;
  const options = {
    theme,
    themeType: PIERRE_THEME_TYPE,
    disableFileHeader: true,
    preferredHighlighter: PIERRE_HIGHLIGHTER,
    unsafeCSS: SELECTION_CSS,
    onPostRender: handlePostRender,
  } as const;
  FILE_OPTIONS.set(theme, options);
  return options;
}

function fenceDiffOptions(
  theme: SyntaxTheme,
): MultiFileDiffProps<undefined, undefined>["options"] {
  const cached = FENCE_DIFF_OPTIONS.get(theme);
  if (cached) return cached;
  const options = {
    theme,
    themeType: PIERRE_THEME_TYPE,
    disableFileHeader: true,
    // Red above green, one column. pierre's default is `split`, which puts
    // the two sides in separate columns instead of next to each other.
    diffStyle: "unified",
    overflow: "wrap",
    preferredHighlighter: PIERRE_HIGHLIGHTER,
    unsafeCSS: SELECTION_CSS + WRAP_INDENT_CSS,
    // Off — pierre's default — unchanged context collapses to "N unmodified
    // lines" past a single line of it. That reads well in a whole file's
    // diff and badly in a fence the reader opened the document to read: a
    // 34-line block with one edited line came out as 10 rendered lines.
    expandUnchanged: true,
    onPostRender: handleFenceDiffPostRender,
  } as const;
  FENCE_DIFF_OPTIONS.set(theme, options);
  return options;
}

/**
 * Catches what the shadow-DOM check cannot: a CodeView that throws during
 * React's own render, and a pierre chunk that never arrives (offline). Both
 * land on the same plain text rather than on React's error screen.
 */
class CodeViewBoundary extends Component<
  {
    contents: string;
    lineNumbers?: boolean;
    className?: string;
    children: ReactNode;
  },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn("pierre CodeView failed; showing plain text", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <PlainCodeFallback
          contents={this.props.contents}
          lineNumbers={this.props.lineNumbers}
          className={this.props.className}
        />
      );
    }
    return this.props.children;
  }
}

// Fence tags that are language names rather than the file extensions
// pierre's filename inference knows.
const FENCE_TAG_EXTENSION: Record<string, string> = {
  python: "py",
  rust: "rs",
  typescript: "ts",
  javascript: "js",
  shell: "sh",
  golang: "go",
  ruby: "rb",
  csharp: "cs",
  kotlin: "kt",
  haskell: "hs",
  perl: "pl",
  powershell: "ps1",
  elixir: "ex",
  erlang: "erl",
  clojure: "clj",
  ocaml: "ml",
  plaintext: "txt",
  text: "txt",
};

/**
 * A synthetic filename whose extension carries the fence's language.
 * Passing the tag as `lang` instead would reject on unknown languages;
 * filename inference degrades to plain text.
 */
export function fenceFilename(tag: string | undefined): string {
  if (!tag) return "snippet.txt";
  return `snippet.${FENCE_TAG_EXTENSION[tag.toLowerCase()] ?? tag}`;
}

/**
 * A count that rises each time `value` changes. CodeView keeps the record it
 * holds under an item's id until the item comes with another `version`, so an
 * item whose content changed under the same id has to carry a new one, or the
 * view goes on drawing the old content.
 */
function useGeneration(value: unknown): number {
  const last = useRef({ value, generation: 0 });
  if (!Object.is(last.current.value, value)) {
    last.current = { value, generation: last.current.generation + 1 };
  }
  return last.current.generation;
}

/**
 * Read-only code rendering through pierre CodeView: syntax highlighting
 * from the filename, dark/light theme in step with the revision diffs.
 * Until pierre renders its first line the same text shows unhighlighted, laid
 * out as pierre lays it out, so it stays readable through both chunk loading
 * and highlighter startup and nothing moves when the colours arrive.
 *
 * pierre's virtualization scaffold declares `contain: inline-size`, so this
 * block contributes 0px to an ancestor's intrinsic width: in a content-sized
 * column (horizontal flex item, table cell, `max-content`) the code wraps at
 * the width of the prose beside it — 30 lines came out 5416px tall in a 109px
 * column, and a fence with no prose left the column 0px wide (T-287). Any such
 * column has to be made to fill its row.
 */
export function CodeBlock({
  filename,
  contents,
  lineNumbers = false,
  plain = false,
  offThread = false,
  copy = true,
  className,
}: {
  filename: string;
  contents: string;
  /**
   * Line numbers suit whole files; snippets read better without. With them a
   * long line scrolls sideways; without, it wraps, each row it wraps onto
   * starting past the line's own indentation behind a faint ↳.
   */
  lineNumbers?: boolean;
  /**
   * A Copy button at the block's top right, in a column of its own so it never
   * covers a line. Turn it off where the surface around the block already has one.
   */
  copy?: boolean;
  /**
   * No highlighting. Tokenizing is what costs: virtualized lines spare the
   * DOM, but pierre tokenizes the whole file regardless, 11 s for 1 MiB of
   * log where plain text took 0.16 s.
   */
  plain?: boolean;
  /**
   * Tokenize in pierre's worker pool, when a `CodeWorkerProvider` lends one.
   * Two costs move off the main thread: compiling a language's grammar, which
   * the first block in that language pays however short it is (520 ms for
   * TypeScript at 4x CPU throttling), and tokenizing a long file. For the
   * second, cap the height with `className` too: uncapped, laying out every
   * line of 1 MiB still held the main thread for 2.2 s.
   */
  offThread?: boolean;
  /** Caps the height for a long file: CodeView virtualizes against its box. */
  className?: string;
}) {
  const generation = useGeneration(contents);
  const items = useMemo(
    () => [
      {
        id: filename,
        type: "file" as const,
        version: generation * 2 + (plain ? 1 : 0),
        file: plain
          ? { name: filename, contents, lang: "text" as const }
          : { name: filename, contents },
      },
    ],
    [filename, contents, plain, generation],
  );
  const syntaxTheme = useSyntaxTheme();
  const options = useMemo(
    () =>
      lineNumbers ? fileOptions(syntaxTheme) : snippetOptions(syntaxTheme),
    [lineNumbers, syntaxTheme],
  );
  const workerFactory = useCodeWorkerFactory();
  const [degraded, setDegraded] = useState(false);
  const [ready, setReady] = useState(contents === "");
  const filenameRef = useRef(filename);
  filenameRef.current = filename;
  const warned = useRef(false);
  // CodeView keeps the containerRef it was handed at mount, so the registered
  // handler reads the filename off a ref rather than closing over the prop.
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    // Unmount hands us null; the WeakMap entry dies with the node anyway.
    if (node === null) return;
    DEGRADE_HANDLERS.set(node, () => {
      if (!warned.current) {
        warned.current = true;
        console.warn(
          `syntax highlighting failed for ${filenameRef.current}; showing plain text`,
        );
      }
      setDegraded(true);
    });
    READY_HANDLERS.set(node, () => setReady(true));
  }, []);
  // Highlighting fails per grammar rather than per input, so a block that has
  // gone plain stays plain: re-arming it would only repeat the same failure.
  const block = degraded ? (
    <PlainCodeFallback
      contents={contents}
      lineNumbers={lineNumbers}
      className={className}
    />
  ) : (
    <CodeViewBoundary
      contents={contents}
      lineNumbers={lineNumbers}
      className={className}
    >
      {!ready && (
        <LoadingCodeFallback
          contents={contents}
          lineNumbers={lineNumbers}
          className={className}
        />
      )}
      <div style={ready ? undefined : { visibility: "hidden" }}>
        {/* Plain text has nothing to tokenize, so no worker to start for it. */}
        {offThread && !plain && workerFactory !== null ? (
          <LazyWorkerCodeView
            items={items}
            options={options}
            className={className}
            containerRef={containerRef}
            workerFactory={workerFactory}
          />
        ) : (
          <LazyCodeView
            items={items}
            options={options}
            className={className}
            containerRef={containerRef}
          />
        )}
      </div>
    </CodeViewBoundary>
  );
  if (!copy) return block;
  // Under raymond a snippet is a read-only field set in the page around it,
  // sunken on the window colour, where a file with its line numbers fills
  // the document it is shown in; Copy is a push button either way. On touch
  // Copy keeps the rest of its hit area inside the block, for whatever frame
  // the block is set in, which may clip.
  return (
    <div
      data-slot="code-block"
      className={cn(
        "flex",
        !lineNumbers &&
          "raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken",
      )}
    >
      <div className="min-w-0 flex-1">{block}</div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Copy code"
        title="Copy code"
        className="m-1 shrink-0 text-muted-foreground touch:m-hit-sm touch:hit-area raymond:bg-(--3d-face) raymond:text-foreground raymond:shadow-raised raymond:hover:bg-(--3d-face) raymond:active:shadow-pressed"
        onClick={() => void copyToClipboard(contents, "Code copied")}
      >
        <CopyIcon className="size-4 raymond:size-3" />
      </Button>
    </div>
  );
}

function FenceDiff({
  filename,
  before,
  after,
}: {
  filename: string;
  before: string;
  after: string;
}) {
  const syntaxTheme = useSyntaxTheme();
  const options = useMemo(() => fenceDiffOptions(syntaxTheme), [syntaxTheme]);
  // A fence body carries no trailing newline, and pierre answers a last line
  // that takes part in a change by drawing "No newline at end of file" —
  // true of the string it was handed, meaningless to a reader of the document.
  const oldFile = useMemo(
    () => ({ name: filename, contents: `${before}\n` }),
    [filename, before],
  );
  const newFile = useMemo(
    () => ({ name: filename, contents: `${after}\n` }),
    [filename, after],
  );
  const [degraded, setDegraded] = useState(false);
  const [ready, setReady] = useState(after === "");
  const filenameRef = useRef(filename);
  filenameRef.current = filename;
  const warned = useRef(false);
  // MultiFileDiff takes no containerRef, so the handler goes on a wrapper of
  // our own; `handlePostRender` walks up from the failing container to find it.
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return;
    DEGRADE_HANDLERS.set(node, () => {
      if (!warned.current) {
        warned.current = true;
        console.warn(
          `syntax highlighting failed for ${filenameRef.current}; showing plain text`,
        );
      }
      setDegraded(true);
    });
    READY_HANDLERS.set(node, () => setReady(true));
    // A warm pierre cache can synchronously render and emitPostRender from
    // the child's ref before this parent ref registers its handlers. Replay
    // any state already present in the shadow root so that signal is not lost.
    for (const container of node.querySelectorAll<HTMLElement>(
      "diffs-container",
    )) {
      handlePostRender(container);
    }
  }, []);
  if (degraded) return <PlainCodeFallback contents={after} />;
  return (
    <div ref={containerRef}>
      <CodeViewBoundary contents={after}>
        {!ready && <LoadingCodeFallback contents={after} />}
        <div style={ready ? undefined : { visibility: "hidden" }}>
          <LazyMultiFileDiff
            oldFile={oldFile}
            newFile={newFile}
            options={options}
          />
        </div>
      </CodeViewBoundary>
    </div>
  );
}

/**
 * One code block shown as the line-level diff between two versions of it:
 * red for the lines the baseline had, green for the ones that replaced them
 * (T-343).
 *
 * Nothing is injected into the code. pierre is handed both bodies as plain
 * strings and does its own diffing, highlighting and theming, so T-31's
 * constraint — a mark reaching inside a fence deletes the code it wraps — is
 * never engaged.
 */
export function CodeDiffBlock({
  filename,
  before,
  after,
}: {
  filename: string;
  before: string;
  after: string;
}) {
  // Identical sides produce zero hunks, and a hunkless diff with no file
  // header renders nothing at all — the block would vanish from the page.
  // Branching here rather than inside `FenceDiff` also keeps every hook in
  // both shapes unconditional.
  if (before === after) {
    return <CodeBlock filename={filename} contents={after} />;
  }
  return <FenceDiff filename={filename} before={before} after={after} />;
}

/** The CodeView item id of a patch's `index`-th file, counted across commits. */
export function patchFileId(index: number): string {
  return `file-${index}`;
}

/** The CodeView item id of a commit's message, counted across the patch. */
export function patchCommitId(index: number): string {
  return `commit-${index}`;
}

/**
 * A parsed patch in one virtualized CodeView: per commit, its message, then
 * one diff per file.
 *
 * `className` must cap the height. CodeView virtualizes against its own box,
 * so an uncapped one grows to the whole patch and lays every line out: a
 * 1 MB, 116-file patch froze the tab for 15 s in one task that way, against
 * under 0.3 s capped.
 *
 * A highlighter failure takes the whole patch back to its plain text rather
 * than one file: the grammar that failed is likely shared by its neighbours.
 */
export function PatchFiles({
  patches,
  messages,
  text,
  className,
  viewRef,
  collapsedFiles,
  renderHeader,
}: {
  patches: ParsedPatch[];
  /**
   * Each patch's commit message, index for index with `patches`, drawn as an
   * item of its own above its files: an empty one is only its header row, and
   * null gets no item at all.
   */
  messages: (string | null)[];
  /** The patch as written, for the plain-text fallback. */
  text: string;
  className: string;
  /** For scrolling to an item by `patchFileId`. */
  viewRef?: Ref<CodeViewHandle<undefined, undefined>>;
  /** Files, by position across the patch, drawn as their header row only. */
  collapsedFiles?: ReadonlySet<number>;
  /**
   * Every item's header row, `var(--patch-header-height)` tall: pierre
   * reserves that height for it without measuring.
   */
  renderHeader: (item: CodeViewItem<undefined>) => ReactNode;
}) {
  const syntaxTheme = useSyntaxTheme();
  const [headerHeight, setHeaderHeight] = useState(PATCH_HEADER_HEIGHT);
  const options = useMemo(
    () => patchOptions(syntaxTheme, headerHeight),
    [syntaxTheme, headerHeight],
  );
  // One count per input rather than one for the whole list, so folding a
  // file changes that file's version alone and the rest keep their layout.
  const patchGeneration = useGeneration(patches);
  const messageGeneration = useGeneration(messages);
  const items = useMemo(() => {
    let position = 0;
    return patches.flatMap((patch, index): CodeViewItem<undefined>[] => {
      const files = patch.files.map((fileDiff): CodeViewItem<undefined> => {
        const collapsed = collapsedFiles?.has(position) ?? false;
        return {
          id: patchFileId(position++),
          type: "diff",
          fileDiff,
          collapsed,
          version: patchGeneration * 2 + (collapsed ? 0 : 1),
        };
      });
      const message = messages[index];
      if (message == null) return files;
      return [
        {
          id: patchCommitId(index),
          type: "file",
          collapsed: message === "",
          version: messageGeneration,
          file: {
            name: patchCommitId(index),
            contents: message,
            lang: "text",
          },
        },
        ...files,
      ];
    });
  }, [patches, messages, collapsedFiles, patchGeneration, messageGeneration]);
  const [degraded, setDegraded] = useState(false);
  const warned = useRef(false);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return;
    DEGRADE_HANDLERS.set(node, () => {
      if (!warned.current) {
        warned.current = true;
        console.warn(
          "syntax highlighting failed for a patch; showing plain text",
        );
      }
      setDegraded(true);
    });
    const readHeader = () =>
      setHeaderHeight(
        Number.parseFloat(
          getComputedStyle(node).getPropertyValue("--patch-header-height"),
        ) || PATCH_HEADER_HEIGHT,
      );
    readHeader();
    const pointer = window.matchMedia?.("(pointer: coarse)");
    pointer?.addEventListener("change", readHeader);
    return () => pointer?.removeEventListener("change", readHeader);
  }, []);
  if (degraded) return <PlainCodeFallback contents={text} />;
  return (
    <CodeViewBoundary contents={text}>
      <LazyCodeView
        fallback={<LoadingCodeFallback contents={text} className={className} />}
        ref={viewRef}
        items={items}
        options={options}
        className={cn(PATCH_HEADER_ROOM, className)}
        containerRef={containerRef}
        renderCustomHeader={renderHeader}
      />
    </CodeViewBoundary>
  );
}
