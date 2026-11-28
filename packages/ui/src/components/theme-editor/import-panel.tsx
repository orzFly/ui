import type { TerminalTheme } from "@orz/themes";
import { useEffect, useId, useRef, useState } from "react";
import {
  type ImportEntry,
  type ImportStatus,
  type ParseResult,
  parseThemeFile,
  THEME_FILE_MAX_LENGTH,
} from "../../lib/theme-file.ts";
import { cn } from "../../lib/utils.ts";
import { Button } from "../button.tsx";
import { Checkbox } from "../checkbox.tsx";
import { FileDrop, FileDropTrigger } from "../file-drop.tsx";
import { InfoPopover } from "../info-popover.tsx";
import { Textarea } from "../textarea.tsx";

export interface ImportPanelProps {
  /** The lists the file's references resolve against (UI and terminal-only together). */
  themes: readonly TerminalTheme[];
  /** Labels imported themes must not take: custom themes of both kinds, and both slots' base themes. */
  labels: readonly string[];
  /** The store's slots: a terminal theme needs a terminal, and a UI theme without a UI slot comes in as a terminal theme. */
  slots: { ui: boolean; terminal: boolean };
  /** Writes the checked themes; ids are the caller's. */
  onImport: (themes: NonNullable<ImportEntry["theme"]>[]) => void;
  /** Why the last import could not be written, if it failed. */
  error: string | null;
  onBack: () => void;
}

const PARSE_DELAY = 200;
const TOO_LARGE = "This file is too large to be a theme file.";

const STATUS: Record<ImportStatus, { label: string; className: string }> = {
  ok: {
    label: "OK",
    className:
      "bg-success/10 text-[color-mix(in_oklab,var(--success),var(--foreground)_65%)]",
  },
  renamed: {
    label: "Renamed",
    className: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  },
  adjusted: {
    label: "Adjusted",
    className:
      "bg-warning/10 text-[color-mix(in_oklab,var(--warning),var(--foreground)_65%)]",
  },
  rejected: {
    label: "Rejected",
    className:
      "bg-destructive/10 text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)]",
  },
};

/** Takes a theme file (pasted, chosen or dropped) and lists what it would add before writing anything. */
export function ImportPanel({
  themes,
  labels,
  slots,
  onImport,
  error,
  onBack,
}: ImportPanelProps) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  // Rows the user unchecked, by index; a fresh parse checks every row again.
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [fileError, setFileError] = useState<string | null>(null);
  const reading = useRef(0);
  const statusId = useId();
  const headingId = useId();

  useEffect(() => {
    if (text.trim() === "") {
      setResult(null);
      return;
    }
    const timer = setTimeout(() => {
      setResult(parseThemeFile(text, themes, labels, { slots }));
      setExcluded(new Set());
    }, PARSE_DELAY);
    return () => clearTimeout(timer);
  }, [text, themes, labels, slots]);

  const edit = (next: string) => {
    reading.current++;
    setFileError(null);
    setText(next);
  };

  const readFile = async (file: File) => {
    const token = ++reading.current;
    // Checked before reading, so a huge file is never loaded into memory.
    if (file.size > THEME_FILE_MAX_LENGTH) {
      setFileError(TOO_LARGE);
      return;
    }
    let content: string;
    try {
      content = await file.text();
    } catch {
      if (token === reading.current) {
        setFileError(`"${file.name}" could not be read.`);
      }
      return;
    }
    if (token !== reading.current) return;
    setFileError(null);
    setText(content);
  };

  const entries = result?.ok ? result.entries : [];
  const picked = entries.flatMap((entry, i) =>
    entry.theme && !excluded.has(i) ? [entry.theme] : [],
  );
  const problem = fileError ?? (result?.ok === false ? result.error : null);

  const toggle = (index: number, on: boolean) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (on) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <FileDrop
      aria-labelledby={headingId}
      accept=".json,application/json"
      onFile={(file) => void readFile(file)}
      onReject={(file) => {
        // A file still being read must not land over this message.
        reading.current++;
        setFileError(`"${file.name}" is not a JSON file.`);
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-1">
          <h3 id={headingId} className="text-ui font-medium">
            Import themes
          </h3>
          <InfoPopover label="About importing themes">
            Paste a theme file, choose one, or drop it on this panel. Nothing is
            added until you import.
          </InfoPopover>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back to the theme
        </Button>
      </div>
      <Textarea
        aria-label="Theme file"
        aria-describedby={problem ? statusId : undefined}
        aria-invalid={problem ? true : undefined}
        spellCheck={false}
        placeholder='{ "format": "orz-themes", … }'
        className="field-sizing-fixed h-40 resize-y font-mono text-ui-sm md:text-ui-sm"
        value={text}
        onChange={(event) => edit(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <FileDropTrigger size="sm">Choose file…</FileDropTrigger>
      </div>
      {problem && (
        <p
          id={statusId}
          role="alert"
          className="text-ui-sm text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)]"
        >
          {problem}
        </p>
      )}
      {entries.length > 0 && (
        <ul aria-label="Themes in the file" className="flex flex-col gap-1.5">
          {entries.map((entry, i) => (
            <ImportRow
              // biome-ignore lint/suspicious/noArrayIndexKey: entries are positional; labels may repeat within a file.
              key={i}
              entry={entry}
              checked={entry.theme !== undefined && !excluded.has(i)}
              onCheckedChange={(on) => toggle(i, on)}
            />
          ))}
        </ul>
      )}
      {error && (
        <p
          role="alert"
          className="text-ui-sm text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)]"
        >
          {error}
        </p>
      )}
      {entries.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={picked.length === 0}
            onClick={() => onImport(picked)}
          >
            Import {picked.length}
          </Button>
        </div>
      )}
    </FileDrop>
  );
}

function ImportRow({
  entry,
  checked,
  onCheckedChange,
}: {
  entry: ImportEntry;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  const status = STATUS[entry.status];
  const label = entry.theme?.label ?? (entry.sourceLabel || "Untitled theme");
  return (
    <li
      data-status={entry.status}
      className="flex items-start gap-2.5 rounded-frame border p-2.5"
    >
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={checked}
        disabled={entry.theme === undefined}
        onCheckedChange={(next) => onCheckedChange(next === true)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="min-w-0 flex-1 truncate text-ui">
            {label}
          </label>
          {entry.kind === "terminal" && (
            <span className="shrink-0 rounded-chip bg-muted px-2 py-0.5 text-ui-sm font-medium text-muted-foreground">
              Terminal
            </span>
          )}
          <span
            className={cn(
              "shrink-0 rounded-chip px-2 py-0.5 text-ui-sm font-medium",
              status.className,
            )}
          >
            {status.label}
          </span>
        </div>
        {entry.messages.map((message) => (
          <p key={message} className="text-ui-sm text-muted-foreground">
            {message}
          </p>
        ))}
      </div>
    </li>
  );
}
