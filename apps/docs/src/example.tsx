import { Button } from "@orz/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { type ComponentType, useState } from "react";
import { Code } from "./code.tsx";
import { exampleSource } from "./example-source.ts";

type Pointer = "fine" | "coarse";

const POINTERS: { value: Pointer; label: string }[] = [
  { value: "fine", label: "Pointer" },
  { value: "coarse", label: "Touch" },
];

/**
 * A live example and the file it came from. Pointer and Touch force the
 * sizes of either pointer on the preview through `data-pointer`; with
 * neither pressed it follows the device.
 */
export function Example({ of: Component }: { of: ComponentType }) {
  const source = exampleSource(Component);
  const [pointer, setPointer] = useState<Pointer>();
  if (source === undefined) {
    throw new Error(
      `${Component.name}: an example comes from a file under src/examples/`,
    );
  }
  return (
    <Tabs
      defaultValue="preview"
      className="my-6 gap-0 overflow-hidden rounded-xl border"
    >
      {/* Mounted while hidden, so the preview keeps its state across a look at the code. */}
      <TabsContent
        value="preview"
        forceMount
        className="data-[state=inactive]:hidden"
      >
        <div data-pointer={pointer} className="grid gap-3 p-6">
          <Component />
        </div>
      </TabsContent>
      <TabsContent value="code" className="max-h-[32rem] overflow-auto">
        <Code lang="tsx" contents={source.trimEnd()} />
      </TabsContent>
      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-2 py-1.5">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        <fieldset className="ml-auto flex gap-1">
          <legend className="sr-only">Preview sizes for</legend>
          {POINTERS.map(({ value, label }) => (
            <Button
              key={value}
              variant={pointer === value ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={pointer === value}
              onClick={() => setPointer(pointer === value ? undefined : value)}
            >
              {label}
            </Button>
          ))}
        </fieldset>
      </div>
    </Tabs>
  );
}
