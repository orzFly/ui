# @orz/ui

React components, hooks and a theme store, built on shadcn's radix-nova primitives and Tailwind
CSS v4. The theme data itself lives in `@orz/themes`.

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

`styles.css` brings the baseline tokens, the base layer, `tw-animate-css` and shadcn's
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
stored pref, paints it, and starts following the OS and other tabs. The store takes its themes as
input, so an app ships only the themes it passes.

```tsx
import { builtinThemes } from "@orz/themes";
import { Toaster } from "@orz/ui/components/sonner";
import { createThemeStore, ThemeProvider } from "@orz/ui/theme";

const themes = createThemeStore({
  storageKey: "app-theme",
  themes: builtinThemes,
});

createRoot(root).render(
  <ThemeProvider store={themes}>
    <App />
    <Toaster />
  </ThemeProvider>,
);
```

The store has two slots, and an app enables either or both by handing over a list for it:

- `themes` is the UI slot. Its pick paints the page.
- `terminalThemes` is the terminal slot. It may also hold terminal-only themes from
  `@orz/themes`. Without a terminal pick, the terminal follows the UI pick: same theme, color
  scheme and variant.

A store with only a UI slot still writes the UI pick's terminal tokens, so an ANSI-escape renderer
anywhere on the page works without a slot of its own. A store with only a terminal slot writes the
terminal tokens alone and leaves `color-scheme`, `.dark` and `data-theme` to the page.

The pick is one theme, a mode and an optional variant per slot:

```ts
store.setPref({
  ui: { theme: "github", mode: "light" },
  terminal: { theme: "dracula", mode: "dark", variant: "amoled" },
});
```

- `mode` is `"system"`, `"light"` or `"dark"`. On a theme with one palette it is always that
  palette's side.
- `variant` names one variant for the whole theme. A palette that does not define it shows its
  default, so AMOLED Solarized under `system` is default Solarized Light by day and AMOLED Solarized
  Dark at night.
- Every read and write normalizes the pref against the current lists: an unknown theme falls back
  to the first one under `system`, or to following for a terminal pick.
- `setThemes(list)` and `setTerminalThemes(list)` replace the lists at runtime, which is how custom
  themes from `composeTheme` come in. A pick whose theme leaves the list comes back when the theme
  returns.

The store paints through one `<style data-orz-theme>` element in `<head>`, holding a single
`:root { … }` rule rendered from the data. It also toggles `.dark` and sets `data-theme`,
`data-variant` and `data-terminal-theme` on the root. Given a `root` other than `<html>`, the store
keeps an element of its own, sets `data-orz-theme-root` on that root to an id unique to the store,
and scopes the rule to it, so stores on different roots never repaint each other. The rule has
plain `:root` specificity, so a stylesheet loaded later, or a `:root:root` selector, can still
retune a token for every theme.

- `useTheme()` returns `{ pref, themes, theme, colorScheme, variant, setPref }`: the UI slot's
  normalized pref and list, the resolved theme object, the color scheme on screen, and the variant
  that side shows. Outside a provider it reports the default theme, light, and ignores `setPref`.
- `useTerminalTheme()` returns `{ following, themes, theme, colorScheme, variant, tokens }` for the
  terminal slot.
- `<ThemeMenu />` from `@orz/ui/components/theme-menu` is a ready-made picker for the UI slot.

### Terminals

The terminal tokens are CSS variables (`--terminal-background`, `--terminal-foreground`,
`--terminal-cursor`, `--terminal-selection`, and `--ansi-black` through `--ansi-bright-white`), and
Tailwind classes such as `bg-terminal-background` and `text-ansi-red`. An ANSI-escape renderer can
use the classes directly. xterm.js takes the resolved tokens:

```tsx
import { xtermTheme } from "@orz/themes";
import { useTerminalTheme } from "@orz/ui/theme";

const { tokens } = useTerminalTheme();
useEffect(() => {
  terminal.options.theme = xtermTheme(tokens);
}, [terminal, tokens]);
```

### Storage

`storageKey` holds the pref as JSON:
`{"ui":{"theme":"github","mode":"light"},"terminal":{"theme":"dracula","mode":"dark"}}`. A default
variant and a following terminal are left out.

Prefs stored by earlier versions of `@orz/ui` are read and rewritten in this shape on the next
write. A plain slug such as `solarized-dark` becomes `{ theme: "solarized", mode: "dark" }`, and
`system`, `light` and `dark` map onto the `default` theme. An app that keeps its old `storageKey`
keeps its users' themes.

### Paint guard

Without a guard, a reload in a dark theme flashes white before the bundle runs. The store caches
the declarations it painted under `paintKey` (default `` `${storageKey}-paint` ``), one per side the
slot's mode can show. `themePaintGuardScript()` returns an inline script that replays them before
the bundle loads, choosing the side from the OS when both are cached, so neither the guard nor the
page needs a theme list. The store adopts the guard's `<style>` element when it starts. Give the
guard the same keys as the store:

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

On the first load after an upgrade there is no cache yet. The guard then sets `.dark` from the
`` `${storageKey}-kind` `` value earlier versions stored, and the store writes the cache.

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

## Colour picker

`ColorPicker` is the panel, rendered inline; `ColorPickerPopover` puts it behind a trigger that
shows the value, or behind your own trigger passed as `children`. Both come from
`@orz/ui/components/color-picker`. The colour maths they use is `@orz/ui/lib/color`: `parseColor`,
`formatColor`, `gamutOf`, `mapToSrgb` and `contrastRatio`, on oklch values.

```tsx
import { ColorPickerPopover } from "@orz/ui/components/color-picker";

<ColorPickerPopover
  value={token}
  onValueChange={preview}
  onValueCommit={save}
  format="oklch"
  contrastWith={background}
  contrastLabel="background"
  swatches={[{ label: "This theme", colors: tokens }]}
/>;
```

- `value` is any CSS colour. The panel follows it, except that the parent echoing the panel's own
  output changes nothing, so the panel keeps full precision between strings.
- `onValueChange` fires on every drag frame and every keystroke that parses; `onValueCommit` when
  an interaction ends (pointer release, a keyboard step, Enter or blur, a swatch, the eyedropper).
  Preview on change, save on commit.
- The output keeps the incoming value's format when that is oklch, hex, rgb or hsl, and is oklch
  otherwise; `format` pins it. hex, rgb and hsl cannot leave sRGB, so they are gamut-mapped.
  `alpha={false}` makes every output opaque.
- Two picking surfaces: oklch (lightness × chroma at a hue, with the sRGB and Display P3 edges
  drawn) and the HSV square. The default follows the output format; `surfaces` limits them, and
  `surface` with `onSurfaceChange` controls the choice if you want to persist it.

Importing either entry point brings in [culori](https://culorijs.org) (about 9 KB gzipped, only the
modes the picker uses); nothing else in `@orz/ui` does.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui` | `cn` |
| `@orz/ui/components/<name>` | `avatar`, `badge`, `button`, `card`, `color-picker`, `confirm-dialog`, `dialog`, `dropdown-menu`, `filter-menu`, `highlighted-input`, `hover-card`, `input`, `label`, `load-failure`, `load-more`, `popover`, `query-box`, `query-highlight`, `select`, `separator`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `theme-menu`, `tooltip`, `unsaved-changes-dialog` |
| `@orz/ui/hooks/<name>` | `scroll-insets`, `use-element-height`, `use-media-query`, `use-overlay-scrollbars`, `use-paged-append`, `use-query-completion`, `use-slash-shortcut` |
| `@orz/ui/lib/<name>` | `clipboard`, `color`, `text-metrics`, `unsaved-guard`, `utils` |
| `@orz/ui/theme` | `createThemeStore`, `ThemeProvider`, `useTheme`, `useTerminalTheme`, `themePaintGuardScript`, `normalizePref`, `parseStoredPref`, types (the theme data types re-exported from `@orz/themes`) |
| `@orz/ui/styles.css` | baseline tokens (the `default` theme), base layer |

`UnsavedChangesDialog` only renders the prompt, and the blocker belongs to your router. Its JSDoc
shows the TanStack Router wiring. Register the work that can be lost with `useDirtySource()` from
`@orz/ui/lib/unsaved-guard`.
