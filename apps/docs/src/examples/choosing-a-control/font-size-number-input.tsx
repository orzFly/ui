import { Label } from "@orz/ui/components/label";
import { NumberInput } from "@orz/ui/components/number-input";
import { Pane } from "@orz/ui/components/pane";
import { useState } from "react";

export function FontSizeNumberInput() {
  const [fontSize, setFontSize] = useState(13);
  return (
    <div className="grid max-w-md gap-3">
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="fs-font-size">Font size</Label>
        <div className="flex items-center gap-2">
          <NumberInput
            id="fs-font-size"
            min={11}
            max={20}
            value={fontSize}
            onValueChange={setFontSize}
            aria-describedby="fs-font-size-unit"
            className="w-20"
          />
          <span
            id="fs-font-size-unit"
            className="text-muted-foreground text-ui"
          >
            px
          </span>
        </div>
      </div>
      <Pane purpose="document" frame="inset">
        <pre
          className="overflow-x-auto p-3 font-mono leading-[1.6]"
          style={{ fontSize }}
        >
          <code>{"function greet(name) {"}</code>
        </pre>
      </Pane>
    </div>
  );
}
