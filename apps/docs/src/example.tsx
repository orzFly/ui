import { Button } from "@orz/ui/components/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import {
  type ComponentType,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { Code } from "./code.tsx";
import { exampleSource } from "./example-source.ts";
import { ClientOnly } from "./hydrated.tsx";

type Pointer = "fine" | "coarse";

const POINTERS: { value: Pointer; label: string }[] = [
  { value: "fine", label: "Pointer" },
  { value: "coarse", label: "Touch" },
];

/** Input that opens an overlay: a menu opens on pointerdown or a key, a dialog on the click after. */
const OPENING_INPUT = ["pointerdown", "keydown"];

/**
 * Carry the preview's forced pointer onto the overlays it opens. A menu, a
 * select or a dialog portals to `<body>`, outside the preview, and would
 * follow the device instead. A node added to `<body>` takes the attribute when
 * the last opening input landed in the preview or in an overlay it already
 * tagged, so a menu opened from a dialog follows too; one opened from the rest
 * of the page does not.
 */
function useOverlaysFollow(
  preview: RefObject<HTMLElement | null>,
  pointer: Pointer | undefined,
) {
  useEffect(() => {
    const root = preview.current;
    if (pointer === undefined || root === null) return;
    const tagged = new Set<HTMLElement>();
    let ours = false;
    const onInput = (event: Event) => {
      const target = event.target;
      ours =
        target instanceof Node &&
        (root.contains(target) ||
          [...tagged].some((overlay) => overlay.contains(target)));
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (node instanceof HTMLElement) tagged.delete(node);
        }
        if (!ours) continue;
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          node.dataset.pointer = pointer;
          tagged.add(node);
        }
      }
    });
    observer.observe(document.body, { childList: true });
    for (const type of OPENING_INPUT) {
      document.addEventListener(type, onInput, true);
    }
    return () => {
      observer.disconnect();
      for (const type of OPENING_INPUT) {
        document.removeEventListener(type, onInput, true);
      }
      for (const overlay of tagged) delete overlay.dataset.pointer;
    };
  }, [preview, pointer]);
}

/**
 * A live example and the file it came from. Pointer and Touch force the
 * sizes of either pointer on the preview, and on the overlays it opens,
 * through `data-pointer`; with neither pressed it follows the device.
 *
 * `clientOnly` keeps an example that reads the theme store or `matchMedia`
 * while it renders out of the prerendered page, which cannot know either.
 */
export function Example({
  of: Component,
  clientOnly = false,
}: {
  of: ComponentType;
  clientOnly?: boolean;
}) {
  const source = exampleSource(Component);
  const [pointer, setPointer] = useState<Pointer>();
  const preview = useRef<HTMLDivElement>(null);
  useOverlaysFollow(preview, pointer);
  if (source === undefined) {
    throw new Error(
      `${Component.name}: an example comes from a file under src/examples/`,
    );
  }
  return (
    <Tabs
      defaultValue="preview"
      // A demo's labels and its source would answer searches meant for the prose.
      data-pagefind-ignore
      className="my-6 gap-0 overflow-hidden rounded-xl border"
    >
      {/* Mounted while hidden, so the preview keeps its state across a look at the code. */}
      <TabsContent
        value="preview"
        forceMount
        className="data-[state=inactive]:hidden"
      >
        <div ref={preview} data-pointer={pointer} className="grid gap-3 p-6">
          {clientOnly ? (
            <ClientOnly fallback={<div className="min-h-9" />}>
              <Component />
            </ClientOnly>
          ) : (
            <Component />
          )}
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
