import { Button } from "@orz/ui/components/button";
import { Checkbox } from "@orz/ui/components/checkbox";
import { Label } from "@orz/ui/components/label";
import { Pane } from "@orz/ui/components/pane";
import { Textarea } from "@orz/ui/components/textarea";
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
        <Pane
          ref={toolbar}
          purpose="banner"
          edge="bottom"
          className="fixed inset-x-0 top-0 z-10 flex flex-wrap items-center gap-2 p-2"
        >
          {[3, 12, 25, FOLDED, 40].map((n) => (
            <Button
              key={n}
              variant="outline"
              size="sm"
              onClick={() => reveal(n)}
            >
              Reveal {n}
            </Button>
          ))}
          <Label>
            <Checkbox
              checked={mode === "start"}
              onCheckedChange={(checked) =>
                setMode(checked === true ? "start" : "auto")
              }
            />
            Align to top
          </Label>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setComposing((v) => !v)}
          >
            {composing ? "Close composer" : "Open composer"}
          </Button>
        </Pane>
        <main className="grid gap-2 px-4 pt-16 pb-[100vh]">
          {SECTIONS.map((n) => {
            const section = (
              <Pane
                key={n}
                purpose="panel"
                frame="card"
                asChild
                className="p-3"
              >
                <section id={`section-${n}`}>
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
              </Pane>
            );
            return n === FOLDED ? (
              <Pane
                key={n}
                purpose="panel"
                frame="card"
                asChild
                className="p-2"
              >
                <details>
                  <summary>Folded</summary>
                  {section}
                </details>
              </Pane>
            ) : (
              section
            );
          })}
        </main>
        {composing && (
          <Pane
            ref={composer}
            purpose="window"
            docked="bottom"
            className="fixed inset-x-0 bottom-0 p-2"
          >
            <Textarea
              aria-label="Composer"
              placeholder="A composer pinned to the bottom edge"
              className="h-32"
            />
          </Pane>
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
        <Pane
          ref={toolbar}
          purpose="banner"
          edge="bottom"
          className="fixed inset-x-0 top-0 z-10 flex items-center gap-2 p-2"
        >
          <Button variant="outline" size="sm" onClick={() => landOn(20)}>
            Land on 20
          </Button>
          <Button variant="outline" size="sm" onClick={landAtEnd}>
            Land at the end
          </Button>
          <span className="text-muted-foreground">{late} of 6 late images</span>
        </Pane>
        <main className="grid gap-2 px-4 pt-16 [overflow-anchor:none]">
          <Pane
            purpose="panel"
            frame="inset"
            style={{ height: late * 120 }}
            aria-hidden="true"
          />
          {SECTIONS.map((n) => (
            <Pane key={n} purpose="panel" frame="card" asChild className="p-3">
              <section id={`held-${n}`}>Section {n}</section>
            </Pane>
          ))}
        </main>
      </>
    );
  },
};
