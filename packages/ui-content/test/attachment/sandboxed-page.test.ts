import { describe, expect, it } from "vitest";
import { sandboxedPage } from "../../src/attachment/sandboxed-page.ts";

describe("sandboxedPage", () => {
  it("frames the file sandboxed to scripts alone, as an HTML page", async () => {
    const page = sandboxedPage("shot.png", "blob:https://app.example/1");
    expect(page.type).toBe("text/html");
    const html = await page.text();
    expect(html).toContain(
      '<iframe sandbox="allow-scripts" title="shot.png" src="blob:https://app.example/1">',
    );
    expect(html).toContain("<title>shot.png</title>");
  });

  it("escapes a name that would otherwise write markup", async () => {
    const html = await sandboxedPage(
      '<b>"x" & y</b>.html',
      "blob:https://app.example/2",
    ).text();
    expect(html).not.toContain("<b>");
    expect(html).toContain("&#60;b&#62;&#34;x&#34; &#38; y&#60;/b&#62;.html");
  });
});
