// Plain .ts without JSX: Storybook's manager esbuild compiles JSX only in .js
// files, and to the classic React.createElement. React here is the manager's
// own React 18; the menus themselves render in the island's React 19 roots.
import type { ResolvedTheme, ThemePreview, ThemeStore } from "@orz/ui/theme";
import React from "react";
import { GLOBALS_UPDATED, SET_GLOBALS } from "storybook/internal/core-events";
import { addons, types } from "storybook/manager-api";
import {
  changedGlobals,
  INITIAL_GLOBALS,
  KEY_OF,
  prefOf,
  SLOTS,
  type Slot,
  type ThemeGlobals,
  urlGlobals,
} from "./globals.ts";
import { storybookTheme } from "./storybook-theme.ts";
import { PREVIEW_EVENT, type PreviewMessage } from "./theme-channel.ts";
import type { ToolHandle } from "./toolbar/island.tsx";

const island = globalThis.__ORZ_TOOLBAR__;
if (island === undefined) {
  throw new Error(
    "orz toolbar: globalThis.__ORZ_TOOLBAR__ is missing. main.ts's managerEntries must put the island's entry ahead of manager.ts; check the entry order after a Storybook upgrade.",
  );
}
const { createToolbar, defaultThemeId } = island;

// The URL's globals, so the manager store paints the right theme, and the
// chrome opens in it, before the iframe exists.
/** Per global, the string this side last wrote or applied; anything equal to it is skipped. */
const last: ThemeGlobals = {
  ...INITIAL_GLOBALS,
  ...urlGlobals(location.search),
};
const toolbar = createToolbar(prefOf(last, defaultThemeId));
const { store } = toolbar;
// The manager store has a UI slot, so it always resolves a UI theme.
const chrome = () => storybookTheme(store.getResolved() as ResolvedTheme);
addons.setConfig({ theme: chrome() });

const pinned: Record<Slot, boolean> = { ui: false, terminal: false };
const handles: Partial<Record<Slot, ToolHandle>> = {};

addons.register("orz/theme", (api) => {
  // The iframe drops channel messages until it has booted, which its first
  // SET_GLOBALS announces; a pick made before then waits here.
  let ready = false;
  let pending: ThemeGlobals = {};

  const emitPreview = (preview: ThemePreview | null) => {
    const message: PreviewMessage = { from: "manager", preview };
    api.emit(PREVIEW_EVENT, message);
  };

  // The only code on this side that writes globals or emits previews, and
  // only when ThemeMenu calls it: a store subscription also fires for storage
  // events and theme-list changes, none of which is a user's commit.
  const facade: ThemeStore = {
    ...store,
    setPref(next) {
      const before = store.getPref();
      store.setPref(next);
      const changed = changedGlobals(
        before,
        store.getPref(),
        last,
        defaultThemeId,
      );
      Object.assign(last, changed);
      if (!ready) {
        Object.assign(pending, changed);
      } else if (Object.keys(changed).length > 0) {
        // No null preview first: the preview's setPref from these globals
        // clears its preview in the same repaint, and a null would flash the
        // old theme on the canvas between the hover and the commit.
        api.updateGlobals(changed);
      } else {
        // Re-picking the committed theme after hovering another changes no
        // global, and the canvas still shows the hover.
        emitPreview(null);
      }
    },
    preview(next) {
      store.preview(next);
      emitPreview(next);
    },
    // The preview store owns the custom list; this store follows its key.
    setCustomThemes() {},
  };

  const onGlobals = (
    globals: Record<string, unknown>,
    storyGlobals: Record<string, unknown> | undefined,
  ) => {
    if (storyGlobals !== undefined) {
      for (const slot of SLOTS) {
        pinned[slot] = KEY_OF[slot] in storyGlobals;
        handles[slot]?.setPinned(pinned[slot]);
      }
    }
    let moved = false;
    for (const slot of SLOTS) {
      const key = KEY_OF[slot];
      const value = globals[key];
      if (typeof value === "string" && value !== last[key]) {
        last[key] = value;
        moved = true;
      }
    }
    if (moved) store.setPref(prefOf(last, defaultThemeId));
  };

  api.on(
    SET_GLOBALS,
    ({
      globals,
      storyGlobals,
    }: {
      globals: Record<string, unknown>;
      storyGlobals?: Record<string, unknown>;
    }) => {
      // An iframe (re)boot: a hover mirrored from the old document is gone.
      store.preview(null);
      const wasReady = ready;
      ready = true;
      if (!wasReady && Object.keys(pending).length > 0) {
        api.updateGlobals(pending);
        pending = {};
        return;
      }
      onGlobals(globals, storyGlobals);
    },
  );
  api.on(
    GLOBALS_UPDATED,
    ({
      globals,
      storyGlobals,
    }: {
      globals: Record<string, unknown>;
      storyGlobals?: Record<string, unknown>;
    }) => onGlobals(globals, storyGlobals),
  );
  api.on(PREVIEW_EVENT, (message: PreviewMessage) => {
    if (message.from !== "manager") store.preview(message.preview);
  });

  store.subscribe(() => api.setOptions({ theme: chrome() }));

  function Tool({ slot }: { slot: Slot }) {
    const host = React.useRef<HTMLSpanElement>(null);
    React.useEffect(() => {
      const handle = toolbar.mount(host.current as HTMLElement, slot, facade);
      handle.setPinned(pinned[slot]);
      handles[slot] = handle;
      return () => {
        if (handles[slot] === handle) delete handles[slot];
        handle.unmount();
      };
    }, [slot]);
    // The island's base rules are scoped to this attribute.
    return React.createElement("span", {
      ref: host,
      "data-orz-toolbar": "",
      style: { display: "contents" },
    });
  }

  addons.add("orz/theme/ui", {
    type: types.TOOL,
    title: "Theme",
    render: () => React.createElement(Tool, { slot: "ui" }),
  });
  addons.add("orz/theme/terminal", {
    type: types.TOOL,
    title: "Terminal theme",
    render: () => React.createElement(Tool, { slot: "terminal" }),
  });
});
