import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useState } from "react";
import { cn } from "../lib/utils.ts";
import { Button } from "./button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "./popover.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select.tsx";
import { Slider } from "./slider.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip.tsx";

export const MEDIA_SPEEDS = [0.5, 1, 1.5, 2, 4] as const;

/** Seconds per step of the seek track, an arrow key's worth. */
const STEP = 0.1;

const pad = (n: number) => String(n).padStart(2, "0");

/** `m:ss`, or `h:mm:ss` when `long` — the duration reaches an hour — so both sides line up. */
export function formatTime(seconds: number, long = seconds >= 3600): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return long ? `${h}:${pad(m)}:${pad(s)}` : `${h * 60 + m}:${pad(s)}`;
}

export type MediaMarker = { time: number; label: string };

export type MediaControlsProps = {
  playing: boolean;
  time: number;
  /** Seconds. Not finite while the media does not know it yet: the track is disabled, the time shows alone. */
  duration: number;
  speed: number;
  onToggle: () => void;
  onSeek: (time: number) => void;
  onSpeed: (speed: number) => void;
  disabled?: boolean;
  /** Where the popovers, the speed list and the tooltips portal: the frame, while it is fullscreen. */
  portal?: HTMLElement | null;
  /** Ticks over the seek track; each seeks to its time. */
  markers?: readonly MediaMarker[];
  /** Loaded ranges in seconds, shaded behind the played range. */
  buffered?: readonly (readonly [start: number, end: number])[];
  /** Absent: no volume control. */
  volume?: {
    /** 0…1. */
    level: number;
    muted: boolean;
    onLevel: (level: number) => void;
    onMute: () => void;
  };
  /** Absent: no fullscreen button. */
  fullscreen?: { active: boolean; onToggle: () => void };
  /** Absent: no picture-in-picture button. */
  pictureInPicture?: { active: boolean; onToggle: () => void };
  className?: string;
};

/**
 * The control bar under a media frame: play, time, seek, volume, speed, picture-in-picture and
 * fullscreen. It holds no media of its own; the player passes the values in and acts on the
 * callbacks.
 */
export function MediaControls({
  playing,
  time,
  duration,
  speed,
  onToggle,
  onSeek,
  onSpeed,
  disabled = false,
  portal,
  markers = [],
  buffered = [],
  volume,
  fullscreen,
  pictureInPicture,
  className,
}: MediaControlsProps) {
  // Dragging moves only the shown time; the player seeks once, on release.
  const [dragged, setDragged] = useState<number | null>(null);
  const known = Number.isFinite(duration) && duration >= 0;
  const shown = known ? Math.min(dragged ?? time, duration) : time;
  const long = known && duration >= 3600;
  const speeds = MEDIA_SPEEDS.includes(speed as (typeof MEDIA_SPEEDS)[number])
    ? MEDIA_SPEEDS
    : [...MEDIA_SPEEDS, speed].sort((a, b) => a - b);
  return (
    <TooltipProvider>
      <div
        data-slot="media-controls"
        className={cn(
          "@container/media-controls flex items-center gap-2 border-t bg-card px-2 py-1 text-card-foreground text-ui-sm",
          className,
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          aria-label={playing ? "Pause" : "Play"}
          onClick={onToggle}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <span className="shrink-0 tabular-nums">
          {known
            ? `${formatTime(shown, long)} / ${formatTime(duration, long)}`
            : formatTime(shown)}
        </span>
        <div className="relative mx-1 flex min-w-16 flex-1 items-center">
          <Slider
            aria-label="Seek"
            min={0}
            max={known ? Math.max(duration, STEP) : STEP}
            step={STEP}
            value={[known ? shown : 0]}
            disabled={disabled || !known}
            onValueChange={([value]) => setDragged(value ?? null)}
            onValueCommit={([value]) => {
              setDragged(null);
              if (value === undefined) return;
              // The track rounds to its step, so the end itself is a step
              // short of the last frame unless snapped to.
              onSeek(value > duration - STEP ? duration : value);
            }}
            trackChildren={
              known && duration > 0
                ? buffered.map(([start, end]) => (
                    <span
                      key={`${start}-${end}`}
                      data-slot="media-buffered"
                      className="absolute inset-y-0 bg-primary/25"
                      style={{
                        left: `${(Math.min(start, duration) / duration) * 100}%`,
                        width: `${((Math.min(end, duration) - Math.min(start, duration)) / duration) * 100}%`,
                      }}
                    />
                  ))
                : undefined
            }
          />
          {known &&
            duration > 0 &&
            markers.map((marker, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: markers are positional, and two may share a time and a label
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-slot="media-marker"
                    disabled={disabled}
                    aria-label={`${marker.label || `Marker ${index + 1}`} at ${formatTime(marker.time, long)}`}
                    className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/50 outline-none after:absolute after:-inset-x-2.5 after:-inset-y-1.5 hover:bg-foreground focus-visible:focus-ring disabled:pointer-events-none touch:hit-area"
                    style={{
                      left: `${(Math.min(marker.time, duration) / duration) * 100}%`,
                    }}
                    onClick={() => onSeek(marker.time)}
                  />
                </TooltipTrigger>
                <TooltipContent container={portal}>
                  {marker.label || `Marker ${index + 1}`}{" "}
                  <span className="tabular-nums opacity-70">
                    {formatTime(marker.time, long)}
                  </span>
                </TooltipContent>
              </Tooltip>
            ))}
        </div>
        {volume !== undefined && (
          <VolumeControl volume={volume} disabled={disabled} portal={portal} />
        )}
        <Select
          value={String(speed)}
          disabled={disabled}
          onValueChange={(value) => onSpeed(Number(value))}
        >
          <SelectTrigger
            size="sm"
            aria-label="Speed"
            className="h-control-sm border-transparent px-2 text-ui-sm tabular-nums"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent container={portal}>
            {speeds.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-ui-sm">
                {s}×
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pictureInPicture !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={
              pictureInPicture.active
                ? "Exit picture-in-picture"
                : "Picture-in-picture"
            }
            aria-pressed={pictureInPicture.active}
            onClick={pictureInPicture.onToggle}
          >
            <PictureInPicture2 />
          </Button>
        )}
        {fullscreen !== undefined && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={fullscreen.active ? "Exit fullscreen" : "Fullscreen"}
            onClick={fullscreen.onToggle}
          >
            {fullscreen.active ? <Minimize /> : <Maximize />}
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

function VolumeControl({
  volume,
  disabled,
  portal,
}: {
  volume: NonNullable<MediaControlsProps["volume"]>;
  disabled: boolean;
  portal?: HTMLElement | null;
}) {
  const silent = volume.muted || volume.level === 0;
  const level = volume.muted ? 0 : volume.level;
  const mute = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      aria-label={volume.muted ? "Unmute" : "Mute"}
      onClick={volume.onMute}
    >
      {silent ? <VolumeX /> : <Volume2 />}
    </Button>
  );
  const onValueChange = ([value]: number[]) => {
    if (value !== undefined) volume.onLevel(value);
  };
  // Both groups render and a container query shows one, so the bar never
  // measures itself and the first paint is already right; the hidden one is
  // display: none, out of the tab order and the accessibility tree.
  return (
    <>
      <div
        data-slot="media-volume"
        className="hidden shrink-0 items-center gap-1 @sm/media-controls:flex"
      >
        {mute}
        <Slider
          aria-label="Volume"
          className="w-16"
          min={0}
          max={1}
          step={0.05}
          value={[level]}
          disabled={disabled}
          onValueChange={onValueChange}
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label="Volume"
            data-slot="media-volume-trigger"
            className="@sm/media-controls:hidden"
          >
            {silent ? <VolumeX /> : <Volume2 />}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          container={portal}
          side="top"
          align="center"
          className="flex w-auto flex-col items-center gap-2 p-2"
        >
          <Slider
            aria-label="Volume"
            orientation="vertical"
            className="data-vertical:h-24 data-vertical:min-h-0"
            min={0}
            max={1}
            step={0.05}
            value={[level]}
            disabled={disabled}
            onValueChange={onValueChange}
          />
          {mute}
        </PopoverContent>
      </Popover>
    </>
  );
}
