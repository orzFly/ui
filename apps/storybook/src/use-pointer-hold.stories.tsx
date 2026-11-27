import { Button } from "@orz/ui/components/button";
import { Pane } from "@orz/ui/components/pane";
import { usePointerHold } from "@orz/ui/hooks/use-pointer-hold";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { withWidth } from "./decorators.tsx";

const USAGE = `import { usePointerHold } from "@orz/ui/hooks/use-pointer-hold";
import { useEffect, useRef, useState } from "react";

function Zoom() {
  const controls = useRef<HTMLDivElement>(null);
  const held = usePointerHold(() => [controls.current]);
  const [zoom, setZoom] = useState(1);
  // Drawn at the zoom it had when the pointer came, until the pointer has gone:
  // the picture growing would push − and + out from under it.
  const [drawn, setDrawn] = useState(zoom);
  useEffect(() => {
    if (!held) setDrawn(zoom);
  }, [held, zoom]);
  return (
    <>
      <div style={{ height: drawn * 40 }}>…</div>
      <div ref={controls}>
        <Button onClick={() => setZoom((z) => z - 1)}>−</Button>
        <Button onClick={() => setZoom((z) => z + 1)}>+</Button>
      </div>
    </>
  );
}`;

const meta = {
  title: "ui/Hooks/usePointerHold",
  parameters: { guidelines: "/guidelines/platforms/desktop-and-pointer/" },
  decorators: [withWidth("max-w-sm")],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Press + a few times: the picture keeps its size while the pointer is on the
 * buttons or near them, so they stay under it, and grows once it has gone.
 */
export const Usage: Story = {
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
  render: function Render() {
    const controls = useRef<HTMLDivElement>(null);
    const held = usePointerHold(() => [controls.current]);
    const [zoom, setZoom] = useState(1);
    const [drawn, setDrawn] = useState(zoom);
    useEffect(() => {
      if (!held) setDrawn(zoom);
    }, [held, zoom]);
    return (
      <div className="grid justify-items-start gap-3">
        <Pane
          purpose="document"
          frame="card"
          className="w-full transition-[height] motion-reduce:transition-none"
          style={{ height: drawn * 40 }}
        />
        <div ref={controls} className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom out"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => z - 1)}
          >
            <MinusIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Zoom in"
            disabled={zoom >= 6}
            onClick={() => setZoom((z) => z + 1)}
          >
            <PlusIcon />
          </Button>
          <span className="text-muted-foreground tabular-nums">
            {zoom}× {held ? "held" : ""}
          </span>
        </div>
      </div>
    );
  },
};
