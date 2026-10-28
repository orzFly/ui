# @orz/ui-mermaid

[Mermaid](https://www.npmjs.com/package/mermaid) diagrams drawn in the active `@orz/ui` theme. The
package contributes a renderer to `@orz/ui-content`'s registry, so a ```` ```mermaid ```` fence in
`@orz/ui-markdown` and a `.mmd` file in a viewer both become diagrams without importing this package
from either.

## Install

<!-- generated:install by scripts/readme.ts: run `pnpm fmt` after changing a peer -->
```bash
pnpm add @orz/ui-mermaid @orz/query @orz/themes @orz/ui @orz/ui-content lucide-react radix-ui \
  react react-dom sonner
```
<!-- /generated -->

`mermaid` is a regular dependency: installing this package is the whole setup.
`@orz/ui-content` is a peer dependency so that the app and every content package share one registry.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-mermaid/styles.css";
```

Import it after `@orz/ui/styles.css`. It holds the diagram's fit rule: a diagram shrinks to its
column down to 75% of its natural width, then scrolls, and is never enlarged. Like `@orz/ui`'s
stylesheet, it registers `@source "./dist"` on its own.

## `mermaidContent`

```tsx
import { ContentRenderers } from "@orz/ui-content";
import { mermaidContent } from "@orz/ui-mermaid";

const RENDERERS = [mermaidContent, markdownContent(), codeContent];

<ContentRenderers renderers={RENDERERS}>{app}</ContentRenderers>;
```

It accepts inline sources whose `lang` is `mermaid` (any case), which is what a markdown fence
becomes, and files named `*.mmd` or `*.mermaid`, in either placement. Register it before any
renderer that takes every inline source, such as a code renderer, since the first renderer that
accepts wins.

The source shows until the first render lands, in place of a diagram that does not parse (with a
one-line summary of the parser's message under it), and behind the Source toggle. That source view
is `Next`: the renderers registered after this one draw it, so it is highlighted when a code
renderer is registered and a plain `<pre><code>` when none is. A file is loaded once: the source view gets its text as an inline
source tagged `mermaid`. A file that fails to load shows the message and a Retry button.

## `MermaidBlock`

For a surface that draws a diagram outside the registry:

```tsx
import { MermaidBlock } from "@orz/ui-mermaid";

<MermaidBlock source={text} />
<MermaidBlock source={text} sourceView={<MySourceView text={text} />} className="my-4" />
```

`sourceView` defaults to a plain `<pre><code>`.

## Theme

A diagram is drawn in the theme tokens in effect on its element (`--background`, `--foreground`,
`--muted`, `--muted-foreground`, `--border`), so every `@orz/ui` theme gets its own colours with no
table to maintain. The palette is baked into the SVG, so the diagram is drawn again whenever
`@orz/ui`'s `useTheme()` reports a new theme, color scheme or variant. Outside a `ThemeProvider` a diagram keeps the colours
present when it was drawn and does not follow a later switch.

## Loading

mermaid is only reached through `import("mermaid")`, so a bundler splits it into chunks of its own,
fetched the first time a page holds a diagram. A chunk that fails to load leaves the diagram on its
source, and the next render tries the import again; whether that refetches is the browser's call,
since some cache a failed module fetch for the life of the page. Labels go through mermaid's
`securityLevel: "strict"`, which sanitises them: markup survives, scripts and handlers do not.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-mermaid` | `mermaidContent`, `MermaidBlock` |
| `@orz/ui-mermaid/styles.css` | the `.mermaid-diagram` fit rule |
