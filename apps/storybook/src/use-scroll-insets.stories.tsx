import {
  holdRevealed,
  landAtBottom,
  type RevealMode,
  revealBlock,
  useOwnHold,
  useScrollInsets,
} from "@orz/ui/hooks/scroll-insets";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useRef, useState } from "react";

const USAGE = `import { revealBlock, useScrollInsets } from "@orz/ui/hooks/scroll-insets";
import { useRef } from "react";

function Page() {
  const toolbar = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLDivElement>(null);
  useScrollInsets({ top: [toolbar], bottom: [composer] });

  const reveal = (id: string) => {
    const el = document.getElementById(id);
    if (el !== null) revealBlock(el, { mode: "auto", behavior: "smooth" });
  };
  return (
    <>
      <div ref={toolbar} className="fixed inset-x-0 top-0">…</div>
      <main>…</main>
      <div ref={composer} className="fixed inset-x-0 bottom-0">…</div>
    </>
  );
}`;

const HELD = `import { holdRevealed, landAtBottom, revealBlock, useOwnHold } from "@orz/ui/hooks/scroll-insets";

function Page() {
  // Lets go of this page's hold when it unmounts.
  const own = useOwnHold();

  const land = (el: HTMLElement) => {
    revealBlock(el);
    // Reveals again as late content resizes the page, until the reader's first input.
    own(holdRevealed(el, document.body));
  };
  const landAtEnd = () => own(landAtBottom());
  …
}`;

const meta = {
  title: "ui/Hooks/useScrollInsets",
  parameters: {
    guidelines: "/guidelines/platforms/touch-and-mobile/",
    layout: "fullscreen",
    // The overlays are position: fixed and the insets land on <html>; drawn
    // inline, they would cover the docs page itself.
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const SECTIONS = Array.from({ length: 40 }, (_, i) => i + 1);
const FOLDED = 30;

/**
 * Every reveal lands between the toolbar and the composer, never under them.
 * Section 30 sits in a closed fold, which opens on the way. Open the composer
 * and reveal again: it is measured the moment it mounts.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const toolbar = useRef<HTMLDivElement>(null);
    const composer = useRef<HTMLDivElement>(null);
    const [composing, setComposing] = useState(false);
    const [mode, setMode] = useState<RevealMode>("auto");
    useScrollInsets({ top: [toolbar], bottom: [composer] });

    const reveal = (n: number) => {
      const el = document.getElementById(`section-${n}`);
      if (el !== null) revealBlock(el, { mode, behavior: "smooth" });
    };

    return (
      <>
        <div
          ref={toolbar}
          className="fixed inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-background p-2"
        >
          {[3, 12, 25, FOLDED, 40].map((n) => (
            <button
              key={n}
              type="button"
              className="rounded-md border px-2"
              onClick={() => reveal(n)}
            >
              Reveal {n}
            </button>
          ))}
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={mode === "start"}
              onChange={(e) => setMode(e.target.checked ? "start" : "auto")}
            />
            Align to top
          </label>
          <button
            type="button"
            className="ml-auto rounded-md border px-2"
            onClick={() => setComposing((v) => !v)}
          >
            {composing ? "Close composer" : "Open composer"}
          </button>
        </div>
        <main className="grid gap-2 px-4 pt-16 pb-[100vh]">
          {SECTIONS.map((n) => {
            const section = (
              <section
                key={n}
                id={`section-${n}`}
                className="rounded-md border p-3"
              >
                Section {n}
                {n % 5 === 0 && (
                  <p className="text-muted-foreground">
                    A taller block, so centring and top alignment differ.
                    <br />
                    <br />
                    <br />
                  </p>
                )}
              </section>
            );
            return n === FOLDED ? (
              <details key={n} className="rounded-md border p-2">
                <summary>Folded</summary>
                {section}
              </details>
            ) : (
              section
            );
          })}
        </main>
        {composing && (
          <div
            ref={composer}
            className="fixed inset-x-0 bottom-0 border-t bg-background p-2"
          >
            <textarea
              aria-label="Composer"
              placeholder="A composer pinned to the bottom edge"
              className="h-32 w-full rounded-md border px-2 py-1"
            />
          </div>
        )}
      </>
    );
  },
};

/**
 * Images arrive late and push a landing away from where it was put. Land on
 * section 20 or on the end, then keep your hands off: every half second a
 * block grows at the top, and the hold keeps the landing in place. The first
 * wheel, touch, click or key lets go, and the page stops moving under you.
 * Scroll anchoring is off here, as on a page that compensates for its own
 * inserts; with it on, Chromium and Firefox would hide what the hold does.
 */
export const HeldLanding: Story = {
  parameters: { docs: { source: { code: HELD, language: "tsx" } } },
  render: function Render() {
    const toolbar = useRef<HTMLDivElement>(null);
    const [late, setLate] = useState(0);
    const own = useOwnHold();
    useScrollInsets({ top: [toolbar] });

    const arrive = () => {
      setLate(0);
      for (let i = 1; i <= 6; i++) {
        window.setTimeout(() => setLate(i), i * 500);
      }
    };
    const landOn = (n: number) => {
      const el = document.getElementById(`held-${n}`);
      if (el === null) return;
      revealBlock(el);
      own(holdRevealed(el, document.body));
      arrive();
    };
    const landAtEnd = () => {
      own(landAtBottom());
      arrive();
    };

    return (
      <>
        <div
          ref={toolbar}
          className="fixed inset-x-0 top-0 z-10 flex items-center gap-2 border-b bg-background p-2"
        >
          <button
            type="button"
            className="rounded-md border px-2"
            onClick={() => landOn(20)}
          >
            Land on 20
          </button>
          <button
            type="button"
            className="rounded-md border px-2"
            onClick={landAtEnd}
          >
            Land at the end
          </button>
          <span className="text-muted-foreground">{late} of 6 late images</span>
        </div>
        <main className="grid gap-2 px-4 pt-16 [overflow-anchor:none]">
          <div
            className="rounded-md bg-muted"
            style={{ height: late * 120 }}
            aria-hidden="true"
          />
          {SECTIONS.map((n) => (
            <section key={n} id={`held-${n}`} className="rounded-md border p-3">
              Section {n}
            </section>
          ))}
        </main>
      </>
    );
  },
};
