# @orz/ui

React components, hooks and a 20-theme token set, built on shadcn's radix-nova primitives and
Tailwind CSS v4.

## Install

```bash
pnpm add @orz/ui react react-dom radix-ui lucide-react sonner
# only for @orz/ui/hooks/use-overlay-scrollbars:
pnpm add overlayscrollbars
```

`radix-ui`, `sonner`, `lucide-react` and React are peer dependencies. They have to be the app's
own copies, because radix's dismissable-layer and focus stacks and sonner's toast store are module
state. If a second copy sat beside the app's, Escape and outside clicks would stop working between
a dialog from one copy and a menu from the other, and `toast()` would not reach `<Toaster />`.

## CSS

```css
@import "tailwindcss";
@import "@orz/ui/styles.css";
```

`styles.css` brings the tokens, the theme blocks, the base layer, `tw-animate-css` and shadcn's
Tailwind variants. It also registers `@source "./dist"` on its own, so Tailwind finds the classes
used inside the package without any `@source` line from you.

If you keep your own copy of the tokens and do not import `styles.css`, point Tailwind at the
package yourself:

```css
@source "../node_modules/@orz/ui/dist";
```

`styles.css` does not load a font. `--font-sans` names `'Geist Variable'` first and falls back to
the system UI font, so install `@fontsource-variable/geist` (or define `--font-sans`) if you want it.
`useOverlayScrollbars` needs the library's own stylesheet, which you import yourself:
`@import "overlayscrollbars/overlayscrollbars.css";`.

## Theme

Importing anything from `@orz/ui` has no side effects. Creating a theme store does: it reads the
stored pref, writes `data-theme` and `.dark` onto `<html>`, and starts following the OS and other
tabs.

```tsx
import { Toaster } from "@orz/ui/components/sonner";
import { createThemeStore, ThemeProvider } from "@orz/ui/theme";

const themes = createThemeStore({ storageKey: "app-theme" });

createRoot(root).render(
  <ThemeProvider store={themes}>
    <App />
    <Toaster />
  </ThemeProvider>,
);
```

- `useTheme()` returns `{ pref, theme, kind, setPref }`. `pref` may be `"system"`, while `theme`
  is always the resolved one. Outside a provider it reports `system`/light and ignores `setPref`.
- `<ThemeMenu />` from `@orz/ui/components/theme-menu` is a ready-made picker.
- The resolved kind is stored under `kindStorageKey`, which defaults to `` `${storageKey}-kind` ``.

### Paint guard

Without a guard, a reload in a dark theme flashes white before the bundle runs.
`themePaintGuardScript()` returns an inline script that applies the stored theme first. Give it
the same keys as the store:

```ts
// vite.config.ts
import { themePaintGuardScript } from "@orz/ui/theme";

export default defineConfig({
  plugins: [
    {
      name: "theme-paint-guard",
      transformIndexHtml: () => [
        {
          tag: "script",
          children: themePaintGuardScript({ storageKey: "app-theme" }),
          injectTo: "head-prepend",
        },
      ],
    },
  ],
});
```

## Query input

A search box that colours its own query and completes it, driven by an `@orz/query` schema.
`@orz/query` is a dependency of this package, so it is installed with it; import the schema
helpers from it directly.

| Import | Contents |
|---|---|
| `@orz/ui/components/highlighted-input` | `HighlightedInput`: a one-line input whose text is painted by a mirror layer underneath, so it can be coloured while selection, undo, autofill and IME composition stay native |
| `@orz/ui/components/query-highlight` | `highlightQuery(text, parts, schema, providers)`: the spans `HighlightedInput` paints, with keys, punctuation and values coloured by verdict |
| `@orz/ui/hooks/use-query-completion` | `useQueryCompletion({ schema, value, caret, providers, enabled })`: key and value completions at the caret; a `search` provider is asked after 150 ms of quiet, and its answers are cached per prefix |
| `@orz/ui/components/query-box` | `QueryBox`: the three above as a combobox, with the app's own rows (history, jumps) as `RowSource`s |

```tsx
import { defineQuerySchema } from "@orz/query";
import { QueryBox } from "@orz/ui/components/query-box";
import { SearchIcon } from "lucide-react";

const schema = defineQuerySchema({
  qualifiers: {
    is: { value: { kind: "enum", values: ["open", "closed"] }, hint: "open or closed" },
    label: { value: { kind: "named", source: "label" }, hint: "a label name" },
  },
});

<QueryBox
  schema={schema}
  providers={{ label: { options: labels?.map((name) => ({ value: name })) } }}
  value={value}
  onValueChange={setValue}
  onSubmit={(query) => navigate(`/search?q=${encodeURIComponent(query)}`)}
  renderSubmitRow={(query, option) => <div {...option}>Search for “{query}”</div>}
  leading={<SearchIcon />}
  inputProps={{ "aria-label": "Search", placeholder: "Search…" }}
/>;
```

Nothing in the panel is preselected, so Enter submits the query as typed unless the reader arrowed
onto a row. Tab takes the highlighted completion, or the first one. Escape closes the panel, and a
second Escape goes to `onEscape`. Pass `options: undefined` for a list that has not loaded: its
values paint as valid rather than flashing amber, and `onOpenChange` tells you when the box is in
use, so loading can wait until then.

## Filter menu

`@orz/ui/components/filter-menu` exports `FilterMenu`: a popover with a filter box over a list of
sections, for a pick from more rows than a menu should make anyone scroll through. Focus stays in the
box, so typing always filters; ↑↓, Home and End move a highlight that `aria-activedescendant`
follows, Enter picks, Escape closes, and Tab closes and moves on. The caller does the filtering and
passes the sections in, so it decides what a match means (aliases, ids, other fields);
`matchText(text, query)` and `MatchedText` fold case and diacritics, and mark the hit.

```tsx
import { FilterMenu, MatchedText, matchText } from "@orz/ui/components/filter-menu";

const [query, setQuery] = useState("");
const rows = FRUIT.filter((fruit) => matchText(fruit.label, query));

<FilterMenu
  query={query}
  onQueryChange={setQuery}
  sections={[{ id: "fruit", label: "Fruit", rows }]}
  selectedId={fruit}
  onSelect={(row) => setFruit(row.id)}
  renderRow={(row) => <MatchedText text={row.label} query={query} />}
  inputLabel="Filter fruit"
>
  <Button variant="outline">{label}</Button>
</FilterMenu>;
```

On opening, the query is cleared and the highlight rests on `selectedId`. `onHighlight(row)` reports
each highlight the user moves to, and `onHighlight(null)` a return to the committed state (the
highlight resting on `selectedId`, the pointer leaving the list, the menu closing), which is what a
live preview needs. A control in `header` that commits at once puts the highlight back through the
`ref`'s `resetHighlight()`.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui` | `cn` |
| `@orz/ui/components/<name>` | `avatar`, `badge`, `button`, `card`, `confirm-dialog`, `dialog`, `dropdown-menu`, `filter-menu`, `highlighted-input`, `hover-card`, `input`, `label`, `load-failure`, `load-more`, `popover`, `query-box`, `query-highlight`, `select`, `separator`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `theme-menu`, `tooltip`, `unsaved-changes-dialog` |
| `@orz/ui/hooks/<name>` | `scroll-insets`, `use-element-height`, `use-media-query`, `use-overlay-scrollbars`, `use-paged-append`, `use-query-completion`, `use-slash-shortcut` |
| `@orz/ui/lib/<name>` | `clipboard`, `text-metrics`, `unsaved-guard`, `utils` |
| `@orz/ui/theme` | `THEMES`, `createThemeStore`, `ThemeProvider`, `useTheme`, `themePaintGuardScript`, types |
| `@orz/ui/styles.css` | tokens, theme blocks, base layer |

`UnsavedChangesDialog` only renders the prompt, and the blocker belongs to your router. Its JSDoc
shows the TanStack Router wiring. Register the work that can be lost with `useDirtySource()` from
`@orz/ui/lib/unsaved-guard`.
