import { MediaControls } from "@orz/ui/components/media-controls";
import { cn } from "@orz/ui/lib/utils";
import { Play } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMedia } from "./use-media.ts";

type MediaPlayerProps = {
  src: string;
  /** The accessible name of the picture or sound, and the frame's `title`. */
  title: string;
  /** Drawn above the media: the renderers put the name and Download here. */
  header?: ReactNode;
  autoPlay?: boolean;
  loop?: boolean;
  /** Initial speed. Default 1. */
  speed?: number;
  /** The element failed to load or decode `src`. When this is set, the player draws nothing itself. */
  onError?: (error: MediaError | null) => void;
  className?: string;
};

export type VideoPlayerProps = MediaPlayerProps;
export type AudioPlayerProps = MediaPlayerProps;

/** A video under the shared control bar, with picture-in-picture and fullscreen where the browser offers them. */
export function VideoPlayer(props: VideoPlayerProps): ReactElement {
  // A different file starts over: no position, no error, to carry.
  return <MediaFrame key={props.src} kind="video" {...props} />;
}

/** An audio file as a header over the shared control bar; the element itself is not drawn. */
export function AudioPlayer(props: AudioPlayerProps): ReactElement {
  return <MediaFrame key={props.src} kind="audio" {...props} />;
}

const SEEK_STEP = 5;

/** Keys a focused control already acts on, which the frame leaves to it. */
const SLIDER_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);
const BUTTON_KEYS = new Set([" ", "Enter"]);

function ownsKey(target: EventTarget, key: string): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      "input, textarea, [role=combobox], [role=listbox], [role=option]",
    ) !== null
  ) {
    return true;
  }
  if (target.closest("[role=slider]") !== null) return SLIDER_KEYS.has(key);
  if (target.closest("button") !== null) return BUTTON_KEYS.has(key);
  return false;
}

const UNPLAYABLE = "This browser can't play this file.";

function MediaFrame({
  kind,
  src,
  title,
  header,
  autoPlay = false,
  loop = false,
  speed = 1,
  onError,
  className,
}: MediaPlayerProps & { kind: "video" | "audio" }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [element, setElement] = useState<HTMLMediaElement | null>(null);
  const [media, actions] = useMedia(element);
  const [fullscreen, setFullscreen] = useState(false);
  // Read after mount, so a server render and the first client render agree.
  const [fullscreenEnabled, setFullscreenEnabled] = useState(false);
  const [pipEnabled, setPipEnabled] = useState(false);
  const video = kind === "video";

  useEffect(() => {
    if (element === null) return;
    // A load resets playbackRate to the default, so both are set.
    element.defaultPlaybackRate = speed;
    element.playbackRate = speed;
  }, [element, speed]);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    if (media.failed) onErrorRef.current?.(media.error);
  }, [media.failed, media.error]);

  useEffect(() => {
    if (!video) return;
    setFullscreenEnabled(document.fullscreenEnabled === true);
    setPipEnabled(document.pictureInPictureEnabled === true);
    const onChange = () =>
      setFullscreen(
        document.fullscreenElement !== null &&
          document.fullscreenElement === frameRef.current,
      );
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [video]);

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

  const known = Number.isFinite(media.duration);
  const seekBy = (delta: number) => {
    const to = Math.max(0, media.time + delta);
    actions.seek(known ? Math.min(to, media.duration) : to);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.defaultPrevented || ownsKey(event.target, event.key)) return;
    const key = event.key;
    if (key === " " || key === "k") actions.toggle();
    else if (key === "ArrowLeft") seekBy(-SEEK_STEP);
    else if (key === "ArrowRight") seekBy(SEEK_STEP);
    else if (/^[0-9]$/.test(key) && known) {
      actions.seek((Number(key) / 10) * media.duration);
    } else if (key === "m") actions.mute();
    else if (key === "f" && video && fullscreenEnabled) toggleFullscreen();
    else return;
    event.preventDefault();
  };

  if (media.failed && onError !== undefined) return null;

  const unplayable = (
    <p
      data-slot="media-error"
      className="px-3 py-4 text-center text-muted-foreground text-sm"
    >
      {UNPLAYABLE}
    </p>
  );

  const controls = (
    <MediaControls
      playing={media.playing}
      time={media.time}
      duration={media.duration}
      speed={media.speed}
      buffered={media.buffered}
      disabled={element === null || media.failed}
      portal={fullscreen ? frameRef.current : undefined}
      onToggle={actions.toggle}
      onSeek={actions.seek}
      onSpeed={actions.setSpeed}
      volume={{
        level: media.level,
        muted: media.muted,
        onLevel: actions.setLevel,
        onMute: actions.mute,
      }}
      fullscreen={
        video && fullscreenEnabled
          ? { active: fullscreen, onToggle: toggleFullscreen }
          : undefined
      }
      pictureInPicture={
        video && pipEnabled
          ? { active: media.pip, onToggle: actions.togglePip }
          : undefined
      }
      className={cn(!video && "border-t-0")}
    />
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys reach it from the controls and the picture inside, which carry the roles
    <div
      ref={frameRef}
      data-slot={video ? "video-player" : "audio-player"}
      title={title}
      className={cn(
        "overflow-hidden rounded-lg border [&:fullscreen]:rounded-none [&:fullscreen]:border-0",
        video ? "bg-black" : "bg-card",
        fullscreen && "flex flex-col",
        className,
      )}
      onKeyDown={onKeyDown}
    >
      {header}
      {video ? (
        <section
          data-slot="media-screen"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the picture is where the keyboard shortcuts start, as a native video's is
          tabIndex={0}
          aria-label={title}
          className={cn(
            "relative outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
            fullscreen && "min-h-0 flex-1",
          )}
        >
          {media.failed ? (
            unplayable
          ) : (
            <>
              {/* biome-ignore lint/a11y/useMediaCaption: an uploaded file carries no caption track to offer */}
              <video
                ref={setElement}
                src={src}
                // A page of embeds must not download every file.
                preload="metadata"
                playsInline
                autoPlay={autoPlay}
                loop={loop}
                className={cn(
                  "block w-full object-contain",
                  fullscreen && "h-full",
                )}
                onClick={actions.toggle}
              />
              {!media.started && element !== null && (
                <button
                  type="button"
                  aria-label="Play video"
                  // The bar's play button is the keyboard's way in.
                  tabIndex={-1}
                  className="absolute inset-0 grid cursor-pointer place-items-center bg-black/40 outline-none"
                  onClick={actions.toggle}
                >
                  <span className="grid size-14 place-items-center rounded-full bg-white/85 text-black shadow-md">
                    <Play className="size-6 translate-x-0.5 fill-current" />
                  </span>
                </button>
              )}
            </>
          )}
        </section>
      ) : (
        // biome-ignore lint/a11y/useMediaCaption: an uploaded file carries no caption track to offer
        <audio
          ref={setElement}
          src={src}
          preload="metadata"
          autoPlay={autoPlay}
          loop={loop}
          aria-label={title}
          className="hidden"
        />
      )}
      {!video && media.failed ? unplayable : controls}
    </div>
  );
}
