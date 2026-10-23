import { Button } from "@orz/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { Slider } from "@orz/ui/components/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { Maximize, Minimize, Pause, Play } from "lucide-react";
import { useState } from "react";
import type { CastInfo } from "./cast.ts";

export const SPEEDS = [0.5, 1, 1.5, 2, 4] as const;

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

export type ControlBarProps = {
  playing: boolean;
  time: number;
  duration: number;
  markers: CastInfo["markers"];
  speed: number;
  fullscreen: boolean;
  fullscreenEnabled: boolean;
  disabled?: boolean;
  /** Where the speed list and marker tooltips portal: the frame, while it is fullscreen. */
  portal?: HTMLElement | null;
  onToggle: () => void;
  onSeek: (time: number) => void;
  onSpeed: (speed: number) => void;
  onFullscreen: () => void;
};

export function ControlBar({
  playing,
  time,
  duration,
  markers,
  speed,
  fullscreen,
  fullscreenEnabled,
  disabled = false,
  portal,
  onToggle,
  onSeek,
  onSpeed,
  onFullscreen,
}: ControlBarProps) {
  // Dragging moves only the shown time; the player seeks once, on release.
  const [dragged, setDragged] = useState<number | null>(null);
  const shown = Math.min(dragged ?? time, duration);
  const long = duration >= 3600;
  const speeds = SPEEDS.includes(speed as (typeof SPEEDS)[number])
    ? SPEEDS
    : [...SPEEDS, speed].sort((a, b) => a - b);
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 border-t bg-card px-2 py-1 text-card-foreground text-xs">
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
          {formatTime(shown, long)} / {formatTime(duration, long)}
        </span>
        <div className="relative mx-1 flex min-w-16 flex-1 items-center">
          <Slider
            aria-label="Seek"
            min={0}
            max={Math.max(duration, 0.1)}
            step={STEP}
            value={[shown]}
            disabled={disabled}
            onValueChange={([value]) => setDragged(value ?? null)}
            onValueCommit={([value]) => {
              setDragged(null);
              if (value === undefined) return;
              // The track rounds to its step, so the end itself is a step
              // short of the last frame unless snapped to.
              onSeek(value > duration - STEP ? duration : value);
            }}
          />
          {duration > 0 &&
            markers.map((marker, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: markers are positional, and two may share a time and a label
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-slot="cast-marker"
                    disabled={disabled}
                    aria-label={`${marker.label || `Marker ${index + 1}`} at ${formatTime(marker.time, long)}`}
                    className="absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/50 outline-none after:absolute after:-inset-x-1.5 after:-inset-y-1 hover:bg-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
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
        <Select
          value={String(speed)}
          disabled={disabled}
          onValueChange={(value) => onSpeed(Number(value))}
        >
          <SelectTrigger
            size="sm"
            aria-label="Speed"
            className="h-7 border-transparent px-2 text-xs tabular-nums"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent container={portal}>
            {speeds.map((s) => (
              <SelectItem key={s} value={String(s)} className="text-xs">
                {s}×
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fullscreenEnabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={onFullscreen}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
