import { describe, expect, it } from "vitest";
import { storybookRedirect, storybookRedirectScript } from "../src/redirect.ts";
import {
  buildNav,
  hrefOf,
  pagesIn,
  routeFromPathname,
  routeOf,
  storybookHref,
  storyId,
  trail,
} from "../src/routes.ts";

describe("routeOf", () => {
  it("is the file's path under content/, with index.mdx its directory's", () => {
    expect(routeOf("./content/index.mdx")).toBe("/");
    expect(routeOf("./content/start.mdx")).toBe("/start/");
    expect(routeOf("./content/guidelines/index.mdx")).toBe("/guidelines/");
    expect(
      routeOf("./content/guidelines/patterns/choosing-a-control.mdx"),
    ).toBe("/guidelines/patterns/choosing-a-control/");
  });
});

describe("routeFromPathname", () => {
  it("takes the base off and puts the trailing slash on", () => {
    expect(routeFromPathname("/ui/", "/ui/")).toBe("/");
    expect(routeFromPathname("/ui", "/ui/")).toBe("/");
    expect(routeFromPathname("/ui/start/", "/ui/")).toBe("/start/");
    expect(routeFromPathname("/ui/start", "/ui/")).toBe("/start/");
    expect(routeFromPathname("/ui/start/index.html", "/ui/")).toBe("/start/");
    expect(routeFromPathname("/start/", "/")).toBe("/start/");
  });

  it("round-trips hrefOf", () => {
    for (const base of ["/", "/ui/"]) {
      for (const route of ["/", "/start/", "/guidelines/patterns/forms/"]) {
        expect(routeFromPathname(hrefOf(route, base), base)).toBe(route);
      }
    }
  });
});

describe("storybook links", () => {
  it("spells ids as Storybook's sanitize does", () => {
    expect(storyId("ui/Primitives/Switch")).toBe("ui-primitives-switch");
    expect(storyId("ui-hex/HexView")).toBe("ui-hex-hexview");
    expect(storyId("ui/Hooks/useSlashShortcut")).toBe(
      "ui-hooks-useslashshortcut",
    );
  });

  it("go under the base", () => {
    expect(storybookHref("/ui/")).toBe("/ui/storybook/");
    expect(storybookHref("/", "ui/Primitives/Switch")).toBe(
      "/storybook/?path=/docs/ui-primitives-switch--docs",
    );
  });
});

describe("the ?path= redirect", () => {
  it("sends a link written for Storybook at the root to storybook/", () => {
    expect(
      storybookRedirect("?path=/docs/ui-primitives-switch--docs", "", "/ui/"),
    ).toBe("/ui/storybook/?path=/docs/ui-primitives-switch--docs");
    expect(
      storybookRedirect("?path=/story/x--y&globals=theme:nord", "#top", "/"),
    ).toBe("/storybook/?path=/story/x--y&globals=theme:nord#top");
  });

  it("leaves every other URL alone", () => {
    expect(storybookRedirect("", "", "/")).toBeNull();
    expect(storybookRedirect("?q=switch", "#path", "/")).toBeNull();
  });

  it("runs as an inline script", () => {
    let replaced: string | undefined;
    const location = {
      search: "?path=/docs/a--docs",
      hash: "",
      replace: (to: string) => {
        replaced = to;
      },
    };
    new Function("location", storybookRedirectScript("/ui/"))(location);
    expect(replaced).toBe("/ui/storybook/?path=/docs/a--docs");
  });
});

describe("buildNav", () => {
  const nav = buildNav([
    { route: "/", meta: { title: "Home" } },
    { route: "/start/", meta: { title: "Start", order: 1 } },
    { route: "/guidelines/", meta: { title: "Guidelines", order: 2 } },
    {
      route: "/guidelines/principles/",
      meta: { title: "Principles", order: 1 },
    },
    {
      route: "/guidelines/patterns/forms/",
      meta: { title: "Forms", order: 5 },
    },
    {
      route: "/guidelines/patterns/choosing-a-control/",
      meta: { title: "Choosing a control", order: 2 },
    },
    { route: "/guidelines/foundations/color/", meta: { title: "Color" } },
  ]);

  it("nests pages by path and sorts by order, then title", () => {
    expect(nav.children.map((node) => node.title)).toEqual([
      "Start",
      "Guidelines",
    ]);
    const guidelines = nav.children[1];
    expect(guidelines?.children.map((node) => node.title)).toEqual([
      "Principles",
      "Patterns",
      "Foundations",
    ]);
  });

  it("titles a directory without a page from its name and orders it by its first page", () => {
    const patterns = nav.children[1]?.children[1];
    expect(patterns).toMatchObject({
      title: "Patterns",
      page: false,
      order: 2,
    });
  });

  it("walks a route's trail and a section's reading order", () => {
    expect(
      trail(nav, "/guidelines/patterns/forms/").map((node) => node.title),
    ).toEqual(["Home", "Guidelines", "Patterns", "Forms"]);
    expect(trail(nav, "/nowhere/")).toEqual([]);
    const guidelines = nav.children[1];
    expect(guidelines && pagesIn(guidelines).map((node) => node.title)).toEqual(
      ["Guidelines", "Principles", "Choosing a control", "Forms", "Color"],
    );
  });
});
