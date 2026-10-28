import { NOTES, type Note } from "@orz/fixtures/notes.ts";
import { Button } from "@orz/ui/components/button";
import { Skeleton } from "@orz/ui/components/skeleton";
import { useEffect, useRef, useState } from "react";

const SKELETON_AFTER_MS = 500;

const titleOf = (note: Note) => /^# (.+)$/m.exec(note.body)?.[1] ?? "Untitled";
const openingOf = (note: Note) =>
  note.body.split("\n\n")[1]?.replace(/\s#[\w-]+/g, "") ?? "";

const OPENS = [
  { id: "retry-design", takes: 200 },
  { id: "job-states", takes: 2000 },
].flatMap(({ id, takes }) => {
  const note = NOTES.find((each) => each.id === id);
  return note ? [{ note, takes }] : [];
});

export function DelayedSkeleton() {
  const [shown, setShown] = useState(OPENS[0]?.note);
  const [skeleton, setSkeleton] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const open = (note: Note, takes: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [
      window.setTimeout(() => setSkeleton(true), SKELETON_AFTER_MS),
      window.setTimeout(() => {
        timers.current.forEach(clearTimeout);
        setSkeleton(false);
        setShown(note);
      }, takes),
    ];
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {OPENS.map(({ note, takes }) => (
          <Button
            key={note.id}
            variant="outline"
            onClick={() => open(note, takes)}
          >
            {titleOf(note)}, in {takes / 1000} s
          </Button>
        ))}
      </div>
      <article
        aria-busy={skeleton}
        className="grid min-h-32 content-start gap-2 rounded-lg border p-4"
      >
        {skeleton ? (
          <>
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </>
        ) : (
          shown && (
            <>
              <h3 className="font-semibold text-lg">{titleOf(shown)}</h3>
              <p className="text-sm">{openingOf(shown)}</p>
            </>
          )
        )}
      </article>
    </div>
  );
}
