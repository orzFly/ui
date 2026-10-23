import { codeContent } from "@orz/ui-code";
import {
  type ContentRenderer,
  ContentRenderers,
  type ContentSource,
} from "@orz/ui-content";
import {
  Markdown,
  type MarkdownPlugin,
  markdownContent,
  markdownEmbeds,
} from "@orz/ui-markdown";
import { rehypeSourceLines } from "@orz/ui-markdown/lib/rehype-source-lines";
import type { Meta, StoryObj } from "@storybook/react-vite";

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

/** Wraps every h2 in a bordered band, and puts a caption over every code block. */
const decorate: MarkdownPlugin = {
  name: "decorate",
  // Stamps source lines, so the fence wrapper below has a `loc` to show.
  rehypePlugins: [rehypeSourceLines],
  components: {
    h2: ({ Next, ...props }) => (
      <div className="border-l-4 border-primary pl-3">
        <Next {...props} />
      </div>
    ),
  },
  fence: ({ Next, ...props }) => (
    <div>
      <div className="mb-1 text-xs text-muted-foreground">
        {props.lang ?? "plain text"}
        {props.loc === null
          ? ""
          : ` · lines ${props.loc.start}–${props.loc.end}`}
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

const EMBEDS = [markdownEmbeds({ resolve: resolveFile })];
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

const RENDERERS = [card, markdownContent(), codeContent];

const EMBED_DEMO = `# A document that embeds another

The image below resolves to \`overview.md\`, so it is drawn as a document,
and its paragraph becomes a \`div.markdown-paragraph\`.

![overview](files/overview.md)

An address that does not resolve stays an image:
![missing](https://example.com/missing.png)
`;

const CODE = [codeContent];

function MarkdownDemo({ source }: { source: string }) {
  return (
    <ContentRenderers renderers={CODE}>
      <div className="max-w-3xl">
        <Markdown>{source}</Markdown>
      </div>
    </ContentRenderers>
  );
}

const meta = {
  title: "ui-markdown/Markdown",
  component: MarkdownDemo,
  args: { source: GFM },
} satisfies Meta<typeof MarkdownDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GfmSampler: Story = {
  parameters: {
    a11y: {
      // remark-gfm draws a task list's boxes as disabled, unlabelled <input>s,
      // as GitHub does: the item's text is the label a reader sees, but not one
      // axe can associate with the box.
      context: { exclude: [".task-list-item > input"] },
    },
  },
};

export const FrontmatterYaml: Story = { args: { source: FRONTMATTER_YAML } };

export const FrontmatterToml: Story = { args: { source: FRONTMATTER_TOML } };

export const Folds: Story = { args: { source: DETAILS } };

/** Raw HTML and refused links are shown as what was typed. */
export const RawHtmlAndRefusedLinks: Story = { args: { source: UNSAFE } };

/** A plugin that wraps `h2` through `components` and every code block through `fence`. */
export const Plugins: Story = {
  args: { source: PLUGIN_DEMO },
  render: ({ source }) => (
    <ContentRenderers renderers={CODE}>
      <div className="max-w-3xl">
        <Markdown plugins={DECORATED}>{source}</Markdown>
      </div>
    </ContentRenderers>
  ),
};

/**
 * In-memory `.md` files embedding each other. The first embedded document renders; the one it
 * embeds is past the depth limit and becomes a link, which is what stops the cycle.
 */
export const EmbeddedDocuments: Story = {
  args: { source: EMBED_DEMO },
  render: ({ source }) => (
    <ContentRenderers renderers={RENDERERS}>
      <div className="max-w-3xl">
        <Markdown plugins={EMBEDS}>{source}</Markdown>
      </div>
    </ContentRenderers>
  ),
};
