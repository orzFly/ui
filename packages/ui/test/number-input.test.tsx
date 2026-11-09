import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NumberInput } from "../src/components/number-input.tsx";

function Controlled(props: Partial<React.ComponentProps<typeof NumberInput>>) {
  const [value, setValue] = useState(props.value ?? 5);
  return (
    <NumberInput
      aria-label="Count"
      {...props}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        props.onValueChange?.(next);
      }}
    />
  );
}

const field = () => screen.getByRole("spinbutton", { name: "Count" });

afterEach(() => vi.useRealTimers());

describe("NumberInput", () => {
  it("is a spinbutton that reports its value and range", () => {
    render(<Controlled min={0} max={10} />);
    expect(field().getAttribute("aria-valuenow")).toBe("5");
    expect(field().getAttribute("aria-valuemin")).toBe("0");
    expect(field().getAttribute("aria-valuemax")).toBe("10");
    expect((field() as HTMLInputElement).value).toBe("5");
  });

  it("steps with the arrow keys, Page Up and Down, Home and End", () => {
    const onValueChange = vi.fn();
    render(<Controlled min={0} max={50} onValueChange={onValueChange} />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenLastCalledWith(6);
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    fireEvent.keyDown(field(), { key: "ArrowDown" });
    expect(onValueChange).toHaveBeenLastCalledWith(4);
    fireEvent.keyDown(field(), { key: "PageUp" });
    expect(onValueChange).toHaveBeenLastCalledWith(14);
    fireEvent.keyDown(field(), { key: "End" });
    expect(onValueChange).toHaveBeenLastCalledWith(50);
    fireEvent.keyDown(field(), { key: "Home" });
    expect(onValueChange).toHaveBeenLastCalledWith(0);
  });

  it("stays within its range, and disables the button that would leave it", () => {
    const onValueChange = vi.fn();
    render(<Controlled value={10} max={10} onValueChange={onValueChange} />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Increase" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Decrease" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("keeps typed text until blur, then holds it to the range and the step", () => {
    const onValueChange = vi.fn();
    render(
      <Controlled min={0} max={20} step={2} onValueChange={onValueChange} />,
    );
    fireEvent.change(field(), { target: { value: "1" } });
    expect((field() as HTMLInputElement).value).toBe("1");
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.change(field(), { target: { value: "13" } });
    fireEvent.blur(field());
    expect(onValueChange).toHaveBeenLastCalledWith(14);
    expect((field() as HTMLInputElement).value).toBe("14");
    fireEvent.change(field(), { target: { value: "99" } });
    fireEvent.keyDown(field(), { key: "Enter" });
    expect(onValueChange).toHaveBeenLastCalledWith(20);
  });

  it("puts the value back when the text is no number", () => {
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);
    fireEvent.change(field(), { target: { value: "ten" } });
    fireEvent.blur(field());
    expect(onValueChange).not.toHaveBeenCalled();
    expect((field() as HTMLInputElement).value).toBe("5");
  });

  it("steps from typed text, not from the value before it", () => {
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);
    fireEvent.change(field(), { target: { value: "8" } });
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenLastCalledWith(9);
  });

  it("keeps a fractional step free of float noise", () => {
    const onValueChange = vi.fn();
    render(<Controlled value={0.2} step={0.1} onValueChange={onValueChange} />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValueChange).toHaveBeenLastCalledWith(0.3);
  });

  it("steps once per press of a button, and repeats while it is held", () => {
    vi.useFakeTimers();
    const onValueChange = vi.fn();
    render(<Controlled max={100} onValueChange={onValueChange} />);
    const increase = screen.getByRole("button", { name: "Increase" });
    fireEvent.pointerDown(increase, { button: 0 });
    expect(onValueChange).toHaveBeenLastCalledWith(6);
    expect(document.activeElement).toBe(field());
    act(() => vi.advanceTimersByTime(400 + 50 * 3));
    expect(onValueChange).toHaveBeenLastCalledWith(10);
    fireEvent.pointerUp(increase);
    // The click that follows a pointer's press steps nothing more.
    fireEvent.click(increase, { detail: 1 });
    act(() => vi.advanceTimersByTime(1000));
    expect(onValueChange).toHaveBeenLastCalledWith(10);
  });

  it("steps on a click with no pointer behind it", () => {
    const onValueChange = vi.fn();
    render(<Controlled onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Decrease" }), {
      detail: 0,
    });
    expect(onValueChange).toHaveBeenLastCalledWith(4);
  });

  it("leaves its value to itself with defaultValue", () => {
    render(<NumberInput aria-label="Count" defaultValue={3} />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect((field() as HTMLInputElement).value).toBe("4");
  });

  it("does not step when disabled or read only", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <Controlled disabled onValueChange={onValueChange} />,
    );
    expect(
      (screen.getByRole("button", { name: "Increase" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    rerender(<Controlled readOnly onValueChange={onValueChange} />);
    fireEvent.keyDown(field(), { key: "ArrowUp" });
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
