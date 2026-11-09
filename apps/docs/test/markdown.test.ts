import { describe, expect, it } from "vitest";
import { pageMarkdown } from "../scripts/markdown.ts";

const META = { title: "Forms", description: "A column of labelled fields." };

const page = (body: string) =>
  `<html><body><nav><a href="/ui/start/">Start</a></nav><article data-pagefind-body>${body}</article></body></html>`;

describe("pageMarkdown", () => {
  it("keeps the indexed body only, with what search skips left out", async () => {
    const md = await pageMarkdown(
      page(
        `<h1>Forms</h1><p>Body text.</p><div data-pagefind-ignore><button>Pointer</button></div>`,
      ),
      META,
      "/ui/",
    );
    expect(md).toContain("# Forms");
    expect(md).toContain("Body text.");
    expect(md).not.toContain("Pointer");
    // The site's nav is outside the body.
    expect(md).not.toContain("[Start]");
  });

  it("writes a table as a GFM table", async () => {
    const md = await pageMarkdown(
      page(
        "<h1>Forms</h1><table><thead><tr><th>Use</th><th>When</th></tr></thead><tbody><tr><td>Switch</td><td>At once</td></tr></tbody></table>",
      ),
      META,
      "/ui/",
    );
    expect(md).toMatch(/\| Use +\| When +\|/);
    expect(md).toMatch(/\| Switch +\| At once +\|/);
  });

  it("points a link to one of the site's pages at its Markdown copy", async () => {
    const md = await pageMarkdown(
      page(
        '<h1>Forms</h1><p><a href="/ui/guidelines/patterns/overlays/#which-one">Overlays</a>, <a href="/ui/storybook/?path=/docs/x">Storybook</a>, <a href="https://example.com/">out</a></p>',
      ),
      META,
      "/ui/",
    );
    expect(md).toContain(
      "[Overlays](/ui/guidelines/patterns/overlays/index.md#which-one)",
    );
    expect(md).toContain("[Storybook](/ui/storybook/?path=/docs/x)");
    expect(md).toContain("[out](https://example.com/)");
  });

  it("links the package's copy of a page relatively, and the rest of the site by its address", async () => {
    const html = page(
      '<h1>Forms</h1><p><a href="/ui/guidelines/patterns/forms/#x">Forms</a>, <a href="/ui/guidelines/patterns/navigation/">Navigation</a>, <a href="/ui/storybook/?path=/docs/x">Storybook</a>, <a href="/ui/llms.txt">Index</a>, <a href="https://example.com/">out</a>, <a href="#here">here</a></p>',
    );
    const site = "https://docs.example/ui/";
    const from = (route: string) =>
      pageMarkdown(html, META, "/ui/", { kind: "package", route, site });
    const nested = await from("/guidelines/patterns/navigation/");
    expect(nested).toContain("[Forms](../forms/index.md#x)");
    expect(nested).toContain("[Navigation](index.md)");
    expect(nested).toContain(
      "[Storybook](https://docs.example/ui/storybook/?path=/docs/x)",
    );
    expect(nested).toContain("[Index](https://docs.example/ui/llms.txt)");
    expect(nested).toContain("[out](https://example.com/)");
    expect(nested).toContain("[here](#here)");
    expect(await from("/")).toContain(
      "[Forms](guidelines/patterns/forms/index.md#x)",
    );
  });

  it("titles a bare page from its meta, and drops an h1 that only repeats it", async () => {
    const md = await pageMarkdown(
      '<html><body><main data-pagefind-body data-title="Forms"><div><h1>Forms</h1></div><p>A demo.</p></main></body></html>',
      META,
      "/ui/",
    );
    expect(md).toBe("# Forms\n\nA column of labelled fields.\n\nA demo.\n");
  });
});
