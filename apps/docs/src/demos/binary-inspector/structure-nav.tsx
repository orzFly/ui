import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@orz/ui/components/select";
import { Skeleton } from "@orz/ui/components/skeleton";
import { cn } from "@orz/ui/lib/utils";
import { formatOffset } from "@orz/ui-hex";
import { flatten, type Region, type Structure } from "./structure.ts";

/** What the structure panel knows about the open file. */
export type StructureState =
  | { kind: "reading" }
  | { kind: "none" }
  | { kind: "parsed"; structure: Structure };

/**
 * The file's regions as a list, beside the bytes on a wide screen. A region opens to its fields
 * while the caret is inside it, so the list follows the caret as it moves, and a click on a
 * region selects its bytes.
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
      <p className="px-3 py-2 text-muted-foreground text-sm">
        Not a PNG or a ZIP, so there is no structure to show: the bytes are all
        there is.
      </p>
    );
  }
  return (
    <RegionList
      regions={state.structure.regions}
      path={path}
      depth={0}
      onPick={onPick}
      aria-label={state.structure.format}
    />
  );
}

function RegionList({
  regions,
  path,
  depth,
  onPick,
  "aria-label": ariaLabel,
}: {
  regions: readonly Region[];
  path: readonly Region[];
  depth: number;
  onPick: (region: Region) => void;
  "aria-label"?: string;
}) {
  const current = path.at(-1);
  return (
    <ul aria-label={ariaLabel} className="grid gap-px">
      {regions.map((region) => {
        const open = path[depth] === region;
        return (
          <li key={region.id}>
            <button
              type="button"
              aria-current={region === current ? "location" : undefined}
              aria-expanded={region.children ? open : undefined}
              onClick={() => onPick(region)}
              style={{ paddingLeft: `${0.75 + depth * 0.875}rem` }}
              className={cn(
                "flex min-h-7 w-full items-center gap-2 rounded-md pr-2 text-left text-sm transition-colors hover:bg-accent aria-[current]:bg-accent aria-[current]:font-medium touch:min-h-11",
                depth > 0 &&
                  "text-muted-foreground aria-[current]:text-foreground",
              )}
            >
              <span className="shrink-0">{region.label}</span>
              {region.value && (
                <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">
                  {region.value}
                </span>
              )}
              <span className="ml-auto shrink-0 font-mono text-muted-foreground text-xs tabular-nums">
                {formatOffset(region.offset)}
              </span>
            </button>
            {open && region.children && (
              <RegionList
                regions={region.children}
                path={path}
                depth={depth + 1}
                onPick={onPick}
              />
            )}
          </li>
        );
      })}
    </ul>
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
            <span className="font-mono text-muted-foreground text-xs">
              {formatOffset(region.offset)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
