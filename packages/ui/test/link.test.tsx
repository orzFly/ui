import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { isPlainClick } from "../src/lib/link.ts";

/** Clicks a link and returns what `isPlainClick` said of the click. */
function click(
  init: Parameters<typeof fireEvent.click>[1] = {},
  props: ComponentProps<"a"> = {},
) {
  let plain: boolean | undefined;
  const { unmount } = render(
    <a
      href="/somewhere"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        plain = isPlainClick(event);
        event.preventDefault();
      }}
    >
      x
    </a>,
  );
  fireEvent.click(screen.getByRole("link"), init);
  unmount();
  return plain;
}

describe("isPlainClick", () => {
  it("is true for a plain left click", () => {
    expect(click()).toBe(true);
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])(
    "is false with %s held",
    (modifier) => {
      expect(click({ [modifier]: true })).toBe(false);
    },
  );

  it("is false for another button", () => {
    expect(click({ button: 1 })).toBe(false);
  });

  it("is false once a handler before it prevented the default", () => {
    expect(click({}, { onClick: (event) => event.preventDefault() })).toBe(
      false,
    );
  });

  it("is false for a link that opens elsewhere, true for _self", () => {
    expect(click({}, { target: "_blank" })).toBe(false);
    expect(click({}, { target: "_self" })).toBe(true);
  });
});
