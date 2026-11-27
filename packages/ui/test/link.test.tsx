import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import {
  isModifiedClick,
  isPlainClick,
  isPlainPress,
} from "../src/lib/link.ts";

/** Clicks a link and returns what `test` (`isPlainClick` unless given) said of the click. */
function click(
  init: Parameters<typeof fireEvent.click>[1] = {},
  props: ComponentProps<"a"> = {},
  test = isPlainClick,
) {
  let plain: boolean | undefined;
  const { unmount } = render(
    <a
      href="/somewhere"
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        plain = test(event);
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

describe("isPlainPress", () => {
  const press = (
    init: Parameters<typeof fireEvent.click>[1] = {},
    props: ComponentProps<"a"> = {},
  ) => click(init, props, isPlainPress);

  it("is true for a plain left click, handled before or not", () => {
    expect(press()).toBe(true);
    expect(press({}, { onClick: (event) => event.preventDefault() })).toBe(
      true,
    );
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])(
    "is false with %s held",
    (modifier) => {
      expect(press({ [modifier]: true })).toBe(false);
    },
  );

  it("is false for another button or a link that opens elsewhere", () => {
    expect(press({ button: 1 })).toBe(false);
    expect(press({}, { target: "_blank" })).toBe(false);
  });
});

describe("isModifiedClick", () => {
  const modified = (
    init: Parameters<typeof fireEvent.click>[1] = {},
    props: ComponentProps<"a"> = {},
  ) => click(init, props, isModifiedClick);

  it("is false for a plain left click, handled before or not", () => {
    expect(modified()).toBe(false);
    expect(modified({}, { onClick: (event) => event.preventDefault() })).toBe(
      false,
    );
  });

  it.each(["ctrlKey", "metaKey", "shiftKey", "altKey"])(
    "is true with %s held",
    (modifier) => {
      expect(modified({ [modifier]: true })).toBe(true);
    },
  );

  it("is true for another button, and false for a link that opens elsewhere", () => {
    expect(modified({ button: 1 })).toBe(true);
    expect(modified({}, { target: "_blank" })).toBe(false);
  });
});
