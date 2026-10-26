import {
  useVisualViewportInsets,
  VIEWPORT_CHROME_EVENT,
  visualViewportInsets,
} from "@orz/ui/hooks/viewport-chrome";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

const USAGE = `import { useVisualViewportInsets } from "@orz/ui/hooks/viewport-chrome";

function App() {
  // Once, at the root: publishes --vv-top and --vv-bottom on <html>.
  useVisualViewportInsets();
  return (
    <>
      <header className="sticky" style={{ top: "var(--vv-top, 0px)" }}>…</header>
      <main>…</main>
      <div className="sticky" style={{ bottom: "var(--vv-bottom, 0px)" }}>
        <textarea />
      </div>
    </>
  );
}`;

const meta = {
  title: "ui/Hooks/useVisualViewportInsets",
  parameters: {
    layout: "fullscreen",
    // The edges are sticky and the offsets land on <html>; drawn inline,
    // they would ride the docs page itself.
    docs: { story: { inline: false, iframeHeight: 480 } },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const PARAGRAPHS = Array.from({ length: 30 }, (_, i) => i + 1);

/**
 * Open this on a phone and focus the box: the keyboard shrinks only the visual
 * viewport, and the bar rides its bottom edge instead of sinking behind the
 * keyboard. Drag the page with the keyboard up, and the header stays on
 * screen. On a desktop both offsets stay at zero.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    useVisualViewportInsets();
    const [edges, setEdges] = useState(visualViewportInsets);
    useEffect(() => {
      const follow = () => setEdges(visualViewportInsets());
      window.addEventListener(VIEWPORT_CHROME_EVENT, follow);
      return () => window.removeEventListener(VIEWPORT_CHROME_EVENT, follow);
    }, []);
    return (
      <>
        <header
          className="sticky z-10 border-b bg-background p-2"
          style={{ top: "var(--vv-top, 0px)" }}
        >
          --vv-top: <strong>{edges.top}px</strong> · --vv-bottom:{" "}
          <strong>{edges.bottom}px</strong>
        </header>
        <main className="grid gap-2 p-4">
          {PARAGRAPHS.map((n) => (
            <p key={n}>Paragraph {n}</p>
          ))}
        </main>
        <div
          className="sticky border-t bg-background p-2"
          style={{ bottom: "var(--vv-bottom, 0px)" }}
        >
          <textarea
            aria-label="Composer"
            placeholder="Focus me on a phone"
            className="h-16 w-full rounded-md border px-2 py-1 text-base"
          />
        </div>
      </>
    );
  },
};
