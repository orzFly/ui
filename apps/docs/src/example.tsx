import { Button } from "@orz/ui/components/button";
import { ModuleMarker } from "@orz/ui/components/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@orz/ui/components/tabs";
import { cn } from "@orz/ui/lib/utils";
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

export type Pointer = "fine" | "coarse";

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
export function useOverlaysFollow(
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
      className="my-6 gap-0 overflow-hidden rounded-surface border"
    >
      {/* A module's ruled header: its marker and name, then the tabs joined to the frame below. */}
      <div className="flex flex-wrap items-stretch border-b bg-muted">
        <div className="flex min-h-control items-center gap-2 px-3">
          <ModuleMarker />
          <span className="hidden font-mono text-ui-sm text-muted-foreground sm:inline">
            {source.file}
          </span>
        </div>
        <TabsList className="border-b-0 bg-transparent">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        <PointerToggle
          pointer={pointer}
          onChange={setPointer}
          className="ml-auto items-center px-1.5 py-0.5"
        />
      </div>
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
        <Code lang="tsx" contents={source.source.trimEnd()} />
      </TabsContent>
    </Tabs>
  );
}

/** A pressed toggle: a box in the page's colour, ringed by `pressed-cue`. */
export const PRESSED =
  "aria-pressed:bg-background aria-pressed:font-medium aria-pressed:text-foreground aria-pressed:pressed-cue";

/** Pointer and Touch: press one to force its sizes, press it again to follow the device. */
export function PointerToggle({
  pointer,
  onChange,
  className,
}: {
  pointer: Pointer | undefined;
  onChange: (pointer: Pointer | undefined) => void;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex gap-1", className)}>
      <legend className="sr-only">Preview sizes for</legend>
      {POINTERS.map(({ value, label }) => (
        <Button
          key={value}
          variant="ghost"
          size="sm"
          className={PRESSED}
          aria-pressed={pointer === value}
          onClick={() => onChange(pointer === value ? undefined : value)}
        >
          {label}
        </Button>
      ))}
    </fieldset>
  );
}
