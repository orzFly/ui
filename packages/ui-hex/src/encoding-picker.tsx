import {
  FilterMenu,
  type FilterMenuSection,
  MatchedText,
} from "@orz/ui/components/filter-menu";
import { ChevronDownIcon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import {
  encodingLabel,
  HEX_ENCODINGS,
  type HexEncoding,
  type HexEncodingInfo,
} from "./encodings.ts";

/**
 * Other names people type for an encoding, mostly the Encoding Standard's
 * labels: what a charset header, a code page number or an old habit calls it.
 */
const ALIASES: Partial<Record<HexEncoding, readonly string[]>> = {
  ascii: ["us-ascii"],
  "iso-8859-1": ["latin1", "cp819"],
  "windows-1252": ["cp1252", "ansi"],
  "utf-8": ["utf8", "unicode"],
  "utf-16le": ["utf-16", "ucs-2", "unicode"],
  "utf-16be": ["unicode"],
  shift_jis: ["sjis", "ms_kanji", "windows-31j", "cp932", "japanese"],
  "euc-jp": ["japanese"],
  gb18030: ["gb2312", "cp936", "chinese"],
  big5: ["big5-hkscs", "chinese"],
  "euc-kr": ["ks_c_5601-1987", "cp949", "windows-949", "korean"],
  "windows-1250": ["cp1250"],
  "windows-1251": ["cp1251"],
  "windows-1253": ["cp1253"],
  "windows-1254": ["cp1254"],
  "windows-1255": ["cp1255"],
  "windows-1256": ["cp1256"],
  "windows-1257": ["cp1257"],
  "windows-1258": ["cp1258"],
  "iso-8859-2": ["latin2"],
  "iso-8859-3": ["latin3"],
  "iso-8859-4": ["latin4"],
  "iso-8859-10": ["latin6"],
  "iso-8859-13": ["latin7"],
  "iso-8859-14": ["latin8"],
  "iso-8859-15": ["latin9"],
  "iso-8859-16": ["latin10"],
  "koi8-u": ["koi8-ru"],
  ibm866: ["cp866", "dos"],
  macintosh: ["mac", "x-mac-roman"],
};

/** Folded, with separators gone, so `utf8` finds UTF-8 and `8859 1` finds ISO-8859-1. */
function compact(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\p{M}\s_-]/gu, "")
    .toLowerCase();
}

const TERMS = new Map(
  HEX_ENCODINGS.map((info) => [
    info.id,
    [info.label, info.id, info.group, ...(ALIASES[info.id] ?? [])].map(compact),
  ]),
);

function encodingSections(query: string): FilterMenuSection<HexEncodingInfo>[] {
  const needle = compact(query);
  const sections: FilterMenuSection<HexEncodingInfo>[] = [];
  for (const info of HEX_ENCODINGS) {
    if (needle !== "" && !TERMS.get(info.id)?.some((t) => t.includes(needle))) {
      continue;
    }
    const last = sections.at(-1);
    if (last?.id === info.group) (last.rows as HexEncodingInfo[]).push(info);
    else sections.push({ id: info.group, label: info.group, rows: [info] });
  }
  return sections;
}

/** The other name a row matched by, when its label did not; shown beside it, so the hit makes sense. */
function aliasHit(info: HexEncodingInfo, query: string): string | undefined {
  const needle = compact(query);
  if (needle === "" || compact(info.label).includes(needle)) return undefined;
  return [info.id, ...(ALIASES[info.id] ?? [])].find((name) =>
    compact(name).includes(needle),
  );
}

// Memoised: the grid re-renders on every scroll frame.
export const EncodingPicker = memo(function EncodingPicker({
  value,
  onChange,
}: {
  value: HexEncoding;
  onChange: (encoding: HexEncoding) => void;
}) {
  const [query, setQuery] = useState("");
  const sections = useMemo(() => encodingSections(query), [query]);
  return (
    <FilterMenu
      query={query}
      onQueryChange={setQuery}
      sections={sections}
      selectedId={value}
      onSelect={(info) => onChange(info.id)}
      renderRow={(info) => {
        const alias = aliasHit(info, query);
        return (
          <>
            <span className="orz-hex-encoding-label">
              <MatchedText text={info.label} query={query} />
            </span>
            {alias !== undefined && (
              <span className="orz-hex-encoding-alias">
                <MatchedText text={alias} query={query} />
              </span>
            )}
          </>
        );
      }}
      placeholder="Filter encodings…"
      inputLabel="Filter encodings"
      listLabel="Text encodings"
      empty={(q) => `No encodings match "${q}"`}
      className="orz-hex-encoding-menu"
    >
      <button
        type="button"
        className="orz-hex-encoding"
        aria-label="Text encoding"
      >
        <span className="orz-hex-encoding-value">{encodingLabel(value)}</span>
        <ChevronDownIcon aria-hidden />
      </button>
    </FilterMenu>
  );
});
