import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSlashShortcut } from "../src/hooks/use-slash-shortcut.ts";

function press(
  key: string,
  target: EventTarget = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useSlashShortcut", () => {
  it("takes / outside a field", () => {
    const onSlash = vi.fn();
    renderHook(() => useSlashShortcut(onSlash));

    const event = press("/");
    expect(onSlash).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves / to a field the reader is typing in", () => {
    const onSlash = vi.fn();
    renderHook(() => useSlashShortcut(onSlash));
    const input = document.body.appendChild(document.createElement("input"));

    const event = press("/", input);
    expect(onSlash).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves / alone while disabled, and takes it again once enabled", () => {
    const onSlash = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useSlashShortcut(onSlash, { enabled }),
      { initialProps: { enabled: false } },
    );

    const event = press("/");
    expect(onSlash).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    rerender({ enabled: true });
    press("/");
    expect(onSlash).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    press("/");
    expect(onSlash).toHaveBeenCalledTimes(1);
  });
});
