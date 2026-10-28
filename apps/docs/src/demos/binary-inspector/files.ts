import { file } from "@orz/fixtures/files.ts";
import type { HexDocument } from "@orz/ui-hex";

/** The files the demo offers before the reader opens one of their own. */
export const SAMPLES = ["gradient.png", "bundle.zip"];

export async function loadSample(
  name: string,
  signal: AbortSignal,
): Promise<Uint8Array> {
  const { url } = file(name);
  if (url === undefined) throw new Error(`${name} has no URL`);
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`.trim());
  }
  return new Uint8Array(await response.arrayBuffer());
}

/** Saves the document as `name` through the browser's download, and counts it as saved. */
export async function download(doc: HexDocument, name: string) {
  const blob = await doc.toBlob("application/octet-stream");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // A revoke in the same task can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url));
  doc.markSaved();
}

const SIZE = new Intl.NumberFormat("en");

/** "3 bytes", "1,510 bytes". */
export const bytes = (count: number) =>
  `${SIZE.format(count)} ${count === 1 ? "byte" : "bytes"}`;

/**
 * What the edits did: how many bytes they wrote, and how much shorter or longer the file is.
 * Empty while nothing differs from the file as opened.
 */
export function describeEdits(doc: HexDocument): string {
  const written = doc
    .modifiedRanges(0, doc.size)
    .reduce((sum, [start, end]) => sum + end - start, 0);
  const grown = doc.size - doc.source.size;
  const parts: string[] = [];
  if (written > 0) parts.push(`${bytes(written)} written`);
  if (grown > 0) parts.push(`${bytes(grown)} longer`);
  if (grown < 0) parts.push(`${bytes(-grown)} shorter`);
  return parts.join(", ");
}
