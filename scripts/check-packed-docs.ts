// @orz/ui's prepack: the package ships the skill and every page of the site as Markdown, which
// are built rather than committed, so a pack without them would publish a package whose skill
// is missing. Run from packages/ui.
import { existsSync } from "node:fs";

const missing = ["docs/llms.txt", "skills/orz-ui/SKILL.md"].filter(
  (file) => !existsSync(file),
);
if (missing.length > 0) {
  console.error(
    `@orz/ui: no ${missing.join(" or ")}; run pnpm --filter @orz/docs build:package first`,
  );
  process.exit(1);
}
