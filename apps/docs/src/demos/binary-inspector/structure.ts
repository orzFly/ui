import { type ByteSource, formatOffset } from "@orz/ui-hex";

/** A run of bytes the structure names: a chunk, a header, one of its fields. */
export interface Region {
  /** Unique in its file; a path of indexes, so the same place keeps it across a re-parse. */
  id: string;
  label: string;
  offset: number;
  length: number;
  /** What the bytes say, shown beside the label: `24 × 24`, `stored`, `"readme.txt"`. */
  value?: string;
  children?: Region[];
}

export interface Structure {
  /** "PNG image", "ZIP archive". */
  format: string;
  /** Which way round the format writes its numbers, so the inspector can read them the same way. */
  littleEndian: boolean;
  regions: Region[];
}

/** Enough for any sample, and a ceiling that keeps a large file of the format quick to list. */
const MAX_REGIONS = 500;

type Read = (offset: number, length: number) => Promise<Uint8Array>;

function reader(source: ByteSource, signal: AbortSignal): Read {
  return async (offset, length) => {
    const bytes = await source.read(offset, length, signal);
    signal.throwIfAborted();
    return bytes;
  };
}

const view = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const latin1 = new TextDecoder("latin1");
const utf8 = new TextDecoder();

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_END = 0x06054b50;

/**
 * The regions of a PNG or a ZIP, read through `source` a header at a time, so a large file costs
 * a few small reads rather than one of the whole file. Null for any other format, which the demo
 * shows as bytes alone. A file damaged partway keeps what was read before the damage.
 */
export async function parseStructure(
  source: ByteSource,
  signal: AbortSignal,
): Promise<Structure | null> {
  const read = reader(source, signal);
  const head = await read(0, 8);
  if (PNG_SIGNATURE.every((byte, i) => head[i] === byte)) {
    return {
      format: "PNG image",
      littleEndian: false,
      regions: await parsePng(read, source.size),
    };
  }
  if (head.length >= 4 && view(head).getUint32(0, true) === ZIP_LOCAL) {
    return {
      format: "ZIP archive",
      littleEndian: true,
      regions: await parseZip(read, source.size),
    };
  }
  return null;
}

const COLOUR_TYPES: Record<number, string> = {
  0: "greyscale",
  2: "RGB",
  3: "indexed",
  4: "greyscale + alpha",
  6: "RGBA",
};

async function parsePng(read: Read, size: number): Promise<Region[]> {
  const regions: Region[] = [
    { id: "0", label: "Signature", offset: 0, length: 8 },
  ];
  let offset = 8;
  while (offset < size && regions.length < MAX_REGIONS) {
    const id = String(regions.length);
    if (offset + 12 > size) {
      regions.push(trailing(id, offset, size, "Truncated chunk"));
      return regions;
    }
    const header = await read(offset, 8);
    const length = view(header).getUint32(0);
    const type = latin1.decode(header.subarray(4, 8));
    const end = offset + 12 + length;
    if (end > size) {
      regions.push(trailing(id, offset, size, `Truncated ${type}`));
      return regions;
    }
    const fields: Region[] = [
      {
        id: `${id}.0`,
        label: "Length",
        offset,
        length: 4,
        value: String(length),
      },
      { id: `${id}.1`, label: "Type", offset: offset + 4, length: 4 },
    ];
    let value: string | undefined;
    if (type === "IHDR" && length >= 13) {
      const data = view(await read(offset + 8, 13));
      const width = data.getUint32(0);
      const height = data.getUint32(4);
      const depth = data.getUint8(8);
      const colour = data.getUint8(9);
      value = `${width} × ${height}, ${depth}-bit ${COLOUR_TYPES[colour] ?? "?"}`;
      const at = offset + 8;
      fields.push(
        field(id, 2, "Width", at, 4, String(width)),
        field(id, 3, "Height", at + 4, 4, String(height)),
        field(id, 4, "Bit depth", at + 8, 1, String(depth)),
        field(id, 5, "Colour type", at + 9, 1, COLOUR_TYPES[colour]),
        field(id, 6, "Compression", at + 10, 1),
        field(id, 7, "Filter", at + 11, 1),
        field(id, 8, "Interlace", at + 12, 1),
      );
      if (length > 13) {
        fields.push(field(id, 9, "Rest", at + 13, length - 13));
      }
    } else if (length > 0) {
      if (type === "tEXt") {
        // A keyword, a NUL, then the text; the keyword says what the text is.
        const text = await read(offset + 8, Math.min(length, 80));
        const nul = text.indexOf(0);
        value = latin1.decode(nul === -1 ? text : text.subarray(0, nul));
      }
      fields.push(field(id, 2, "Data", offset + 8, length));
    }
    fields.push(field(id, fields.length, "CRC", end - 4, 4));
    regions.push({
      id,
      label: type,
      offset,
      length: end - offset,
      value: value ?? `${length} bytes`,
      children: fields,
    });
    offset = end;
    if (type === "IEND") break;
  }
  if (offset < size && regions.length < MAX_REGIONS) {
    regions.push(trailing(String(regions.length), offset, size, "After IEND"));
  }
  return regions;
}

const METHODS: Record<number, string> = { 0: "stored", 8: "deflate" };

/**
 * From the end-of-central-directory record, which says where every file starts: walking local
 * headers from the front would stop at the first file whose sizes trail its data.
 */
async function parseZip(read: Read, size: number): Promise<Region[]> {
  // The record is 22 bytes, then a comment of at most 65535.
  const tailStart = Math.max(0, size - 22 - 0xffff);
  const tail = await read(tailStart, size - tailStart);
  const tailView = view(tail);
  let endAt = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === ZIP_END) {
      endAt = i;
      break;
    }
  }
  if (endAt === -1) {
    return [trailing("0", 0, size, "No end of central directory")];
  }
  const count = tailView.getUint16(endAt + 10, true);
  const directorySize = tailView.getUint32(endAt + 12, true);
  const directoryAt = tailView.getUint32(endAt + 16, true);
  const commentLength = tailView.getUint16(endAt + 20, true);
  const end = tailStart + endAt;

  const files: Region[] = [];
  const entries: Region[] = [];
  let at = directoryAt;
  for (let i = 0; i < count && files.length < MAX_REGIONS; i++) {
    if (at + 46 > size) break;
    const entry = view(await read(at, 46));
    if (entry.getUint32(0, true) !== ZIP_CENTRAL) break;
    const method = entry.getUint16(10, true);
    const compressed = entry.getUint32(20, true);
    const original = entry.getUint32(24, true);
    const nameLength = entry.getUint16(28, true);
    const extraLength = entry.getUint16(30, true);
    const entryCommentLength = entry.getUint16(32, true);
    const localAt = entry.getUint32(42, true);
    const name = utf8.decode(await read(at + 46, nameLength));
    const entryLength = 46 + nameLength + extraLength + entryCommentLength;
    const entryId = `c.${i}`;
    entries.push({
      id: entryId,
      label: name,
      offset: at,
      length: entryLength,
      value: `at ${formatOffset(localAt)}`,
      children: [
        field(entryId, 0, "Header", at, 46),
        field(entryId, 1, "Name", at + 46, nameLength),
        ...(extraLength > 0
          ? [field(entryId, 2, "Extra", at + 46 + nameLength, extraLength)]
          : []),
      ],
    });
    at += entryLength;

    if (localAt + 30 > size) continue;
    const local = view(await read(localAt, 30));
    if (local.getUint32(0, true) !== ZIP_LOCAL) continue;
    const localName = local.getUint16(26, true);
    const localExtra = local.getUint16(28, true);
    const dataAt = localAt + 30 + localName + localExtra;
    const dataLength = Math.min(compressed, size - dataAt);
    const fileId = `f.${i}`;
    files.push({
      id: fileId,
      label: name,
      offset: localAt,
      length: dataAt + dataLength - localAt,
      value: `${METHODS[method] ?? `method ${method}`}, ${original} bytes`,
      children: [
        field(fileId, 0, "Header", localAt, 30),
        field(fileId, 1, "Name", localAt + 30, localName),
        ...(localExtra > 0
          ? [field(fileId, 2, "Extra", localAt + 30 + localName, localExtra)]
          : []),
        ...(dataLength > 0
          ? [field(fileId, 3, "Data", dataAt, dataLength)]
          : []),
      ],
    });
  }

  const regions: Region[] = files.sort((a, b) => a.offset - b.offset);
  if (directorySize > 0) {
    regions.push({
      id: "c",
      label: "Central directory",
      offset: directoryAt,
      length: directorySize,
      value: `${count} ${count === 1 ? "entry" : "entries"}`,
      children: entries,
    });
  }
  regions.push({
    id: "e",
    label: "End of directory",
    offset: end,
    length: Math.min(22 + commentLength, size - end),
    ...(commentLength > 0 && {
      children: [
        field("e", 0, "Record", end, 22),
        field("e", 1, "Comment", end + 22, commentLength),
      ],
    }),
  });
  return regions;
}

function field(
  parent: string,
  index: number,
  label: string,
  offset: number,
  length: number,
  value?: string,
): Region {
  return {
    id: `${parent}.${index}`,
    label,
    offset,
    length,
    ...(value !== undefined && { value }),
  };
}

const trailing = (
  id: string,
  offset: number,
  size: number,
  label: string,
): Region => ({ id, label, offset, length: size - offset });

/** Every region, depth first, with how deep it sits. */
export function flatten(
  regions: readonly Region[],
  depth = 0,
): { region: Region; depth: number }[] {
  return regions.flatMap((region) => [
    { region, depth },
    ...flatten(region.children ?? [], depth + 1),
  ]);
}

/** The innermost region holding all of [start, end], and the regions around it, outermost first. */
export function regionPath(
  regions: readonly Region[],
  start: number,
  end: number,
): Region[] {
  const hit = regions.find(
    (region) => start >= region.offset && end < region.offset + region.length,
  );
  if (!hit) return [];
  return [hit, ...regionPath(hit.children ?? [], start, end)];
}
