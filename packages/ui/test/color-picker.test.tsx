import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ColorPicker,
  ColorPickerPopover,
  type ColorPickerProps,
} from "../src/components/color-picker.tsx";
import { maxChroma, parseColor } from "../src/lib/color.ts";

function renderPicker(props: Partial<ColorPickerProps> & { value: string }) {
  const onValueChange = vi.fn();
  const onValueCommit = vi.fn();
  const result = render(
    <ColorPicker
      onValueChange={onValueChange}
      onValueCommit={onValueCommit}
      {...props}
    />,
  );
  return { ...result, onValueChange, onValueCommit };
}

/** A parent that echoes every change back, as a real controlled consumer does. */
function Echo(
  props: Partial<ColorPickerProps> & {
    initial: string;
    onChange?: (v: string) => void;
    onCommit?: (v: string) => void;
  },
) {
  const { initial, onChange, onCommit, ...rest } = props;
  const [value, setValue] = useState(initial);
  return (
    <>
      <output data-testid="value">{value}</output>
      <button type="button" onClick={() => setValue("#ff0000")}>
        reset
      </button>
      <ColorPicker
        {...rest}
        value={value}
        onValueChange={(v) => {
          setValue(v);
          onChange?.(v);
        }}
        onValueCommit={onCommit}
      />
    </>
  );
}

const textField = () => screen.getByRole("textbox", { name: "Colour value" });
const area = () => screen.getByRole("slider", { name: "Colour" });
const channel = (name: string) => screen.getByRole("textbox", { name });
const thumb = () => area().querySelector("[data-thumb]") as HTMLElement;

/** C as a share of the sRGB maximum at its lightness and hue. */
function relative(text: string, gamut: "srgb" | "p3" = "srgb") {
  const { l, c, h } = oklchOf(text);
  return c / maxChroma(l, h, gamut);
}

function oklchOf(text: string) {
  const parsed = parseColor(text);
  if (parsed === null) throw new Error(`does not parse: ${text}`);
  return parsed.color;
}

describe("ColorPicker value", () => {
  it("renders the value in its own format", () => {
    renderPicker({ value: "oklch(0.623 0.214 259.815)" });
    expect(textField()).toHaveProperty("value", "oklch(0.623 0.214 259.815)");
    expect(channel("Lightness")).toHaveProperty("value", "0.623");
    expect(channel("Chroma")).toHaveProperty("value", "0.214");
    expect(channel("Hue")).toHaveProperty("value", "259.815");
    expect(channel("Alpha")).toHaveProperty("value", "100");
  });

  it("emits nothing on mount", () => {
    const { onValueChange, onValueCommit } = renderPicker({ value: "#3b82f6" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
  });

  it("keeps full precision through the parent's echo", () => {
    const onChange = vi.fn();
    render(<Echo initial="#ff0000" onChange={onChange} />);
    // Each step moves value by 2.55 of 255. Re-read from the echoed hex, every step would lose
    // the half a unit the string rounds away, and ten steps would land on #e10000.
    for (let i = 0; i < 10; i++)
      fireEvent.keyDown(area(), { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledTimes(10);
    expect(screen.getByTestId("value").textContent).toBe("#e50000");
  });

  it("replaces its state when the parent changes the value mid-session", () => {
    render(<Echo initial="oklch(0.5 0.1 200)" />);
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    expect(textField()).toHaveProperty("value", "oklch(0.51 0.1 200)");
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(textField()).toHaveProperty("value", "#ff0000");
    expect(channel("Red")).toHaveProperty("value", "255");
  });

  it("follows a parent value that equals an earlier emit", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ColorPicker value="oklch(0.5 0.1 200)" onValueChange={onChange} />,
    );
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith("oklch(0.51 0.1 200)");
    rerender(<ColorPicker value="#ff0000" onValueChange={onChange} />);
    expect(textField()).toHaveProperty("value", "#ff0000");
    rerender(
      <ColorPicker value="oklch(0.51 0.1 200)" onValueChange={onChange} />,
    );
    expect(textField()).toHaveProperty("value", "oklch(0.51 0.1 200)");
    rerender(
      <ColorPicker value="oklch(0.5 0.1 200)" onValueChange={onChange} />,
    );
    onChange.mockClear();
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("oklch(0.51 0.1 200)");
  });

  it("shows an unparseable value as invalid text over black, and emits nothing", () => {
    const { onValueChange } = renderPicker({ value: "var(--primary)" });
    expect(textField()).toHaveProperty("value", "var(--primary)");
    expect(textField().getAttribute("aria-invalid")).toBe("true");
    expect(channel("Lightness")).toHaveProperty("value", "0");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

describe("ColorPicker text field", () => {
  it("emits a change on a keystroke that parses, and commits on Enter", () => {
    const { onValueChange, onValueCommit } = renderPicker({
      value: "oklch(0.5 0.1 200)",
    });
    fireEvent.change(textField(), { target: { value: "oklch(0.6 0.1 200)" } });
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.6 0.1 200)");
    expect(onValueCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(textField(), { key: "Enter" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.6 0.1 200)");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.6 0.1 200)");
  });

  it("commits a typed change on blur", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.5 0.1 200)" });
    fireEvent.change(textField(), { target: { value: "oklch(0.6 0.1 200)" } });
    fireEvent.blur(textField());
    expect(onValueCommit).toHaveBeenCalledWith("oklch(0.6 0.1 200)");
  });

  it("marks invalid text, emits nothing, and restores on blur", () => {
    const { onValueChange, onValueCommit } = renderPicker({
      value: "oklch(0.5 0.1 200)",
    });
    fireEvent.change(textField(), { target: { value: "oklch(0.6" } });
    expect(textField().getAttribute("aria-invalid")).toBe("true");
    fireEvent.keyDown(textField(), { key: "Enter" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommit).not.toHaveBeenCalled();
    fireEvent.blur(textField());
    expect(textField()).toHaveProperty("value", "oklch(0.5 0.1 200)");
    expect(textField().getAttribute("aria-invalid")).toBeNull();
  });

  it("restores on Escape", () => {
    renderPicker({ value: "#3b82f6" });
    fireEvent.change(textField(), { target: { value: "#3b8" + "zz" } });
    fireEvent.keyDown(textField(), { key: "Escape" });
    expect(textField()).toHaveProperty("value", "#3b82f6");
  });
});

describe("ColorPicker by keyboard", () => {
  it("steps lightness and chroma on the absolute area, Shift by 10, each committing", () => {
    const { onValueChange, onValueCommit } = renderPicker({
      value: "oklch(0.5 0.1 200)",
      surface: "absolute",
    });
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.51 0.1 200)");
    fireEvent.keyDown(area(), { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.51 0.104 200)");
    fireEvent.keyDown(area(), { key: "ArrowDown", shiftKey: true });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.41 0.104 200)");
    fireEvent.keyDown(area(), { key: "ArrowLeft", shiftKey: true });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.41 0.064 200)");
    expect(onValueCommit).toHaveBeenCalledTimes(4);
    expect(onValueChange).toHaveBeenCalledTimes(4);
  });

  it("names both axes in aria-valuetext", () => {
    renderPicker({ value: "oklch(0.623 0.214 259.815)", surface: "absolute" });
    expect(area().getAttribute("aria-roledescription")).toBe("2D slider");
    expect(area().getAttribute("aria-valuetext")).toBe(
      "lightness 62.3%, chroma 0.214",
    );
  });

  it("steps saturation and value on the HSV area", () => {
    const { onValueCommit } = renderPicker({ value: "hsl(0 100% 50%)" });
    expect(area().getAttribute("aria-valuetext")).toBe(
      "saturation 100%, value 100%",
    );
    fireEvent.keyDown(area(), { key: "ArrowDown", shiftKey: true });
    expect(area().getAttribute("aria-valuetext")).toBe(
      "saturation 100%, value 90%",
    );
    fireEvent.keyDown(area(), { key: "ArrowLeft" });
    expect(area().getAttribute("aria-valuetext")).toBe(
      "saturation 99%, value 90%",
    );
    expect(onValueCommit).toHaveBeenCalledTimes(2);
  });

  it("steps hue and alpha through their sliders, each committing", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.5 0.1 200)" });
    const hue = screen.getByRole("slider", { name: "Hue" });
    fireEvent.keyDown(hue, { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.5 0.1 201)");
    fireEvent.keyDown(hue, { key: "ArrowRight", shiftKey: true });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.5 0.1 211)");
    const alpha = screen.getByRole("slider", { name: "Alpha" });
    fireEvent.keyDown(alpha, { key: "ArrowLeft", shiftKey: true });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.5 0.1 211 / 90%)");
  });

  it("keeps the hue through chroma 0", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(0.5 0.008 120)",
      surface: "absolute",
    });
    fireEvent.keyDown(area(), { key: "ArrowLeft" });
    fireEvent.keyDown(area(), { key: "ArrowLeft" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.5 0 120)");
    expect(channel("Hue")).toHaveProperty("value", "120");
    fireEvent.keyDown(area(), { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.5 0.004 120)");
  });

  it("leaves chroma alone on a vertical step, even past the area's axis", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(0.5 0.4 200)",
      surface: "absolute",
    });
    expect(thumb().hasAttribute("data-pinned")).toBe(true);
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.51 0.4 200)");
  });

  it("keeps the hue slider's right end at 360", () => {
    const { onValueChange } = renderPicker({ value: "oklch(0.5 0.1 200)" });
    const hue = screen.getByRole("slider", { name: "Hue" });
    fireEvent.keyDown(hue, { key: "End" });
    expect(hue.getAttribute("aria-valuenow")).toBe("360");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.5 0.1 0)");
  });

  it("keeps the hue when a grey arrives from the parent", () => {
    render(<Echo initial="oklch(0.5 0.1 120)" />);
    fireEvent.change(textField(), { target: { value: "#808080" } });
    fireEvent.change(textField(), { target: { value: "oklch(0.6 0 0)" } });
    fireEvent.blur(textField());
    expect(channel("Hue")).toHaveProperty("value", "120");
  });
});

describe("ColorPicker oklch surface", () => {
  const last = (fn: ReturnType<typeof vi.fn>) =>
    oklchOf(fn.mock.lastCall?.[0] as string);

  it("steps C by a hundredth of the maximum, keeping L, Shift by a tenth", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.7 0.1 25)" });
    const max = maxChroma(0.7, 25, "srgb");
    fireEvent.keyDown(area(), { key: "ArrowRight" });
    expect(last(onValueCommit).l).toBe(0.7);
    expect(last(onValueCommit).c).toBeCloseTo(0.1 + 0.01 * max, 3);
    fireEvent.keyDown(area(), { key: "ArrowLeft", shiftKey: true });
    expect(last(onValueCommit).c).toBeCloseTo(0.1 - 0.09 * max, 3);
    expect(onValueCommit).toHaveBeenCalledTimes(2);
  });

  it("keeps C / maxChroma on a vertical step", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.7 0.1 25)" });
    const r = relative("oklch(0.7 0.1 25)");
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    expect(last(onValueCommit).l).toBe(0.71);
    expect(relative(onValueCommit.mock.lastCall?.[0])).toBeCloseTo(r, 2);
    fireEvent.keyDown(area(), { key: "ArrowDown", shiftKey: true });
    expect(last(onValueCommit).l).toBe(0.61);
    expect(relative(onValueCommit.mock.lastCall?.[0])).toBeCloseTo(r, 2);
  });

  it("holds its place through L = 1, where the maximum is 0", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.98 0.01 200)" });
    const x = thumb().style.left;
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    expect(last(onValueCommit)).toMatchObject({ l: 1, c: 0 });
    expect(thumb().style.left).toBe(x);
    fireEvent.keyDown(area(), { key: "ArrowDown" });
    fireEvent.keyDown(area(), { key: "ArrowDown" });
    expect(last(onValueCommit).l).toBe(0.98);
    expect(Math.abs(last(onValueCommit).c - 0.01)).toBeLessThan(1e-3);
  });

  it("names the share of the maximum in aria-valuetext", () => {
    renderPicker({ value: "oklch(0.7 0.1 25)" });
    const share = Math.round(relative("oklch(0.7 0.1 25)") * 100);
    expect(area().getAttribute("aria-valuetext")).toBe(
      `lightness 70%, chroma 0.1 (${share}% of sRGB max)`,
    );
    expect(thumb().hasAttribute("data-pinned")).toBe(false);
  });

  it("pins a colour beyond sRGB, and keeps its C on a vertical step", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(0.577 0.245 27.325)",
    });
    expect(thumb().hasAttribute("data-pinned")).toBe(true);
    expect(thumb().style.left).toBe("100%");
    expect(area().getAttribute("aria-valuetext")).toBe(
      "lightness 57.7%, chroma 0.245, beyond the sRGB edge",
    );
    fireEvent.keyDown(area(), { key: "ArrowUp" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.587 0.245 27.325)");
  });

  it("starts a horizontal step from a pinned colour at the edge", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(0.577 0.245 27.325)",
    });
    fireEvent.keyDown(area(), { key: "ArrowLeft" });
    expect(last(onValueCommit).c).toBeCloseTo(
      0.99 * maxChroma(0.577, 27.325, "srgb"),
      3,
    );
  });

  it("drops its hold when the gamut changes", () => {
    const { rerender } = render(
      <ColorPicker value="oklch(0.7 0.05 25)" gamut="srgb" />,
    );
    for (let i = 0; i < 10; i++)
      fireEvent.keyDown(area(), { key: "ArrowRight", shiftKey: true });
    expect(area().getAttribute("aria-valuetext")).toMatch(/100% of sRGB max/);
    rerender(<ColorPicker value="oklch(0.7 0.05 25)" gamut="p3" />);
    // The panel's own colour is still the sRGB edge, which is well inside P3.
    const share = Math.round(
      (maxChroma(0.7, 25, "srgb") / maxChroma(0.7, 25, "p3")) * 100,
    );
    expect(area().getAttribute("aria-valuetext")).toMatch(
      new RegExp(`\\(${share}% of P3 max\\)$`),
    );
  });

  it("does not pin a P3 colour under gamut p3", () => {
    renderPicker({ value: "oklch(0.577 0.245 27.325)", gamut: "p3" });
    expect(thumb().hasAttribute("data-pinned")).toBe(false);
    expect(area().getAttribute("aria-valuetext")).toMatch(/% of P3 max\)$/);
  });
});

describe("ColorPicker chroma lock", () => {
  const lock = () =>
    screen.getByRole("button", { name: "Keep relative chroma" });
  const hue = () => screen.getByRole("slider", { name: "Hue" });

  it("keeps C / maxChroma through a hue step", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.7 0.1 25)" });
    fireEvent.click(lock());
    expect(lock().getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(hue(), { key: "ArrowRight", shiftKey: true });
    const out = onValueCommit.mock.lastCall?.[0] as string;
    expect(oklchOf(out).h).toBe(35);
    expect(relative(out)).toBeCloseTo(relative("oklch(0.7 0.1 25)"), 2);
  });

  it("keeps C / maxChroma through an L field edit", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(0.7 0.1 25)",
      defaultChromaLock: true,
    });
    fireEvent.change(channel("Lightness"), { target: { value: "0.5" } });
    fireEvent.keyDown(channel("Lightness"), { key: "Enter" });
    const out = onValueCommit.mock.lastCall?.[0] as string;
    expect(oklchOf(out).l).toBe(0.5);
    expect(relative(out)).toBeCloseTo(relative("oklch(0.7 0.1 25)"), 2);
  });

  it("keeps C for a colour beyond the gamut", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(0.577 0.245 27.325)",
      defaultChromaLock: true,
    });
    fireEvent.keyDown(hue(), { key: "ArrowRight" });
    expect(oklchOf(onValueCommit.mock.lastCall?.[0]).c).toBe(0.245);
  });

  it("keeps C while off", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.7 0.1 25)" });
    expect(lock().getAttribute("aria-pressed")).toBe("false");
    fireEvent.keyDown(hue(), { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.7 0.1 26)");
  });

  it("obeys a controlled chromaLock", () => {
    const onChromaLockChange = vi.fn();
    renderPicker({
      value: "oklch(0.7 0.1 25)",
      chromaLock: false,
      onChromaLockChange,
    });
    fireEvent.click(lock());
    expect(onChromaLockChange).toHaveBeenCalledWith(true);
    expect(lock().getAttribute("aria-pressed")).toBe("false");
  });

  it("shows on both oklch surfaces and not on HSV", () => {
    renderPicker({ value: "#3b82f6" });
    expect(
      screen.queryByRole("button", { name: "Keep relative chroma" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Absolute" }));
    expect(lock()).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "OKLCH" }));
    expect(lock()).toBeTruthy();
  });
});

describe("ColorPicker reset", () => {
  const reset = () => screen.getByRole("button", { name: "Reset" });

  it("commits the reset value, and is disabled at it", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(0.7 0.1 25)",
      resetValue: "oklch(0.5 0.2 260 / 50%)",
    });
    expect(reset().getAttribute("title")).toBe(
      "Reset to oklch(0.5 0.2 260 / 50%)",
    );
    expect(reset()).toHaveProperty("disabled", false);
    fireEvent.click(reset());
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.5 0.2 260 / 50%)");
    expect(reset()).toHaveProperty("disabled", true);
  });

  it("restores the reset value's format", () => {
    const onCommit = vi.fn();
    render(
      <Echo
        initial="oklch(0.6 0.25 25)"
        resetValue="oklch(0.6 0.25 25)"
        onCommit={onCommit}
      />,
    );
    expect(reset()).toHaveProperty("disabled", true);
    fireEvent.change(textField(), { target: { value: "#ff0000" } });
    fireEvent.keyDown(textField(), { key: "Enter" });
    expect(reset()).toHaveProperty("disabled", false);
    fireEvent.click(reset());
    expect(onCommit).toHaveBeenLastCalledWith("oklch(0.6 0.25 25)");
    expect(reset()).toHaveProperty("disabled", true);
  });

  it("is hidden without resetValue or when it does not parse", () => {
    const { unmount } = renderPicker({ value: "#3b82f6" });
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
    unmount();
    renderPicker({ value: "#3b82f6", resetValue: "var(--primary)" });
    expect(screen.queryByRole("button", { name: "Reset" })).toBeNull();
  });
});

describe("ColorPicker format", () => {
  it("pins the output format", () => {
    const { onValueChange } = renderPicker({
      value: "oklch(0.5 0.1 200)",
      format: "hex",
    });
    expect((textField() as HTMLInputElement).value).toMatch(/^#[0-9a-f]{6}$/);
    fireEvent.change(textField(), { target: { value: "rgb(255 0 0)" } });
    expect(onValueChange).toHaveBeenLastCalledWith("#ff0000");
  });

  it("follows the typed format when not pinned", () => {
    const { onValueChange } = renderPicker({ value: "oklch(0.5 0.1 200)" });
    fireEvent.change(textField(), { target: { value: "rgb(255 0 0)" } });
    expect(onValueChange).toHaveBeenLastCalledWith("rgb(255 0 0)");
    expect(channel("Red")).toHaveProperty("value", "255");
    fireEvent.change(textField(), { target: { value: "red" } });
    // A named colour has no format of its own; the output keeps rgb.
    expect(onValueChange).toHaveBeenLastCalledWith("rgb(255 0 0)");
  });

  it("is oklch for a value in another syntax", () => {
    renderPicker({ value: "red" });
    expect((textField() as HTMLInputElement).value).toMatch(/^oklch\(/);
  });

  it("emits opaque colours with alpha={false}", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(1 0 0 / 10%)",
      alpha: false,
    });
    expect(textField()).toHaveProperty("value", "oklch(1 0 0)");
    expect(screen.queryByRole("slider", { name: "Alpha" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Alpha" })).toBeNull();
    fireEvent.change(textField(), { target: { value: "#ff000080" } });
    fireEvent.keyDown(textField(), { key: "Enter" });
    expect(onValueCommit).toHaveBeenLastCalledWith(
      expect.not.stringContaining("/"),
    );
  });

  it("clamps channel fields and wraps hue", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.5 0.1 200)" });
    fireEvent.change(channel("Lightness"), { target: { value: "1.5" } });
    fireEvent.keyDown(channel("Lightness"), { key: "Enter" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(1 0.1 200)");
    fireEvent.change(channel("Hue"), { target: { value: "-30" } });
    fireEvent.blur(channel("Hue"));
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(1 0.1 330)");
  });

  it("edits rgb channels", () => {
    const { onValueCommit } = renderPicker({ value: "#000000" });
    fireEvent.change(channel("Green"), { target: { value: "300" } });
    fireEvent.keyDown(channel("Green"), { key: "Enter" });
    expect(onValueCommit).toHaveBeenLastCalledWith("#00ff00");
  });
});

describe("ColorPicker surfaces", () => {
  const pressed = () =>
    screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true")
      .map((b) => b.textContent);

  it("offers three surfaces by default", () => {
    renderPicker({ value: "oklch(0.5 0.1 200)" });
    const toggle = screen.getByRole("group", { name: "Picking surface" });
    expect(
      [...toggle.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["OKLCH", "Absolute", "HSV"]);
  });

  it("defaults to the output format's surface", () => {
    const { unmount } = renderPicker({ value: "oklch(0.5 0.1 200)" });
    expect(pressed()).toEqual(["OKLCH"]);
    unmount();
    renderPicker({ value: "#3b82f6" });
    expect(pressed()).toEqual(["HSV"]);
  });

  it("switches with the toggle and reports it", () => {
    const onSurfaceChange = vi.fn();
    renderPicker({ value: "#3b82f6", onSurfaceChange });
    fireEvent.click(screen.getByRole("button", { name: "OKLCH" }));
    expect(onSurfaceChange).toHaveBeenCalledWith("oklch");
    expect(pressed()).toEqual(["OKLCH"]);
    expect(area().getAttribute("aria-valuetext")).toMatch(/^lightness/);
  });

  it("obeys a controlled surface", () => {
    const onSurfaceChange = vi.fn();
    renderPicker({ value: "#3b82f6", surface: "hsv", onSurfaceChange });
    fireEvent.click(screen.getByRole("button", { name: "OKLCH" }));
    expect(onSurfaceChange).toHaveBeenCalledWith("oklch");
    expect(pressed()).toEqual(["HSV"]);
  });

  it("hides the toggle for one surface", () => {
    renderPicker({ value: "#3b82f6", surfaces: ["oklch"] });
    expect(screen.queryByRole("button", { name: "HSV" })).toBeNull();
    expect(screen.queryByRole("button", { name: "OKLCH" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Absolute" })).toBeNull();
    expect(area().getAttribute("aria-valuetext")).toMatch(/^lightness/);
  });

  it("falls back to the first offered surface", () => {
    renderPicker({ value: "#3b82f6", surface: "hsv", surfaces: ["oklch"] });
    expect(area().getAttribute("aria-valuetext")).toMatch(/^lightness/);
  });
});

describe("ColorPicker gamut edges", () => {
  const W = 256;
  const H = 168;
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** happy-dom lays nothing out; this observer reports the surface at W × H CSS px. */
  function sized(props: Partial<ColorPickerProps> & { value: string }) {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        readonly report: (entries: { contentRect: DOMRectReadOnly }[]) => void;
        constructor(
          report: (entries: { contentRect: DOMRectReadOnly }[]) => void,
        ) {
          this.report = report;
        }
        observe() {
          this.report([{ contentRect: new DOMRectReadOnly(0, 0, W, H) }]);
        }
        unobserve() {}
        disconnect() {}
      },
    );
    return renderPicker(props);
  }
  const edges = () =>
    [...area().querySelectorAll("polyline")].map((line) => ({
      edge: line.getAttribute("data-edge"),
      dashed: line.getAttribute("stroke-dasharray"),
      points: (line.getAttribute("points") ?? "")
        .split(" ")
        .map((p) => p.split(",").map(Number)),
    }));

  it("draws them over the canvas at the surface's CSS size", () => {
    sized({ value: "oklch(0.7 0.1 25)", surfaces: ["absolute"] });
    const svg = area().querySelector("svg");
    expect(svg?.getAttribute("width")).toBe(String(W));
    expect(svg?.getAttribute("height")).toBe(String(H));
    const [p3, srgb] = edges();
    expect([p3.edge, p3.dashed]).toEqual(["p3", "6 4"]);
    expect([srgb.edge, srgb.dashed]).toEqual(["srgb", null]);
    for (const { points } of [p3, srgb]) {
      // One point per canvas row, painted at half size, and one on each border.
      expect(points).toHaveLength(H / 2 + 2);
      expect(points[0]).toEqual([0, 0]);
      expect(points.at(-1)).toEqual([0, H]);
    }
    // The chroma axis ends a little past the P3 wedge's tip.
    const tip = Math.max(...p3.points.map(([x]) => x));
    expect(tip).toBeGreaterThan(W * 0.9);
    expect(tip).toBeLessThan(W);
  });

  it("marks sRGB's edge on a P3 oklch surface, and nothing on an sRGB one", () => {
    const { unmount } = sized({
      value: "oklch(0.7 0.1 25)",
      surfaces: ["oklch"],
      gamut: "p3",
    });
    const [srgb] = edges();
    expect(srgb.edge).toBe("srgb");
    for (const [x] of srgb.points) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThanOrEqual(W);
    }
    unmount();
    sized({ value: "oklch(0.7 0.1 25)", surfaces: ["oklch"] });
    expect(area().querySelector("svg")).toBeNull();
  });

  it("draws none on the HSV surface", () => {
    sized({ value: "#3b82f6", surfaces: ["hsv"] });
    expect(area().querySelector("svg")).toBeNull();
  });
});

describe("ColorPicker swatches", () => {
  it("shows flat swatches, skipping what does not parse", () => {
    renderPicker({
      value: "#3b82f6",
      swatches: ["#ef4444", "nope", "#3b82f6"],
    });
    expect(screen.getByText("Swatches")).toBeTruthy();
    expect(screen.getByRole("button", { name: "#ef4444" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "nope" })).toBeNull();
  });

  it("shows groups under their labels", () => {
    renderPicker({
      value: "#3b82f6",
      swatches: [
        { label: "This theme", colors: ["oklch(0.5 0.1 200)"] },
        { label: "Recent", colors: ["#ef4444"] },
      ],
    });
    expect(screen.getByText("This theme")).toBeTruthy();
    expect(screen.getByText("Recent")).toBeTruthy();
  });

  it("presses the swatch equal to the value in the output format", () => {
    renderPicker({
      value: "#3B82F6",
      swatches: ["rgb(59 130 246)", "#ef4444"],
    });
    expect(
      screen
        .getByRole("button", { name: "rgb(59 130 246)" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "#ef4444" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("presses a grey swatch once picked, though it takes the panel's hue", () => {
    renderPicker({
      value: "oklch(0.5 0.1 27)",
      swatches: ["oklch(1 0 0 / 10%)"],
    });
    const swatch = screen.getByRole("button", { name: "oklch(1 0 0 / 10%)" });
    fireEvent.click(swatch);
    expect(textField()).toHaveProperty("value", "oklch(1 0 27 / 10%)");
    expect(swatch.getAttribute("aria-pressed")).toBe("true");
  });

  it("commits a clicked swatch, alpha included", () => {
    const { onValueChange, onValueCommit } = renderPicker({
      value: "#3b82f6",
      swatches: ["#ef444480"],
    });
    fireEvent.click(screen.getByRole("button", { name: "#ef444480" }));
    expect(onValueChange).toHaveBeenLastCalledWith("#ef444480");
    expect(onValueCommit).toHaveBeenLastCalledWith("#ef444480");
  });
});

describe("ColorPicker chips", () => {
  it("shows the contrast ratio and grade", () => {
    renderPicker({
      value: "oklch(0 0 0)",
      contrastWith: "oklch(1 0 0)",
    });
    expect(screen.getByText("21.00:1 vs background · AAA")).toBeTruthy();
  });

  it("names the other colour with contrastLabel", () => {
    renderPicker({
      value: "#777777",
      contrastWith: "#ffffff",
      contrastLabel: "primary",
    });
    expect(screen.getByText(/^4\.47:1 vs primary · AA large$/)).toBeTruthy();
  });

  it("never shows a ratio that rounds up past its grade", () => {
    // 4.4997:1 — under AA, so not "4.50".
    renderPicker({ value: "oklch(0.5681 0 0)", contrastWith: "#ffffff" });
    expect(screen.getByText("4.49:1 vs background · AA large")).toBeTruthy();
  });

  it("hides the contrast chip without contrastWith or when it does not parse", () => {
    const { container, unmount } = renderPicker({ value: "#777777" });
    expect(container.querySelector("[data-contrast]")).toBeNull();
    unmount();
    const again = renderPicker({ value: "#777777", contrastWith: "nope" });
    expect(again.container.querySelector("[data-contrast]")).toBeNull();
  });

  it("reports the gamut and maps to sRGB", () => {
    const { onValueCommit } = renderPicker({
      value: "oklch(0.577 0.245 27.325)",
    });
    expect(screen.getByText(/outside sRGB · in P3/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "map to sRGB" }));
    const committed = onValueCommit.mock.lastCall?.[0] as string;
    expect(committed).toMatch(/^oklch\(/);
    expect(screen.getByText("in sRGB")).toBeTruthy();
    expect(oklchOf(committed).c).toBeLessThan(0.245);
  });

  it("says when a hex output is mapped", () => {
    renderPicker({ value: "oklch(0.7 0.37 145)", format: "hex" });
    expect(screen.getByText("outside P3").getAttribute("title")).toBe(
      "Mapped to sRGB in hex",
    );
  });

  it("hides the map button in sRGB without giving up its place", () => {
    const { rerender } = renderPicker({
      value: "#777777",
      contrastWith: "#ffffff",
    });
    const map = () => screen.getByText("map to sRGB");
    expect(map().style.visibility).toBe("hidden");
    expect(screen.queryByRole("button", { name: "map to sRGB" })).toBeNull();
    rerender(
      <ColorPicker
        value="oklch(0.7 0.37 145)"
        format="hex"
        contrastWith="#ffffff"
      />,
    );
    expect(map().style.visibility).toBe("");
  });
});

describe("ColorPicker eyedropper", () => {
  afterEach(() => {
    delete (window as { EyeDropper?: unknown }).EyeDropper;
  });

  it("is absent without window.EyeDropper", () => {
    renderPicker({ value: "#3b82f6" });
    expect(
      screen.queryByRole("button", { name: "Pick from screen" }),
    ).toBeNull();
  });

  it("commits the picked colour, keeping alpha", async () => {
    (window as { EyeDropper?: unknown }).EyeDropper = class {
      open() {
        return Promise.resolve({ sRGBHex: "#ff0000" });
      }
    };
    const { onValueCommit } = renderPicker({ value: "#3b82f680" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pick from screen" }));
    });
    expect(onValueCommit).toHaveBeenLastCalledWith("#ff000080");
  });

  it("does nothing on a cancelled pick, and hides with eyeDropper={false}", async () => {
    (window as { EyeDropper?: unknown }).EyeDropper = class {
      open() {
        return Promise.reject(new DOMException("cancelled", "AbortError"));
      }
    };
    const { onValueChange, unmount } = renderPicker({ value: "#3b82f6" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pick from screen" }));
    });
    expect(onValueChange).not.toHaveBeenCalled();
    unmount();
    renderPicker({ value: "#3b82f6", eyeDropper: false });
    expect(
      screen.queryByRole("button", { name: "Pick from screen" }),
    ).toBeNull();
  });
});

describe("ColorPicker disabled", () => {
  afterEach(() => {
    delete (window as { EyeDropper?: unknown }).EyeDropper;
  });

  it("makes every control inert and hides the eyedropper", () => {
    (window as { EyeDropper?: unknown }).EyeDropper = class {};
    renderPicker({
      value: "oklch(0.577 0.245 27.325)",
      disabled: true,
      swatches: ["#ef4444"],
    });
    expect(area().getAttribute("tabindex")).toBe("-1");
    const buttons = screen.getAllByRole("button");
    expect(
      buttons.map((b) => b.textContent || b.getAttribute("aria-label")),
    ).toEqual([
      "OKLCH",
      "Absolute",
      "HSV",
      "Keep relative chroma",
      "map to sRGB",
      "#ef4444",
    ]);
    for (const button of buttons)
      expect(button).toHaveProperty("disabled", true);
    for (const field of screen.getAllByRole("textbox"))
      expect(field).toHaveProperty("disabled", true);
    for (const name of ["Hue", "Alpha"])
      expect(
        screen.getByRole("slider", { name }).hasAttribute("data-disabled"),
      ).toBe(true);
  });
});

describe("ColorPicker extra", () => {
  it("renders at the bottom of the panel", () => {
    renderPicker({ value: "#3b82f6", extra: <p>blur radius</p> });
    expect(screen.getByText("blur radius")).toBeTruthy();
  });
});

describe("ColorPickerPopover", () => {
  function openWith(trigger: HTMLElement) {
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
    fireEvent.click(trigger);
  }

  it("opens from the default trigger, which shows the value", () => {
    render(<ColorPickerPopover value="#3b82f6" />);
    const trigger = screen.getByRole("button", { name: "Pick colour" });
    expect(trigger.textContent).toContain("#3b82f6");
    openWith(trigger);
    expect(textField()).toHaveProperty("value", "#3b82f6");
  });

  it("opens from children, labelled", () => {
    render(
      <ColorPickerPopover value="#3b82f6" aria-label="Label colour">
        <button type="button">dot</button>
      </ColorPickerPopover>,
    );
    openWith(screen.getByRole("button", { name: "Label colour" }));
    expect(textField()).toHaveProperty("value", "#3b82f6");
  });

  it("passes extra through to the panel", () => {
    render(<ColorPickerPopover value="#3b82f6" extra={<p>blur radius</p>} />);
    expect(screen.queryByText("blur radius")).toBeNull();
    openWith(screen.getByRole("button", { name: "Pick colour" }));
    expect(screen.getByText("blur radius")).toBeTruthy();
  });

  it("disables the trigger", () => {
    render(<ColorPickerPopover value="#3b82f6" disabled />);
    expect(screen.getByRole("button", { name: "Pick colour" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
