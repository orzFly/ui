import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatTimestamp,
  Timestamp,
  TimestampProvider,
} from "../src/components/timestamp.tsx";

const NOW = Date.parse("2026-11-27T19:30:00Z");
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(NOW + ms).toISOString();

const US = { locale: "en-US", timeZone: "UTC" };

function inUs(children: ReactNode) {
  return (
    <TimestampProvider locale="en-US" timeZone="UTC">
      {children}
    </TimestampProvider>
  );
}

const shown = () => document.querySelector("time");

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatTimestamp", () => {
  it("leaves the year out within this year, and writes it otherwise", () => {
    expect(formatTimestamp(at(-2 * HOUR), "datetime", US)).toBe(
      "Nov 27, 5:30 PM",
    );
    expect(formatTimestamp("2025-11-27T19:30:00Z", "datetime", US)).toBe(
      "Nov 27, 2025, 7:30 PM",
    );
    expect(formatTimestamp(at(-2 * HOUR), "date", US)).toBe("Nov 27");
    expect(formatTimestamp("2025-03-01T00:00:00Z", "date", US)).toBe(
      "Mar 1, 2025",
    );
  });

  it("takes the year in the zone it writes in", () => {
    // Already 2027 in Tokyo, still 2026 in UTC.
    const newYear = "2026-12-31T20:00:00Z";
    const options = { locale: "en-US", now: newYear };
    expect(
      formatTimestamp(newYear, "date", { ...options, timeZone: "Asia/Tokyo" }),
    ).toBe("Jan 1");
    expect(
      formatTimestamp("2026-06-01T00:00:00Z", "date", {
        ...options,
        timeZone: "Asia/Tokyo",
      }),
    ).toBe("Jun 1, 2026");
  });

  it("says how long ago, then the date past a week", () => {
    const ago = (ms: number) => formatTimestamp(at(-ms), "relative", US);
    expect(ago(20_000)).toBe("now");
    expect(ago(4 * MINUTE + 59_000)).toBe("4m ago");
    expect(ago(3 * HOUR)).toBe("3h ago");
    expect(ago(DAY + HOUR)).toBe("1d ago");
    expect(ago(6 * DAY)).toBe("6d ago");
    expect(ago(7 * DAY)).toBe("Nov 20");
    expect(formatTimestamp(at(2 * HOUR), "relative", US)).toBe("in 2h");
    expect(formatTimestamp(at(30 * DAY), "relative", US)).toBe("Dec 27");
  });

  it("speaks the reader's language", () => {
    expect(
      formatTimestamp(at(-4 * MINUTE), "relative", {
        locale: "zh-CN",
        timeZone: "UTC",
      }),
    ).toBe("4分钟前");
  });

  it("gives back what it cannot read", () => {
    expect(formatTimestamp("soon", "datetime", US)).toBe("soon");
  });
});

describe("Timestamp", () => {
  it("is a <time> with its instant, and the instant in full as its title", () => {
    render(inUs(<Timestamp value={at(-2 * HOUR)} className="text-ui-sm" />));
    const time = shown();
    expect(time?.textContent).toBe("Nov 27, 5:30 PM");
    expect(time?.getAttribute("datetime")).toBe("2026-11-27T17:30:00.000Z");
    expect(time?.getAttribute("title")).toBe("Nov 27, 2026, 5:30:00 PM UTC");
    expect(time?.className).toBe("text-ui-sm");
  });

  it("titles every format in full", () => {
    render(inUs(<Timestamp value={at(-4 * MINUTE)} format="relative" />));
    expect(shown()?.textContent).toBe("4m ago");
    expect(shown()?.getAttribute("title")).toBe("Nov 27, 2026, 7:26:00 PM UTC");
  });

  it("keeps a relative time current, as the clock goes on", () => {
    render(inUs(<Timestamp value={at(-30_000)} format="relative" />));
    expect(shown()?.textContent).toBe("now");
    act(() => vi.advanceTimersByTime(30_000));
    expect(shown()?.textContent).toBe("1m ago");
    act(() => vi.advanceTimersByTime(58 * MINUTE));
    expect(shown()?.textContent).toBe("59m ago");
    act(() => vi.advanceTimersByTime(MINUTE));
    expect(shown()?.textContent).toBe("1h ago");
    act(() => vi.advanceTimersByTime(7 * DAY));
    expect(shown()?.textContent).toBe("Nov 27");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("counts down to a time ahead", () => {
    render(inUs(<Timestamp value={at(2 * MINUTE)} format="relative" />));
    expect(shown()?.textContent).toBe("in 2m");
    act(() => vi.advanceTimersByTime(MINUTE));
    expect(shown()?.textContent).toBe("in 1m");
    act(() => vi.advanceTimersByTime(MINUTE));
    expect(shown()?.textContent).toBe("now");
  });

  it("looks again when the page is shown, after a sleep its timer slept through", () => {
    render(inUs(<Timestamp value={at(-2 * MINUTE)} format="relative" />));
    vi.setSystemTime(NOW + 3 * HOUR);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(shown()?.textContent).toBe("3h ago");
  });

  it("stops ticking at a fixed now", () => {
    render(
      <TimestampProvider locale="en-US" timeZone="UTC" now={at(10 * MINUTE)}>
        <Timestamp value={at(0)} format="relative" />
      </TimestampProvider>,
    );
    expect(shown()?.textContent).toBe("10m ago");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("leaves no timer behind once unmounted", () => {
    const { unmount } = render(
      inUs(<Timestamp value={at(-MINUTE)} format="relative" />),
    );
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("builds one formatter per locale, zone and shape, however many it draws", () => {
    const made = vi.spyOn(Intl, "DateTimeFormat");
    render(
      <TimestampProvider locale="en-GB" timeZone="Europe/Paris">
        {Array.from({ length: 50 }, (_, i) => at(-i * DAY * 40)).map(
          (value) => (
            <Timestamp key={value} value={value} />
          ),
        )}
      </TimestampProvider>,
    );
    // The two shapes (this year, another year), their title, and the year they compare.
    expect(made.mock.calls.length).toBeLessThanOrEqual(4);
    made.mockRestore();
  });

  it("writes what it cannot read as it came", () => {
    render(<Timestamp value="soon" />);
    expect(shown()?.textContent).toBe("soon");
    expect(shown()?.hasAttribute("datetime")).toBe(false);
  });
});

describe("Timestamp rendered on the server", () => {
  it("writes the year and UTC, then the reader's once hydrated, with no mismatch", async () => {
    const tree = (
      <TimestampProvider locale="en-US">
        <Timestamp value={at(-4 * MINUTE)} format="relative" />
      </TimestampProvider>
    );
    const html = renderToString(tree);
    expect(html).toContain("Nov 27, 2026, 7:26 PM UTC");
    const root = document.createElement("div");
    root.innerHTML = html;
    document.body.append(root);
    const recoverable = vi.fn();
    await act(async () => {
      hydrateRoot(root, tree, { onRecoverableError: recoverable });
    });
    expect(recoverable).not.toHaveBeenCalled();
    expect(root.querySelector("time")?.textContent).toBe("4m ago");
    root.remove();
  });

  it("keeps a zone the app named", () => {
    const html = renderToString(
      <TimestampProvider timeZone="Asia/Tokyo">
        <Timestamp value="2026-11-27T19:30:00Z" format="date" />
      </TimestampProvider>,
    );
    expect(html).toContain(">Nov 28, 2026<");
  });
});
