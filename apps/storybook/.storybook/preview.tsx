import { builtinThemes } from "@orz/themes";
import { Toaster } from "@orz/ui/components/sonner";
import {
  createThemeStore,
  type ResolvedTheme,
  type ThemePreview,
  ThemeProvider,
  type ThemeStore,
} from "@orz/ui/theme";
import { DocsContainer } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type ComponentProps, useEffect, useSyncExternalStore } from "react";
import {
  GLOBALS_UPDATED,
  SET_GLOBALS,
  UPDATE_GLOBALS,
} from "storybook/internal/core-events";
import { addons } from "storybook/preview-api";
import {
  changedGlobals,
  INITIAL_GLOBALS,
  KEY_OF,
  prefOf,
  type ThemeGlobals,
  urlGlobals,
} from "./globals.ts";
import { storybookTheme } from "./storybook-theme.ts";
import { PREVIEW_EVENT, type PreviewMessage } from "./theme-channel.ts";
import "./preview.css";

// The globals are the committed state: a stored pref would be a second one,
// and another tab's pick would repaint this canvas but not its toolbar or URL.
const themes = createThemeStore({
  storageKey: "orz-storybook-theme",
  persistPref: false,
  themes: builtinThemes,
  terminalThemes: builtinThemes,
});
const DEFAULT_THEME = builtinThemes[0].id;

/** Per global, the string this side last wrote or applied; anything equal to it is skipped. */
const last: ThemeGlobals = {
  ...INITIAL_GLOBALS,
  ...urlGlobals(location.search),
};
themes.setPref(prefOf(last, DEFAULT_THEME));

function applyGlobals(globals: Readonly<Record<string, unknown>>) {
  let moved = false;
  for (const key of Object.values(KEY_OF)) {
    const value = globals[key];
    if (typeof value === "string" && value !== last[key]) {
      last[key] = value;
      moved = true;
    }
  }
  if (moved) themes.setPref(prefOf(last, DEFAULT_THEME));
}

function emitPreview(preview: ThemePreview | null) {
  const message: PreviewMessage = { from: "preview", preview };
  addons.getChannel().emit(PREVIEW_EVENT, message);
}

// What ThemeProvider hands to a ThemeMenu inside a story: a pick there writes
// the globals, so the toolbar, the chrome and the URL follow it.
const facade: ThemeStore = {
  ...themes,
  setPref(next) {
    const before = themes.getPref();
    themes.setPref(next);
    const changed = changedGlobals(
      before,
      themes.getPref(),
      last,
      DEFAULT_THEME,
    );
    if (Object.keys(changed).length > 0) {
      Object.assign(last, changed);
      // What the preview's own useGlobals sends.
      addons.getChannel().emit(UPDATE_GLOBALS, { globals: changed });
    } else {
      // The manager's chrome may still show this side's hover.
      emitPreview(null);
    }
  },
  preview(next) {
    themes.preview(next);
    emitPreview(next);
  },
};

void addons.ready().then((channel) => {
  // Ahead of the story's re-render, so a commit repaints the canvas with no
  // frame of the old theme.
  // Only this preview's own globals. A docs page whose stories render in
  // iframes (ThemeMenu's) hosts a preview per story, and each one's channel
  // posts its own SET_GLOBALS, at the initial globals, to this window. The
  // channel calls a listener with the event as `this`, and an event's `from`
  // is the sending channel's id.
  const sender = (channel as unknown as { sender: string }).sender;
  const onGlobals = function (
    this: { from?: string },
    { globals }: { globals: Record<string, unknown> },
  ) {
    if (this.from === sender) applyGlobals(globals);
  };
  channel.on(SET_GLOBALS, onGlobals);
  channel.on(GLOBALS_UPDATED, onGlobals);
  channel.on(PREVIEW_EVENT, (message: PreviewMessage) => {
    if (message.from !== "preview") themes.preview(message.preview);
  });
});

const withTheme: Decorator = (Story, context) => {
  const { theme, terminal } = context.globals;
  // The channel listeners above apply a change first; this is the fallback
  // for a story's own globals.
  useEffect(() => {
    applyGlobals({ theme, terminal });
  }, [theme, terminal]);
  return (
    <ThemeProvider store={facade}>
      <Story />
      <Toaster />
    </ThemeProvider>
  );
};

// The store has a UI slot, so it always resolves a UI theme.
const resolvedTheme = () => themes.getResolved() as ResolvedTheme;

// Docs pages are drawn by Storybook's own theme, which knows nothing of the
// toolbar; left alone it stays light under a dark @orz/ui theme and the
// stories' light text lands on a white page.
function ThemedDocsContainer(props: ComponentProps<typeof DocsContainer>) {
  const resolved = useSyncExternalStore(themes.subscribe, resolvedTheme);
  return <DocsContainer {...props} theme={storybookTheme(resolved)} />;
}

const preview: Preview = {
  // No `toolbar`: the pickers are the ThemeMenus manager.ts puts there.
  // Storybook still takes both globals from the URL and from updateGlobals.
  globalTypes: {
    theme: { description: "Theme" },
    terminal: { description: "Terminal theme" },
  },
  initialGlobals: INITIAL_GLOBALS,
  parameters: {
    docs: { container: ThemedDocsContainer },
    options: {
      // Storybook lifts this function out of the source and evals it on its
      // own: it cannot reach anything outside its body, and a type
      // annotation inside it is a syntax error there.
      // Equal titles compare as 0, and the sort is stable, which keeps a file's
      // docs entry and stories in their written order.
      storySort: (a, b) => {
        const order = ["Foundations", "Primitives", "Patterns", "Hooks", "Hex"];
        const [ra, rb] = [a.title, b.title].map((title) => {
          const i = order.indexOf(title.split("/")[0]);
          return i === -1 ? order.length : i;
        });
        return ra - rb || a.title.localeCompare(b.title);
      },
    },
  },
  decorators: [withTheme],
  tags: ["autodocs"],
};

export default preview;
