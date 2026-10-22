import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HexInspector } from "../src/hex-inspector.tsx";
import { type ByteSource, bytesSource } from "../src/source.ts";

const BYTES = Uint8Array.from({ length: 32 }, (_, i) => i + 1);
const source = bytesSource(BYTES);

function row(container: HTMLElement, label: string) {
  const dt = [...container.querySelectorAll("dt")].find(
    (el) => el.textContent === label,
  );
  const dd = dt?.nextElementSibling as HTMLElement;
  return { dt: dt as HTMLElement, dd };
}

describe("HexInspector", () => {
  it("reads the selection start and dims rows wider than the selection", async () => {
    const { container } = render(
      <HexInspector
        source={source}
        selection={{ anchor: 1, focus: 0, pane: "hex" }}
      />,
    );
    expect(screen.getByText("Offset 0x0 · 2 bytes")).toBeTruthy();
    await waitFor(() =>
      expect(row(container, "Int16").dd.textContent).toBe("513"),
    );
    expect(row(container, "Int16").dd.hasAttribute("data-dimmed")).toBe(false);
    const int32 = row(container, "Int32").dd;
    expect(int32.hasAttribute("data-dimmed")).toBe(true);
    expect(int32.textContent).toBe("67305985");
    expect(row(container, "Binary").dd.textContent).toBe("00000001");
  });

  it("switches endianness", async () => {
    const onLittleEndianChange = vi.fn();
    const { container } = render(
      <HexInspector
        source={source}
        selection={{ anchor: 0, focus: 1, pane: "hex" }}
        onLittleEndianChange={onLittleEndianChange}
      />,
    );
    await waitFor(() =>
      expect(row(container, "Int16").dd.textContent).toBe("513"),
    );
    fireEvent.click(screen.getByRole("switch", { name: "Little endian" }));
    expect(row(container, "Int16").dd.textContent).toBe("258");
    expect(onLittleEndianChange).toHaveBeenCalledWith(false);
  });

  it("shows a dash past the end of the source", async () => {
    const { container } = render(
      <HexInspector
        source={source}
        selection={{ anchor: 31, focus: 31, pane: "hex" }}
      />,
    );
    await waitFor(() =>
      expect(row(container, "Uint8").dd.textContent).toBe("32"),
    );
    expect(row(container, "Int16").dd.textContent).toBe("—");
    expect(row(container, "Float64").dd.textContent).toBe("—");
  });

  it("shows no selection", () => {
    const { container } = render(
      <HexInspector source={source} selection={null} />,
    );
    expect(screen.getByText("No selection")).toBeTruthy();
    for (const dd of container.querySelectorAll("dd")) {
      expect(dd.textContent).toBe("");
      expect(dd.hasAttribute("data-dimmed")).toBe(true);
    }
  });

  it("reads nothing at the end of the source", () => {
    const read = vi.fn(source.read);
    const { container } = render(
      <HexInspector
        source={{ size: BYTES.length, read }}
        selection={{ anchor: 32, focus: 32, pane: "hex" }}
      />,
    );
    expect(read).not.toHaveBeenCalled();
    // Not left loading: an empty row shows the dash.
    expect(row(container, "Uint8").dd.textContent).toBe("—");
  });

  it("reads async sources and aborts a superseded read", async () => {
    const signals: AbortSignal[] = [];
    const asyncSource: ByteSource = {
      size: 32,
      read: (offset, length, signal) => {
        if (signal) signals.push(signal);
        return Promise.resolve(BYTES.slice(offset, offset + length));
      },
    };
    const { container, rerender } = render(
      <HexInspector
        source={asyncSource}
        selection={{ anchor: 0, focus: 0, pane: "hex" }}
      />,
    );
    rerender(
      <HexInspector
        source={asyncSource}
        selection={{ anchor: 4, focus: 4, pane: "hex" }}
      />,
    );
    expect(signals[0]?.aborted).toBe(true);
    await waitFor(() =>
      expect(row(container, "Uint8").dd.textContent).toBe("5"),
    );
  });

  it("re-reads an unchanged selection when the source changes", async () => {
    const bytes = BYTES.slice();
    let onChange: (() => void) | undefined;
    const changing: ByteSource = {
      size: bytes.length,
      read: (offset, length) => bytes.subarray(offset, offset + length),
      subscribe(listener) {
        onChange = listener;
        return () => {
          onChange = undefined;
        };
      },
    };
    const { container } = render(
      <HexInspector
        source={changing}
        selection={{ anchor: 2, focus: 2, pane: "hex" }}
      />,
    );
    await waitFor(() =>
      expect(row(container, "Uint8").dd.textContent).toBe("3"),
    );
    bytes[2] = 0x7f;
    act(() => onChange?.());
    await waitFor(() =>
      expect(row(container, "Uint8").dd.textContent).toBe("127"),
    );
  });
});
