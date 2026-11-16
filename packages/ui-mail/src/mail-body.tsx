import { cn } from "@orz/ui/lib/utils";
import { ImageOffIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

const URL_PATTERN = /https?:\/\/[^\s<>"')\]]*[^\s<>"')\].,;:!?]/g;

function linkify(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(URL_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(line.slice(last, index));
    out.push(
      <a
        key={index}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {match[0]}
      </a>,
    );
    last = index + match[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

function Lines({ text }: { text: string }) {
  const lines = text.replace(/\r?\n$/, "").split(/\r?\n/);
  return lines.map((line, i) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity of their own, and never reorder
      key={i}
      className={cn(line.startsWith(">") && "text-muted-foreground")}
    >
      {linkify(line)}
      {i < lines.length - 1 && "\n"}
    </span>
  ));
}

/**
 * The plain body, monospaced. A flowed body wraps; any other keeps its lines as sent, so a
 * diffstat stays aligned, and scrolls sideways where they run past the width.
 */
export function PlainBody({ text, flowed }: { text: string; flowed: boolean }) {
  if (flowed) {
    return (
      <div className="whitespace-pre-wrap break-words font-mono text-ui-sm">
        <Lines text={text} />
      </div>
    );
  }
  // The frame draws the well; the scroller inside it would paint its lines
  // over a sunken edge of its own.
  return (
    <div className="rounded-frame ring-1 ring-border raymond:rounded-none raymond:bg-(--window) raymond:p-0.5 raymond:shadow-sunken raymond:ring-0">
      <section
        aria-label="Message text"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a region that scrolls sideways takes focus so the keyboard can scroll it
        tabIndex={0}
        className="overflow-x-auto whitespace-pre p-3 font-mono text-ui-sm outline-none focus-visible:focus-ring-inset"
      >
        <Lines text={text} />
      </section>
    </div>
  );
}

/**
 * The HTML body, in a frame that runs no script and loads nothing remote (`prepareHtml` writes the
 * policy into it), as tall as its document so the message scrolls as one.
 */
export function HtmlBody({
  srcdoc,
  remote,
}: {
  srcdoc: string;
  remote: boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `loaded` marks a new document in the frame
  useEffect(() => {
    const root = frameRef.current?.contentDocument?.documentElement;
    if (!root || typeof ResizeObserver === "undefined") return;
    const measure = () => setHeight(root.scrollHeight);
    measure();
    // Images load after the document does, and grow it.
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [loaded]);

  return (
    <div className="flex flex-col gap-2">
      {remote && (
        <p className="flex items-center gap-1.5 text-muted-foreground text-ui-sm">
          <ImageOffIcon className="size-3.5 shrink-0" />
          Remote images and styles in this message aren't loaded.
        </p>
      )}
      <div className="overflow-hidden rounded-frame bg-white ring-1 ring-border raymond:rounded-none raymond:p-0.5 raymond:shadow-sunken raymond:ring-0">
        {/* No allow-scripts, so the message runs nothing, and with that
            allow-same-origin only lets this page read the frame's height.
            @orz/ui-content's htmlContent is the reverse: its files run
            scripts, so it can never be same-origin. */}
        <iframe
          ref={frameRef}
          title="Message"
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={srcdoc}
          onLoad={() => setLoaded((n) => n + 1)}
          className="block min-h-24 w-full bg-white"
          style={height === null ? undefined : { height }}
        />
      </div>
    </div>
  );
}
