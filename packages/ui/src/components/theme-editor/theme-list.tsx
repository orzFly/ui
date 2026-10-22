import {
  type CustomTheme,
  composeTheme,
  type TerminalTheme,
} from "@orz/themes";
import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "../button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../select.tsx";

export interface ThemeListProps {
  /** The store's custom themes, in its order. */
  customs: readonly CustomTheme[];
  /** The draft in the form; listed last when the store does not hold it (new, or deleted elsewhere). */
  draft: CustomTheme;
  dirty: boolean;
  /** The base lists, to flag themes that no longer compose. */
  themes: readonly TerminalTheme[];
  onSelect: (id: string) => void;
  onNew: () => void;
  onImport: () => void;
  onExportAll: () => void;
}

export const displayLabel = (label: string) => label.trim() || "Untitled theme";

/** The header: which custom theme the form edits, and the list-wide actions. */
export function ThemeList({
  customs,
  draft,
  dirty,
  themes,
  onSelect,
  onNew,
  onImport,
  onExportAll,
}: ThemeListProps) {
  const entries = customs.some((c) => c.id === draft.id)
    ? customs
    : [...customs, draft];
  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={draft.id}
        onValueChange={(id) => {
          if (id !== draft.id) onSelect(id);
        }}
      >
        <SelectTrigger
          aria-label="Custom theme"
          size="sm"
          className="min-w-0 flex-1"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {entries.map((custom) => {
            const current = custom.id === draft.id;
            const unavailable = composeTheme(custom, themes) === null;
            return (
              <SelectItem key={custom.id} value={custom.id}>
                <span className="truncate">
                  {displayLabel(current ? draft.label : custom.label)}
                </span>
                {current && dirty && (
                  <span
                    data-unsaved
                    title="Unsaved changes"
                    className="size-1.5 shrink-0 rounded-full bg-primary"
                  >
                    <span className="sr-only">(unsaved)</span>
                  </span>
                )}
                {unavailable && (
                  <span
                    data-unavailable
                    title="Its base themes are missing, so the theme menu does not show it."
                    className="text-amber-700 dark:text-amber-300"
                  >
                    <TriangleAlertIcon aria-hidden className="size-3.5" />
                    <span className="sr-only">(base missing)</span>
                  </span>
                )}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="sm" onClick={onNew}>
        <PlusIcon aria-hidden />
        New
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onImport}>
        Import…
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={customs.length === 0}
        onClick={onExportAll}
      >
        Export all
      </Button>
    </div>
  );
}
