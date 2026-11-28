"use client";

import * as React from "react";

/**
 * How a `Timestamp` writes its instant. `datetime`: the date and the time to the minute.
 * `date`: the date alone. Both leave the year out within the reader's current year.
 * `relative`: how long ago or how far ahead ("4m ago", "in 2h"), and the date past a week.
 */
export type TimestampFormat = "datetime" | "date" | "relative";

/** An instant: a `Date`, milliseconds since the epoch, or an ISO 8601 string with its offset. */
export type TimestampValue = Date | number | string;

export interface TimestampOptions {
  /** A BCP 47 tag. Default: the reader's. */
  locale?: string;
  /** An IANA zone. Default: the reader's. */
  timeZone?: string;
  /** What "now" is, for the year left out and for a relative time. Default: the clock's. */
  now?: TimestampValue;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** Past this age, either way, a relative time is written as its date. */
const RELATIVE_DAYS = 7;
/** The longest a relative time waits to look again; `setTimeout` cannot count further. */
const LONGEST_WAIT = DAY;

const UNITS = [
  { unit: "day", ms: DAY },
  { unit: "hour", ms: HOUR },
  { unit: "minute", ms: MINUTE },
] as const;

// One formatter per locale, zone and shape: building one costs far more than a call, and a
// timeline draws hundreds of timestamps.
const formatters = new Map<string, Intl.DateTimeFormat>();
const relatives = new Map<string, Intl.RelativeTimeFormat>();

function dateFormat(
  locale: string | undefined,
  timeZone: string | undefined,
  shape: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale ?? ""}|${timeZone ?? ""}|${shape}`;
  let format = formatters.get(key);
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone });
    formatters.set(key, format);
  }
  return format;
}

function relativeFormat(
  locale: string | undefined,
  numeric: "always" | "auto",
): Intl.RelativeTimeFormat {
  const key = `${locale ?? ""}|${numeric}`;
  let format = relatives.get(key);
  if (format === undefined) {
    format = new Intl.RelativeTimeFormat(locale, { style: "narrow", numeric });
    relatives.set(key, format);
  }
  return format;
}

const SHAPES: Record<string, Intl.DateTimeFormatOptions> = {
  datetime: {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  datetimeYear: {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  },
  datetimeZone: {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  },
  date: { month: "short", day: "numeric" },
  dateYear: { year: "numeric", month: "short", day: "numeric" },
  full: { dateStyle: "medium", timeStyle: "long" },
  // Digits whatever the locale, to compare two years.
  year: { year: "numeric" },
};

function format(
  shape: keyof typeof SHAPES,
  time: number,
  locale: string | undefined,
  timeZone: string | undefined,
): string {
  const options = SHAPES[shape] ?? {};
  return dateFormat(
    shape === "year" ? "en" : locale,
    timeZone,
    shape,
    options,
  ).format(time);
}

function toTime(value: TimestampValue): number {
  return value instanceof Date
    ? value.getTime()
    : typeof value === "number"
      ? value
      : Date.parse(value);
}

function absolute(
  kind: "datetime" | "date",
  time: number,
  { locale, timeZone, now }: TimestampOptions,
): string {
  const sameYear =
    now !== undefined &&
    format("year", time, locale, timeZone) ===
      format("year", toTime(now), locale, timeZone);
  return format(sameYear ? kind : `${kind}Year`, time, locale, timeZone);
}

/** The text a `Timestamp` shows, for a place that takes a string. */
export function formatTimestamp(
  value: TimestampValue,
  kind: TimestampFormat = "datetime",
  options: TimestampOptions = {},
): string {
  const time = toTime(value);
  if (Number.isNaN(time)) return String(value);
  const now = toTime(options.now ?? Date.now());
  if (kind !== "relative") {
    return absolute(kind, time, { ...options, now });
  }
  const age = now - time;
  const span = Math.abs(age);
  if (span >= RELATIVE_DAYS * DAY) {
    return absolute("date", time, { ...options, now });
  }
  if (span < MINUTE)
    return relativeFormat(options.locale, "auto").format(0, "second");
  // Never "yesterday": a day here is 24 hours, which a calendar's yesterday need not be.
  const { unit, ms } = UNITS.find((each) => span >= each.ms) ?? UNITS[2];
  const count = Math.trunc(span / ms);
  return relativeFormat(options.locale, "always").format(
    age >= 0 ? -count : count,
    unit,
  );
}

/** The instant in full, to the second and with its zone, as a timestamp's `title`. */
function fullTimestamp(time: number, options: TimestampOptions): string {
  return format("full", time, options.locale, options.timeZone);
}

/** How long until a relative time's text changes, or null once it is a date for good. */
function untilChange(time: number, now: number): number | null {
  const age = now - time;
  const span = Math.abs(age);
  const cutoff = RELATIVE_DAYS * DAY;
  if (age >= 0) {
    if (span >= cutoff) return null;
    const { ms } = UNITS.find((each) => span >= each.ms) ?? UNITS[2];
    const next = span < MINUTE ? MINUTE : (Math.trunc(span / ms) + 1) * ms;
    return Math.min(next - span, LONGEST_WAIT);
  }
  // Ahead of now, the text changes as the span shrinks past a whole unit.
  if (span >= cutoff) return Math.min(span - cutoff + 1, LONGEST_WAIT);
  const { ms } = UNITS.find((each) => span >= each.ms) ?? UNITS[2];
  const whole = Math.trunc(span / ms) * ms;
  return Math.min(span - whole + 1, LONGEST_WAIT);
}

const TimestampContext = React.createContext<TimestampOptions>({});

/**
 * Sets the locale, the zone or "now" for the timestamps inside: an app's own setting for
 * either of the first two, and a fixed "now" for a test or a screenshot, which stops relative
 * times from ticking.
 */
function TimestampProvider({
  locale,
  timeZone,
  now,
  children,
}: TimestampOptions & { children: React.ReactNode }) {
  const value = React.useMemo(
    () => ({ locale, timeZone, now }),
    [locale, timeZone, now],
  );
  return <TimestampContext value={value}>{children}</TimestampContext>;
}

const subscribeNothing = () => () => {};

/** False on the server and through hydration, which cannot know the reader's clock. */
function useHydrated(): boolean {
  return React.useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

// One listener for every live timestamp: a timer stopped while the machine slept fires late, so
// coming back to the page looks again.
const onShow = new Set<() => void>();
function listenForShow(callback: () => void): () => void {
  if (onShow.size === 0) {
    document.addEventListener("visibilitychange", showAll);
  }
  onShow.add(callback);
  return () => {
    onShow.delete(callback);
    if (onShow.size === 0) {
      document.removeEventListener("visibilitychange", showAll);
    }
  };
}
function showAll() {
  if (document.visibilityState !== "visible") return;
  for (const callback of onShow) callback();
}

/**
 * One instant in a `<time>`, in the reader's locale and zone: the date and the time, the date,
 * or how long ago. Its `title` is the instant in full, to the second and with its zone. A
 * relative time keeps itself current while it is on screen.
 *
 * On the server and through hydration it writes the instant with its year, in UTC unless a
 * `TimestampProvider` names the zone and in English unless it names the locale, then the
 * reader's once hydrated.
 */
function Timestamp({
  value,
  format: kind = "datetime",
  ...props
}: Omit<React.ComponentProps<"time">, "dateTime" | "children"> & {
  value: TimestampValue;
  /** Default `datetime`. */
  format?: TimestampFormat;
}) {
  const context = React.useContext(TimestampContext);
  const hydrated = useHydrated();
  const [, tick] = React.useReducer((count: number) => count + 1, 0);
  const time = toTime(value);
  const live =
    hydrated &&
    kind === "relative" &&
    context.now === undefined &&
    !Number.isNaN(time);
  React.useEffect(() => {
    if (!live) return;
    const wait = untilChange(time, Date.now());
    if (wait === null) return;
    const timer = setTimeout(tick, wait);
    return () => clearTimeout(timer);
  });
  React.useEffect(() => (live ? listenForShow(tick) : undefined), [live]);
  if (Number.isNaN(time)) {
    return (
      <time data-slot="timestamp" {...props}>
        {String(value)}
      </time>
    );
  }
  let text: string;
  let options: TimestampOptions;
  if (hydrated) {
    options = { ...context, now: context.now ?? Date.now() };
    text = formatTimestamp(time, kind, options);
  } else {
    options = {
      locale: context.locale ?? "en",
      timeZone: context.timeZone ?? "UTC",
    };
    // Without a now, so with its year; a zone the reader did not pick is named.
    text =
      kind === "date"
        ? format("dateYear", time, options.locale, options.timeZone)
        : format(
            context.timeZone === undefined ? "datetimeZone" : "datetimeYear",
            time,
            options.locale,
            options.timeZone,
          );
  }
  return (
    <time
      data-slot="timestamp"
      {...props}
      dateTime={new Date(time).toISOString()}
      title={fullTimestamp(time, options)}
    >
      {text}
    </time>
  );
}

export { Timestamp, TimestampProvider };
