import {
  type ComponentType,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";
import type {
  ContentDisplay,
  ContentProps,
  ContentRenderer,
  ContentSource,
  Placement,
} from "./types.ts";

type Registry = {
  renderers: readonly ContentRenderer[];
  /** `steps[i]` draws a source with `renderers[i…]`; the last one is the fallback. */
  steps: readonly ComponentType<ContentProps>[];
  maxDepth: number | undefined;
};

/**
 * The fallback, as a component, for renderers that decide to step aside: a plain `<pre><code>`
 * for inline text, and a download link (or the bare name when there is no `url`) for a file.
 */
export function ContentFallback({ source, className }: ContentProps) {
  if (source.kind === "inline") {
    return (
      <pre className={className}>
        <code
          className={
            source.lang === undefined ? undefined : `language-${source.lang}`
          }
        >
          {source.text}
        </code>
      </pre>
    );
  }
  if (source.url === undefined) {
    return <span className={className}>{source.name}</span>;
  }
  return (
    <a className={className} href={source.url} download={source.name}>
      {source.name}
    </a>
  );
}

/**
 * One component per position, built once per list: a renderer's `Next` has to be the same
 * component type on every render, or React remounts everything the renderer drew below it and a
 * live text selection in there collapses (T-60).
 */
function stepsFor(
  renderers: readonly ContentRenderer[],
): ComponentType<ContentProps>[] {
  const steps: ComponentType<ContentProps>[] = [];
  steps[renderers.length] = ContentFallback;
  for (let i = renderers.length - 1; i >= 0; i--) {
    steps[i] = function ContentStep(props: ContentProps) {
      for (let j = i; j < renderers.length; j++) {
        const renderer = renderers[j];
        if (renderer?.accepts(props.source, props.placement)) {
          const Next = steps[j + 1] ?? ContentFallback;
          return <renderer.Component {...props} Next={Next} />;
        }
      }
      return <ContentFallback {...props} />;
    };
  }
  return steps;
}

const EMPTY: readonly ContentRenderer[] = [];

const RegistryContext = createContext<Registry>({
  renderers: EMPTY,
  steps: stepsFor(EMPTY),
  maxDepth: undefined,
});

const DepthContext = createContext(0);

/**
 * Registers renderers for every `<Content>` below. The list is ordered and the first renderer
 * that accepts a source draws it, so a narrow renderer goes before a broad one. A nested provider
 * puts its renderers in front of the outer ones.
 *
 * Keep `renderers` stable (a module constant or a memo): a new array rebuilds every `Next`, and
 * React remounts whatever the renderers drew.
 */
export function ContentRenderers({
  renderers,
  maxDepth,
  children,
}: {
  renderers: readonly ContentRenderer[];
  /** Read by renderers that limit nesting (`useContentMaxDepth`); `<Content>` does not enforce it. */
  maxDepth?: number;
  children?: ReactNode;
}) {
  const outer = useContext(RegistryContext);
  const merged = useMemo(
    () =>
      outer.renderers.length === 0
        ? renderers
        : [...renderers, ...outer.renderers],
    [renderers, outer.renderers],
  );
  const steps = useMemo(() => stepsFor(merged), [merged]);
  const resolvedMaxDepth = maxDepth ?? outer.maxDepth;
  const value = useMemo(
    () => ({ renderers: merged, steps, maxDepth: resolvedMaxDepth }),
    [merged, steps, resolvedMaxDepth],
  );
  return (
    <RegistryContext.Provider value={value}>
      {children}
    </RegistryContext.Provider>
  );
}

function firstAccepting(
  renderers: readonly ContentRenderer[],
  source: ContentSource,
  placement: Placement,
): ContentRenderer | undefined {
  return renderers.find((renderer) => renderer.accepts(source, placement));
}

/**
 * Draws a source with the first registered renderer that accepts it, or the fallback.
 *
 * A file source a renderer draws raises `useContentDepth()` by one for everything below it, once
 * per `<Content>`: a renderer that wraps the file and hands it on through `Next` does not count
 * it twice.
 */
export function Content(props: ContentProps) {
  const { renderers, steps } = useContext(RegistryContext);
  const depth = useContext(DepthContext);
  const First = steps[0] ?? ContentFallback;
  const drawn =
    props.source.kind === "file" &&
    firstAccepting(renderers, props.source, props.placement) !== undefined;
  if (!drawn) return <First {...props} />;
  return (
    <DepthContext.Provider value={depth + 1}>
      <First {...props} />
    </DepthContext.Provider>
  );
}

/**
 * How the renderer that would draw this source lays out, without rendering anything: `"block"`,
 * `"inline"`, or `null` when nothing registered accepts it.
 */
export function useContentDisplay(
  source: ContentSource,
  placement: Placement,
): ContentDisplay | null {
  return useContentDisplayOf()(source, placement);
}

/**
 * `useContentDisplay` as a function, for a caller that asks about a varying number of sources in
 * one render, such as a paragraph checking each of its images.
 */
export function useContentDisplayOf(): (
  source: ContentSource,
  placement: Placement,
) => ContentDisplay | null {
  const { renderers } = useContext(RegistryContext);
  return useCallback(
    (source, placement) => {
      const renderer = firstAccepting(renderers, source, placement);
      return renderer === undefined ? null : (renderer.display ?? "block");
    },
    [renderers],
  );
}

/** How many file sources, each drawn by a renderer, enclose this point. */
export function useContentDepth(): number {
  return useContext(DepthContext);
}

/** The nearest `<ContentRenderers maxDepth>`, for renderers that limit nesting. */
export function useContentMaxDepth(): number | undefined {
  return useContext(RegistryContext).maxDepth;
}
