import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatTime,
  MediaControls,
  type MediaControlsProps,
} from "../src/components/media-controls.tsx";

function renderBar(props: Partial<MediaControlsProps> = {}) {
  const handlers = {
    onToggle: vi.fn(),
    onSeek: vi.fn(),
    onSpeed: vi.fn(),
  };
  const result = render(
    <MediaControls
      playing={false}
      time={0}
      duration={60}
      speed={1}
      {...handlers}
      {...props}
    />,
  );
  return { ...result, ...handlers };
}

const seekThumb = () => screen.getByRole("slider", { name: "Seek" });

/** Radix reads the pointer against the root's box, which happy-dom leaves empty. */
function sizeSeekTrack(width: number) {
  const root = seekThumb().closest('[data-slot="slider"]') as HTMLElement;
  root.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      right: width,
      bottom: 10,
      width,
      height: 10,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  root.setPointerCapture = () => {};
  root.releasePointerCapture = () => {};
  root.hasPointerCapture = () => true;
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatTime", () => {
  it("writes m:ss under an hour and h:mm:ss from an hour", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(59.9)).toBe("0:59");
    expect(formatTime(3599)).toBe("59:59");
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3725)).toBe("1:02:05");
  });

  it("pads a short time to an hour-long duration's width", () => {
    expect(formatTime(65, true)).toBe("0:01:05");
  });
});

describe("MediaControls", () => {
  it("draws play, time, seek and speed, and none of the optional controls", () => {
    renderBar({ time: 5 });
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(screen.getByText("0:05 / 1:00")).toBeTruthy();
    expect(seekThumb()).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Speed" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mute" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Volume" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Fullscreen" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Picture-in-picture" }),
    ).toBeNull();
  });

  it("toggles play through its button, labelled for the state", () => {
    const { onToggle, rerender } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(
      <MediaControls
        playing
        time={0}
        duration={60}
        speed={1}
        onToggle={onToggle}
        onSeek={vi.fn()}
        onSpeed={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
  });

  it("draws fullscreen and picture-in-picture when passed, labelled for their state", () => {
    const fullscreen = { active: false, onToggle: vi.fn() };
    const pictureInPicture = { active: true, onToggle: vi.fn() };
    renderBar({ fullscreen, pictureInPicture });
    fireEvent.click(screen.getByRole("button", { name: "Fullscreen" }));
    expect(fullscreen.onToggle).toHaveBeenCalledTimes(1);
    const pip = screen.getByRole("button", {
      name: "Exit picture-in-picture",
    });
    expect(pip.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(pip);
    expect(pictureInPicture.onToggle).toHaveBeenCalledTimes(1);
  });

  it("seeks once, on release, while a drag moves only the time shown", () => {
    const { onSeek } = renderBar();
    const root = sizeSeekTrack(600);
    fireEvent.pointerDown(root, { clientX: 100, pointerId: 1, button: 0 });
    fireEvent.pointerMove(root, { clientX: 300, pointerId: 1 });
    expect(screen.getByText("0:30 / 1:00")).toBeTruthy();
    expect(onSeek).not.toHaveBeenCalled();
    fireEvent.pointerUp(root, { clientX: 300, pointerId: 1 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek.mock.calls[0]?.[0]).toBeCloseTo(30);
  });

  it("snaps a value within a step of the end to the end", () => {
    const { onSeek } = renderBar({ time: 9.9, duration: 10.05 });
    fireEvent.keyDown(seekThumb(), { key: "ArrowRight" });
    expect(onSeek).toHaveBeenCalledWith(10.05);
  });

  it("shades each buffered range inside the track at its share of the duration", () => {
    renderBar({
      duration: 200,
      buffered: [
        [0, 50],
        [100, 150],
      ],
    });
    const track = document.querySelector('[data-slot="slider-track"]');
    const spans = [
      ...document.querySelectorAll<HTMLElement>('[data-slot="media-buffered"]'),
    ];
    expect(spans).toHaveLength(2);
    for (const span of spans) expect(span.parentElement).toBe(track);
    expect(spans[1]?.style.left).toBe("50%");
    expect(spans[1]?.style.width).toBe("25%");
  });

  it("disables the track and shows the time alone while the duration is unknown", () => {
    renderBar({
      time: 12,
      duration: Number.POSITIVE_INFINITY,
      buffered: [[0, 20]],
      markers: [{ time: 3, label: "Intro" }],
    });
    expect(screen.getByText("0:12")).toBeTruthy();
    expect(screen.queryByText(/\//)).toBeNull();
    expect(seekThumb().getAttribute("data-disabled")).not.toBeNull();
    expect(document.querySelector('[data-slot="media-marker"]')).toBeNull();
    expect(document.querySelector('[data-slot="media-buffered"]')).toBeNull();
  });

  it("draws markers that seek to their time", () => {
    const { onSeek } = renderBar({
      markers: [{ time: 15, label: "Intro" }],
    });
    const marker = screen.getByRole("button", { name: "Intro at 0:15" });
    expect(marker.getAttribute("data-slot")).toBe("media-marker");
    expect(marker.style.left).toBe("25%");
    fireEvent.click(marker);
    expect(onSeek).toHaveBeenCalledWith(15);
  });

  it("adds a speed outside the presets to the list", () => {
    renderBar({ speed: 3 });
    fireEvent.click(screen.getByRole("combobox", { name: "Speed" }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["0.5×", "1×", "1.5×", "2×", "3×", "4×"]);
  });

  describe("volume", () => {
    const volume = (
      over: Partial<NonNullable<MediaControlsProps["volume"]>>,
    ) => ({
      level: 0.5,
      muted: false,
      onLevel: vi.fn(),
      onMute: vi.fn(),
      ...over,
    });

    it("renders the inline group and the popover trigger, one for each width", () => {
      renderBar({ volume: volume({}) });
      const inline = document.querySelector('[data-slot="media-volume"]');
      expect(inline?.className).toMatch(/\bhidden\b/);
      expect(inline?.className).toMatch(/@sm\/media-controls:flex/);
      expect(
        inline?.querySelector('[role="slider"][aria-label="Volume"]'),
      ).not.toBeNull();
      const trigger = screen.getByRole("button", { name: "Volume" });
      expect(trigger.className).toMatch(/@sm\/media-controls:hidden/);
    });

    it("reports a new level and a mute from the inline group", () => {
      const v = volume({});
      renderBar({ volume: v });
      fireEvent.keyDown(screen.getByRole("slider", { name: "Volume" }), {
        key: "ArrowUp",
      });
      expect(v.onLevel).toHaveBeenCalledWith(0.55);
      fireEvent.click(screen.getByRole("button", { name: "Mute" }));
      expect(v.onMute).toHaveBeenCalledTimes(1);
    });

    it("shows a muted level as 0 and offers Unmute", () => {
      renderBar({ volume: volume({ muted: true }) });
      expect(
        screen
          .getByRole("slider", { name: "Volume" })
          .getAttribute("aria-valuenow"),
      ).toBe("0");
      expect(screen.getByRole("button", { name: "Unmute" })).toBeTruthy();
    });

    it("opens a vertical slider and a mute button from the narrow trigger", () => {
      const v = volume({});
      const host = document.createElement("div");
      document.body.append(host);
      renderBar({ volume: v, portal: host });
      fireEvent.click(screen.getByRole("button", { name: "Volume" }));
      const content = host.querySelector('[data-slot="popover-content"]');
      expect(content).not.toBeNull();
      const slider = content?.querySelector('[role="slider"]');
      expect(slider?.getAttribute("aria-orientation")).toBe("vertical");
      const mute = content?.querySelector<HTMLElement>(
        'button[aria-label="Mute"]',
      );
      expect(mute).not.toBeNull();
      if (mute) fireEvent.click(mute);
      expect(v.onMute).toHaveBeenCalledTimes(1);
      host.remove();
    });
  });
});
