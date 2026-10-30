import castText from "@orz/fixtures/asciinema/session.cast?raw";
import { CI_RUN } from "@orz/fixtures/ci-run.ts";
import seriesText from "@orz/fixtures/patch/series.patch?raw";
import { TASKS } from "@orz/fixtures/tasks.ts";
import { Badge } from "@orz/ui/components/badge";
import { MediaControls } from "@orz/ui/components/media-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";
import { cn } from "@orz/ui/lib/utils";
import { AnsiView } from "@orz/ui-ansi";
import { stripAnsi } from "@orz/ui-ansi/parse";
import { AsciinemaPlayer, type CastInfo, scanCast } from "@orz/ui-asciinema";
import { PatchView } from "@orz/ui-code";
import {
  ArrowRightIcon,
  FileDiffIcon,
  PlayIcon,
  SquareCheckIcon,
  SquareTerminalIcon,
} from "lucide-react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { taskKey } from "../demos/tasks/board.ts";
import { StatusDot } from "../demos/tasks/parts.tsx";
import { ClientOnly } from "../hydrated.tsx";
import { Link } from "../router.tsx";
import { useFirstInView } from "./in-view.ts";
import { HomeModule } from "./module.tsx";

/**
 * The working row's viewer bodies: one height below lg, and at lg the row's,
 * which the terminal sets. Their contents fill it absolutely, so the fallback
 * and the viewer hold the same box.
 */
const VIEWER_BODY = "relative h-64 lg:h-auto lg:min-h-64 lg:flex-1";

function DemoLink({ to }: { to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      Open the demo
      <ArrowRightIcon aria-hidden className="size-3.5" />
    </Link>
  );
}

const OPEN_TASKS = TASKS.filter((task) => task.status !== "closed").slice(0, 5);

export function TasksModule({ className }: { className?: string }) {
  const [selected, setSelected] = useState(OPEN_TASKS[0]?.id);
  return (
    <HomeModule
      icon={<SquareCheckIcon />}
      title="Tasks"
      api={["ui/Primitives/Table", "ui/Primitives/Badge"]}
      action={<DemoLink to="/demos/tasks/" />}
      className={className}
    >
      <Table data-pagefind-ignore>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-px pl-3">Task</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-px max-sm:hidden">Status</TableHead>
            <TableHead className="w-px pr-3 max-md:hidden lg:max-xl:hidden">
              Assignee
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {OPEN_TASKS.map((task) => (
            <TableRow
              key={task.id}
              tabIndex={0}
              aria-selected={task.id === selected}
              data-state={task.id === selected ? "selected" : undefined}
              className="cursor-default outline-none focus-visible:focus-ring-inset touch:h-11"
              onClick={() => setSelected(task.id)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                setSelected(task.id);
              }}
            >
              <TableCell className="pl-3 font-mono text-muted-foreground">
                {taskKey(task.id)}
              </TableCell>
              <TableCell className="max-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{task.title}</span>
                  {task.labels.map((label) => (
                    <Badge key={label} variant="outline">
                      {label}
                    </Badge>
                  ))}
                </span>
              </TableCell>
              <TableCell className="max-sm:hidden">
                <StatusDot status={task.status} />
              </TableCell>
              <TableCell className="pr-3 text-muted-foreground max-md:hidden lg:max-xl:hidden">
                {task.assignee ?? "Nobody"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </HomeModule>
  );
}

const FAILED_JOB = (() => {
  const job = CI_RUN.jobs.find((candidate) => candidate.status === "failed");
  if (!job) throw new Error("CI_RUN has no failed job");
  return job;
})();

/** Keeps a log's scroller at its end while its lines arrive, until the reader takes over. */
function useScrolledToEnd(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scroller = ref.current?.querySelector("section");
    if (!scroller) return;
    const toEnd = () => {
      scroller.scrollTop = scroller.scrollHeight;
    };
    const observer = new ResizeObserver(toEnd);
    for (const child of scroller.children) observer.observe(child);
    observer.observe(scroller);
    const stop = () => observer.disconnect();
    for (const type of ["pointerdown", "wheel", "keydown"]) {
      scroller.addEventListener(type, stop, { once: true, passive: true });
    }
    return () => {
      stop();
      for (const type of ["pointerdown", "wheel", "keydown"]) {
        scroller.removeEventListener(type, stop);
      }
    };
  }, [ref]);
}

function CiLogView() {
  const ref = useRef<HTMLDivElement>(null);
  useScrolledToEnd(ref);
  return (
    <div ref={ref} className="absolute inset-0">
      <AnsiView
        text={FAILED_JOB.log}
        chrome="pane"
        maxHeight="100%"
        className="h-full rounded-none ring-0"
      />
    </div>
  );
}

/**
 * What the prerendered page shows in a viewer's place: its text, from the
 * start or, for a log that rests at its end, from the end.
 */
function PlainFallback({
  text,
  end = false,
  className,
}: {
  text: string;
  end?: boolean;
  className?: string;
}) {
  return (
    <pre
      className={cn(
        "absolute inset-0 flex flex-col overflow-hidden px-3 py-2 font-mono text-ui-sm",
        end && "justify-end",
        className,
      )}
    >
      {text}
    </pre>
  );
}

export function CiLogModule({ className }: { className?: string }) {
  return (
    <HomeModule
      icon={<SquareTerminalIcon />}
      title={`${CI_RUN.workflow} #${CI_RUN.id} · ${FAILED_JOB.name}`}
      api={["ui-ansi/AnsiView"]}
      action={<DemoLink to="/demos/pull-request/" />}
      className={className}
    >
      <div className={VIEWER_BODY} data-pagefind-ignore>
        <ClientOnly
          fallback={
            <PlainFallback
              text={stripAnsi(FAILED_JOB.log)}
              end
              className="bg-terminal-background text-terminal-foreground"
            />
          }
        >
          <CiLogView />
        </ClientOnly>
      </div>
    </HomeModule>
  );
}

const DIFF_FILE = "src/fetch-task.ts";

/** The file's diff, cut out of the series: from its `diff --git` line to the next one. */
const FILE_DIFF = (() => {
  const start = seriesText.indexOf(`diff --git a/${DIFF_FILE} `);
  if (start < 0) throw new Error(`series.patch does not touch ${DIFF_FILE}`);
  const end = seriesText.indexOf("\ndiff --git", start);
  return seriesText.slice(start, end < 0 ? undefined : end + 1);
})();

/** The subject of the commit that changes the file, as `git format-patch` wrote it. */
const DIFF_SUBJECT = (() => {
  const mail = seriesText.slice(0, seriesText.indexOf(FILE_DIFF));
  const subject = [
    ...mail.matchAll(/^Subject: (?:\[PATCH[^\]]*\]\s*)?(.*)$/gm),
  ].at(-1)?.[1];
  if (!subject) throw new Error(`series.patch: no subject above ${DIFF_FILE}`);
  return subject;
})();

export function DiffModule({ className }: { className?: string }) {
  const [bar, setBar] = useState<HTMLElement | null>(null);
  return (
    <HomeModule
      icon={<FileDiffIcon />}
      title={DIFF_SUBJECT}
      api={["ui-code/PatchView"]}
      action={<span ref={setBar} className="contents" />}
      className={className}
    >
      <div className={VIEWER_BODY} data-pagefind-ignore>
        <ClientOnly fallback={<PlainFallback text={FILE_DIFF} />}>
          <div className="absolute inset-0 overflow-auto">
            <PatchView filename={DIFF_FILE} text={FILE_DIFF} titleBar={bar} />
          </div>
        </ClientOnly>
      </div>
    </HomeModule>
  );
}

const CAST = (() => {
  const info = scanCast(castText);
  if ("error" in info) throw new Error(`session.cast: ${info.error}`);
  return info;
})();

/** The cast's screen once every event has printed, as text. */
function lastFrame(cast: string, info: CastInfo): string {
  const output = cast
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line) as [number, string, string])
    .filter(([, kind]) => kind === "o")
    .map(([, , data]) => data)
    .join("");
  return stripAnsi(output).split("\n").slice(-info.rows).join("\n");
}

const LAST_FRAME = lastFrame(castText, CAST);

/** The player's box before it loads: the screen at its own proportions, the bar below. */
function TerminalFallback() {
  return (
    <div className="bg-terminal-background">
      <div
        className="@container overflow-hidden"
        style={{ aspectRatio: `${CAST.cols * 0.6} / ${CAST.rows * (4 / 3)}` }}
      >
        <pre
          className="px-[1cqw] font-mono text-terminal-foreground"
          style={{
            fontSize: `calc(98cqw / ${CAST.cols * 0.6})`,
            lineHeight: 4 / 3,
          }}
        >
          {LAST_FRAME}
        </pre>
      </div>
      <MediaControls
        playing={false}
        time={0}
        duration={CAST.duration}
        markers={CAST.markers}
        speed={1}
        disabled
        onToggle={() => {}}
        onSeek={() => {}}
        onSpeed={() => {}}
      />
    </div>
  );
}

/** Mounts the player the first time it scrolls into view, playing unless motion is reduced. */
function TerminalView() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useFirstInView(ref);
  const [autoPlay, setAutoPlay] = useState<boolean>();
  useEffect(() => {
    if (inView) {
      setAutoPlay(!matchMedia("(prefers-reduced-motion: reduce)").matches);
    }
  }, [inView]);
  return (
    <div ref={ref}>
      {autoPlay === undefined ? (
        <TerminalFallback />
      ) : (
        <AsciinemaPlayer
          cast={castText}
          autoPlay={autoPlay}
          className="rounded-none ring-0"
        />
      )}
    </div>
  );
}

export function TerminalModule({ className }: { className?: string }) {
  return (
    <HomeModule
      icon={<PlayIcon />}
      title={CAST.title ?? "Terminal recording"}
      api={["ui-asciinema/AsciinemaPlayer"]}
      className={className}
    >
      <div data-pagefind-ignore>
        <ClientOnly fallback={<TerminalFallback />}>
          <TerminalView />
        </ClientOnly>
      </div>
    </HomeModule>
  );
}
