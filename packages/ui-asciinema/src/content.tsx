import { Button } from "@orz/ui/components/button";
import {
  ContentFallback,
  type ContentProps,
  type ContentRenderer,
  type ContentSource,
  useSourceText,
} from "@orz/ui-content";
import { Download } from "lucide-react";
import { type ComponentType, useMemo } from "react";
import { AsciinemaPlayer } from "./asciinema-player.tsx";
import { isCastError, scanCast } from "./cast.ts";

/**
 * Above this a cast is offered as a download instead: the player parses the whole recording up
 * front, which at 16 MiB already takes about a second.
 */
export const CAST_MAX_BYTES = 16 * 1024 * 1024;

type FileSource = Extract<ContentSource, { kind: "file" }>;
type CastProps = ContentProps & {
  source: FileSource;
  Next: ComponentType<ContentProps>;
};

function isCast(source: ContentSource): boolean {
  if (source.kind === "inline") return false;
  return (
    /\.cast$/i.test(source.name) ||
    source.mime?.toLowerCase() === "application/x-asciicast"
  );
}

function TooLargeCast({ source, placement, className }: ContentProps) {
  return (
    <div className={className}>
      <ContentFallback source={source} placement={placement} />{" "}
      <span>Too large to preview — download to view.</span>
    </div>
  );
}

function CastHeader({ source, title }: { source: FileSource; title?: string }) {
  return (
    <div className="flex items-center gap-2 border-b bg-card py-1 pr-1 pl-3 text-card-foreground text-xs">
      <span className="min-w-0 flex-1 truncate" title={source.name}>
        {title ?? source.name}
      </span>
      {source.url !== undefined && (
        <Button asChild size="xs" variant="ghost">
          <a href={source.url} download={source.name}>
            <Download />
            Download
          </a>
        </Button>
      )}
    </div>
  );
}

function LoadedCast({ source, placement, className, Next }: CastProps) {
  const text = useSourceText(source);
  const scan = useMemo(
    () => (text.status === "ready" ? scanCast(text.text) : undefined),
    [text.status, text.text],
  );
  if (text.status === "loading") {
    return (
      <ContentFallback
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  if (text.status === "error") {
    return (
      <div className={className}>
        <ContentFallback source={source} placement={placement} />{" "}
        <span>{text.error.message}</span>{" "}
        <Button size="xs" variant="outline" onClick={text.retry}>
          Retry
        </Button>
      </div>
    );
  }
  // UTF-16 units, not bytes; a cast is JSON-escaped and almost all ASCII.
  if (text.text.length > CAST_MAX_BYTES) {
    return (
      <TooLargeCast
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  if (scan === undefined || isCastError(scan)) {
    // A broken recording still offers what the renderers after this one
    // make of the file: a download link, at least.
    return (
      <div className={className}>
        <Next source={source} placement={placement} />
        {scan !== undefined && (
          <p className="text-muted-foreground text-xs">{scan.error}</p>
        )}
      </div>
    );
  }
  return (
    <AsciinemaPlayer
      cast={text.text}
      header={<CastHeader source={source} title={scan.title} />}
      className={className}
    />
  );
}

function Cast(props: ContentProps & { Next: ComponentType<ContentProps> }) {
  const { source, placement, className } = props;
  if (source.kind !== "file") return null;
  if (source.size !== undefined && source.size > CAST_MAX_BYTES) {
    return (
      <TooLargeCast
        source={source}
        placement={placement}
        className={className}
      />
    );
  }
  return <LoadedCast {...props} source={source} />;
}

/**
 * The registry entry for asciinema recordings: a `.cast` file, or one typed
 * `application/x-asciicast`, in either placement. Register it ahead of any renderer that would
 * take a `.cast` as text.
 */
export const asciinemaContent: ContentRenderer = {
  name: "asciinema",
  accepts: isCast,
  display: "block",
  Component: Cast,
};
