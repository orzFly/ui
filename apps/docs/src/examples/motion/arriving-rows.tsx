import { Button } from "@orz/ui/components/button";
import { useState } from "react";

const STEPS = ["Checkout", "Install", "Build", "Test", "Upload artifacts"];

export function ArrivingRows() {
  const [done, setDone] = useState(1);
  return (
    <div className="grid gap-3">
      <ol className="grid gap-1 text-sm">
        {STEPS.slice(0, done).map((step) => (
          <li
            key={step}
            className="rounded-md bg-muted px-3 py-1.5 animate-in fade-in duration-150 ease-out motion-safe:slide-in-from-top-1"
          >
            {step}
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={done === STEPS.length}
          onClick={() => setDone(done + 1)}
        >
          Next step
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDone(1)}>
          Reset
        </Button>
      </div>
    </div>
  );
}
