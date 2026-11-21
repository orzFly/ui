# @orz/ui-json

A JSON value drawn as a tree that folds, searches and copies its parts, windowed so that a payload
of many megabytes opens at once. It reads JSON, JSONC, JSON5, YAML and TOML text through its
parsers (YAML's goes through the `yaml` package, TOML's through `toml-eslint-parser`), which keep
the text's comments and show them in the tree, and keep each member's place in the text, so a
selection copies as formatted JSON or as the source it was written as. A YAML document's anchors,
aliases and tags show on their rows, and an alias opens onto what it names. A TOML table written
in more than one place copies as each of those places.

## Install

<!-- generated:install by scripts/readme.ts: run `pnpm fmt` after changing a peer -->
```bash
pnpm add @orz/ui-json @orz/query @orz/themes @orz/ui lucide-react radix-ui react react-dom sonner
# only for @orz/ui-json/content, @orz/ui-json/toml/content, @orz/ui-json/yaml/content:
pnpm add @orz/ui-content
# only for @orz/ui-json/toml, @orz/ui-json/toml/content:
pnpm add toml-eslint-parser
# only for @orz/ui-json/yaml, @orz/ui-json/yaml/content:
pnpm add yaml
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

```tsx
import { JsonView } from "@orz/ui-json";
import { parseYaml } from "@orz/ui-json/yaml";

const parsed = parseYaml(text);
if (parsed.ok) <JsonView document={parsed.document} />;
```

```tsx
import { JsonView } from "@orz/ui-json";
import { parseToml } from "@orz/ui-json/toml";

const parsed = parseToml(text);
if (parsed.ok) <JsonView document={parsed.document} />;
```

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui-json` | `JsonView`, `parseJson`, `selectionText`, `selectionSource`, `agentTraceSummary`, types |
| `@orz/ui-json/content` | `jsonContent` |
| `@orz/ui-json/yaml` | `parseYaml`, its types |
| `@orz/ui-json/yaml/content` | `yamlContent` |
| `@orz/ui-json/toml` | `parseToml`, its types |
| `@orz/ui-json/toml/content` | `tomlContent` |
| `@orz/ui-json/styles.css` | the `@source` that brings the package's classes into the app's build |

## Licence

BSD-3-Clause. Parts are ported from other projects under their own licences; `NOTICE` names them
and reproduces their texts.
