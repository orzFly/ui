import { HexGrid, type HexViewProps } from "./hex-grid.tsx";

export type {
  HexCopyResult,
  HexPane,
  HexSelection,
  HexViewHandle,
  HexViewProps,
} from "./hex-grid.tsx";

export function HexView(props: HexViewProps) {
  return <HexGrid {...props} />;
}
