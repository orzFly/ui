import {
  builtinThemes,
  DEFAULT_VARIANT,
  resolvePalette,
  schemesOf,
  stylesOf,
  type TokenName,
  type Tokens,
  variantsOf,
} from "@orz/themes";
import { contrastRows } from "@orz/themes/contrast";
import { InlineCode } from "@orz/ui/components/inline-code";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@orz/ui/components/table";

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
        for (const row of contrastRows(tokens, stylesOf(theme))) {
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

/** The built-in themes' pairs below the contrast floors, measured from the palettes. */
export function BelowFloor() {
  const rows = shortfalls();
  return (
    <div className="my-5">
      <Table purpose="prose">
        <TableHeader>
          <TableRow>
            <TableHead>Theme</TableHead>
            <TableHead>Token</TableHead>
            <TableHead>On</TableHead>
            <TableHead>Lowest</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ palette, token, surfaces, ratio, floor }) => (
            <TableRow key={`${palette} ${token}`}>
              <TableCell>{palette}</TableCell>
              <TableCell>
                <InlineCode>{token}</InlineCode>
              </TableCell>
              <TableCell>
                {surfaces.map((surface, index) => (
                  <span key={surface}>
                    {index > 0 && ", "}
                    <InlineCode>{surface}</InlineCode>
                  </span>
                ))}
              </TableCell>
              <TableCell className="tabular-nums">
                {ratio.toFixed(2)}:1, under {floor}:1
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
