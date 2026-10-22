import type { Element } from "hast";
import type { ComponentProps, ComponentType, JSX } from "react";
import type { PluggableList } from "unified";

/** What react-markdown hands an element override: the element's props, plus its hast node. */
export type ElementProps<Tag extends keyof JSX.IntrinsicElements> =
  ComponentProps<Tag> & { node?: Element };

/** Tags a plugin may wrap. `<pre>` is `<Markdown>`'s own: it reads fences out of it. */
export type WrappableTag = Exclude<keyof JSX.IntrinsicElements, "pre">;

export type FenceProps = {
  /** The contents, without the trailing newline every fence carries. */
  code: string;
  /** The info string's first word as written; undefined for an indented block. */
  lang: string | undefined;
  /** 1-based inclusive source lines of the whole block, markers included; null when unstamped. */
  loc: { start: number; end: number } | null;
};

export type ElementWrapper<Tag extends WrappableTag> = ComponentType<
  ElementProps<Tag> & { Next: ComponentType<ElementProps<Tag>> }
>;

export type MarkdownPlugin = {
  name: string;
  /** Appended, in list order, after the fixed syntax chain. */
  remarkPlugins?: PluggableList;
  /** Appended, in list order, after `rehypeDetails`. */
  rehypePlugins?: PluggableList;
  /** Wrap any element. `Next` renders it the way the plugins after this one would. */
  components?: { [Tag in WrappableTag]?: ElementWrapper<Tag> };
  /** Wrap a parsed code block. The innermost `Next` is the registry. */
  fence?: ComponentType<FenceProps & { Next: ComponentType<FenceProps> }>;
};
