import { Content } from "@orz/ui-content";
import type { Element, ElementContent } from "hast";
import {
  type ComponentType,
  createContext,
  createElement,
  memo,
  type Ref,
  useContext,
  useMemo,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import type { PluggableList } from "unified";
import { fenceTitle } from "./lib/fence-meta.ts";
import { MARKDOWN_SYNTAX_PLUGINS } from "./lib/markdown-processor.ts";
import { rehypeDetails } from "./lib/rehype-details.ts";
import { rehypeHeadingLevels } from "./lib/rehype-heading-levels.ts";
import {
  CODE_CONTENT_START_ATTR,
  parseSourceLoc,
  SOURCE_LINE_ATTR,
} from "./lib/rehype-source-lines.ts";
import type {
  ElementProps,
  FenceProps,
  MarkdownPlugin,
  WrappableTag,
} from "./plugin.ts";

const NO_PLUGINS: readonly MarkdownPlugin[] = [];

/**
 * The plugins of the nearest enclosing `<Markdown>`; undefined outside one. A document embedded
 * inside a document reads them, so it is drawn the way its host is.
 */
export const MarkdownPluginsContext = createContext<
  readonly MarkdownPlugin[] | undefined
>(undefined);

/** Whether the nearest `<Markdown>` lets a long code block scroll in its frame. */
const CollapseFencesContext = createContext(true);

/** The level the nearest `<Markdown>` draws a `#` at; undefined outside one. */
const HeadingLevelContext = createContext<number | undefined>(undefined);

function clampLevel(level: number): number {
  return Number.isFinite(level)
    ? Math.min(6, Math.max(1, Math.floor(level)))
    : 1;
}

/**
 * Pull the code text, the fence tag and the info string after the tag out of
 * a `<pre>` element's hast node. Returns null for shapes that aren't a plain
 * fenced block, which then keep the default `<pre>` rendering.
 */
function parseFence(
  pre: Element | undefined,
): { text: string; tag?: string; meta?: string } | null {
  const code = pre?.children.find(
    (child): child is Element =>
      child.type === "element" && child.tagName === "code",
  );
  if (code === undefined) return null;
  const className = Array.isArray(code.properties.className)
    ? code.properties.className
    : [];
  const tag = className
    .find((name): name is string =>
      typeof name === "string" ? name.startsWith("language-") : false,
    )
    ?.slice("language-".length);
  const text = code.children
    .filter(
      (child): child is Extract<ElementContent, { type: "text" }> =>
        child.type === "text",
    )
    .map((child) => child.value)
    .join("");
  const meta = code.data?.meta;
  // Fenced blocks always carry a trailing newline; a code renderer would
  // show it as an empty last line.
  return {
    text: text.replace(/\n$/, ""),
    tag,
    meta: typeof meta === "string" && meta !== "" ? meta : undefined,
  };
}

function RegistryFence({ code, lang, meta }: FenceProps) {
  const collapse = useContext(CollapseFencesContext);
  return (
    <Content
      source={{
        kind: "inline",
        text: code,
        lang,
        title: fenceTitle(meta),
        collapse,
      }}
      placement="document"
    />
  );
}

function fenceChain(
  plugins: readonly MarkdownPlugin[],
): ComponentType<FenceProps> {
  let current: ComponentType<FenceProps> = RegistryFence;
  for (const plugin of [...plugins].reverse()) {
    const Wrapper = plugin.fence;
    if (Wrapper === undefined) continue;
    const Inner = current;
    current = function FenceWrapper(props: FenceProps) {
      return <Wrapper {...props} Next={Inner} />;
    };
  }
  return current;
}

function preFor(Fence: ComponentType<FenceProps>) {
  return function MarkdownPre({
    node,
    children,
    ...props
  }: ElementProps<"pre">) {
    const fence = parseFence(node);
    if (fence === null) return <pre {...props}>{children}</pre>;
    // Whatever draws the fence must not drop the source-line stamp a caller
    // anchors selections to (T-52). A wrapper re-carries it, plus where the
    // code content starts: the stamped range opens on the ``` marker for
    // fenced blocks but on the first code line for indented ones.
    const stamp = (props as Record<string, unknown>)[SOURCE_LINE_ATTR];
    const loc = typeof stamp === "string" ? parseSourceLoc(stamp) : null;
    // Decoration classes ride on the <pre> too (T-158) and would otherwise
    // vanish in the swap.
    const className = ["markdown-fence", props.className]
      .filter(Boolean)
      .join(" ");
    const wrapperProps =
      loc === null
        ? { className }
        : {
            [SOURCE_LINE_ATTR]: stamp,
            [CODE_CONTENT_START_ATTR]: (() => {
              // Whether there is a marker line to skip is answered by the line
              // count, not by reading the opening line: a fence inside a
              // blockquote opens on "> ```ts", whose `>` survives trimStart().
              const span = loc.end - loc.start + 1;
              const contentLines =
                fence.text === "" ? 0 : fence.text.split("\n").length;
              return loc.start + (span - contentLines >= 1 ? 1 : 0);
            })(),
            className,
          };
    return (
      <div {...wrapperProps}>
        <Fence code={fence.text} lang={fence.tag} meta={fence.meta} loc={loc} />
      </div>
    );
  };
}

/** Element props as the chain passes them along; each wrapper is typed per tag at the plugin. */
type AnyElementProps = { node?: Element; [prop: string]: unknown };

function elementChain(
  tag: WrappableTag,
  plugins: readonly MarkdownPlugin[],
): ComponentType<AnyElementProps> {
  let current: ComponentType<AnyElementProps> = function Plain({
    node: _node,
    ...props
  }: AnyElementProps) {
    return createElement(tag, props);
  };
  for (const plugin of [...plugins].reverse()) {
    const Wrapper = plugin.components?.[tag] as
      | ComponentType<
          AnyElementProps & { Next: ComponentType<AnyElementProps> }
        >
      | undefined;
    if (Wrapper === undefined) continue;
    const Inner = current;
    current = function ElementWrapper(props: AnyElementProps) {
      return <Wrapper {...props} Next={Inner} />;
    };
  }
  return current;
}

function componentsFor(plugins: readonly MarkdownPlugin[]): Components {
  const components: Record<string, ComponentType<AnyElementProps>> = {
    pre: preFor(fenceChain(plugins)),
  };
  const tags = new Set(
    plugins.flatMap(
      (plugin) => Object.keys(plugin.components ?? {}) as WrappableTag[],
    ),
  );
  for (const tag of tags) {
    if ((tag as string) === "pre") continue;
    components[tag] = elementChain(tag, plugins);
  }
  return components as Components;
}

export type MarkdownProps = {
  children: string;
  /**
   * Keep this array stable: a module constant, or a memo. See `<Markdown>`.
   * The first plugin is outermost: its wrappers render first, and their `Next` reaches the second.
   */
  plugins?: readonly MarkdownPlugin[];
  /** Added to the `.markdown-body` root. */
  className?: string;
  /**
   * Cut a code block past `FENCE_COLLAPSE_LINES`, and a long patch, behind Show all (default: the
   * enclosing document's choice, else on). Off where every line has to stay on the page: a review
   * that annotates lines cannot point at one a cut hides. Off, code blocks are drawn whole and a
   * patch scrolls in a box of its own. Embedded file cards are cut either way.
   */
  collapseLongFences?: boolean;
  /**
   * The level a `#` heading is drawn at, 1 to 6; each deeper heading follows it down, stopping at
   * `h6`. Default: a level below the enclosing document's, for a document embedded in another,
   * else 1.
   */
  headingLevel?: number;
  ref?: Ref<HTMLDivElement>;
};

/**
 * GitHub-style markdown: GFM, refused links drawn as their source, YAML and TOML frontmatter as a
 * two-column table, and raw HTML escaped to its source except `<details>`/`<summary>` folds.
 * Plugins append remark and rehype passes to that chain and wrap elements and code blocks; they
 * cannot remove any of it. Code blocks are drawn through `@orz/ui-content`'s registry.
 *
 * A document drawn inside another, such as a file `markdownContent` embeds, starts its headings a
 * level below its host's `#` (`headingLevel`), so its title sits under the host's and the page
 * keeps one outline.
 *
 * Keep `plugins` stable. A fresh array, or a fresh plugin object in it, makes react-markdown
 * reparse the document and React remount every overridden element, and either one collapses a live
 * text selection inside it (T-60).
 *
 * A re-render with the same text, plugins and class does nothing: react-markdown keeps no parse
 * cache, and a host re-renders for reasons that never touch the text (each keystroke in a composer
 * beside it), which on a long document cost a frame or more per key.
 */
export const Markdown = memo(function Markdown({
  children,
  plugins = NO_PLUGINS,
  className,
  collapseLongFences,
  headingLevel,
  ref,
}: MarkdownProps) {
  // Unset, a document embedded in another follows its host.
  const outerCollapse = useContext(CollapseFencesContext);
  const collapseFences = collapseLongFences ?? outerCollapse;
  const outerLevel = useContext(HeadingLevelContext);
  const level = clampLevel(
    headingLevel ?? (outerLevel === undefined ? 1 : outerLevel + 1),
  );
  // The override map must be referentially stable across re-renders: every
  // entry is a component built here, and a fresh map makes React treat each
  // one as a NEW component type, unmounting and rebuilding those DOM
  // subtrees on every parent render. Rebuilt text nodes silently collapse
  // any live text selection — which is what broke annotating a selection
  // (T-60): a floating button's own appearance re-rendered the document and
  // destroyed the selection it was offering to annotate.
  const components = useMemo(() => componentsFor(plugins), [plugins]);

  // `rehypeDetails` goes first so that every later pass walks the tree the
  // reader will get, rather than one where a fold is still a pair of raw HTML
  // strings; for the same reason a plugin's pass sees the headings at the
  // levels they are drawn at. The memos are the identity rule above, applied
  // to the plugin lists react-markdown compares.
  const remarkPlugins = useMemo<PluggableList>(
    () => [
      ...MARKDOWN_SYNTAX_PLUGINS,
      ...plugins.flatMap((plugin) => plugin.remarkPlugins ?? []),
    ],
    [plugins],
  );
  const rehypePlugins = useMemo<PluggableList>(
    () => [
      rehypeDetails,
      [rehypeHeadingLevels, { level }],
      ...plugins.flatMap((plugin) => plugin.rehypePlugins ?? []),
    ],
    [plugins, level],
  );

  return (
    <div
      ref={ref}
      className={className ? `markdown-body ${className}` : "markdown-body"}
    >
      <MarkdownPluginsContext.Provider value={plugins}>
        <CollapseFencesContext.Provider value={collapseFences}>
          <HeadingLevelContext.Provider value={level}>
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={components}
            >
              {children}
            </ReactMarkdown>
          </HeadingLevelContext.Provider>
        </CollapseFencesContext.Provider>
      </MarkdownPluginsContext.Provider>
    </div>
  );
});
