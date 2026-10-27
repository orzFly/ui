import { describe, expect, it } from "vitest";
import { excerptParts, hitOf, locationOf } from "../src/search.ts";

describe("excerptParts", () => {
  it("splits at the marks and unescapes, so the excerpt renders as text", () => {
    expect(
      excerptParts("a <mark>Switch</mark> &lt;b&gt; &amp; <mark>it</mark>"),
    ).toEqual([
      { text: "a ", match: false },
      { text: "Switch", match: true },
      { text: " <b> & ", match: false },
      { text: "it", match: true },
    ]);
  });
});

describe("locationOf", () => {
  it("is the route and the hash the router takes", () => {
    expect(locationOf("/start/")).toEqual({ route: "/start/", hash: "" });
    expect(locationOf("/start/#install")).toEqual({
      route: "/start/",
      hash: "#install",
    });
  });
});

describe("hitOf", () => {
  it("keeps the headings, not the page's own top, as sections", () => {
    const hit = hitOf({
      url: "/start/",
      meta: { title: "Start" },
      excerpt: "<mark>Install</mark> it",
      sub_results: [
        { title: "Start", url: "/start/", excerpt: "top" },
        { title: "Install", url: "/start/#install", excerpt: "pnpm add" },
      ],
    });
    expect(hit.title).toBe("Start");
    expect(hit.route).toBe("/start/");
    expect(hit.sections).toEqual([
      {
        title: "Install",
        route: "/start/",
        hash: "#install",
        excerpt: [{ text: "pnpm add", match: false }],
      },
    ]);
  });
});
