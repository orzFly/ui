import type { TerminalTheme } from "@orz/themes";
import { type DragEvent, useEffect, useId, useRef, useState } from "react";
import {
  type ImportEntry,
  type ImportStatus,
  type ParseResult,
  parseThemeFile,
  THEME_FILE_MAX_LENGTH,
} from "../../lib/theme-file.ts";
import { cn } from "../../lib/utils.ts";
import { Button } from "../button.tsx";
import { Textarea } from "../textarea.tsx";

export interface ImportPanelProps {
  /** The lists the file's references resolve against (UI and terminal-only together). */
  themes: readonly TerminalTheme[];
  /** Labels imported themes must not take: custom and base themes. */
  labels: readonly string[];
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
    className: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  },
  renamed: {
    label: "Renamed",
    className: "bg-sky-500/15 text-sky-800 dark:text-sky-200",
  },
  adjusted: {
    label: "Adjusted",
    className: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
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
  onImport,
  error,
  onBack,
}: ImportPanelProps) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  // Rows the user unchecked, by index; a fresh parse checks every row again.
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const reading = useRef(0);
  const statusId = useId();

  useEffect(() => {
    if (text.trim() === "") {
      setResult(null);
      return;
    }
    const timer = setTimeout(() => {
      setResult(parseThemeFile(text, themes, labels));
      setExcluded(new Set());
    }, PARSE_DELAY);
    return () => clearTimeout(timer);
  }, [text, themes, labels]);

  const edit = (next: string) => {
    reading.current++;
    setFileError(null);
    setText(next);
  };

  const readFile = async (file: File | undefined) => {
    if (file === undefined) return;
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

  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void readFile(event.dataTransfer.files[0]);
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
    // biome-ignore lint/a11y/noStaticElementInteractions: dropping a file is a shortcut; Choose file… is the accessible route.
    <div
      className={cn(
        "-m-2 flex flex-col gap-3 rounded-lg p-2",
        dragging && "bg-primary/5 ring-2 ring-primary/40",
      )}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={drop}
    >
      <div className="flex items-center gap-2">
        <h3 className="flex-1 text-sm font-medium">Import themes</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          Back to the theme
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste a theme file, choose one, or drop it on this panel. Nothing is
        added until you import.
      </p>
      <Textarea
        aria-label="Theme file"
        aria-describedby={problem ? statusId : undefined}
        aria-invalid={problem ? true : undefined}
        spellCheck={false}
        placeholder='{ "format": "orz-themes", … }'
        className="field-sizing-fixed h-40 resize-y font-mono text-xs md:text-xs"
        value={text}
        onChange={(event) => edit(event.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInput.current?.click()}
        >
          Choose file…
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="theme-file-input"
          onChange={(event) => {
            void readFile(event.target.files?.[0]);
            // The same file chosen again still fires a change.
            event.target.value = "";
          }}
        />
      </div>
      {problem && (
        <p
          id={statusId}
          role="alert"
          className="text-xs text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)]"
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
          className="text-xs text-[color-mix(in_oklab,var(--destructive),var(--foreground)_65%)]"
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
    </div>
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
      className="flex items-start gap-2.5 rounded-lg border p-2.5"
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary disabled:opacity-50"
        checked={checked}
        disabled={entry.theme === undefined}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <label htmlFor={id} className="min-w-0 flex-1 truncate text-sm">
            {label}
          </label>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
              status.className,
            )}
          >
            {status.label}
          </span>
        </div>
        {entry.messages.map((message) => (
          <p key={message} className="text-xs text-muted-foreground">
            {message}
          </p>
        ))}
      </div>
    </li>
  );
}
