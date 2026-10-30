import { Button } from "@orz/ui/components/button";
import { cn } from "@orz/ui/lib/utils";
import {
  CaseSensitiveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ListFilterIcon,
  RegexIcon,
  SearchIcon,
} from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from "react";
import type { LevelCounts } from "../parse/level-tracker.ts";
import { LEVELS, type LogLevel } from "../parse/levels.ts";
import { MATCH_CAP } from "./search.ts";

export type LevelKey = LogLevel | "other";

/** The chips' order: the levels from fatal to trace, then Other. */
export const LEVEL_KEYS: readonly LevelKey[] = [...LEVELS, "other"];

const formatCount = (n: number) => n.toLocaleString("en-US");

/**
 * The filter after a click on the chip of `key`: a click toggles it, a
 * shift+click shows it alone, or everything again when it already was.
 */
export function toggleLevel(
  hidden: ReadonlySet<LevelKey>,
  key: LevelKey,
  solo: boolean,
  present: readonly LevelKey[],
): Set<LevelKey> {
  if (!solo) {
    const next = new Set(hidden);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  }
  const alone =
    !hidden.has(key) && present.every((k) => k === key || hidden.has(k));
  return alone ? new Set() : new Set(LEVEL_KEYS.filter((k) => k !== key));
}

export interface LevelChipsProps {
  counts: LevelCounts;
  hidden: ReadonlySet<LevelKey>;
  onChange: (hidden: Set<LevelKey>) => void;
}

/** A toggle chip per level that occurs, with its line count. */
export function LevelChips({ counts, hidden, onChange }: LevelChipsProps) {
  const present = LEVEL_KEYS.filter((key) => counts[key] > 0);
  const onClick = (key: LevelKey) => (event: MouseEvent) =>
    onChange(toggleLevel(hidden, key, event.shiftKey, present));
  return (
    <div className="flex flex-wrap gap-1">
      {present.map((key) => (
        <Button
          key={key}
          size="xs"
          variant="ghost"
          aria-pressed={!hidden.has(key)}
          title="Click to show or hide; shift+click to show only this level"
          // styles.css gives [data-level] its --log-level, which colours the dot.
          data-level={key === "other" ? undefined : key}
          className="rounded-chip font-mono text-muted-foreground line-through opacity-60 aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:pressed-cue aria-pressed:no-underline aria-pressed:opacity-100"
          onClick={onClick(key)}
        >
          <span
            aria-hidden
            className="size-2 rounded-full bg-[var(--log-level,var(--color-muted-foreground))]"
          />
          {key === "other" ? "Other" : key.toUpperCase()}{" "}
          <span className="text-muted-foreground">
            {formatCount(counts[key])}
          </span>
        </Button>
      ))}
    </div>
  );
}

export interface SearchCounter {
  /** The current match's index, or -1. */
  current: number;
  count: number;
  capped: boolean;
  scanning: boolean;
  error: "invalid" | null;
}

/** "3 / 41", with "…" while the scan runs and "100,000+" past the cap. */
export function counterLabel(query: string, c: SearchCounter): string {
  if (query === "") return "";
  if (c.error) return "Invalid regex";
  const total = c.capped ? `${formatCount(MATCH_CAP)}+` : formatCount(c.count);
  return `${formatCount(c.current + 1)} / ${total}${c.scanning ? "…" : ""}`;
}

export interface SearchBoxProps {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQuery: (query: string) => void;
  counter: SearchCounter;
  caseSensitive: boolean;
  onCaseSensitive: (on: boolean) => void;
  regex: boolean;
  onRegex: (on: boolean) => void;
  onlyMatching: boolean;
  onOnlyMatching: (on: boolean) => void;
  /** Goes to the next match, or the previous with `back`. */
  onStep: (back: boolean) => void;
  /** Escape: leaves the box, keeping the query. */
  onLeave: () => void;
  className?: string;
}

function Toggle({
  label,
  pressed,
  onPressed,
  children,
}: {
  label: string;
  pressed: boolean;
  onPressed: (on: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className="aria-pressed:bg-muted aria-pressed:text-foreground aria-pressed:pressed-cue"
      onClick={() => onPressed(!pressed)}
    >
      {children}
    </Button>
  );
}

export function SearchBox({
  inputRef,
  query,
  onQuery,
  counter,
  caseSensitive,
  onCaseSensitive,
  regex,
  onRegex,
  onlyMatching,
  onOnlyMatching,
  onStep,
  onLeave,
  className,
}: SearchBoxProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onStep(event.shiftKey);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onLeave();
    }
  };
  const invalid = counter.error !== null && query !== "";
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-0.5 rounded-[min(var(--radius-control),8px)] border border-border bg-background pl-1.5",
        className,
      )}
    >
      <SearchIcon
        aria-hidden
        className="size-3 shrink-0 text-muted-foreground"
      />
      <input
        ref={inputRef}
        type="search"
        aria-label="Search log"
        placeholder="Search"
        aria-invalid={invalid || undefined}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={onKeyDown}
        className="h-control-xs w-36 min-w-0 flex-auto bg-transparent px-1 font-mono text-foreground outline-none aria-invalid:text-destructive"
      />
      <span
        aria-live="polite"
        className={cn(
          "shrink-0 text-right text-muted-foreground tabular-nums",
          invalid && "text-destructive",
        )}
      >
        {counterLabel(query, counter)}
      </span>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        onClick={() => onStep(true)}
      >
        <ChevronUpIcon />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Next match"
        title="Next match (Enter)"
        onClick={() => onStep(false)}
      >
        <ChevronDownIcon />
      </Button>
      <Toggle
        label="Match case"
        pressed={caseSensitive}
        onPressed={onCaseSensitive}
      >
        <CaseSensitiveIcon />
      </Toggle>
      <Toggle label="Regular expression" pressed={regex} onPressed={onRegex}>
        <RegexIcon />
      </Toggle>
      <Toggle
        label="Only matching lines"
        pressed={onlyMatching}
        onPressed={onOnlyMatching}
      >
        <ListFilterIcon />
      </Toggle>
    </div>
  );
}
