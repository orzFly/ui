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

## Entry points

| Import | Contents |
|---|---|
| `@orz/ui` | `cn` |
| `@orz/ui/components/<name>` | `avatar`, `badge`, `button`, `card`, `confirm-dialog`, `dialog`, `dropdown-menu`, `hover-card`, `input`, `label`, `load-failure`, `load-more`, `popover`, `select`, `separator`, `skeleton`, `sonner`, `switch`, `table`, `tabs`, `textarea`, `theme-menu`, `tooltip`, `unsaved-changes-dialog` |
| `@orz/ui/hooks/<name>` | `scroll-insets`, `use-element-height`, `use-media-query`, `use-overlay-scrollbars`, `use-paged-append`, `use-slash-shortcut` |
| `@orz/ui/lib/<name>` | `clipboard`, `text-metrics`, `unsaved-guard`, `utils` |
| `@orz/ui/theme` | `THEMES`, `createThemeStore`, `ThemeProvider`, `useTheme`, `themePaintGuardScript`, types |
| `@orz/ui/styles.css` | tokens, theme blocks, base layer |

`UnsavedChangesDialog` only renders the prompt, and the blocker belongs to your router. Its JSDoc
shows the TanStack Router wiring. Register the work that can be lost with `useDirtySource()` from
`@orz/ui/lib/unsaved-guard`.
