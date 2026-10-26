import { codeContent } from "@orz/ui-code";
import type { ContentRenderer, ContentSource } from "@orz/ui-content";
import {
  attachmentLinks,
  externalLinks,
  Markdown,
  type MarkdownPlugin,
  MarkdownPluginsContext as MarkdownPluginsContextView,
  markdownContent,
  markdownEmbeds,
} from "@orz/ui-markdown";
import {
  rehypeSourceLines,
  SOURCE_LINE_ATTR,
} from "@orz/ui-markdown/lib/rehype-source-lines";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useContext } from "react";
import { withRenderers, withViewer, withWidth } from "./decorators.tsx";
import guideText from "./fixtures/attachment/guide.md?raw";
import { group, resolve } from "./fixtures/files.ts";
import { ATTACHMENT_RENDERERS } from "./fixtures/renderers.ts";

const GFM = `# Release notes

A paragraph with **bold**, *italic*, ~~struck~~ and \`inline code\`, plus a
[link](https://example.com) and an autolink: https://example.com/docs.

## Lists

- Plain item
- Nested:
  - second level
    - third level
1. First
2. Second

- [x] Write the parser
- [ ] Ship it

## Table

| Setting | Default | Notes |
|:--|:-:|--:|
| \`retries\` | 3 | per request |
| \`timeout\` | 30s | wall clock |
| \`verbose\` | off | logs every step |

## Quote and rule

> Quotes keep the muted tone,
> across lines.

---

\`\`\`ts
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

    an indented block is a code block too
`;

const FRONTMATTER_YAML = `---
title: Weekly sync
owner: alice
tags: [planning, notes]
meta:
  room: 3
  remote: yes
---

The frontmatter above renders as a two-column table. Each value is the
source slice, never parsed, so the nested \`meta\` keeps its indentation.
`;

const FRONTMATTER_TOML = `+++
[release]
name = "bot-one"
version = "1.2.0"
draft = false
+++

TOML frontmatter reads the same way; the section header gets a full-width row.
`;

const DETAILS = `<details>
<summary>Closed fold</summary>

Markdown **inside** the fold renders as usual.

\`\`\`sh
echo "a fence inside a fold"
\`\`\`

</details>

<details open>
<summary>Open fold</summary>

- one
- two

<details>
<summary>Nested</summary>

Folds nest.

</details>

</details>
`;

const UNSAFE = `Raw HTML is shown as what was typed: <b>not bold</b>, <span style="color:red">not red</span>.

<script>alert("never runs")</script>

<details onclick="alert(1)">
<summary>an open tag with an attribute is not a fold</summary>
</details>

Links whose protocol is refused show their source:
[click me](javascript:alert(1)) and ![image](data:image/png;base64,AAAA).

A plain [https link](https://example.com) still works.
`;

const BAND_COMPONENTS: MarkdownPlugin["components"] = {
  h2: ({ Next, ...props }) => (
    <div className="border-l-4 border-primary pl-3">
      <Next {...props} />
    </div>
  ),
};

/** Wraps every h2 in a bordered band, and puts a caption over every code block. */
const decorate: MarkdownPlugin = {
  name: "decorate",
  components: BAND_COMPONENTS,
  fence: ({ Next, ...props }) => (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">
        {props.lang ?? "plain text"}
      </div>
      <Next {...props} />
    </div>
  ),
};
const DECORATED = [decorate];

const PLUGIN_DEMO = `## A wrapped heading

The plugin above wraps every \`h2\` and every code block; \`Next\` draws the
element the way it would have been drawn without it.

\`\`\`json
{ "wrapped": true }
\`\`\`

## Another heading

    indented code has no language
`;

const gutterClass =
  "w-10 shrink-0 pt-0.5 text-right font-mono text-xs text-muted-foreground select-none";

/** The `data-loc` stamp `rehypeSourceLines` puts on a block, as a gutter beside it. */
const stamped = (props: object) =>
  String((props as Record<string, unknown>)[SOURCE_LINE_ATTR] ?? "");

/** Shows every paragraph's, heading's and code block's source lines in a gutter. */
const SOURCE_LINES: MarkdownPlugin = {
  name: "source-lines",
  rehypePlugins: [rehypeSourceLines],
  components: {
    p: ({ Next, ...props }) => (
      <div className="flex gap-3">
        <span className={gutterClass}>{stamped(props)}</span>
        <Next {...props} />
      </div>
    ),
    h2: ({ Next, ...props }) => (
      <div className="flex items-baseline gap-3">
        <span className={gutterClass}>{stamped(props)}</span>
        <Next {...props} />
      </div>
    ),
  },
  // A fence's stamp arrives parsed, as `loc`; it is null without rehypeSourceLines.
  fence: ({ Next, ...props }) => (
    <div className="flex gap-3">
      <span className={gutterClass}>
        {props.loc === null ? "" : `${props.loc.start}-${props.loc.end}`}
      </span>
      <div className="min-w-0 flex-1">
        <Next {...props} />
      </div>
    </div>
  ),
};
const SOURCE_LINES_LIST = [SOURCE_LINES];

const EMBED_PLUGINS = [
  markdownEmbeds({ resolve }),
  attachmentLinks({ resolve }),
];
const LINK_PLUGINS = [attachmentLinks({ resolve })];
const EXTERNAL_PLUGINS = [attachmentLinks({ resolve }), externalLinks()];

const EXTERNAL_DOC = `Read [the guide](files/guide.md) here, or [the spec](https://example.com/spec)
and the [GFM reference](https://github.github.com/gfm/) in a new tab. A [link to this
page](#top) and [mail](mailto:noreply@example.com) stay where they are.`;
const ATTACHMENTS = [
  withViewer({ group }),
  withRenderers(...ATTACHMENT_RENDERERS),
];

const LINKS_DOC =
  "See [the guide](files/guide.md), [the logo](files/logo.svg), [the archive](files/bundle.zip) and [an outside page](https://example.com).";

/** In-memory documents, addressed as `files/<name>`: react-markdown refuses a `file:` URL. */
const FILES: Record<string, string> = {
  "overview.md": `## Overview

This document is embedded in the page. It embeds one more:

![details](files/details.md)

\`\`\`ts
// Fences still render at any depth: inline sources are never limited.
const depth = 1;
\`\`\`
`,
  "details.md": `## Details

This document embeds the overview again, which would never end without a
depth limit:

![overview](files/overview.md)
`,
  "context.md": `## Embedded

This document is drawn by \`markdownContent\` inside the page's \`<Markdown>\`,
so it takes the page's plugins rather than its own:

\`\`\`plugins
\`\`\`
`,
};

const LOADS = new Map(
  Object.entries(FILES).map(([name, text]) => [
    name,
    // A short delay, so the loading state is visible.
    () =>
      new Promise<string>((resolve) => setTimeout(() => resolve(text), 300)),
  ]),
);

function resolveFile(href: string): ContentSource | null {
  if (!href.startsWith("files/")) return null;
  const name = href.slice("files/".length);
  const load = LOADS.get(name);
  if (load === undefined) return null;
  return { kind: "file", name, url: `#${name}`, load };
}

/** Prints the plugins of the `<Markdown>` it is drawn in, for a fence tagged `plugins`. */
const pluginNames: ContentRenderer = {
  name: "plugin-names",
  accepts: (source) => source.kind === "inline" && source.lang === "plugins",
  Component: () => {
    const plugins = useContext(MarkdownPluginsContextView);
    return (
      <p className="font-mono text-sm">
        plugins: {plugins?.map((p) => p.name).join(", ") ?? "none"}
      </p>
    );
  },
};

/** `decorate`'s heading band, with no fence caption. */
const band: MarkdownPlugin = { name: "band", components: BAND_COMPONENTS };

const CONTEXT_PLUGINS = [band, markdownEmbeds({ resolve: resolveFile })];
const CONTEXT_RENDERERS = withRenderers(
  pluginNames,
  markdownContent(),
  codeContent,
);

const CONTEXT_DOC = `## Host

\`\`\`plugins
\`\`\`

![context](files/context.md)
`;

const CYCLE_PLUGINS = [markdownEmbeds({ resolve: resolveFile })];

/**
 * Stands in for an attachment card: frames every file embedded in a document and hands it to
 * `Next`, so the story shows where each embedded document begins.
 */
const card: ContentRenderer = {
  name: "card",
  accepts: (source, placement) =>
    source.kind === "file" && placement === "document",
  Component: ({ Next, ...props }) => (
    <section className="my-2 overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/40 px-3 py-1 text-sm font-medium">
        {props.source.kind === "file" ? props.source.name : null}
      </div>
      <div className="p-3">
        <Next {...props} />
      </div>
    </section>
  ),
};

const EMBED_RENDERERS = withRenderers(card, markdownContent(), codeContent);

const EMBED_DEMO = `# A document that embeds another

The image below resolves to \`overview.md\`, so it is drawn as a document,
and its paragraph becomes a \`div.markdown-paragraph\`.

![overview](files/overview.md)

An address that does not resolve stays an image:
![missing](https://example.com/missing.png)
`;

const CODE = withRenderers(codeContent);

// remark-gfm draws a task list's boxes as disabled, unlabelled <input>s, as
// GitHub does: the item's text is the label a reader sees, but not one axe can
// associate with the box.
const TASK_LIST_A11Y = {
  a11y: { context: { exclude: [".task-list-item > input"] } },
};

const PLUGINS_SNIPPET = `import { Markdown, type MarkdownPlugin } from "@orz/ui-markdown";

const decorate: MarkdownPlugin = {
  name: "decorate",
  components: {
    // Wrap any element; Next draws it as the plugins after this one would.
    h2: ({ Next, ...props }) => (
      <div className="border-l-4 border-primary pl-3">
        <Next {...props} />
      </div>
    ),
  },
  // Wrap every code block; the innermost Next is the content registry.
  fence: ({ Next, ...props }) => (
    <div>
      <div className="text-xs">{props.lang ?? "plain text"}</div>
      <Next {...props} />
    </div>
  ),
};

// A module constant: a fresh array makes <Markdown> reparse and remount.
const plugins = [decorate];

<Markdown plugins={plugins}>{source}</Markdown>`;

const SOURCE_LINES_SNIPPET = `import { Markdown, type MarkdownPlugin } from "@orz/ui-markdown";
import { rehypeSourceLines, SOURCE_LINE_ATTR } from "@orz/ui-markdown/lib/rehype-source-lines";

const sourceLines: MarkdownPlugin = {
  name: "source-lines",
  // Stamps every block element with data-loc="start-end", 1-based and inclusive.
  rehypePlugins: [rehypeSourceLines],
  components: {
    p: ({ Next, ...props }) => (
      <div>
        <span>{props[SOURCE_LINE_ATTR]}</span>
        <Next {...props} />
      </div>
    ),
  },
  // FenceProps.loc is the parsed stamp: non-null only with rehypeSourceLines.
  fence: ({ Next, ...props }) => (
    <div>
      <span>{props.loc && \`\${props.loc.start}-\${props.loc.end}\`}</span>
      <Next {...props} />
    </div>
  ),
};

const plugins = [sourceLines];

<Markdown plugins={plugins}>{source}</Markdown>`;

const EMBEDS_SNIPPET = `import { codeContent } from "@orz/ui-code";
import { type ContentSource, ContentRenderers } from "@orz/ui-content";
import { AttachmentViewerProvider, attachmentCard, imageContent } from "@orz/ui-content/attachment";
import { attachmentLinks, Markdown, markdownContent, markdownEmbeds } from "@orz/ui-markdown";

// One resolver for both plugins: an address in the document, to the file it names or null.
const resolve = (href: string): ContentSource | null => files.get(href) ?? null;

const plugins = [markdownEmbeds({ resolve }), attachmentLinks({ resolve })];
const renderers = [attachmentCard(), imageContent(), markdownContent(), codeContent];

<ContentRenderers renderers={renderers}>
  <AttachmentViewerProvider>
    <Markdown plugins={plugins}>{source}</Markdown>
  </AttachmentViewerProvider>
</ContentRenderers>`;

const LINKS_SNIPPET = `import { attachmentLinks, Markdown } from "@orz/ui-markdown";

// A link that resolves to a file becomes an AttachmentLink chip; boxed draws a border.
// Any other link is left to the plugins after this one.
const plugins = [attachmentLinks({ resolve, boxed: false })];

<Markdown plugins={plugins}>{source}</Markdown>`;

const EXTERNAL_SNIPPET = `import { attachmentLinks, externalLinks, Markdown } from "@orz/ui-markdown";

// Last, so attachment links are claimed first. Leave it out to keep every link in this tab.
const plugins = [attachmentLinks({ resolve }), externalLinks()];

<Markdown plugins={plugins}>{source}</Markdown>`;

const CONTEXT_SNIPPET = `import { MarkdownPluginsContext } from "@orz/ui-markdown";
import { useContext } from "react";

const plugins = useContext(MarkdownPluginsContext); // the enclosing <Markdown>'s plugins; undefined outside one`;

const code = (snippet: string) => ({
  docs: { source: { code: snippet, language: "tsx" } },
});

/**
 * GitHub-style markdown. Fences and embeds are drawn through `@orz/ui-content`'s registry, so the
 * stories that show highlighted code register `@orz/ui-code`'s `codeContent` around it.
 */
const meta = {
  title: "ui-markdown/Markdown",
  component: Markdown,
  args: { children: GFM },
  argTypes: { plugins: { control: false } },
  decorators: [withWidth("max-w-3xl")],
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  decorators: [CODE],
  parameters: TASK_LIST_A11Y,
};

export const FrontmatterYaml: Story = { args: { children: FRONTMATTER_YAML } };

export const FrontmatterToml: Story = { args: { children: FRONTMATTER_TOML } };

export const Folds: Story = {
  args: { children: DETAILS },
  decorators: [CODE],
};

/** Raw HTML and refused links are shown as what was typed. */
export const RawHtmlAndRefusedLinks: Story = { args: { children: UNSAFE } };

/** With no code renderer registered, every fence is the registry's plain `<pre><code>`. */
export const WithoutRenderers: Story = { parameters: TASK_LIST_A11Y };

/** A plugin that wraps `h2` through `components` and every code block through `fence`. */
export const Plugins: Story = {
  args: { children: PLUGIN_DEMO },
  render: (args) => <Markdown {...args} plugins={DECORATED} />,
  decorators: [CODE],
  parameters: code(PLUGINS_SNIPPET),
};

/**
 * `rehypeSourceLines` stamps each block with the source lines it came from; a fence wrapper gets
 * them parsed, as `loc`. What selection anchoring maps a reader's selection back through.
 */
export const RehypeSourceLines: Story = {
  args: { children: PLUGIN_DEMO },
  render: (args) => <Markdown {...args} plugins={SOURCE_LINES_LIST} />,
  decorators: [CODE],
  parameters: code(SOURCE_LINES_SNIPPET),
};

/**
 * A document embedding an image, a source file and another markdown document, which embeds one
 * in turn. The second level is past the depth limit, so it is a link chip.
 */
export const MarkdownEmbeds: Story = {
  args: { children: guideText },
  render: (args) => <Markdown {...args} plugins={EMBED_PLUGINS} />,
  decorators: ATTACHMENTS,
  parameters: code(EMBEDS_SNIPPET),
};

/** Links to files become attachment chips that open the viewer; other links stay links. */
export const AttachmentLinks: Story = {
  args: { children: LINKS_DOC },
  render: (args) => <Markdown {...args} plugins={LINK_PLUGINS} />,
  decorators: ATTACHMENTS,
  parameters: code(LINKS_SNIPPET),
};

/** Links to another origin open in a new tab, marked ↗; file, same-page and mail links do not. */
export const ExternalLinks: Story = {
  args: { children: EXTERNAL_DOC },
  render: (args) => <Markdown {...args} plugins={EXTERNAL_PLUGINS} />,
  decorators: ATTACHMENTS,
  parameters: code(EXTERNAL_SNIPPET),
};

/**
 * The plugins of the enclosing `<Markdown>`, for a renderer drawn inside it. `markdownContent`
 * reads it, so an embedded document is drawn with its host's plugins: both headings are banded.
 */
export const MarkdownPluginsContext: Story = {
  args: { children: CONTEXT_DOC },
  render: (args) => <Markdown {...args} plugins={CONTEXT_PLUGINS} />,
  decorators: [CONTEXT_RENDERERS],
  parameters: code(CONTEXT_SNIPPET),
};

/**
 * In-memory `.md` files embedding each other. The first embedded document renders; the one it
 * embeds is past the depth limit and becomes a link, which is what stops the cycle.
 */
export const EmbedCycle: Story = {
  args: { children: EMBED_DEMO },
  render: (args) => <Markdown {...args} plugins={CYCLE_PLUGINS} />,
  decorators: [EMBED_RENDERERS],
  tags: ["edge", "!autodocs"],
};
