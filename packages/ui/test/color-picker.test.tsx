import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ColorPicker,
  ColorPickerPopover,
  type ColorPickerProps,
} from "../src/components/color-picker.tsx";
import { parseColor } from "../src/lib/color.ts";

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
  it("steps lightness and chroma on the oklch area, Shift by 10, each committing", () => {
    const { onValueChange, onValueCommit } = renderPicker({
      value: "oklch(0.5 0.1 200)",
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
    renderPicker({ value: "oklch(0.623 0.214 259.815)" });
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
    const { onValueCommit } = renderPicker({ value: "oklch(0.5 0.008 120)" });
    fireEvent.keyDown(area(), { key: "ArrowLeft" });
    fireEvent.keyDown(area(), { key: "ArrowLeft" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.5 0 120)");
    expect(channel("Hue")).toHaveProperty("value", "120");
    fireEvent.keyDown(area(), { key: "ArrowRight" });
    expect(onValueCommit).toHaveBeenLastCalledWith("oklch(0.5 0.004 120)");
  });

  it("leaves chroma alone on a vertical step, even past the area's axis", () => {
    const { onValueCommit } = renderPicker({ value: "oklch(0.5 0.4 200)" });
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
    expect(area().getAttribute("aria-valuetext")).toMatch(/^lightness/);
  });

  it("falls back to the first offered surface", () => {
    renderPicker({ value: "#3b82f6", surface: "hsv", surfaces: ["oklch"] });
    expect(area().getAttribute("aria-valuetext")).toMatch(/^lightness/);
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
    expect(screen.getByText(/outside P3/)).toBeTruthy();
    expect(screen.getByText(/mapped to sRGB in hex/)).toBeTruthy();
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
    ).toEqual(["OKLCH", "HSV", "map to sRGB", "#ef4444"]);
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

  it("disables the trigger", () => {
    render(<ColorPickerPopover value="#3b82f6" disabled />);
    expect(screen.getByRole("button", { name: "Pick colour" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
