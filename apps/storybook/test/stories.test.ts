import { readdirSync, readFileSync } from "node:fs";
import { loadCsf } from "storybook/internal/csf-tools";
import { describe, expect, it } from "vitest";

const SRC = new URL("../src/", import.meta.url);
const PACKAGES = new URL("../../../packages/", import.meta.url);

const GROUPS = new Set(["Foundations", "Primitives", "Hooks"]);
const TITLE = /^([a-z0-9-]+)\/(?:([A-Z][A-Za-z]*)\/)?([A-Za-z][A-Za-z0-9]*)$/;
const HOOK = /^use[A-Z]/;
const DECLARED =
  /^export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm;
const LISTED = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;
const IMPORT = /\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const TEST_DIR = /(?:^|\/)test\//;
const PREVIEW_API = /^import\s+\{([^}]*)\}\s+from\s+"storybook\/preview-api"/gm;

const packages = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const exported = new Map<string, Set<string>>();
/** Every name a package's source exports, from any module: a superset of its entry points. */
function exportsOf(pkg: string): Set<string> {
  const cached = exported.get(pkg);
  if (cached) return cached;
  const names = new Set<string>();
  const src = new URL(`${pkg}/src/`, PACKAGES);
  for (const file of readdirSync(src, { recursive: true, encoding: "utf8" })) {
    if (!/\.tsx?$/.test(file)) continue;
    const text = readFileSync(new URL(file, src), "utf8");
    for (const [, name] of text.matchAll(DECLARED)) if (name) names.add(name);
    for (const [, list = ""] of text.matchAll(LISTED)) {
      for (const part of list.split(",")) {
        const name = part
          .replace(/^\s*type\s+/, "")
          .split(/\s+as\s+/)
          .at(-1)
          ?.trim();
        if (name) names.add(name);
      }
    }
  }
  exported.set(pkg, names);
  return names;
}

const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).sort();
// Storybook's own CSF parser, on the file's text: a template literal holding
// sample code has `export function` lines and `title:` keys a regex would take.
const stories = files
  .filter((file) => file.endsWith(".stories.tsx"))
  .map((file) => {
    const text = readFileSync(new URL(file, SRC), "utf8");
    const csf = loadCsf(text, { fileName: file, makeTitle: (title) => title });
    return { file, text, csf: csf.parse() };
  });
type StoryFile = (typeof stories)[number];

const titleOf = ({ csf }: StoryFile) => csf.meta?.title ?? "";
const tagsOf = ({ csf }: StoryFile, name: string) => [
  ...(csf.meta?.tags ?? []),
  ...(csf._stories[name]?.tags ?? []),
];
const isEdge = (story: StoryFile, name: string) =>
  tagsOf(story, name).includes("edge");

function titleProblem(title: string): string | null {
  const match = TITLE.exec(title);
  if (!match) return "is not <pkg-dir>/[Group/]<Export>";
  const [, pkg = "", group, name = ""] = match;
  if (!packages.includes(pkg)) return `${pkg} is not a directory in packages/`;
  if (group !== undefined && (pkg !== "ui" || !GROUPS.has(group)))
    return `${group} is not one of @orz/ui's groups`;
  if (pkg === "ui" && (group === "Hooks") !== HOOK.test(name))
    return "a hook goes in ui/Hooks, and only a hook";
  // A renderer page, and the foundations, which are not one export.
  if (name === "Content" || group === "Foundations") return null;
  return exportsOf(pkg).has(name)
    ? null
    : `${name} is not exported by packages/${pkg}`;
}

function openingProblem(story: StoryFile): string | null {
  const { text, csf } = story;
  const names = Object.keys(csf._stories);
  const [pkg = "", ...rest] = titleOf(story).split("/");
  // csf-tools gives the meta's `component` as printed source, so
  // `X as ComponentType<Args>` arrives whole; the type belongs in `satisfies`.
  const component = csf.meta?.component;
  // ui-content/Content is the Content component's own page, so it is a component page.
  if (pkg !== "ui-content" && rest.at(-1) === "Content") {
    if (component !== undefined) return "a renderer page sets no component";
    const strays = names.filter(
      (name) =>
        !isEdge(story, name) &&
        !exportsOf(pkg).has(
          `${name.charAt(0).toLowerCase()}${name.slice(1)}Content`,
        ),
    );
    return strays.length > 0
      ? `${strays.join(", ")} not named after a renderer`
      : null;
  }
  if (component !== undefined) {
    if (!/^[A-Za-z_$][\w$]*$/.test(component))
      return `component ${component} is not a plain identifier`;
    const imported = new RegExp(
      String.raw`^import\s+\{[^}]*\b${component}\b[^}]*\}\s+from\s+"@orz/`,
      "m",
    );
    if (!imported.test(text))
      return `component ${component} is not imported from an @orz/ package`;
  }
  const want = component === undefined ? "Usage" : "Playground";
  const [first = ""] = names;
  return first === want && !isEdge(story, first)
    ? null
    : `opens with ${first}, not ${want}`;
}

describe("stories", () => {
  it("finds the story files", () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  it("title their pages <pkg-dir>/[Group/]<Export>", () => {
    const problems = stories.flatMap((s) => {
      const p = titleProblem(titleOf(s));
      return p ? [`${s.file}: ${titleOf(s)} ${p}`] : [];
    });
    expect(problems).toEqual([]);
  });

  it("give no two files one title", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const s of stories) {
      const other = seen.get(titleOf(s));
      if (other) clashes.push(`${other} and ${s.file}: ${titleOf(s)}`);
      else seen.set(titleOf(s), s.file);
    }
    expect(clashes).toEqual([]);
  });

  it("open with Playground, Usage where there is no component, or a renderer story", () => {
    const problems = stories.flatMap((s) => {
      const p = openingProblem(s);
      return p ? [`${s.file}: ${p}`] : [];
    });
    expect(problems).toEqual([]);
  });

  it("import nothing from a test directory", () => {
    const imports = files
      .filter((f) => /\.tsx?$/.test(f))
      .flatMap((f) =>
        [...readFileSync(new URL(f, SRC), "utf8").matchAll(IMPORT)]
          .map(([, path = ""]) => path)
          .filter((p) => TEST_DIR.test(p))
          .map((p) => `${f}: ${p}`),
      );
    expect(imports).toEqual([]);
  });

  // React re-renders a render that holds React state on its own, after
  // Storybook has dropped the story's context, and `useArgs` throws there.
  it("call no Storybook hook: args go back through argsUpdater", () => {
    const hooks = files
      .filter((f) => /\.tsx?$/.test(f))
      .flatMap((f) =>
        [...readFileSync(new URL(f, SRC), "utf8").matchAll(PREVIEW_API)]
          .flatMap(([, list = ""]) => list.split(","))
          .map((name) => name.trim())
          .filter((name) => HOOK.test(name))
          .map((name) => `${f}: ${name}`),
      );
    expect(hooks).toEqual([]);
  });

  it("keep edge stories off the docs page", () => {
    const leaks = stories.flatMap((s) => [
      ...(s.csf.meta?.tags?.includes("edge")
        ? [`${s.file}: edge on the meta`]
        : []),
      ...Object.keys(s.csf._stories)
        .filter((n) => isEdge(s, n) && !tagsOf(s, n).includes("!autodocs"))
        .map((n) => `${s.file}: ${n}`),
    ]);
    expect(leaks).toEqual([]);
  });
});
