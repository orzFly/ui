import { builtinThemes } from "@orz/themes";
import { Toaster } from "@orz/ui/components/sonner";
import { ThemeEditor } from "@orz/ui/components/theme-editor";
import {
  createThemeStore,
  type ResolvedTheme,
  type ThemePref,
  type ThemePreview,
  ThemeProvider,
  type ThemeStore,
} from "@orz/ui/theme";
import { DocsContainer } from "@storybook/addon-docs/blocks";
import type { Decorator, Preview } from "@storybook/react-vite";
import { type ComponentProps, useEffect, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
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
  withUrlGlobals,
} from "./globals.ts";
import { storybookTheme } from "./storybook-theme.ts";
import {
  CUSTOMIZE_EVENT,
  type CustomizeMessage,
  PREVIEW_EVENT,
  type PreviewMessage,
} from "./theme-channel.ts";
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

// A docs page that renders its stories in iframes (ThemeMenu's) takes their
// URL from PREVIEW_URL, and Storybook remounts them on every globals change.
// Without the globals there, each one reloads on initialGlobals.
const PREVIEW_BASE = globalThis.PREVIEW_URL ?? "iframe.html";
const syncPreviewUrl = () => {
  globalThis.PREVIEW_URL = withUrlGlobals(PREVIEW_BASE, last);
};
syncPreviewUrl();

/** The toolbar editor's draft (see PreviewMessage), shown whenever nothing else previews. */
let draft: ThemePreview | null = null;
const show = (preview: ThemePreview | null) => themes.preview(preview ?? draft);
// setPref ends any preview, the draft's included.
const setPref = (next: ThemePref) => {
  themes.setPref(next);
  if (draft !== null) show(null);
};

function applyGlobals(globals: Readonly<Record<string, unknown>>) {
  let moved = false;
  for (const key of Object.values(KEY_OF)) {
    const value = globals[key];
    if (typeof value === "string" && value !== last[key]) {
      last[key] = value;
      moved = true;
    }
  }
  if (!moved) return;
  syncPreviewUrl();
  setPref(prefOf(last, DEFAULT_THEME));
}

function emitPreview(preview: ThemePreview | null, isDraft = false) {
  const message: PreviewMessage = { from: "preview", preview };
  if (isDraft) message.draft = true;
  addons.getChannel().emit(PREVIEW_EVENT, message);
}

// What ThemeProvider hands to a ThemeMenu inside a story: a pick there writes
// the globals, so the toolbar, the chrome and the URL follow it.
const facade: ThemeStore = {
  ...themes,
  setPref(next) {
    const before = themes.getPref();
    setPref(next);
    const changed = changedGlobals(
      before,
      themes.getPref(),
      last,
      DEFAULT_THEME,
    );
    if (Object.keys(changed).length > 0) {
      Object.assign(last, changed);
      syncPreviewUrl();
      // What the preview's own useGlobals sends.
      addons.getChannel().emit(UPDATE_GLOBALS, { globals: changed });
    } else {
      // The manager's chrome may still show this side's hover.
      emitPreview(null);
    }
  },
  preview(next) {
    show(next);
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
    if (message.from !== "preview") show(message.preview);
  });
});

const editorStore: ThemeStore = {
  ...facade,
  preview(next) {
    draft = next;
    show(next);
    emitPreview(next, true);
  },
};

interface EditorState {
  // The last request outlives the close, so the sheet keeps its content
  // through the exit animation.
  request: CustomizeMessage | null;
  open: boolean;
}

/** The editor the toolbar's ThemeMenus open: "Custom themes…" and a custom row's edit button. */
function ToolbarEditor({
  subscribe,
  getState,
  setOpen,
}: {
  subscribe: (listener: () => void) => () => void;
  getState: () => EditorState;
  setOpen: (open: boolean) => void;
}) {
  const { request, open } = useSyncExternalStore(subscribe, getState);
  return (
    <ThemeProvider store={editorStore}>
      <ThemeEditor
        open={open}
        themeId={request?.id}
        kind={request?.slot}
        onOpenChange={setOpen}
      />
    </ThemeProvider>
  );
}

// A root of its own beside the story's, so the editor stays open, and keeps
// its draft, across story changes, and a docs page gets one, not one per story.
void addons.ready().then((channel) => {
  // An edit to this file re-runs it in `storybook dev`, and Vite does not
  // always dispose the old run first; each run would add an editor.
  globalThis.__ORZ_TOOLBAR_EDITOR__?.();
  let state: EditorState = { request: null, open: false };
  const listeners = new Set<() => void>();
  const set = (next: EditorState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  // Here rather than in an effect: the manager sends a request made before
  // the iframe booted as soon as it has, which may be before React commits.
  const onCustomize = (request: CustomizeMessage) =>
    set({ request, open: true });
  channel.on(CUSTOMIZE_EVENT, onCustomize);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  root.render(
    <ToolbarEditor
      subscribe={(listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }}
      getState={() => state}
      setOpen={(open) => set({ ...state, open })}
    />,
  );
  globalThis.__ORZ_TOOLBAR_EDITOR__ = () => {
    channel.off(CUSTOMIZE_EVENT, onCustomize);
    root.unmount();
    host.remove();
  };
});

declare global {
  /** Removes the toolbar editor's root. */
  var __ORZ_TOOLBAR_EDITOR__: (() => void) | undefined;
  /** The base URL addon-docs builds a docs page's story iframes from. */
  var PREVIEW_URL: string | undefined;
}

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
