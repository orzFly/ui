import {
  type RevealMode,
  revealBlock,
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

const meta = {
  title: "ui/Hooks/useScrollInsets",
  parameters: {
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
