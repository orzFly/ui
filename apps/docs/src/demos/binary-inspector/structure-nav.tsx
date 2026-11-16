import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { Skeleton } from "@orz/ui/components/skeleton";
import { Tree, TreeCount, TreeItem, TreeLabel } from "@orz/ui/components/tree";
import { cn } from "@orz/ui/lib/utils";
import { formatOffset } from "@orz/ui-hex";
import { flatten, type Region, type Structure } from "./structure.ts";

/** What the structure panel knows about the open file. */
export type StructureState =
  | { kind: "reading" }
  | { kind: "none" }
  | { kind: "parsed"; structure: Structure };

/**
 * The file's regions as a tree, beside the bytes on a wide screen. A region opens to its fields
 * when the caret moves into it, and stays open until the reader closes it; a click on a region
 * selects its bytes.
 */
export function StructureList({
  state,
  path,
  onPick,
}: {
  state: StructureState;
  /** The regions around the caret, outermost first. */
  path: readonly Region[];
  onPick: (region: Region) => void;
}) {
  if (state.kind === "reading") {
    return (
      <div className="grid gap-2 px-3 py-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (state.kind === "none") {
    return (
      <p className="px-3 py-2 text-muted-foreground text-ui">
        Not a PNG or a ZIP, so there is no structure to show: the bytes are all
        there is.
      </p>
    );
  }
  const { structure } = state;
  return (
    <Tree
      aria-label={structure.format}
      items={structure.regions}
      current={path.at(-1)?.id}
      currentToken="location"
    >
      {(region) => (
        <TreeItem asChild>
          <button type="button" onClick={() => onPick(region)}>
            <TreeLabel className="shrink-0">{region.label}</TreeLabel>
            {region.value && (
              <span className="min-w-0 flex-1 truncate text-ui-sm">
                {region.value}
              </span>
            )}
            <TreeCount className="font-mono">
              {formatOffset(region.offset)}
            </TreeCount>
          </button>
        </TreeItem>
      )}
    </Tree>
  );
}

/** The same regions on a phone: one `Select` above the bytes, every field at once, indented. */
export function StructureSelect({
  state,
  path,
  onPick,
  className,
}: {
  state: StructureState;
  path: readonly Region[];
  onPick: (region: Region) => void;
  className?: string;
}) {
  if (state.kind !== "parsed") return null;
  const items = flatten(state.structure.regions);
  return (
    <Select
      value={path.at(-1)?.id ?? ""}
      onValueChange={(id) => {
        const hit = items.find(({ region }) => region.id === id);
        if (hit) onPick(hit.region);
      }}
    >
      <SelectTrigger
        aria-label={`${state.structure.format} structure`}
        className={cn("min-w-0", className)}
      >
        <SelectValue placeholder={state.structure.format} />
      </SelectTrigger>
      <SelectContent>
        {items.map(({ region, depth }) => (
          <SelectItem key={region.id} value={region.id}>
            <span style={{ paddingLeft: `${depth * 0.875}rem` }}>
              {region.label}
            </span>
            <span className="font-mono text-muted-foreground text-ui-sm">
              {formatOffset(region.offset)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
