# @orz/ui-json

A JSON value drawn as a tree that folds, searches and copies its parts, windowed so that a payload
of many megabytes opens at once. It reads JSON, JSONC and JSON5 text through its own parser, which
keeps the text's comments and shows them in the tree, and keeps each member's place in the text, so
a selection copies as formatted JSON or as the source it was written as.

## Install

<!-- generated:install by scripts/readme.ts: run `pnpm fmt` after changing a peer -->
```bash
pnpm add @orz/ui-json @orz/query @orz/themes @orz/ui lucide-react radix-ui react react-dom sonner
# only for @orz/ui-json/content:
pnpm add @orz/ui-content
```
<!-- /generated -->

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
@import "@orz/ui-json/styles.css";
```

Import it after `@orz/ui/styles.css`. It holds no rules of its own; it registers `@source "./dist"`,
so the package's classes are generated without an `@source` in the app.

## Use

```tsx
import { JsonView, parseJson } from "@orz/ui-json";

<JsonView value={payload} />;

const parsed = parseJson(text, { dialect: "json5" });
if (parsed.ok) <JsonView document={parsed.document} />;
```

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-json` | `JsonView`, `parseJson`, `selectionText`, `selectionSource`, `agentTraceSummary`, types |
| `@orz/ui-json/content` | `jsonContent` |
| `@orz/ui-json/styles.css` | the `@source` that brings the package's classes into the app's build |

## Licence

BSD-3-Clause. Parts are ported from other projects under their own licences; `NOTICE` names them
and reproduces their texts.
