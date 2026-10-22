import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Not `new URL(…, import.meta.url)`: under happy-dom `URL` is the window's
// class, which node:fs refuses as a file URL.
const STYLES = readFileSync(join(import.meta.dirname, "../styles.css"), "utf8");

describe("styles.css", () => {
  it("styles the markdown body", () => {
    expect(STYLES).toContain(".markdown-body");
  });

  // These rules came out of an app whose review and diagram surfaces this
  // package does not ship; a leftover selector would be dead weight at best.
  it("carries no app-only spec or mermaid rules", () => {
    expect(STYLES).not.toMatch(/spec-/);
    expect(STYLES).not.toMatch(/mermaid/);
  });

  // The package's components render no utility classes, so the file needs no
  // @source, and it imports nothing a consumer has not already imported.
  it("uses no Tailwind directives", () => {
    expect(STYLES).not.toMatch(/@(apply|source|import)\b/);
  });
});
