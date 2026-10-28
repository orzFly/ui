import {
  builtinThemes,
  DEFAULT_VARIANT,
  resolvePalette,
  schemesOf,
  type TokenName,
  type Tokens,
  variantsOf,
} from "@orz/themes";
import { contrastRows } from "@orz/themes/contrast";

interface Shortfall {
  palette: string;
  token: TokenName;
  surfaces: TokenName[];
  /** The lowest ratio across the surfaces. */
  ratio: number;
  floor: number;
}

/**
 * Every built-in palette's pairs under the floors `@orz/themes` holds its themes to, a
 * token's surfaces on one row. Variants that paint a side alike share a row, named
 * together.
 */
function shortfalls(): Shortfall[] {
  return builtinThemes.flatMap((theme) =>
    schemesOf(theme).flatMap((scheme) => {
      // The palette itself is named by its side; a variant by its label.
      const painted = new Map<string, { tokens: Tokens; names: string[] }>();
      for (const variant of variantsOf(theme)) {
        const tokens = resolvePalette(theme, scheme, variant.id)?.tokens;
        if (!tokens) continue;
        const name = variant.id === DEFAULT_VARIANT ? "" : variant.label;
        const key = JSON.stringify(tokens);
        const same = painted.get(key);
        if (same) same.names.push(name);
        else painted.set(key, { tokens, names: [name] });
      }
      const side = theme[scheme]?.label ?? scheme;
      return [...painted.values()].flatMap(({ tokens, names }) => {
        // A variant the side lacks resolves to its default, so a row holding the
        // default is the palette itself, whatever else falls back to it.
        const variants = names.includes("") ? "" : names.join(", ");
        const palette = `${theme.label} ${side}${variants ? ` · ${variants}` : ""}`;
        const byToken = new Map<TokenName, Shortfall>();
        for (const row of contrastRows(tokens)) {
          if (row.ratio >= row.floor) continue;
          const seen = byToken.get(row.foreground);
          if (seen) {
            seen.surfaces.push(row.surface);
            seen.ratio = Math.min(seen.ratio, row.ratio);
          } else {
            byToken.set(row.foreground, {
              palette,
              token: row.foreground,
              surfaces: [row.surface],
              ratio: row.ratio,
              floor: row.floor,
            });
          }
        }
        return [...byToken.values()];
      });
    }),
  );
}

const code = "rounded bg-muted px-1 py-0.5 font-mono text-[0.875em]";
const cell = "border-b px-3 py-2 align-top";
const head = "border-b px-3 py-2 text-left font-medium text-muted-foreground";

/** The built-in themes' pairs below the contrast floors, measured from the palettes. */
export function BelowFloor() {
  const rows = shortfalls();
  return (
    <div className="my-5 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={head}>Theme</th>
            <th className={head}>Token</th>
            <th className={head}>On</th>
            <th className={head}>Lowest</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ palette, token, surfaces, ratio, floor }) => (
            <tr key={`${palette} ${token}`}>
              <td className={cell}>{palette}</td>
              <td className={cell}>
                <code className={code}>{token}</code>
              </td>
              <td className={cell}>
                {surfaces.map((surface, index) => (
                  <span key={surface}>
                    {index > 0 && ", "}
                    <code className={code}>{surface}</code>
                  </span>
                ))}
              </td>
              <td className={`${cell} tabular-nums`}>
                {ratio.toFixed(2)}:1, under {floor}:1
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
