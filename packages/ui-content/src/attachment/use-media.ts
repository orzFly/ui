import { useCallback, useEffect, useMemo, useState } from "react";

export type MediaState = {
  playing: boolean;
  /** Played, or seeked, at least once: the poster overlay is gone. */
  started: boolean;
  time: number;
  /** Seconds; NaN before the metadata, Infinity for a stream or an unfinished recording. */
  duration: number;
  buffered: [start: number, end: number][];
  level: number;
  muted: boolean;
  speed: number;
  pip: boolean;
  /** The element failed to load or decode its source. */
  failed: boolean;
  error: MediaError | null;
};

export type MediaActions = {
  toggle(): void;
  seek(time: number): void;
  setLevel(level: number): void;
  mute(): void;
  setSpeed(speed: number): void;
  togglePip(): void;
};

const INITIAL: MediaState = {
  playing: false,
  started: false,
  time: 0,
  duration: Number.NaN,
  buffered: [],
  level: 1,
  muted: false,
  speed: 1,
  pip: false,
  failed: false,
  error: null,
};

const EVENTS = [
  "play",
  "pause",
  "ended",
  "timeupdate",
  "seeked",
  "loadedmetadata",
  "durationchange",
  "progress",
  "volumechange",
  "ratechange",
  "enterpictureinpicture",
  "leavepictureinpicture",
] as const;

/** A refused play() or picture-in-picture request (autoplay policy, an aborted load) changes nothing. */
const ignore = () => {};

function rangesOf(ranges: TimeRanges | undefined): [number, number][] {
  const pairs: [number, number][] = [];
  if (ranges === undefined) return pairs;
  for (let i = 0; i < ranges.length; i++) {
    pairs.push([ranges.start(i), ranges.end(i)]);
  }
  return pairs;
}

/** The control bar's values, read from a media element's events, and the actions on it. */
export function useMedia(
  element: HTMLMediaElement | null,
): [MediaState, MediaActions] {
  const [state, setState] = useState<MediaState>(INITIAL);

  const read = useCallback((media: HTMLMediaElement) => {
    setState((previous) => ({
      playing: !media.paused,
      started: previous.started || !media.paused,
      time: media.currentTime,
      duration: media.duration,
      buffered: rangesOf(media.buffered),
      level: media.volume,
      muted: media.muted,
      speed: media.playbackRate,
      pip:
        typeof document !== "undefined" &&
        document.pictureInPictureElement === media,
      failed: previous.failed,
      error: previous.error,
    }));
  }, []);

  useEffect(() => {
    if (element === null) return;
    const onEvent = () => read(element);
    const onError = () =>
      setState((previous) => ({
        ...previous,
        playing: false,
        failed: true,
        error: element.error,
      }));
    read(element);
    for (const name of EVENTS) element.addEventListener(name, onEvent);
    element.addEventListener("error", onError);
    return () => {
      for (const name of EVENTS) element.removeEventListener(name, onEvent);
      element.removeEventListener("error", onError);
    };
  }, [element, read]);

  useEffect(() => {
    if (element === null || !state.playing) return;
    // The cast bar's cadence; timeupdate alone comes about every 250 ms.
    const interval = setInterval(
      () =>
        setState((previous) => ({ ...previous, time: element.currentTime })),
      100,
    );
    return () => clearInterval(interval);
  }, [element, state.playing]);

  const actions = useMemo<MediaActions>(
    () => ({
      toggle() {
        if (element === null) return;
        if (element.paused) {
          // Not every implementation returns the promise.
          element.play()?.catch(ignore);
        } else {
          element.pause();
        }
      },
      seek(time) {
        if (element === null) return;
        element.currentTime = time;
        setState((previous) => ({ ...previous, time, started: true }));
      },
      setLevel(level) {
        if (element === null) return;
        element.volume = level;
        element.muted = false;
      },
      mute() {
        if (element === null) return;
        element.muted = !element.muted;
      },
      setSpeed(speed) {
        if (element === null) return;
        element.playbackRate = speed;
      },
      togglePip() {
        if (!(element instanceof HTMLVideoElement)) return;
        if (document.pictureInPictureElement === element) {
          document.exitPictureInPicture().catch(ignore);
        } else {
          element.requestPictureInPicture().catch(ignore);
        }
      },
    }),
    [element],
  );

  return [state, actions];
}
