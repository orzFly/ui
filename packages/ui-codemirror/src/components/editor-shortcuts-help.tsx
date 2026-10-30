import { Button } from "@orz/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@orz/ui/components/popover";
import { KeyboardIcon } from "lucide-react";
import { useState } from "react";
import { type ModKeyLabels, modKeyLabels } from "../lib/platform.ts";

type Key = keyof ModKeyLabels | "V" | ".";

const SHORTCUTS: { keys: Key[]; text: string }[] = [
  { keys: ["mod", "V"], text: "Paste — formatting becomes Markdown" },
  { keys: ["mod", "shift", "V"], text: "Paste as plain text" },
  { keys: ["mod", "alt", "V"], text: "Paste as quote" },
  { keys: ["mod", "alt", "shift", "V"], text: "Paste plain text as quote" },
  { keys: ["mod", "."], text: "Paste options, right after pasting" },
  { keys: ["mod", "shift", "."], text: "Quote or unquote selected lines" },
];

/**
 * `MarkdownEditor`'s paste and quote keys, none of which leave a trace on
 * screen until they are used, behind a keyboard button for a toolbar beside
 * the editor. Apple platforms get ⌘ ⌥ ⇧.
 */
export function EditorShortcutsHelp() {
  const labels = modKeyLabels();
  // Portalled into the button's own subtree rather than <body>: a box that
  // folds once focus leaves its DOM would otherwise fold as the popover takes
  // focus, and take the popover's button away with it. `fixed` positioning
  // keeps it unclipped here all the same.
  const [host, setHost] = useState<HTMLElement | null>(null);
  return (
    <div ref={setHost} className="contents">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
          >
            <KeyboardIcon className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          container={host}
          className="w-auto max-w-[calc(100vw-1rem)] p-2"
        >
          <table className="text-ui-sm">
            <tbody>
              {SHORTCUTS.map(({ keys, text }) => (
                <tr key={text}>
                  <td className="py-1 pr-4 whitespace-nowrap">
                    <span className="inline-flex gap-1">
                      {keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded-[min(var(--radius-chip),4px)] border bg-muted px-1.5 font-mono text-ui-xs text-muted-foreground"
                        >
                          {key === "V" || key === "." ? key : labels[key]}
                        </kbd>
                      ))}
                    </span>
                  </td>
                  <td className="py-1">{text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PopoverContent>
      </Popover>
    </div>
  );
}
