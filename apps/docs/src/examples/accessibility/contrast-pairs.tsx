import { resolvePalette, type TokenName } from "@orz/themes";
import { contrastRatio, parseColor } from "@orz/ui/lib/color";
import { useTheme } from "@orz/ui/theme";
import { useEffect, useState } from "react";

// Text needs 4.5:1 (WCAG 2.2 SC 1.4.3); a control's edge or state 3:1 (SC 1.4.11).
const PAIRS: { fg: TokenName; bg: TokenName; min: number; use: string }[] = [
  { fg: "foreground", bg: "background", min: 4.5, use: "Body text" },
  { fg: "muted-foreground", bg: "background", min: 4.5, use: "Secondary text" },
  { fg: "muted-foreground", bg: "muted", min: 4.5, use: "Inactive tab" },
  { fg: "primary-foreground", bg: "primary", min: 4.5, use: "Primary button" },
  { fg: "destructive", bg: "background", min: 4.5, use: "Error message" },
  { fg: "ring", bg: "background", min: 3, use: "Focus ring" },
  { fg: "input", bg: "background", min: 3, use: "Field border" },
];

export function ContrastPairs() {
  const { theme, colorScheme, variant } = useTheme();
  const tokens = resolvePalette(theme, colorScheme, variant)?.tokens;
  // The pick lives in the browser, so the server-rendered page cannot show it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <table className="w-full text-ui">
      <thead className="text-left text-muted-foreground">
        <tr>
          <th className="py-1.5 font-medium">Use</th>
          <th className="py-1.5 font-medium">Tokens</th>
          <th className="py-1.5 text-right font-medium">Ratio</th>
        </tr>
      </thead>
      <tbody>
        {PAIRS.map(({ fg, bg, min, use }) => {
          const f = tokens && parseColor(tokens[fg]);
          const b = tokens && parseColor(tokens[bg]);
          const ratio =
            mounted && f && b ? contrastRatio(f.color, b.color) : null;
          return (
            <tr key={`${fg} ${bg}`} className="border-t">
              <td className="py-1.5">{use}</td>
              <td className="py-1.5 font-mono text-ui-sm">
                {fg} on {bg}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {ratio === null
                  ? "–"
                  : // Rounded down, so 4.497 never reads as a passing 4.50.
                    `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1 ${ratio >= min ? "passes" : `fails ${min}:1`}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
