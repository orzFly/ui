// What @orz/ui ships for agents beside its code: every page of the site as Markdown in docs/,
// and the skill in skills/orz-ui/, both with links that stay inside the package. Built from
// the same commit as the code, so they describe the installed version; neither is committed,
// and @orz/ui's prepack refuses to pack without them.
//
//   pnpm --filter @orz/docs build:package
import {
  cpSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { skillText } from "../../../scripts/readme.ts";
import { buildSite } from "./build.ts";

const APP = fileURLToPath(new URL("..", import.meta.url));
const UI = fileURLToPath(new URL("../../../packages/ui", import.meta.url));
const CACHE = join(APP, "node_modules/.cache/docs-package");

await buildSite({
  base: "/",
  outDir: join(CACHE, "site"),
  storybook: false,
  packageDir: join(CACHE, "package"),
});

const docs = join(UI, "docs");
const skills = join(UI, "skills");
rmSync(docs, { recursive: true, force: true });
rmSync(skills, { recursive: true, force: true });
cpSync(join(CACHE, "package/docs"), docs, { recursive: true });
mkdirSync(join(skills, "orz-ui"), { recursive: true });
writeFileSync(join(skills, "orz-ui/SKILL.md"), skillText("package"));
rmSync(CACHE, { recursive: true, force: true });

const files = [docs, skills].flatMap((dir) =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((file) => join(dir, file))
    .filter((file) => statSync(file).isFile()),
);
const bytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
console.log(
  `packages/ui: wrote ${files.length} files, ${bytes} bytes, into docs/ and skills/`,
);
