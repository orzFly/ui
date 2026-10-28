/** A file a demo's Code view shows. */
export interface DemoFile {
  /** Its key in `?source=`: the path under the demo's directory, or the fixture's import path. */
  name: string;
  group: "demo" | "fixtures";
  contents: string;
}

type Loaders = Record<string, () => Promise<string>>;

// Lazy, so a page only fetches a demo's source when its Code view opens.
const DEMO_FILES: Loaders = import.meta.glob<string>("./*/**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
});
// Only the text ones: a binary fixture reaches a demo as a URL, not as source.
const FIXTURE_FILES: Loaders = import.meta.glob<string>(
  "../../../fixtures/src/**/*.{ts,tsx,md,patch,cast,json,txt,html,svg}",
  { query: "?raw", import: "default" },
);
const FIXTURES_DIR = "../../../fixtures/src/";
const FIXTURES = "@orz/fixtures/";

const FIXTURE_IMPORT = /\bfrom\s+["']@orz\/fixtures\/([^"'?]+)/g;

/** A demo's own files, by name: its `<dir>.tsx` first, the rest in path order. */
export function demoFileNames(dir: string): string[] {
  const prefix = `./${dir}/`;
  return Object.keys(DEMO_FILES)
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length))
    .sort(
      (a, b) =>
        Number(b === `${dir}.tsx`) - Number(a === `${dir}.tsx`) ||
        a.localeCompare(b),
    );
}

/** The fixtures `sources` import, each once, in path order. */
export function fixtureImports(sources: readonly string[]): string[] {
  const paths = new Set<string>();
  for (const source of sources) {
    for (const [, path] of source.matchAll(FIXTURE_IMPORT)) {
      if (path && `${FIXTURES_DIR}${path}` in FIXTURE_FILES) paths.add(path);
    }
  }
  return [...paths].sort();
}

function load(loaders: Loaders, path: string): Promise<string> {
  const loader = loaders[path];
  if (loader === undefined) throw new Error(`${path}: no such file`);
  return loader();
}

/** A demo's files, then the text fixtures they import. */
export async function loadDemoFiles(dir: string): Promise<DemoFile[]> {
  const own = await Promise.all(
    demoFileNames(dir).map(async (name) => ({
      name,
      group: "demo" as const,
      contents: await load(DEMO_FILES, `./${dir}/${name}`),
    })),
  );
  const fixtures = await Promise.all(
    fixtureImports(own.map((file) => file.contents)).map(async (path) => ({
      name: `${FIXTURES}${path}`,
      group: "fixtures" as const,
      contents: await load(FIXTURE_FILES, `${FIXTURES_DIR}${path}`),
    })),
  );
  return [...own, ...fixtures];
}
