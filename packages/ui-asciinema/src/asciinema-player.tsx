import { Button } from "@orz/ui/components/button";
import { MediaControls } from "@orz/ui/components/media-controls";
import { cn } from "@orz/ui/lib/utils";
import { useTerminalTheme } from "@orz/ui/theme";
import type { Player } from "asciinema-player";
import { Play } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { type CastInfo, isCastError, scanCast } from "./cast.ts";
import { loadPlayer } from "./load-player.ts";
import { playerThemeVars } from "./player-theme.ts";

export type AsciinemaPlayerProps = {
  /** The cast's text. */
  cast: string;
  /** Drawn above the terminal; the content renderer puts the filename and Download here. */
  header?: ReactNode;
  /** Initial speed. Default 1. */
  speed?: number;
  loop?: boolean;
  autoPlay?: boolean;
  /** Keep the palette a cast carries in its header instead of the terminal slot. Default false. */
  useEmbeddedTheme?: boolean;
  className?: string;
};

/** Where a rebuilt player picks up from. */
type Resume = {
  time: number;
  playing: boolean;
  started: boolean;
  /** Focus was on the old terminal, which disposing it takes out of the page. */
  focused: boolean;
};

/** Keys the player's own handler acts on; after one, the bar reads the position again. */
const PLAYER_KEYS = /^(?: |,|\.|\[|\]|[0-9]|ArrowLeft|ArrowRight)$/;

/** A cell's width and height in em, for a placeholder the size the terminal will be. */
const CELL_WIDTH = 0.6;
const LINE_HEIGHT = 4 / 3;

/**
 * An asciinema recording, played by asciinema-player under a control bar of @orz/ui components,
 * in the colours of the terminal theme slot.
 *
 * The player reads its palette once, and can change neither its speed nor its fit afterwards, so
 * a new terminal theme, speed or fullscreen state builds it again, at the same position and still
 * playing if it was.
 */
export function AsciinemaPlayer(props: AsciinemaPlayerProps) {
  const scan = useMemo(() => scanCast(props.cast), [props.cast]);
  if (isCastError(scan)) {
    return (
      <p className={cn("text-destructive text-ui", props.className)}>
        {scan.error}
      </p>
    );
  }
  // A different cast starts over: no position, no poster state, to carry.
  return <CastPlayer key={props.cast} {...props} info={scan} />;
}

function CastPlayer({
  cast,
  info,
  header,
  speed: initialSpeed = 1,
  loop = false,
  autoPlay = false,
  useEmbeddedTheme = false,
  className,
}: AsciinemaPlayerProps & { info: CastInfo }) {
  const id = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const playerRef = useRef<Player | null>(null);
  const resumeRef = useRef<Resume | null>(null);

  const { tokens } = useTerminalTheme();
  const vars = useMemo(() => playerThemeVars(tokens), [tokens]);
  const paletteKey = Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");

  const [speed, setSpeed] = useState(initialSpeed);
  useEffect(() => setSpeed(initialSpeed), [initialSpeed]);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const [load, setLoad] = useState<"loading" | "ready" | Error>("loading");
  const [attempt, setAttempt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;
  // Until the first play or seek, the terminal shows the final frame while the
  // bar shows 0:00, where play starts from.
  const [started, setStarted] = useState(autoPlay);
  const startedRef = useRef(autoPlay);
  const markStarted = useCallback(() => {
    startedRef.current = true;
    setStarted(true);
  }, []);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(info.duration);

  const sync = useCallback(() => {
    const player = playerRef.current;
    if (player === null) return;
    const reported = player.getDuration();
    if (typeof reported === "number") setDuration(reported);
    if (startedRef.current) setTime(player.getCurrentTime());
  }, []);

  useEffect(() => {
    // Read only as triggers. The colours reach the player through the <style>
    // below, which is already in the DOM when it reads them; a new attempt is
    // Retry after a failed import.
    void [paletteKey, attempt];
    const host = hostRef.current;
    if (host === null) return;
    let live = true;
    let player: Player | undefined;
    const resume = resumeRef.current;
    resumeRef.current = null;
    loadPlayer().then(
      ({ create }) => {
        if (!live) return;
        const fresh = resume === null || !resume.started;
        const probe = probeRef.current;
        // A v1 cast is one JSON object; the player reads it from text only
        // when it is pretty-printed, and from the object either way.
        const data = info.version === 1 ? JSON.parse(cast) : cast;
        const built = create({ data }, host, {
          controls: false,
          preload: true,
          fit: fullscreen ? "both" : "width",
          // No `auto/` prefix: a palette embedded in the cast is ignored.
          theme: useEmbeddedTheme ? "auto/orz" : "orz",
          speed,
          loop,
          autoPlay: fresh && autoPlay,
          // Past the end rather than at it: the player draws a poster from
          // the events strictly before its time, which would leave the last
          // one out. Play still starts from 0.
          poster: fresh && !autoPlay ? `npt:${info.duration + 1}` : undefined,
          terminalFontFamily:
            probe === null ? undefined : getComputedStyle(probe).fontFamily,
        });
        player = built;
        playerRef.current = built;
        built.addEventListener("play", () => {
          if (live) markStarted();
        });
        built.addEventListener("playing", () => {
          if (!live) return;
          setPlaying(true);
          sync();
        });
        for (const stopped of ["pause", "ended"] as const) {
          built.addEventListener(stopped, () => {
            if (!live) return;
            setPlaying(false);
            sync();
          });
        }
        setLoad("ready");
        // Not startAt: the player reads that on the uncapped timeline and
        // shows its frame only once playing, where seek takes the time the
        // player reports and draws it at once.
        if (!fresh) {
          if (resume.time > 0) void built.seek(resume.time).then(sync);
          if (resume.playing) void built.play();
        }
        if (resume?.focused) {
          built.el
            .querySelector<HTMLElement>(".ap-term-text")
            ?.focus({ preventScroll: true });
        }
      },
      (error: unknown) => {
        if (!live) return;
        setLoad(error instanceof Error ? error : new Error(String(error)));
      },
    );
    return () => {
      live = false;
      if (player === undefined) return;
      resumeRef.current = {
        time: player.getCurrentTime(),
        playing: playingRef.current,
        started: startedRef.current,
        focused: player.el.contains(document.activeElement),
      };
      player.dispose();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [
    cast,
    paletteKey,
    speed,
    fullscreen,
    useEmbeddedTheme,
    attempt,
    loop,
    autoPlay,
    info.duration,
    info.version,
    markStarted,
    sync,
  ]);

  useEffect(() => {
    if (!playing) return;
    // The stock control bar's cadence.
    const interval = setInterval(sync, 100);
    return () => clearInterval(interval);
  }, [playing, sync]);

  useEffect(() => {
    setFullscreenEnabled(document.fullscreenEnabled === true);
    const onChange = () =>
      setFullscreen(
        document.fullscreenElement !== null &&
          document.fullscreenElement === frameRef.current,
      );
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const frame = frameRef.current;
    if (frame === null || !document.fullscreenEnabled) return;
    // Refused when the call lacks a user gesture, say; the frame just stays as
    // it is.
    const ignore = () => {};
    if (document.fullscreenElement === frame) {
      document.exitFullscreen().catch(ignore);
    } else {
      frame.requestFullscreen().catch(ignore);
    }
  }, []);

  // The poster is drawn past the last event, and the player seeks from there
  // incrementally after clearing it: a seek to the end would leave the screen
  // blank. From 0, where the bar says it is, every seek redraws. The player
  // queues its commands, so a seek a key goes on to make runs after this one.
  const leavePoster = (player: Player) => {
    if (startedRef.current) return;
    markStarted();
    void player.seek(0);
  };

  const toggle = () => {
    const player = playerRef.current;
    if (player === null) return;
    markStarted();
    if (playing) void player.pause();
    else void player.play();
  };

  const seek = (to: number) => {
    const player = playerRef.current;
    if (player === null) return;
    leavePoster(player);
    setTime(to);
    // Past the end for the end: the player clamps that to its own duration,
    // where a scanned one a float's breadth short would leave out the last
    // frame.
    void player.seek(to >= duration ? duration + 1 : to).then(sync);
  };

  const onKeyDownCapture = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    // Caught on the way down, so the player's own handler never sees them: its
    // `f` would fullscreen the terminal alone, without this bar, and `?`, `k`
    // and `m` open overlays this frame does not use.
    if (event.key === "f") {
      event.preventDefault();
      event.stopPropagation();
      toggleFullscreen();
      return;
    }
    if (event.key === "?" || event.key === "k" || event.key === "m") {
      event.stopPropagation();
      return;
    }
    const player = playerRef.current;
    if (
      PLAYER_KEYS.test(event.key) &&
      player !== null &&
      event.target instanceof Node &&
      player.el.contains(event.target)
    ) {
      leavePoster(player);
      // Its seek and step resolve after the key; while paused nothing else
      // would read the new position.
      setTimeout(sync, 100);
    }
  };

  const css = `[data-orz-cast="${id}"] .ap-player{${Object.entries(vars)
    .map(([name, value]) => `${name}:${value};`)
    .join("")}}`;
  const ready = load === "ready";

  return (
    <div
      ref={frameRef}
      data-orz-cast={id}
      className={cn(
        "overflow-hidden rounded-frame bg-terminal-background ring-1 ring-border [&:fullscreen]:rounded-none [&:fullscreen]:ring-0",
        className,
      )}
      onKeyDownCapture={onKeyDownCapture}
    >
      <style>{css}</style>
      <span ref={probeRef} aria-hidden className="hidden font-mono" />
      {header}
      <div data-slot="cast-screen" className="relative">
        {!ready && (
          <div
            className="grid w-full place-items-center text-terminal-foreground text-ui"
            style={{
              aspectRatio: `${info.cols * CELL_WIDTH} / ${info.rows * LINE_HEIGHT}`,
            }}
          >
            {load instanceof Error && (
              <div className="grid justify-items-center gap-2 p-4 text-center">
                <span>Could not load the player: {load.message}</span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    setLoad("loading");
                    setAttempt((n) => n + 1);
                  }}
                >
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}
        <div ref={hostRef} data-slot="cast-host" />
        {ready && !started && (
          <button
            type="button"
            aria-label="Play recording"
            // The bar's play button is the keyboard's way in.
            tabIndex={-1}
            className="absolute inset-0 grid cursor-pointer place-items-center bg-terminal-background/40 outline-none"
            onClick={toggle}
          >
            <span className="grid size-14 place-items-center rounded-full bg-terminal-foreground/85 text-terminal-background shadow-md">
              <Play className="size-6 translate-x-0.5 fill-current" />
            </span>
          </button>
        )}
      </div>
      <MediaControls
        playing={playing}
        time={time}
        duration={duration}
        markers={info.markers}
        speed={speed}
        fullscreen={
          fullscreenEnabled
            ? { active: fullscreen, onToggle: toggleFullscreen }
            : undefined
        }
        disabled={!ready}
        portal={fullscreen ? frameRef.current : undefined}
        onToggle={toggle}
        onSeek={seek}
        onSpeed={setSpeed}
      />
    </div>
  );
}
