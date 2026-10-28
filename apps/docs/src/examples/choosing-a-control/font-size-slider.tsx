import { Label } from "@orz/ui/components/label";
import { Slider } from "@orz/ui/components/slider";
import { useState } from "react";

export function FontSizeSlider() {
  const [fontSize, setFontSize] = useState(13);
  return (
    <div className="grid max-w-md gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <Label id="fs-font-size">Font size</Label>
        <span className="text-muted-foreground text-sm tabular-nums">
          {fontSize}px
        </span>
      </div>
      <Slider
        aria-labelledby="fs-font-size"
        min={11}
        max={20}
        value={[fontSize]}
        onValueChange={([next]) => setFontSize(next ?? fontSize)}
      />
      <pre
        className="overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono leading-[1.6]"
        style={{ fontSize }}
      >
        <code>{"function greet(name) {"}</code>
      </pre>
    </div>
  );
}
