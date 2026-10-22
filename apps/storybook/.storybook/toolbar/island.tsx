// The only manager-side code that imports @orz/* at runtime. Storybook's
// manager runs React 18 and bundles its entries with a fixed esbuild config
// that cannot compile @orz/ui, so build.ts pre-builds this file with Vite,
// React 19 included, and it hands itself to manager.ts through globalThis.
// No storybook/* imports here: those are the manager's React 18 globals.
import { builtinThemes } from "@orz/themes";
import { ThemeMenu } from "@orz/ui/components/theme-menu";
import {
  createThemeStore,
  type ThemePref,
  ThemeProvider,
  type ThemeStore,
} from "@orz/ui/theme";
import { createRoot } from "react-dom/client";

export interface ToolHandle {
  /** True while the current story pins this slot's global: the trigger is disabled. */
  setPinned(pinned: boolean): void;
  unmount(): void;
}

export interface Toolbar {
  /** The manager's theme store: UI and terminal slots over builtinThemes. */
  store: ThemeStore;
  /** Renders a ThemeMenu for `slot` into `host` in a React 19 root. */
  mount(
    host: HTMLElement,
    slot: "ui" | "terminal",
    facade: ThemeStore,
  ): ToolHandle;
}

/** builtinThemes[0].id, which the globals codec needs for the "system" sentinel. */
export const defaultThemeId = builtinThemes[0].id;

// Storybook's toolbar buttons: 28 × 28, a 14 px icon, the bar's muted text,
// and the secondary colour (sidebar-primary in storybook-theme.ts) on hover.
const TRIGGER =
  "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-[4px] text-muted-foreground transition-[background,box-shadow] duration-150 ease-out [&_svg]:size-3.5 hover:bg-sidebar-primary/14 hover:text-sidebar-primary active:bg-sidebar-primary/14 focus-visible:outline-2 focus-visible:outline-sidebar-primary data-[state=open]:text-sidebar-primary disabled:cursor-not-allowed disabled:opacity-50";

function Tool({
  slot,
  facade,
  pinned,
  closed,
}: {
  slot: "ui" | "terminal";
  facade: ThemeStore;
  pinned: boolean;
  /** Bumped to close an open menu from outside; remounting closes it and clears its preview. */
  closed: number;
}) {
  return (
    <ThemeProvider store={facade}>
      <ThemeMenu
        // Pinning remounts too: a story can pin the slot while the menu is
        // open (Back in the browser closes nothing).
        key={`${pinned}-${closed}`}
        slot={slot}
        trigger={({ Icon, label }) => (
          <button
            type="button"
            className={TRIGGER}
            aria-label={label}
            title={pinned ? "Set by this story" : label}
            disabled={pinned}
          >
            <Icon aria-hidden />
          </button>
        )}
      />
    </ThemeProvider>
  );
}

export function createToolbar(initial: ThemePref): Toolbar {
  const store = createThemeStore({
    storageKey: "orz-storybook-toolbar",
    // The globals are the committed state; a stored pref would be a second
    // one, and another tab's pick would reach this store but not its URL.
    persistPref: false,
    // The preview store's custom list, read at boot and followed through
    // storage events, so a theme saved in the iframe shows up here too.
    customStorageKey: "orz-storybook-theme-custom",
    themes: builtinThemes,
    terminalThemes: builtinThemes,
  });
  store.setPref(initial);
  return {
    store,
    mount(host, slot, facade) {
      const root = createRoot(host);
      let pinned = false;
      let closed = 0;
      const render = () =>
        root.render(
          <Tool slot={slot} facade={facade} pinned={pinned} closed={closed} />,
        );
      // Radix closes the menu on a pointerdown or a focusin in this
      // document; a click into the preview iframe makes neither here, only
      // a window blur with the iframe as the active element.
      const onBlur = () =>
        setTimeout(() => {
          if (
            document.activeElement instanceof HTMLIFrameElement &&
            host.querySelector('[data-state="open"]') !== null
          ) {
            closed++;
            render();
          }
        });
      window.addEventListener("blur", onBlur);
      render();
      return {
        setPinned(next) {
          pinned = next;
          render();
        },
        unmount() {
          window.removeEventListener("blur", onBlur);
          root.unmount();
        },
      };
    },
  };
}

declare global {
  var __ORZ_TOOLBAR__:
    | { createToolbar: typeof createToolbar; defaultThemeId: string }
    | undefined;
}

globalThis.__ORZ_TOOLBAR__ = { createToolbar, defaultThemeId };
