import {
  type AnyCustomTheme,
  isCustomTerminalTheme,
  type TerminalTheme,
} from "@orz/themes";
import { ChevronDownIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "../button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../dropdown-menu.tsx";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../select.tsx";
import { composeDraft } from "./draft.ts";

type Kind = "ui" | "terminal";

export interface ThemeListProps {
  /** The store's custom themes of the kinds this editor offers, in its order. */
  customs: readonly AnyCustomTheme[];
  /** The kinds this store offers, UI first; with both, the list groups them and New asks which. */
  kinds: readonly Kind[];
  /** The draft in the form; listed last in its group when the store does not hold it (new, or deleted elsewhere). */
  draft: AnyCustomTheme;
  dirty: boolean;
  /** The base lists, to flag themes that no longer compose. */
  themes: readonly TerminalTheme[];
  onSelect: (id: string) => void;
  onNew: (kind: Kind) => void;
  onImport: () => void;
  exportAllDisabled: boolean;
  onExportAll: () => void;
}

export const displayLabel = (label: string) => label.trim() || "Untitled theme";

const GROUP_LABEL: Record<Kind, string> = {
  ui: "Themes",
  terminal: "Terminal themes",
};
const NEW_LABEL: Record<Kind, string> = {
  ui: "Theme",
  terminal: "Terminal theme",
};
const kindOf = (custom: AnyCustomTheme): Kind =>
  isCustomTerminalTheme(custom) ? "terminal" : "ui";

/** The header: which custom theme the form edits, and the list-wide actions. */
export function ThemeList({
  customs,
  kinds,
  draft,
  dirty,
  themes,
  onSelect,
  onNew,
  onImport,
  exportAllDisabled,
  onExportAll,
}: ThemeListProps) {
  const entries = customs.some((c) => c.id === draft.id)
    ? customs
    : [...customs, draft];
  const groups = kinds.map((kind) => ({
    kind,
    entries: entries.filter((c) => kindOf(c) === kind),
  }));
  const grouped = kinds.length > 1;

  const item = (custom: AnyCustomTheme) => {
    const current = custom.id === draft.id;
    const unavailable = composeDraft(custom, themes) === null;
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
            className="text-warning"
          >
            <TriangleAlertIcon aria-hidden className="size-3.5" />
            <span className="sr-only">(base missing)</span>
          </span>
        )}
      </SelectItem>
    );
  };

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
          {grouped
            ? groups
                .filter((g) => g.entries.length > 0)
                .map((g) => (
                  <SelectGroup key={g.kind}>
                    <SelectLabel>{GROUP_LABEL[g.kind]}</SelectLabel>
                    {g.entries.map(item)}
                  </SelectGroup>
                ))
            : entries.map(item)}
        </SelectContent>
      </Select>
      {grouped ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <PlusIcon aria-hidden />
              New
              <ChevronDownIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {kinds.map((kind) => (
              <DropdownMenuItem key={kind} onSelect={() => onNew(kind)}>
                {NEW_LABEL[kind]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onNew(kinds[0] ?? "ui")}
        >
          <PlusIcon aria-hidden />
          New
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={onImport}>
        Import…
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={exportAllDisabled}
        onClick={onExportAll}
      >
        Export all
      </Button>
    </div>
  );
}
