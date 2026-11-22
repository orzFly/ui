// @vitest-environment happy-dom
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BelowFloor } from "../src/below-floor.tsx";

function rows() {
  const host = document.createElement("div");
  host.innerHTML = renderToString(<BelowFloor />);
  return [...host.querySelectorAll("tbody tr")].map((row) => {
    const [palette, token, on, lowest] = [...row.querySelectorAll("td")];
    return {
      name: `${palette?.textContent} ${token?.textContent}`,
      surfaces: [...(on?.querySelectorAll("code") ?? [])].map(
        (code) => code.textContent,
      ),
      lowest: lowest?.textContent ?? "",
    };
  });
}

describe("the pairs below the contrast floors", () => {
  const table = rows();

  it("lists some", () => {
    expect(table.length).toBeGreaterThan(0);
  });

  // primary on the page is held as text and as a state's edge: one pair, two checks.
  it("names each surface once in a row", () => {
    expect(
      table
        .filter(({ surfaces }) => new Set(surfaces).size !== surfaces.length)
        .map(({ name, surfaces }) => `${name}: ${surfaces.join(", ")}`),
    ).toEqual([]);
  });
});
