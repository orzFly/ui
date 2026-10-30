import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// @orz/ui's own faces, resolved from it: the app does not depend on them.
const require = createRequire(
  fileURLToPath(new URL("../../../packages/ui/package.json", import.meta.url)),
);

const FACES = [
  "@fontsource-variable/noto-sans",
  "@fontsource-variable/noto-sans-mono",
].map((pkg) => require.resolve(`${pkg}/wght.css`));

/** Where the manager's index.html finds the files, relative to itself. */
export const MANAGER_FONTS_AT = "fonts";

/**
 * The faces' `@font-face` rules for the manager's head, and the directory
 * that serves their files. The manager is not built by Vite, so nothing
 * would bundle `styles.css`'s imports. The URLs are relative so they hold
 * under the docs site's `storybook/` and the `/ui/` base.
 */
export function managerFonts(): { head: string; dir: string } {
  // Only the files the rules name: each package also ships its other axes
  // and formats, several megabytes the deployed site would carry for nothing.
  const dir = fileURLToPath(
    new URL("../node_modules/.cache/orz-manager-fonts", import.meta.url),
  );
  mkdirSync(dir, { recursive: true });
  const rules = FACES.map((css) =>
    readFileSync(css, "utf8").replaceAll(
      /url\(\.\/files\/([^)]+)\)/g,
      (_, file: string) => {
        copyFileSync(join(dirname(css), "files", file), join(dir, file));
        return `url(./${MANAGER_FONTS_AT}/${file})`;
      },
    ),
  );
  return {
    head: `<style>\n${rules.join("\n")}</style>`,
    dir,
  };
}
