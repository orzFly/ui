// The public docs site's address, read from the root package.json's `homepage`, so that what
// links to it from outside the site (the skill, the home page's install command) never writes
// it by hand.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MANIFEST = fileURLToPath(new URL("../package.json", import.meta.url));

/** `https://…/ui/`, ending in a slash. */
export function siteUrl(): string {
  const { homepage } = JSON.parse(readFileSync(MANIFEST, "utf8")) as {
    homepage?: string;
  };
  if (!homepage?.endsWith("/")) {
    throw new Error(
      `package.json: homepage must be the site's URL ending in /, got ${homepage}`,
    );
  }
  return homepage;
}
