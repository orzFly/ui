import { builtinThemes, dracula, type TerminalTokens } from "@orz/themes";
import {
  createThemeStore,
  ThemeProvider,
  type ThemeStore,
} from "@orz/ui/theme";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { Options, Player } from "asciinema-player";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsciinemaPlayer } from "../src/asciinema-player.tsx";
import { playerThemeVars } from "../src/player-theme.ts";

type Stub = Player & {
  opts: Options;
  time: number;
  emit: (name: string) => void;
  keys: string[];
};

// The real player needs canvas and WASM; the module is the seam. Each create
// hands back a stub that records what was asked of it.
const created = vi.hoisted(() => [] as Stub[]);
const create = vi.hoisted(() =>
  vi.fn((_src: unknown, host: HTMLElement, opts: Options = {}) => {
    const el = document.createElement("div");
    el.className = "ap-wrapper";
    const term = document.createElement("pre");
    term.tabIndex = 0;
    el.append(term);
    host.append(el);
    const listeners = new Map<string, (() => void)[]>();
    const stub = {
      el,
      opts,
      time: 0,
      keys: [] as string[],
      emit(name: string) {
        for (const listener of listeners.get(name) ?? []) listener();
      },
      dispose: vi.fn(() => el.remove()),
      getCurrentTime: () => stub.time,
      getDuration: () => 7,
      play: vi.fn(async () => {
        stub.emit("play");
        stub.emit("playing");
      }),
      pause: vi.fn(async () => stub.emit("pause")),
      seek: vi.fn(async (to: unknown) => {
        if (typeof to === "number") stub.time = to;
      }),
      addEventListener: (name: string, listener: () => void) => {
        listeners.set(name, [...(listeners.get(name) ?? []), listener]);
      },
    } as unknown as Stub;
    // Stands in for the player's own key handler.
    el.addEventListener("keydown", (event) => stub.keys.push(event.key));
    created.push(stub);
    return stub;
  }),
);
const loadPlayer = vi.hoisted(() =>
  vi.fn(
    async () => ({ create }) as unknown as typeof import("asciinema-player"),
  ),
);
vi.mock("../src/load-player.ts", () => ({ loadPlayer }));

const CAST = [
  { version: 2, width: 80, height: 20, idle_time_limit: 2 },
  [0.5, "o", "$ "],
  [1, "m", "install"],
  [30, "o", "done\r\n"],
  [31, "m", "tests"],
  [32, "o", "$ "],
]
  .map((row) => JSON.stringify(row))
  .join("\n");
const NO_MARKERS = [
  { version: 2, width: 80, height: 20 },
  [0.5, "o", "$ "],
  [3, "o", "ok\r\n"],
]
  .map((row) => JSON.stringify(row))
  .join("\n");

const latest = () => {
  const stub = created.at(-1);
  if (stub === undefined) throw new Error("no player was created");
  return stub;
};

let store: ThemeStore;

/** happy-dom has no Fullscreen API at all. */
function stubFullscreenEnabled(enabled: boolean) {
  Object.defineProperty(document, "fullscreenEnabled", {
    configurable: true,
    value: enabled,
  });
}

beforeEach(() => {
  created.length = 0;
  create.mockClear();
  loadPlayer.mockClear();
  store = createThemeStore({
    storageKey: "cast-theme",
    themes: builtinThemes,
    terminalThemes: builtinThemes,
  });
  store.setPref({
    ui: { theme: "default", mode: "light" },
    terminal: { theme: "dracula", mode: "dark" },
  });
});

afterEach(() => {
  store.dispose();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.variant;
  delete document.documentElement.dataset.terminalTheme;
  document.documentElement.classList.remove("dark");
  for (const style of document.head.querySelectorAll("style")) style.remove();
  vi.unstubAllGlobals();
  delete (document as { fullscreenEnabled?: unknown }).fullscreenEnabled;
});

function mount(node: ReactNode) {
  return render(<ThemeProvider store={store}>{node}</ThemeProvider>);
}

async function built(count = 1) {
  await waitFor(() => expect(create).toHaveBeenCalledTimes(count));
  return latest();
}

describe("AsciinemaPlayer", () => {
  it("builds the player without its controls, on our palette, with the final frame as poster", async () => {
    const { container } = mount(<AsciinemaPlayer cast={CAST} />);
    // Before the module arrives: the bar already knows the scanned length.
    expect(screen.getByText("0:00 / 0:05")).toBeTruthy();
    const player = await built();
    expect(create.mock.calls[0]?.[0]).toEqual({ data: CAST });
    expect(player.opts).toMatchObject({
      controls: false,
      preload: true,
      fit: "width",
      theme: "orz",
      speed: 1,
      autoPlay: false,
      poster: "npt:6",
    });

    const frame = container.querySelector<HTMLElement>("[data-orz-cast]");
    const id = frame?.dataset.orzCast;
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css.startsWith(`[data-orz-cast="${id}"] .ap-player{`)).toBe(true);
    const vars = playerThemeVars(dracula.dark?.terminal as TerminalTokens);
    for (const [name, value] of Object.entries(vars)) {
      expect(css).toContain(`${name}:${value};`);
    }
  });

  it("keeps a cast's own palette only when asked to", async () => {
    mount(<AsciinemaPlayer cast={CAST} useEmbeddedTheme />);
    expect((await built()).opts.theme).toBe("auto/orz");
  });

  it("plays, pauses and seeks through the bar, and to a marker", async () => {
    mount(<AsciinemaPlayer cast={CAST} />);
    const player = await built();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Play" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(player.play).toHaveBeenCalledTimes(1);
    // The overlay goes once playing has started.
    expect(screen.queryByRole("button", { name: "Play recording" })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    expect(player.pause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "tests at 0:04" }));
    expect(player.seek).toHaveBeenLastCalledWith(4);
    await waitFor(() => expect(screen.getByText("0:04 / 0:07")).toBeTruthy());

    fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), {
      key: "End",
    });
    expect(player.seek).toHaveBeenLastCalledWith(7);
  });

  it("draws one tick per marker, and none for a cast without them", async () => {
    const { container, unmount } = mount(<AsciinemaPlayer cast={CAST} />);
    await built();
    const ticks = container.querySelectorAll<HTMLElement>(
      '[data-slot="cast-marker"]',
    );
    expect([...ticks].map((tick) => tick.getAttribute("aria-label"))).toEqual([
      "install at 0:01",
      "tests at 0:04",
    ]);
    expect(ticks[1]?.style.left).toBe("80%");
    unmount();

    const bare = mount(<AsciinemaPlayer cast={NO_MARKERS} />);
    await built(2);
    expect(
      bare.container.querySelector('[data-slot="cast-marker"]'),
    ).toBeNull();
  });

  it("starts from the poster's play overlay", async () => {
    mount(<AsciinemaPlayer cast={CAST} />);
    const player = await built();
    fireEvent.click(
      await screen.findByRole("button", { name: "Play recording" }),
    );
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("rebuilds on a new terminal theme, at the same time and still playing", async () => {
    const { container } = mount(<AsciinemaPlayer cast={CAST} />);
    const first = await built();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Play" }));
    });
    first.time = 2.5;

    await act(async () => {
      store.setPref({
        ui: { theme: "default", mode: "light" },
        terminal: { theme: "nord", mode: "dark" },
      });
    });
    const second = await built(2);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.opts).toMatchObject({ autoPlay: false, poster: undefined });
    expect(second.seek).toHaveBeenCalledWith(2.5);
    expect(second.play).toHaveBeenCalledTimes(1);
    const vars = playerThemeVars(
      builtinThemes.find((t) => t.id === "nord")?.dark
        ?.terminal as TerminalTokens,
    );
    const css = container.querySelector("style")?.textContent ?? "";
    expect(css).toContain(
      `--term-color-background:${vars["--term-color-background"]};`,
    );
  });

  it("rebuilds on a new speed, at the same time and still paused", async () => {
    const view = mount(<AsciinemaPlayer cast={CAST} />);
    const first = await built();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "install at 0:01" })),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "install at 0:01" }));
    });
    view.rerender(
      <ThemeProvider store={store}>
        <AsciinemaPlayer cast={CAST} speed={2} />
      </ThemeProvider>,
    );
    const second = await built(2);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.opts.speed).toBe(2);
    expect(second.seek).toHaveBeenCalledWith(1);
    expect(second.play).not.toHaveBeenCalled();
  });

  it("keeps the poster through a rebuild before anything was played", async () => {
    const view = mount(<AsciinemaPlayer cast={CAST} />);
    await built();
    view.rerender(
      <ThemeProvider store={store}>
        <AsciinemaPlayer cast={CAST} speed={1.5} />
      </ThemeProvider>,
    );
    const second = await built(2);
    expect(second.opts.poster).toBe("npt:6");
    expect(second.seek).not.toHaveBeenCalled();
  });

  describe("fullscreen", () => {
    let fullscreenElement: Element | null;

    beforeEach(() => {
      fullscreenElement = null;
      const change = () =>
        document.dispatchEvent(new Event("fullscreenchange"));
      stubFullscreenEnabled(true);
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => fullscreenElement,
      });
      HTMLElement.prototype.requestFullscreen = vi.fn(async function (
        this: HTMLElement,
      ) {
        fullscreenElement = this;
        change();
      });
      document.exitFullscreen = vi.fn(async () => {
        fullscreenElement = null;
        change();
      });
    });

    afterEach(() => {
      delete (document as { fullscreenElement?: unknown }).fullscreenElement;
    });

    it("puts the whole frame in fullscreen and refits the player to it", async () => {
      const { container } = mount(<AsciinemaPlayer cast={CAST} />);
      await built();
      await act(async () => {
        fireEvent.click(
          await screen.findByRole("button", { name: "Fullscreen" }),
        );
      });
      expect(fullscreenElement).toBe(
        container.querySelector("[data-orz-cast]"),
      );
      const second = await built(2);
      expect(second.opts.fit).toBe("both");
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Exit fullscreen" }),
        );
      });
      expect((await built(3)).opts.fit).toBe("width");
    });

    it("takes f for itself, and leaves the player's other keys to it", async () => {
      const { container } = mount(<AsciinemaPlayer cast={CAST} />);
      const player = await built();
      const term = player.el.querySelector("pre") as HTMLElement;
      await act(async () => {
        fireEvent.keyDown(term, { key: "f" });
      });
      expect(fullscreenElement).toBe(
        container.querySelector("[data-orz-cast]"),
      );
      const second = await built(2);
      const secondTerm = second.el.querySelector("pre") as HTMLElement;
      for (const key of ["?", "k", "m", " ", "]"]) {
        await act(async () => {
          fireEvent.keyDown(secondTerm, { key });
        });
      }
      expect(second.keys).toEqual([" ", "]"]);
      expect(player.keys).toEqual([]);
    });
  });

  it("hides the fullscreen button where fullscreen is not available", async () => {
    stubFullscreenEnabled(false);
    mount(<AsciinemaPlayer cast={CAST} />);
    await built();
    expect(screen.queryByRole("button", { name: "Fullscreen" })).toBeNull();
  });

  it("disposes the player on unmount", async () => {
    const { unmount } = mount(<AsciinemaPlayer cast={CAST} />);
    const player = await built();
    unmount();
    expect(player.dispose).toHaveBeenCalledTimes(1);
  });

  it("offers Retry when the player's module fails to load", async () => {
    loadPlayer.mockRejectedValueOnce(new Error("chunk failed"));
    mount(<AsciinemaPlayer cast={CAST} />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    await built();
    expect(loadPlayer).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/chunk failed/)).toBeNull();
  });

  it("shows why a cast cannot play, and never builds a player", () => {
    mount(<AsciinemaPlayer cast="not a cast" />);
    expect(screen.getByText("Line 1: not JSON")).toBeTruthy();
    expect(loadPlayer).not.toHaveBeenCalled();
  });
});
