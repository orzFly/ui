import { Label } from "@orz/ui/components/label";
import { Switch } from "@orz/ui/components/switch";
import { Fragment, useEffect, useId, useState } from "react";

import { decodeAll } from "./decode.ts";
import { formatOffset } from "./format.ts";
import type { ByteSource } from "./source.ts";
import type { HexSelection } from "./types.ts";

export interface HexInspectorProps {
  source: ByteSource;
  selection: HexSelection | null;
  littleEndian?: boolean;
  defaultLittleEndian?: boolean;
  onLittleEndianChange?: (littleEndian: boolean) => void;
  className?: string;
}

const EMPTY = new Uint8Array(0);
// Stored in place of the bytes when the read fails; compared by identity.
const FAILED = new Uint8Array(0);

function useSourceVersion(source: ByteSource) {
  const [version, setVersion] = useState(0);
  useEffect(() => source.subscribe?.(() => setVersion((v) => v + 1)), [source]);
  return version;
}

export function HexInspector({
  source,
  selection,
  littleEndian: littleEndianProp,
  defaultLittleEndian = true,
  onLittleEndianChange,
  className,
}: HexInspectorProps) {
  const [innerLittleEndian, setInnerLittleEndian] =
    useState(defaultLittleEndian);
  const littleEndian = littleEndianProp ?? innerLittleEndian;
  const setLittleEndian = (next: boolean) => {
    if (littleEndianProp === undefined) setInnerLittleEndian(next);
    onLittleEndianChange?.(next);
  };

  const version = useSourceVersion(source);
  const start = selection ? Math.min(selection.anchor, selection.focus) : -1;
  const length = selection
    ? Math.max(selection.anchor, selection.focus) - start + 1
    : 0;

  const [read, setRead] = useState<{
    source: ByteSource;
    key: string;
    bytes: Uint8Array;
  } | null>(null);
  const key = `${start}:${version}`;

  useEffect(() => {
    if (start < 0) return;
    const count = Math.max(0, Math.min(8, source.size - start));
    const controller = new AbortController();
    const result = source.read(start, count, controller.signal);
    if (result instanceof Uint8Array) {
      setRead({ source, key, bytes: result.slice() });
      return;
    }
    result.then(
      (bytes) => {
        if (!controller.signal.aborted) setRead({ source, key, bytes });
      },
      () => {
        if (!controller.signal.aborted) setRead({ source, key, bytes: FAILED });
      },
    );
    return () => controller.abort();
  }, [source, start, key]);

  const bytes =
    read?.source === source && read.key === key ? read.bytes : undefined;
  const rows = decodeAll(bytes ?? EMPTY, bytes?.length ?? 0, littleEndian);
  const loading = start >= 0 && !bytes;
  const failed = bytes === FAILED;
  const switchId = useId();

  return (
    <div
      className={
        className ? `orz-hex-inspector ${className}` : "orz-hex-inspector"
      }
    >
      <p className="orz-hex-inspector-heading">
        {selection
          ? `Offset ${formatOffset(start)} · ${length} ${length === 1 ? "byte" : "bytes"}${failed ? " · read failed" : ""}`
          : "No selection"}
      </p>
      <dl className="orz-hex-inspector-list">
        {rows.map((row) => {
          const dimmed = !selection || length < row.width ? "" : undefined;
          return (
            <Fragment key={row.label}>
              <dt data-dimmed={dimmed}>{row.label}</dt>
              <dd data-dimmed={dimmed}>
                {!selection || loading || failed ? "" : (row.value ?? "—")}
              </dd>
            </Fragment>
          );
        })}
      </dl>
      <div className="orz-hex-inspector-endian">
        <Switch
          id={switchId}
          checked={littleEndian}
          onCheckedChange={setLittleEndian}
        />
        <Label htmlFor={switchId}>Little endian</Label>
      </div>
    </div>
  );
}
