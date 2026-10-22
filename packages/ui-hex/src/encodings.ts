import {
  asciiDecoding,
  latin1Decoding,
  type TextDecoding,
  tableDecoding,
} from "./text-decoding.ts";
import {
  eastAsianDecoding,
  utf8Decoding,
  utf16Decoding,
} from "./text-decoding-multibyte.ts";

export type HexEncoding =
  | "ascii"
  | "iso-8859-1"
  | "windows-1252"
  | "utf-8"
  | "utf-16le"
  | "utf-16be"
  | "shift_jis"
  | "euc-jp"
  | "gb18030"
  | "big5"
  | "euc-kr"
  | "windows-1250"
  | "windows-1251"
  | "windows-1253"
  | "windows-1254"
  | "windows-1255"
  | "windows-1256"
  | "windows-1257"
  | "windows-1258"
  | "iso-8859-2"
  | "iso-8859-3"
  | "iso-8859-4"
  | "iso-8859-5"
  | "iso-8859-6"
  | "iso-8859-7"
  | "iso-8859-8"
  | "iso-8859-10"
  | "iso-8859-13"
  | "iso-8859-14"
  | "iso-8859-15"
  | "iso-8859-16"
  | "koi8-r"
  | "koi8-u"
  | "ibm866"
  | "macintosh";

export interface HexEncodingInfo {
  /** The Encoding Standard name, so a detected charset passes straight through. */
  id: HexEncoding;
  label: string;
  group: "Western" | "Unicode" | "East Asian" | "Other";
}

const other = (id: HexEncoding, label: string): HexEncodingInfo => ({
  id,
  label,
  group: "Other",
});

/** Every encoding, in picker order. */
export const ENCODING_TABLE: readonly HexEncodingInfo[] = [
  { id: "ascii", label: "ASCII", group: "Western" },
  { id: "iso-8859-1", label: "ISO-8859-1 (Latin-1)", group: "Western" },
  { id: "windows-1252", label: "Windows-1252 (Western)", group: "Western" },
  { id: "utf-8", label: "UTF-8", group: "Unicode" },
  { id: "utf-16le", label: "UTF-16LE", group: "Unicode" },
  { id: "utf-16be", label: "UTF-16BE", group: "Unicode" },
  { id: "shift_jis", label: "Shift_JIS", group: "East Asian" },
  { id: "euc-jp", label: "EUC-JP", group: "East Asian" },
  { id: "gb18030", label: "GB18030 (GBK)", group: "East Asian" },
  { id: "big5", label: "Big5", group: "East Asian" },
  { id: "euc-kr", label: "EUC-KR", group: "East Asian" },
  other("windows-1250", "Windows-1250 (Central European)"),
  other("windows-1251", "Windows-1251 (Cyrillic)"),
  other("windows-1253", "Windows-1253 (Greek)"),
  other("windows-1254", "Windows-1254 (Turkish)"),
  other("windows-1255", "Windows-1255 (Hebrew)"),
  other("windows-1256", "Windows-1256 (Arabic)"),
  other("windows-1257", "Windows-1257 (Baltic)"),
  other("windows-1258", "Windows-1258 (Vietnamese)"),
  other("iso-8859-2", "ISO-8859-2 (Central European)"),
  other("iso-8859-3", "ISO-8859-3 (South European)"),
  other("iso-8859-4", "ISO-8859-4 (Baltic)"),
  other("iso-8859-5", "ISO-8859-5 (Cyrillic)"),
  other("iso-8859-6", "ISO-8859-6 (Arabic)"),
  other("iso-8859-7", "ISO-8859-7 (Greek)"),
  other("iso-8859-8", "ISO-8859-8 (Hebrew)"),
  other("iso-8859-10", "ISO-8859-10 (Nordic)"),
  other("iso-8859-13", "ISO-8859-13 (Baltic)"),
  other("iso-8859-14", "ISO-8859-14 (Celtic)"),
  other("iso-8859-15", "ISO-8859-15 (Western)"),
  other("iso-8859-16", "ISO-8859-16 (South-Eastern European)"),
  other("koi8-r", "KOI8-R (Russian)"),
  other("koi8-u", "KOI8-U (Ukrainian)"),
  other("ibm866", "IBM866 (Cyrillic DOS)"),
  other("macintosh", "Macintosh (Mac Roman)"),
];

/** The entries `Decoder` can construct; ASCII and ISO-8859-1 are computed and always pass. */
export function probeEncodings(
  Decoder: new (
    label: string,
    options?: TextDecoderOptions,
  ) => unknown = TextDecoder,
): HexEncodingInfo[] {
  return ENCODING_TABLE.filter((info) => {
    if (info.id === "ascii" || info.id === "iso-8859-1") return true;
    try {
      new Decoder(info.id, { fatal: true });
      return true;
    } catch {
      return false;
    }
  });
}

/** The encodings this runtime supports, in picker order. */
export const HEX_ENCODINGS: readonly HexEncodingInfo[] = probeEncodings();

function createDecoding(id: HexEncoding): TextDecoding {
  switch (id) {
    case "ascii":
      return asciiDecoding;
    case "iso-8859-1":
      return latin1Decoding;
    case "utf-8":
      return utf8Decoding;
    case "utf-16le":
      return utf16Decoding(true);
    case "utf-16be":
      return utf16Decoding(false);
    case "shift_jis":
    case "euc-jp":
    case "gb18030":
    case "big5":
    case "euc-kr":
      return eastAsianDecoding(id);
    default:
      return tableDecoding(id);
  }
}

const decodings = new Map<string, TextDecoding>();
const warned = new Set<string>();

/** The decoding for `id`; ASCII, with one warning per id, when this runtime lacks it. */
export function getTextDecoding(
  id: HexEncoding,
  available: readonly HexEncodingInfo[] = HEX_ENCODINGS,
): TextDecoding {
  if (!available.some((info) => info.id === id)) {
    if (!warned.has(id)) {
      warned.add(id);
      console.warn(
        `@orz/ui-hex: the encoding "${id}" is not available in this runtime; showing ASCII`,
      );
    }
    return asciiDecoding;
  }
  let decoding = decodings.get(id);
  if (!decoding) {
    decoding = createDecoding(id);
    decodings.set(id, decoding);
  }
  return decoding;
}

/** The picker's label for `id`, or the id itself when it is not listed. */
export function encodingLabel(id: HexEncoding): string {
  return ENCODING_TABLE.find((info) => info.id === id)?.label ?? id;
}
