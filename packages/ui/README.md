# @orz/ui

React components, hooks and a theme store, built on shadcn's radix-nova primitives and Tailwind
CSS v4. The theme data itself lives in `@orz/themes`.

## Install

<!-- Generated from package.json by scripts/install.ts: run `pnpm fmt` after changing a peer. -->
```bash
pnpm add @orz/ui @orz/query @orz/themes lucide-react radix-ui react react-dom sonner
# only for @orz/ui/hooks/use-overlay-scrollbars:
pnpm add overlayscrollbars
```

`radix-ui`, `sonner`, `lucide-react` and React are peer dependencies. They have to be the app's
own copies, because radix's dismissable-layer and focus stacks and sonner's toast store are module
state. If a second copy sat beside the app's, Escape and outside clicks would stop working between
a dialog from one copy and a menu from the other, and `toast()` would not reach `<Toaster />`.

`@orz/themes` and `@orz/query` are dependencies of `@orz/ui`, installed beside it because the app
imports them as well: the themes it hands the theme store, and the schema a `QueryBox` parses with.

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

`styles.css` is `theme.css` plus the page-level rules: the base layer (`* { border-color }`,
`body` colours, `html` font), the overlayscrollbars theme, `revealBlock`'s `.anchor-flash` and
`@source "./dist"`. A surface that
shares a document with someone else's UI, and must not restyle it, imports
`@orz/ui/theme.css` instead: the tokens, `.dark`, `tw-animate-css` and shadcn's variants, nothing
global. `theme.css` carries no `@source`, so that surface names the files Tailwind scans itself.

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
  to the first theme of the list the app passed, under `system`, or to following for a terminal
  pick.
- `setThemes(list)` and `setTerminalThemes(list)` replace those lists at runtime. A pick whose theme
  leaves the list comes back when the theme returns.

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
- Both also return `preview`, `customThemes` and `setCustomThemes` (below). Outside a provider the
  list is empty and the two calls are ignored.
- `useThemeSlots()` returns `{ ui, terminal }`: which slots the store has. The two hooks fall back
  where theirs is missing, so they cannot tell you.

### Theme menu

`<ThemeMenu />` from `@orz/ui/components/theme-menu` is a ready-made picker: an icon button opening
a filter box, an Auto / Light / Dark switch, and the themes, each with its variants in a submenu.
Whatever is highlighted previews on the whole page after resting 80 ms, and a pick commits it.

```tsx
<ThemeMenu />                                  // the UI pick
<ThemeMenu slot="terminal" />                  // the terminal pick, e.g. on a terminal pane
<ThemeMenu onCustomize={(id, slot) => openEditor(id, slot)} />
```

- `slot` is `"ui"` (default) or `"terminal"`. A picker whose slot the store lacks renders nothing.
  The terminal picker adds a "Same as UI" row and a Terminal only group.
- `onCustomize` adds a "Custom themes…" row, which calls it with no id, and an edit button on each
  custom theme's row, which calls it with that theme's id. The second argument is the menu's slot,
  so a new theme opened from the terminal menu is a terminal theme; a callback that takes only the
  id still fits. The app brings the editor, such as `ThemeEditor` below.

`trigger` replaces the icon button, for a toolbar with buttons of its own look. It gets the icon
the default button would show (it follows the mode in the UI picker) and the menu's name, "Theme"
or "Terminal theme", which the element should carry as its accessible name. The element goes
through Radix's `PopoverTrigger asChild`, so it must take a ref and spread the props it is given
onto a DOM element.

```tsx
<ThemeMenu
  trigger={({ Icon, label }) => (
    <button type="button" aria-label={label} title={label} className="…">
      <Icon className="size-3.5" />
    </button>
  )}
/>
```

### Custom themes

The store keeps the user's custom themes from `@orz/themes` in one list of two kinds, and lists the
ones that compose ahead of each slot's own list, in list order:

- a `CustomTheme` (no `kind`) is composed with `composeTheme` and goes into both slots. In a store with no UI slot it stays in the list and shows nowhere;
- a `CustomTerminalTheme` (`kind: "terminal"`), made of terminal colours alone, is composed with
  `composeTerminalTheme` and goes into the terminal slot only. In a store with no terminal slot it
  stays in the list and shows nowhere.

```ts
const { customThemes, setCustomThemes } = useTheme();
setCustomThemes([...customThemes, draft]);
```

- `getCustomThemes()` / `setCustomThemes(list)` on the store, typed `AnyCustomTheme`.
  `setCustomThemes` throws on an id that repeats across both kinds or that a theme in either list
  already has.
- `setThemes` and `setTerminalThemes` replace the app's own lists; the custom themes are composed
  again against them.
- A custom theme whose bases are gone stays in `getCustomThemes()` but out of the lists, so an
  editor can still show and repair it.
- The list is stored as JSON under `customStorageKey` (default `` `${storageKey}-custom` ``) and
  follows other tabs. Entries that do not have the shape of either kind, or carry a `kind` this
  version does not know, are dropped on read, and the key is only written by `setCustomThemes`.
- `persistCustomThemes: false` keeps the store away from that key altogether. The app then loads its
  list with `setCustomThemes` and saves it from `subscribe` and `getCustomThemes`, for example to its
  server.
- `persistPref: false` does the same for the pref under `storageKey`: the store never writes the
  pref and ignores other tabs' writes to it. The app then commits picks itself with `setPref`, for
  example from a URL. Until it does, the store shows the pick the paint cache last painted (the
  first theme when there is none), so it does not repaint over the [paint guard](#paint-guard).
  An app whose source holds no pick, such as a bare URL, commits its default with `setPref` rather
  than relying on the store's. The paint cache and the custom themes are unaffected.

### Custom theme editor

`<ThemeEditor />` from `@orz/ui/components/theme-editor` is the editor `ThemeMenu`'s
`onCustomize` opens: a panel docked to the right, with the page left visible and repainted with the
draft as it changes. Each side of a theme is based on a theme from the store's lists with
overrides, fully custom, or absent; its terminal colours follow the base or are edited the same
way.

A store with a terminal slot also gets terminal themes, in a layout of their own: Light and Dark
tabs, each side None, based on a palette (with its scheme and variant) or fully custom, over the
terminal colours. A terminal theme with one side serves both modes. A terminal-only store edits
terminal themes only; a store with both slots lists the two kinds in two groups, and **+ New** asks
which to make.

```tsx
const [editing, setEditing] = useState<{ id?: string; slot: "ui" | "terminal" } | null>(null);

<ThemeMenu onCustomize={(id, slot) => setEditing({ id, slot })} />
<ThemeMenu slot="terminal" onCustomize={(id, slot) => setEditing({ id, slot })} />
<ThemeEditor
  open={editing !== null}
  themeId={editing?.id}
  kind={editing?.slot}
  onOpenChange={(open) => { if (!open) setEditing(null); }}
/>
```

- `themeId` opens that custom theme; without one, with an id the store does not hold, or with a
  theme of a kind the store cannot show, the editor starts a new theme from what the page shows (a
  terminal theme from what the terminal shows).
- `kind` is the kind of that new theme. Unset, or naming a slot the store lacks, it is a UI theme
  when the store has a UI slot, else a terminal theme.
- It reads and writes the store's custom list (`customThemes` / `setCustomThemes`), so the themes
  are stored wherever the store keeps that list: under `customStorageKey`, or wherever the app saves
  it with `persistCustomThemes: false`. A kind the store cannot show is left out of the editor and
  written back untouched. Save also makes a UI theme the UI pick, and a terminal theme the terminal
  pick, leaving the UI pick alone.
- `onOpenChange(false)` comes after Save, or after the unsaved-changes prompt resolves to Discard.
  While the draft has unsaved edits it is registered with `@orz/ui/lib/unsaved-guard`, so the app's
  leave-page guard covers it.

Import… and Export carry themes as JSON files (`format: "orz-themes"`, `version: 1`). UI themes go
in `themes`, always written; terminal themes in `terminalThemes`, written only when there is one. An
entry is a custom theme without its id or kind, and every based side or terminal also carries the
colours it showed at export, so a theme whose base the importing app lacks arrives as fully custom
instead of being lost. Import follows the store's slots: a terminal theme is refused where there is
no terminal, and a UI theme arrives in a terminal-only store as a terminal theme made from the
terminal colours each side shows. `serializeThemeFile`, `parseThemeFile` and `uniqueLabel` in `@orz/ui/lib/theme-file` read and
write the format with no React or DOM, for example to validate uploads on a server.

### Preview

`preview(next)` shows a pick without committing it, and `preview(null)` shows the committed pick
again. It is what `ThemeMenu` calls on a highlight.

```ts
store.preview({ ui: { theme: "dracula", mode: "dark" } });
store.preview({ terminal: "follow" });                              // the terminal following the UI
store.preview({ ui: { theme: composeTheme(draft, themes), mode } }); // an unsaved theme
```

- A slot left out of `next` shows its committed pick. A theme passed as an object need not be in
  any list; for `ui` it must be a UI theme (`isUiTheme`), or `preview` throws.
- It paints exactly what `setPref` paints, and writes neither `storageKey` nor the paint cache, so
  other tabs and a reload see only the committed pick.
- While it is active, `getResolved()`, `getTerminal()` and the hooks report what is shown, so
  everything themed follows the preview; `getPref()` and the hooks' `pref` stay the committed pick.
- `setPref` and `dispose` clear it. A previewed theme that leaves its list falls back to the
  committed pick.

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

When the app keeps the pick on its server, keep `persistPref` on and hand the server's answer to
`setPref` when it arrives. Until then the store shows the copy in `storageKey`, so a reload paints
the last pick at once, and the server's answer repaints only when another device changed it. Save
the user's picks from `subscribe` and `getPref`. `persistPref: false` is for an app whose pick must
not have a second source, such as one held in the URL.

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

Under a UI pick, the guard's rule also sets `background-color: var(--background)` on `<html>`, so
frames painted before the stylesheet loads already show the theme's background. The store's rule
leaves it out, so once the store starts, `body`'s background reaches the canvas as usual.

A page that cannot run an inline script, under a Content Security Policy without
`'unsafe-inline'` for example, can have its server paint the background instead. Given
`paintCookie: "app-theme-paint"`, the store also writes the committed UI pick's background for each
side it can show to that cookie (path `/`, one year, `SameSite=Lax`). `themePaintCookieStyle(value)`
turns the cookie's value, URL-encoded or not, into CSS for a `<style>` in `<head>`: the background
and `color-scheme` on `html`, with the dark side under `@media (prefers-color-scheme: dark)` when
both are stored. A side whose colour could break out of the rule is dropped, and a missing or
malformed value gives `""`.

```ts
// a server template
const css = themePaintCookieStyle(request.cookies["app-theme-paint"]);
html`<head><style>${css}</style>…</head>`;
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

Rows can carry a submenu: `getSubmenu(row)` returns its rows (ids unique across the whole menu), and
`selectedSubmenuId` checks one of them. The submenu opens beside a row the user highlights, by
pointer or keys, but not for the highlight resting on `selectedId` or on the query's first hit. →
with the caret at the end of the query enters it, ← and Escape come back, and `onHighlight` and
`onSelect` receive its rows like any other. The pointer can cut across other rows on its way to the
submenu without moving the highlight. A row with a submenu is a split button: clicking the row picks
it, and clicking its chevron, past the divider, opens the submenu instead. `submenuLabel(row)` names
the submenu's listbox.

## Colour picker

`ColorPicker` is the panel, rendered inline; `ColorPickerPopover` puts it behind a trigger that
shows the value, or behind your own trigger passed as `children`. Both come from
`@orz/ui/components/color-picker`. The colour maths they use is `@orz/ui/lib/color`: `parseColor`,
`formatColor`, `gamutOf`, `mapToSrgb`, `maxChroma` and `contrastRatio`, on oklch values.
`maxChroma(l, h, gamut)` is the largest chroma at a lightness and hue that stays inside `"srgb"` or
`"p3"`.

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
- Three picking surfaces, all at the current hue:
  - `oklch`: lightness up, and across, chroma as a share of the largest chroma the `gamut` holds at
    that lightness, so every point is a colour inside it. A colour beyond the gamut sits pinned to
    the right edge with a dashed ring, and keeps its value until the area is touched.
  - `absolute`: lightness up, and across, chroma itself, the axis fitted to the hue's Display P3
    wedge. The sRGB and P3 edges are drawn, and past P3 is a faded veil. It is the surface for exact
    chroma and for colours outside sRGB.
  - `hsv`: the HSV square.

  The default is `oklch` when the output is oklch and `hsv` otherwise; `surfaces` limits them, and
  `surface` with `onSurfaceChange` controls the choice if you want to persist it.
- `gamut` (`"srgb"`, the default, or `"p3"`) bounds the `oklch` surface and the chroma lock.
- `resetValue` shows a reset button beside the text field that commits that value. The prop is not
  `defaultValue`, which React reads as an uncontrolled input's initial value.
- The chroma lock, a toggle beside the hue slider on the oklch surfaces, keeps chroma's share of
  the gamut's maximum while the hue slider or the L and H fields move, so a vivid colour stays
  vivid instead of falling out of the gamut. `chromaLock` / `defaultChromaLock` /
  `onChromaLockChange` control it.
- `extra` renders at the bottom of the panel, for a consumer's own controls.

Importing either entry point brings in [culori](https://culorijs.org) (about 9 KB gzipped, only the
modes the picker uses); nothing else in `@orz/ui` does.

## Media controls

`MediaControls`, from `@orz/ui/components/media-controls`, is the control bar under a media frame:
play, time, seek, volume, speed, picture-in-picture and fullscreen, in that order. It plays nothing
itself; the player passes the values in and acts on the callbacks. `@orz/ui-asciinema`'s cast
player and `@orz/ui-content`'s `VideoPlayer` and `AudioPlayer` draw it.

```tsx
import { MediaControls } from "@orz/ui/components/media-controls";

<MediaControls
  playing={playing}
  time={time}
  duration={duration}
  speed={speed}
  onToggle={toggle}
  onSeek={seek}
  onSpeed={setSpeed}
  buffered={[[0, 42]]}
  volume={{ level, muted, onLevel: setLevel, onMute: toggleMute }}
  fullscreen={{ active: fullscreen, onToggle: toggleFullscreen }}
  portal={fullscreen ? frame : undefined}
/>;
```

- `time` and `duration` are seconds. A `duration` that is not finite, as a recorded WebM reports
  until it has been read to the end, disables the seek track and shows the time alone.
- Dragging the seek track moves only the time shown; `onSeek` fires once, on release, and a value
  within a step of the end snaps to the end.
- `markers` are ticks over the track that seek to their time; `buffered` ranges are shaded behind
  the played range.
- `volume`, `fullscreen` and `pictureInPicture` are each one object of value and handler; leave one
  out and its control is not drawn. `onLevel` only reports a level: whether dragging a muted
  volume unmutes is the player's call.
- From 24rem wide, volume is a mute button beside a level slider; below that, a single button opens
  a popover with a vertical slider and the mute button. A container query makes the switch, so
  nothing is measured.
- `portal` is where the popover, the speed list and the tooltips render: the frame, while it is
  fullscreen, or they would open outside it. `MEDIA_SPEEDS` lists the speeds offered, and a speed
  outside it joins the list. `formatTime(seconds, long?)` writes `m:ss`, or `h:mm:ss`.

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui` | `cn` |
| `@orz/ui/components/<name>` | `avatar`, `badge`, `button`, `card`, `color-picker`, `confirm-dialog`, `dialog`, `dropdown-menu`, `filter-menu`, `highlighted-input`, `hover-card`, `input`, `label`, `link-chip`, `load-failure`, `load-more`, `media-controls`, `popover`, `query-box`, `query-highlight`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `theme-editor`, `theme-menu`, `tooltip`, `unsaved-changes-dialog` |
| `@orz/ui/hooks/<name>` | `scroll-insets`, `use-element-height`, `use-media-query`, `use-overlay-scrollbars`, `use-paged-append`, `use-query-completion`, `use-slash-shortcut` |
| `@orz/ui/lib/<name>` | `cell-width`, `clipboard`, `color`, `scroll-map`, `text-metrics`, `theme-file`, `unsaved-guard`, `utils` |
| `@orz/ui/theme` | `createThemeStore`, `ThemeProvider`, `useTheme`, `useTerminalTheme`, `useThemeSlots`, `themePaintGuardScript`, `normalizePref`, `parseStoredPref`, types (the theme data types re-exported from `@orz/themes`) |
| `@orz/ui/styles.css` | baseline tokens (the `default` theme), base layer |
| `@orz/ui/theme.css` | baseline tokens and custom variants, without the base layer or @source |

`UnsavedChangesDialog` only renders the prompt, and the blocker belongs to your router. Its JSDoc
shows the TanStack Router wiring. Register the work that can be lost with `useDirtySource()` from
`@orz/ui/lib/unsaved-guard`.
