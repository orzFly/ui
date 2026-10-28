import { Button } from "@orz/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@orz/ui/components/dialog";
import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@orz/ui/components/tooltip";
import { type ComponentProps, type ReactNode, useEffect, useRef } from "react";
import { setShortcutsEnabled, useShortcutsEnabled } from "../../shortcuts.ts";

/** The keys, as `KeyboardEvent.key` spells them, and what each does. */
export const KEYS = {
  next: { key: "j", label: "Next conversation" },
  previous: { key: "k", label: "Previous conversation" },
  open: { key: "o", label: "Open conversation" },
  back: { key: "u", label: "Back to the list" },
  select: { key: "x", label: "Select conversation" },
  archive: { key: "e", label: "Archive" },
  trash: { key: "#", label: "Delete" },
  star: { key: "s", label: "Star" },
  unread: { key: "U", label: "Mark as unread" },
  read: { key: "I", label: "Mark as read" },
  compose: { key: "c", label: "Compose" },
  reply: { key: "r", label: "Reply" },
  help: { key: "?", label: "Keyboard shortcuts" },
} as const;

export type KeyAction = keyof typeof KEYS;

/**
 * How a key is printed: the capitals are typed with Shift, which an Apple keyboard prints as ⇧.
 * Only tooltips and the open dialog print one, so the prerender never needs to know.
 */
const printed = (key: string) => {
  if (key === key.toLowerCase()) return key.toUpperCase();
  const apple = /mac|iphone|ipad/i.test(navigator.platform);
  return apple ? `⇧${key}` : `Shift ${key}`;
};

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      data-slot="kbd"
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border bg-muted px-1 font-mono text-[0.7rem] text-muted-foreground"
    >
      {children}
    </kbd>
  );
}

/** Where a single key must not act: the reader is typing, or a dialog or menu has the keys. */
function isElsewhere(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  if (el.isContentEditable) return true;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return true;
  return el.closest("[role=dialog],[role=menu],[role=listbox]") !== null;
}

/**
 * Mail's single-key shortcuts, bound while the site's own setting allows them: WCAG 2.1.4 asks
 * that keys which archive and delete can be turned off, and the reader turns them off once.
 */
export function useMailKeys(onKey: (action: KeyAction) => void) {
  const enabled = useShortcutsEnabled();
  const handler = useRef(onKey);
  useEffect(() => {
    handler.current = onKey;
  });
  useEffect(() => {
    if (!enabled) return;
    const byKey = new Map<string, KeyAction>(
      Object.entries(KEYS).map(([action, { key }]) => [
        key,
        action as KeyAction,
      ]),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.defaultPrevented || isElsewhere(event.target)) return;
      const action = byKey.get(event.key);
      if (!action) return;
      event.preventDefault();
      handler.current(action);
    };
    addEventListener("keydown", onKeyDown);
    return () => removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

/**
 * An icon button named by its tooltip, which also prints the action's key while the keys are on:
 * a shortcut is learned where its action is.
 */
export function ActionButton({
  label,
  action,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  label: string;
  action?: KeyAction;
}) {
  const enabled = useShortcutsEnabled();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {enabled && action && <Kbd>{printed(KEYS[action].key)}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

/** Every key in one place, opened with `?`, with the switch that turns them all off. */
export function KeysDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const enabled = useShortcutsEnabled();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Single keys, for when the focus is not in a field.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5">
          {Object.values(KEYS).map(({ key, label }) => (
            <div key={key} className="contents">
              <dt className={enabled ? undefined : "text-muted-foreground"}>
                {label}
              </dt>
              <dd className="justify-self-end">
                <Kbd>{printed(key)}</Kbd>
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex items-center justify-between gap-4 border-t pt-3">
          <div className="grid gap-1">
            <Label htmlFor="mail-character-keys">Character keys</Label>
            <p
              id="mail-character-keys-description"
              className="text-muted-foreground text-xs"
            >
              Also turns off <Kbd>/</Kbd> for the site's search.
            </p>
          </div>
          <Switch
            id="mail-character-keys"
            checked={enabled}
            onCheckedChange={setShortcutsEnabled}
            aria-describedby="mail-character-keys-description"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
