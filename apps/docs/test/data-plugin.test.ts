import { statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataPlugin } from "../scripts/plugins.ts";

const IDS = [
  "virtual:orz-install",
  "virtual:orz-packages",
  "virtual:orz-themes",
  "virtual:orz-demo-api",
  "virtual:orz-ui-source",
];

describe("dataPlugin", () => {
  // Vite dev resolves every watched path as an import of the virtual module, so a directory
  // fails the page there while the build, which never resolves them, passes.
  it.each(IDS)("%s watches only files", (id) => {
    const plugin = dataPlugin();
    const resolveId = plugin.resolveId as (id: string) => string | undefined;
    const load = plugin.load as (this: unknown, id: string) => string;
    const watched: string[] = [];
    load.call(
      { addWatchFile: (file: string) => watched.push(file) },
      resolveId(id) as string,
    );
    expect(watched.length).toBeGreaterThan(0);
    expect(watched.filter((file) => !statSync(file).isFile())).toEqual([]);
  });
});
