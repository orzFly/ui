import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createHexDocument } from "../src/document.ts";
import { bytesSource } from "../src/source.ts";
import { useHexDocumentState } from "../src/use-hex-document-state.ts";

describe("useHexDocumentState", () => {
  it("follows edits, undo and markSaved with a stable snapshot between them", () => {
    const doc = createHexDocument(bytesSource(new Uint8Array(8)));
    let renders = 0;
    const { result, rerender } = renderHook(() => {
      renders++;
      return useHexDocumentState(doc);
    });
    expect(result.current).toEqual({
      size: 8,
      dirty: false,
      canUndo: false,
      canRedo: false,
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);

    act(() => doc.insert(0, Uint8Array.of(1, 2)));
    expect(result.current).toEqual({
      size: 10,
      dirty: true,
      canUndo: true,
      canRedo: false,
    });
    act(() => doc.undo());
    expect(result.current).toEqual({
      size: 8,
      dirty: false,
      canUndo: false,
      canRedo: true,
    });
    act(() => {
      doc.redo();
      doc.markSaved();
    });
    expect(result.current).toEqual({
      size: 10,
      dirty: false,
      canUndo: true,
      canRedo: false,
    });
    const settled = renders;
    rerender();
    expect(renders).toBe(settled + 1);
  });
});
