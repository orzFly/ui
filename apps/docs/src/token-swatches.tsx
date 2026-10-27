import type { TerminalTokenName, TokenName } from "@orz/themes";
import { resolvePalette } from "@orz/themes";
import { contrastRatio, parseColor } from "@orz/ui/lib/color";
import { useTerminalTheme, useTheme } from "@orz/ui/theme";
import { useHydrated } from "./hydrated.tsx";

type Token = TokenName | TerminalTokenName;

/**
 * The active theme's values, or null until hydration: the server renders
 * the default theme, so a value read before then would not match the page
 * it hydrates.
 */
function useTokenValues(): Partial<Record<Token, string>> | null {
  const hydrated = useHydrated();
  const { theme, colorScheme, variant } = useTheme();
  const terminal = useTerminalTheme();
  if (!hydrated) return null;
  const palette = resolvePalette(theme, colorScheme, variant);
  return { ...palette?.tokens, ...terminal.tokens };
}

function ratio(foreground?: string, background?: string): number | null {
  const fg = foreground && parseColor(foreground);
  const bg = background && parseColor(background);
  return fg && bg ? contrastRatio(fg.color, bg.color) : null;
}

function Value({ text }: { text: string | undefined }) {
  return (
    <span className="block min-h-4 truncate font-mono text-muted-foreground text-xs">
      {text}
    </span>
  );
}

/**
 * A surface with its foreground, as the active theme paints them, and the
 * contrast between the two against WCAG's 4.5:1 for text.
 */
export function TokenPairs({
  pairs,
}: {
  pairs: readonly (readonly [surface: TokenName, text: TokenName])[];
}) {
  const values = useTokenValues();
  return (
    <div className="my-6 grid gap-3 sm:grid-cols-2">
      {pairs.map(([surface, text]) => {
        const contrast = values && ratio(values[text], values[surface]);
        return (
          <div
            key={`${surface} ${text}`}
            className="overflow-hidden rounded-lg border"
          >
            <div
              className="flex h-16 items-center justify-between px-4"
              style={{
                background: `var(--${surface})`,
                color: `var(--${text})`,
              }}
            >
              <span className="font-medium text-lg">Aa</span>
              {typeof contrast === "number" && (
                <span className="font-mono text-sm tabular-nums">
                  {contrast.toFixed(1)}:1
                  {contrast < 4.5 && " · under 4.5"}
                </span>
              )}
            </div>
            <div className="grid gap-1 border-t px-4 py-2 text-sm">
              <code className="font-mono text-xs">
                {surface} / {text}
              </code>
              <Value text={values?.[surface]} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Tokens drawn on their own: a line, a ring, a chart series, an ANSI colour. */
export function TokenSwatches({ tokens }: { tokens: readonly Token[] }) {
  const values = useTokenValues();
  return (
    <div className="my-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {tokens.map((token) => (
        <div key={token} className="min-w-0">
          <div
            className="h-10 rounded-md border"
            style={{ background: `var(--${token})` }}
          />
          <code className="mt-1.5 block truncate font-mono text-xs">
            {token}
          </code>
          <Value text={values?.[token]} />
        </div>
      ))}
    </div>
  );
}
