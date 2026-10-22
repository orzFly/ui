export interface DecodedValue {
  label: string;
  /** Bytes the value spans. */
  width: number;
  /** `null` when the value would run past the end of the source. */
  value: string | null;
}

// DataView.getFloat16 is too new to rely on in every consumer's target.
export function float16(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const mantissa = bits & 0x3ff;
  if (exponent === 0) return sign * mantissa * 2 ** -24;
  if (exponent === 0x1f) return mantissa ? Number.NaN : sign * Infinity;
  return sign * (1 + mantissa / 1024) * 2 ** (exponent - 15);
}

function formatFloat(value: number): string {
  return Object.is(value, -0) ? "-0" : String(value);
}

type Reader = (view: DataView, littleEndian: boolean) => string;

const ROWS: { label: string; width: number; read: Reader }[] = [
  {
    label: "Binary",
    width: 1,
    read: (v) => v.getUint8(0).toString(2).padStart(8, "0"),
  },
  { label: "Int8", width: 1, read: (v) => String(v.getInt8(0)) },
  { label: "Uint8", width: 1, read: (v) => String(v.getUint8(0)) },
  { label: "Int16", width: 2, read: (v, le) => String(v.getInt16(0, le)) },
  { label: "Uint16", width: 2, read: (v, le) => String(v.getUint16(0, le)) },
  { label: "Int32", width: 4, read: (v, le) => String(v.getInt32(0, le)) },
  { label: "Uint32", width: 4, read: (v, le) => String(v.getUint32(0, le)) },
  {
    label: "Int64",
    width: 8,
    read: (v, le) => v.getBigInt64(0, le).toString(),
  },
  {
    label: "Uint64",
    width: 8,
    read: (v, le) => v.getBigUint64(0, le).toString(),
  },
  {
    label: "Float16",
    width: 2,
    read: (v, le) => formatFloat(float16(v.getUint16(0, le))),
  },
  {
    label: "Float32",
    width: 4,
    read: (v, le) => formatFloat(v.getFloat32(0, le)),
  },
  {
    label: "Float64",
    width: 8,
    read: (v, le) => formatFloat(v.getFloat64(0, le)),
  },
];

/** One entry per inspector row, read from the first `available` bytes of `bytes`. */
export function decodeAll(
  bytes: Uint8Array,
  available: number,
  littleEndian: boolean,
): DecodedValue[] {
  const n = Math.min(available, bytes.length);
  const view = new DataView(bytes.buffer, bytes.byteOffset, n);
  return ROWS.map(({ label, width, read }) => ({
    label,
    width,
    value: n >= width ? read(view, littleEndian) : null,
  }));
}
