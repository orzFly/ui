// Ported from PicoTera (BSD-3-Clause); see NOTICE.
import { Badge } from "@orz/ui/components/badge";
import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@orz/ui/components/dialog";
import { writeClipboard } from "@orz/ui/lib/clipboard";
import { cn } from "@orz/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  BracesIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  TextIcon,
  WrapTextIcon,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { JsonViewLabels } from "./labels.ts";
import {
  formatChars,
  isContainer,
  type JsonKind,
  kindOf,
  parseJsonText,
  prettyJsonOf,
  rawTextOf,
} from "./tree.ts";

/**
 * Characters per rendered segment: large enough that the segment count stays sane, small enough
 * that one wrapped segment is a few lines, not a screenful.
 */
const SEGMENT_SIZE = 2000;

const COPIED_MS = 1500;

const VALUE_CLASS: Record<JsonKind, string> = {
  string: "text-warning",
  number: "text-success",
  boolean: "text-primary",
  null: "text-muted-foreground",
  object: "text-muted-foreground",
  array: "text-muted-foreground",
};

/** A string split on its newlines, then into fixed-size segments. */
export function segmentsOf(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    if (line.length <= SEGMENT_SIZE) {
      out.push(line);
      continue;
    }
    for (let start = 0; start < line.length; start += SEGMENT_SIZE) {
      out.push(line.slice(start, start + SEGMENT_SIZE));
    }
  }
  return out;
}

/** The file a value downloads as: its key, or `value` for the root. */
export function downloadName(path: string, text: boolean): string {
  const name =
    path === "$"
      ? "value"
      : path.split(/[.[]/).pop()?.replace(/["\]]/g, "") || "value";
  return `${name}.${text ? "txt" : "json"}`;
}

/** A Copy button that answers in place: a check for a moment, and "Copied" to a screen reader. */
function CopyButton({
  text,
  label,
  copied: copiedLabel,
  icon,
  disabled,
}: {
  text: () => string | null;
  label: string;
  copied: string;
  icon: ReactNode;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={async () => {
          const value = text();
          if (value === null || !(await writeClipboard(value))) return;
          clearTimeout(timer.current);
          setCopied(true);
          timer.current = setTimeout(() => setCopied(false), COPIED_MS);
        }}
      >
        {copied ? <CheckIcon data-icon="copied" /> : icon}
        {label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {copied ? copiedLabel : ""}
      </span>
    </>
  );
}

/** The object URL a Download link points at, made while the dialog is open and revoked after. */
function useObjectUrl(body: () => string, type: string): string | undefined {
  const [url, setUrl] = useState<string>();
  const read = useRef(body);
  read.current = body;
  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") return;
    const made = URL.createObjectURL(new Blob([read.current()], { type }));
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [type]);
  return url;
}

/** One line of 100 monospace characters, measured on a canvas, over 100. */
function useCharWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(7.2);
  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const ctx = el.ownerDocument.createElement("canvas").getContext?.("2d");
      if (!ctx) return;
      const style = getComputedStyle(el);
      ctx.font = `${style.fontSize} ${style.fontFamily}`;
      const each = ctx.measureText("0".repeat(100)).width / 100;
      if (each > 0) setWidth(each);
    };
    measure();
    document.fonts?.ready.then(measure);
  }, [ref]);
  return width;
}

function TextSegments({ text, wrap }: { text: string; wrap: boolean }) {
  const segments = useMemo(() => segmentsOf(text), [text]);
  const scroller = useRef<HTMLDivElement>(null);
  const charWidth = useCharWidth(scroller);
  const virtualizer = useVirtualizer({
    count: segments.length,
    getScrollElement: () => scroller.current,
    // Wrapped segments are measured, so the estimate only has to be close; unwrapped, each is
    // one line.
    estimateSize: () => (wrap ? 54 : 18),
    overscan: 6,
    initialRect: { width: 800, height: 600 },
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: a wrap flip invalidates every measurement
  useLayoutEffect(() => {
    virtualizer.measure();
  }, [wrap, virtualizer]);
  const width = useMemo(() => {
    if (wrap) return undefined;
    let longest = 0;
    for (const segment of segments) {
      if (segment.length > longest) longest = segment.length;
    }
    return `${Math.ceil(longest * charWidth + 24)}px`;
  }, [wrap, segments, charWidth]);
  return (
    <div
      ref={scroller}
      data-slot="json-inspect-text"
      className="min-h-0 flex-1 overflow-auto bg-background font-mono text-data text-foreground [contain:content] select-text"
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize(), width }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            ref={wrap ? virtualizer.measureElement : undefined}
            data-index={item.index}
            className={cn(
              "absolute top-0 left-0 px-3 leading-[1.5]",
              wrap ? "w-full break-all whitespace-pre-wrap" : "whitespace-pre",
            )}
            style={{ transform: `translateY(${item.start}px)` }}
          >
            {segments[item.index]}
          </div>
        ))}
      </div>
    </div>
  );
}

export interface InspectTarget {
  value: unknown;
  path: string;
}

/**
 * One value on its own, in a dialog: a string's full text, windowed and selectable, a scalar's
 * text, or a container's tree through `renderTree`.
 */
export function InspectDialog({
  target,
  onClose,
  labels,
  renderTree,
}: {
  target: InspectTarget | null;
  onClose: () => void;
  labels: JsonViewLabels;
  renderTree: (value: unknown) => ReactNode;
}) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {target && (
        <InspectContent
          // A new target starts with its own wrap and parse state.
          key={target.path}
          target={target}
          labels={labels}
          renderTree={renderTree}
        />
      )}
    </Dialog>
  );
}

function InspectContent({
  target,
  labels,
  renderTree,
}: {
  target: InspectTarget;
  labels: JsonViewLabels;
  renderTree: (value: unknown) => ReactNode;
}) {
  const { value, path } = target;
  const kind = kindOf(value);
  const container = isContainer(kind);
  const isText = kind === "string";
  const text = typeof value === "string" ? value : "";
  const [wrap, setWrap] = useState(true);
  const [parsed, setParsed] = useState<{ value: unknown } | null>(null);
  const [parseFailed, setParseFailed] = useState(false);
  const pretty = useMemo(
    () => (isText ? null : prettyJsonOf(value, 2)),
    [isText, value],
  );
  const size = isText
    ? text.length
    : Array.isArray(value)
      ? value.length
      : container
        ? Object.keys(value as object).length
        : 0;
  const canParse = isText && /^\s*[[{]/.test(text.slice(0, 1000));
  const url = useObjectUrl(
    () => (isText ? text : (pretty ?? rawTextOf(value))),
    isText ? "text/plain;charset=utf-8" : "application/json;charset=utf-8",
  );
  const showTree = container || parsed !== null;

  return (
    <DialogContent
      data-slot="json-inspect"
      className="h-[min(82dvh,55rem)] gap-0 p-0 sm:max-w-[min(70rem,92vw)]"
    >
      <div className="flex flex-none flex-col gap-1 border-b bg-muted px-4 py-3 pr-12 raymond:border-b-0 raymond:bg-transparent">
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {labels.inspectTitle}
          <Badge
            variant="outline"
            className="font-normal text-muted-foreground"
          >
            {kind}
          </Badge>
          {(isText || container) && (
            <span className="font-mono text-muted-foreground text-ui-xs tabular-nums">
              {isText ? labels.chars(formatChars(size)) : labels.items(size)}
            </span>
          )}
        </DialogTitle>
        <DialogDescription
          className="truncate font-mono text-data text-foreground"
          title={path}
        >
          {path}
        </DialogDescription>
      </div>
      <div className="flex flex-none flex-wrap items-center gap-1 border-b px-3 py-1.5">
        <CopyButton
          text={() => (isText ? text : rawTextOf(value))}
          label={labels.copy}
          copied={labels.copied}
          icon={<CopyIcon />}
        />
        {!isText && (
          <CopyButton
            text={() => pretty}
            label={labels.copyAsJson}
            copied={labels.copied}
            icon={<BracesIcon />}
            disabled={pretty === null}
          />
        )}
        <Button asChild variant="ghost" size="sm">
          <a href={url} download={downloadName(path, isText)}>
            <DownloadIcon />
            {labels.download}
          </a>
        </Button>
        {isText && !showTree && (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={wrap}
            className="aria-pressed:pressed-cue"
            onClick={() => setWrap((on) => !on)}
          >
            <WrapTextIcon />
            {labels.wrap}
          </Button>
        )}
        {canParse && !showTree && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const result = parseJsonText(text);
              setParseFailed(!result.ok);
              if (result.ok) setParsed({ value: result.value });
            }}
          >
            <BracesIcon />
            {labels.parseAsJson}
          </Button>
        )}
        {parsed !== null && (
          <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
            <TextIcon />
            {labels.showText}
          </Button>
        )}
        {parseFailed && (
          <span role="status" className="px-1 text-destructive text-ui-sm">
            {labels.notJson}
          </span>
        )}
      </div>
      {showTree ? (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          {renderTree(container ? value : parsed?.value)}
        </div>
      ) : isText ? (
        <TextSegments text={text} wrap={wrap} />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3 font-mono text-data select-text">
          <span className={VALUE_CLASS[kind]}>{String(value)}</span>
        </div>
      )}
    </DialogContent>
  );
}
