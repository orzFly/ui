import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioPlayer, VideoPlayer } from "../../src/attachment/index.ts";

/** Pins a property on the element itself, over happy-dom's getter, as a browser would report it. */
function set(element: HTMLMediaElement, values: Record<string, unknown>) {
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(element, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
}

function fire(element: EventTarget, name: string) {
  act(() => {
    element.dispatchEvent(new Event(name));
  });
}

function ranges(pairs: [number, number][]): TimeRanges {
  return {
    length: pairs.length,
    start: (i: number) => pairs[i]?.[0] ?? 0,
    end: (i: number) => pairs[i]?.[1] ?? 0,
  };
}

const media = () => document.querySelector("video, audio") as HTMLMediaElement;
const screenArea = () =>
  document.querySelector('[data-slot="media-screen"]') as HTMLElement;

let play: ReturnType<typeof vi.fn<() => Promise<void>>>;
let pause: ReturnType<typeof vi.fn<() => void>>;

function setDocumentFlag(name: string, value: unknown) {
  Object.defineProperty(document, name, { configurable: true, value });
}

beforeEach(() => {
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const name of [
    "fullscreenEnabled",
    "pictureInPictureEnabled",
    "pictureInPictureElement",
  ]) {
    delete (document as unknown as Record<string, unknown>)[name];
  }
  delete (HTMLElement.prototype as unknown as Record<string, unknown>)
    .requestFullscreen;
});

describe("VideoPlayer", () => {
  it("draws a video without native controls, under the bar, with a play overlay", () => {
    render(<VideoPlayer src="clip.webm" title="clip.webm" />);
    const video = media();
    expect(video.tagName).toBe("VIDEO");
    expect(video.hasAttribute("controls")).toBe(false);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play video" }));
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("follows play and pause", () => {
    render(<VideoPlayer src="clip.webm" title="clip.webm" />);
    const video = media();
    set(video, { paused: false });
    fire(video, "play");
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play video" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(pause).toHaveBeenCalledTimes(1);
    set(video, { paused: true });
    fire(video, "pause");
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("follows time and duration, and shows the time alone while the duration is infinite", () => {
    render(<VideoPlayer src="clip.webm" title="clip.webm" />);
    const video = media();
    set(video, { duration: 120, currentTime: 10 });
    fire(video, "durationchange");
    fire(video, "timeupdate");
    expect(screen.getByText("0:10 / 2:00")).toBeTruthy();
    set(video, { duration: Number.POSITIVE_INFINITY });
    fire(video, "durationchange");
    expect(screen.getByText("0:10")).toBeTruthy();
    expect(
      screen
        .getByRole("slider", { name: "Seek" })
        .getAttribute("data-disabled"),
    ).not.toBeNull();
  });

  it("shades the buffered ranges", () => {
    render(<VideoPlayer src="clip.webm" title="clip.webm" />);
    const video = media();
    set(video, { duration: 100, buffered: ranges([[0, 40]]) });
    fire(video, "progress");
    const span = document.querySelector<HTMLElement>(
      '[data-slot="media-buffered"]',
    );
    expect(span?.style.width).toBe("40%");
  });

  it("follows volume and speed changes", () => {
    render(<VideoPlayer src="clip.webm" title="clip.webm" />);
    const video = media();
    set(video, { muted: true });
    fire(video, "volumechange");
    expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy();
    set(video, { playbackRate: 2 });
    fire(video, "ratechange");
    expect(screen.getByRole("combobox", { name: "Speed" }).textContent).toBe(
      "2×",
    );
  });

  it("starts at the given speed", () => {
    render(<VideoPlayer src="clip.webm" title="clip.webm" speed={1.5} />);
    expect(media().playbackRate).toBe(1.5);
    expect(media().defaultPlaybackRate).toBe(1.5);
  });

  it("acts on the element from the bar, and dragging a muted level unmutes", () => {
    render(<VideoPlayer src="clip.webm" title="clip.webm" />);
    const video = media();
    set(video, { duration: 100 });
    fire(video, "durationchange");
    fireEvent.keyDown(screen.getByRole("slider", { name: "Seek" }), {
      key: "End",
    });
    expect(video.currentTime).toBe(100);

    video.muted = true;
    fire(video, "volumechange");
    fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), {
      key: "ArrowUp",
    });
    expect(video.volume).toBe(0.05);
    expect(video.muted).toBe(false);
    fire(video, "volumechange");
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(video.muted).toBe(true);

    fireEvent.click(screen.getByRole("combobox", { name: "Speed" }));
    fireEvent.click(screen.getByRole("option", { name: "2×" }));
    expect(video.playbackRate).toBe(2);
  });

  describe("keyboard", () => {
    function setup() {
      setDocumentFlag("fullscreenEnabled", true);
      const requestFullscreen = vi.fn(() => Promise.resolve());
      Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
        configurable: true,
        value: requestFullscreen,
      });
      render(<VideoPlayer src="clip.webm" title="clip.webm" />);
      const video = media();
      set(video, { duration: 100, currentTime: 20 });
      fire(video, "durationchange");
      fire(video, "timeupdate");
      return { video, requestFullscreen };
    }

    it("plays and pauses on Space and k", () => {
      setup();
      fireEvent.keyDown(screenArea(), { key: " " });
      fireEvent.keyDown(screenArea(), { key: "k" });
      expect(play).toHaveBeenCalledTimes(2);
    });

    it("seeks 5 s on the arrows, and claims them", () => {
      const { video } = setup();
      expect(fireEvent.keyDown(screenArea(), { key: "ArrowRight" })).toBe(
        false,
      );
      expect(video.currentTime).toBe(25);
      expect(fireEvent.keyDown(screenArea(), { key: "ArrowLeft" })).toBe(false);
      expect(video.currentTime).toBe(20);
    });

    it("jumps to tenths of the duration on the digits", () => {
      const { video } = setup();
      fireEvent.keyDown(screenArea(), { key: "7" });
      expect(video.currentTime).toBe(70);
      fireEvent.keyDown(screenArea(), { key: "0" });
      expect(video.currentTime).toBe(0);
    });

    it("mutes on m and goes fullscreen on f", () => {
      const { video, requestFullscreen } = setup();
      fireEvent.keyDown(screenArea(), { key: "m" });
      expect(video.muted).toBe(true);
      fireEvent.keyDown(screenArea(), { key: "f" });
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
    });

    it("leaves keys to a focused slider, and ignores a held modifier", () => {
      const { video } = setup();
      fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), {
        key: "ArrowRight",
      });
      expect(video.currentTime).toBe(20);
      fireEvent.keyDown(screenArea(), { key: "k", ctrlKey: true });
      fireEvent.keyDown(screenArea(), { key: "ArrowRight", metaKey: true });
      expect(play).not.toHaveBeenCalled();
      expect(video.currentTime).toBe(20);
    });

    it("leaves Space to a focused button, which presses it", () => {
      setup();
      const mute = screen.getByRole("button", { name: "Mute" });
      expect(fireEvent.keyDown(mute, { key: " " })).toBe(true);
      expect(play).not.toHaveBeenCalled();
    });
  });

  it("offers picture-in-picture and fullscreen only where the document does", () => {
    const { unmount } = render(
      <VideoPlayer src="clip.webm" title="clip.webm" />,
    );
    expect(screen.queryByRole("button", { name: "Fullscreen" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Picture-in-picture" }),
    ).toBeNull();
    unmount();

    setDocumentFlag("fullscreenEnabled", true);
    setDocumentFlag("pictureInPictureEnabled", true);
    render(<VideoPlayer src="clip.webm" title="clip.webm" />);
    const requestPictureInPicture = vi.fn(() => Promise.resolve());
    Object.defineProperty(media(), "requestPictureInPicture", {
      configurable: true,
      value: requestPictureInPicture,
    });
    expect(screen.getByRole("button", { name: "Fullscreen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Picture-in-picture" }));
    expect(requestPictureInPicture).toHaveBeenCalledTimes(1);

    setDocumentFlag("pictureInPictureElement", media());
    fire(media(), "enterpictureinpicture");
    expect(
      screen.getByRole("button", { name: "Exit picture-in-picture" }),
    ).toBeTruthy();
  });

  it("hands an error to onError and draws nothing", () => {
    const onError = vi.fn();
    const { container } = render(
      <VideoPlayer src="clip.avi" title="clip.avi" onError={onError} />,
    );
    fire(media(), "error");
    expect(onError).toHaveBeenCalledWith(null);
    expect(container.innerHTML).toBe("");
  });

  it("says it can't play the file without onError", () => {
    render(<VideoPlayer src="clip.avi" title="clip.avi" />);
    fire(media(), "error");
    expect(screen.getByText("This browser can't play this file.")).toBeTruthy();
    expect(document.querySelector("video")).toBeNull();
  });
});

describe("AudioPlayer", () => {
  it("draws the header over the bar, the element hidden, with no picture controls", () => {
    setDocumentFlag("fullscreenEnabled", true);
    setDocumentFlag("pictureInPictureEnabled", true);
    render(
      <AudioPlayer
        src="tone.ogg"
        title="tone.ogg"
        header={<div>tone.ogg</div>}
      />,
    );
    expect(media().tagName).toBe("AUDIO");
    expect(media().className).toMatch(/\bhidden\b/);
    expect(screen.getByText("tone.ogg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fullscreen" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Picture-in-picture" }),
    ).toBeNull();
    expect(screenArea()).toBeNull();
  });

  it("takes the keys from its bar", () => {
    render(<AudioPlayer src="tone.ogg" title="tone.ogg" />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Play" }), {
      key: "k",
    });
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("replaces the bar with the message on an error", () => {
    render(<AudioPlayer src="tone.wma" title="tone.wma" />);
    fire(media(), "error");
    expect(screen.getByText("This browser can't play this file.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Play" })).toBeNull();
  });
});
