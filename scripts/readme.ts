// Keeps what each README, and the @orz/ui skill's template, restates from the code in step with
// it: the install block, the themes table, the rows of the entry-point table, and the skill's
// site links and package list; then writes skills/orz-ui/SKILL.md, the template without its
// block markers.
//
//   node scripts/readme.ts          rewrite what is stale
//   node scripts/readme.ts --check  fail if anything is stale
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { block, install, type Workspace, workspaces } from "./install.ts";
import { siteUrl } from "./site.ts";
import { themeMarkdown, themeTable } from "./themes.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** What fills a generated block, by the kind its opening comment names. */
const GENERATORS: Record<
  string,
  { source: string; text: (workspace: Workspace) => string }
> = {
  install: {
    source: "a peer",
    text: ({ manifest }) =>
      `\`\`\`bash\n${block(install(manifest.name, all))}\n\`\`\``,
  },
  themes: {
    source: "a built-in theme",
    text: () => themeMarkdown(themeTable()),
  },
  site: {
    source: "package.json's homepage",
    text: () => {
      const site = siteUrl();
      return [
        `- Guidelines, every page as Markdown: ${site}llms.txt`,
        `- Setup: ${site}start/index.md`,
        `- Props of every export: ${site}storybook/`,
      ].join("\n");
    },
  },
  packages: {
    source: "a package's description",
    text: () =>
      [...all.values()]
        .map(
          ({ manifest }) =>
            `- \`${manifest.name}\`: ${manifest.description ?? ""}`,
        )
        .join("\n"),
  },
};

/**
 * The @orz/ui skill: a template filled from the @orz/ui workspace like its README, and the
 * skill an agent reads, which is the template without the block markers. The template lives
 * outside skills/, which an installer copies whole.
 */
const SKILL_TEMPLATE = join(ROOT, "scripts/templates/orz-ui-skill.md");
const SKILL = join(ROOT, "skills/orz-ui/SKILL.md");

const MARKER = /^<!-- (?:generated:[\w-]+ [^\n]*|\/generated) -->\n/gm;

const opening = (kind: string) =>
  `<!-- generated:${kind} by scripts/readme.ts: run \`pnpm fmt\` after changing ${GENERATORS[kind]?.source} -->`;
const CLOSING = "<!-- /generated -->";
// `??`: an empty block ends at its own closing comment, not the next block's.
const BLOCK =
  /<!-- generated:([\w-]+) [^\n]*-->\n(?:[\s\S]*?\n)??<!-- \/generated -->/g;

/**
 * Every README needs an install block; a block of another kind is where its README put one.
 * The skill has none (`needsInstall` false): it outlives the install lines, so it sends an
 * agent to the current ones.
 */
function syncBlocks(
  text: string,
  workspace: Workspace,
  problems: string[],
  needsInstall = true,
) {
  const kinds = new Set<string>();
  const next = text.replace(BLOCK, (_whole, kind: string) => {
    const generator = GENERATORS[kind];
    if (!generator) {
      problems.push(`unknown generated block "${kind}"`);
      return _whole;
    }
    kinds.add(kind);
    return `${opening(kind)}\n${generator.text(workspace)}\n${CLOSING}`;
  });
  if (needsInstall && !kinds.has("install")) {
    problems.push(
      `no install block: add ${opening("install")} and ${CLOSING} under ## Install`,
    );
  }
  return next;
}

const ENTRY_POINTS = /^## Entry points\n[\s\S]*?(?=^## |(?![\s\S]))/m;
const ROW = /^\| `([^`]+)` \|(.*)\|$/;

/**
 * The files a wildcard export reaches, as the names an app puts in its place. A subpath
 * is one level, as `tsc` builds it: `./src/components/*.tsx` is a file in components/.
 */
function stems(dir: string, source: string): string[] {
  const [before = "", after = ""] = source.split("*");
  return readdirSync(join(dir, before), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(after))
    .map((entry) => entry.name.slice(0, -after.length || undefined))
    .filter((stem) => !stem.endsWith(".test"))
    .sort();
}

/**
 * The entry-point table names each export of package.json once, and nothing else. A
 * wildcard export's row lists the names it reaches; every other row's contents are
 * written by hand.
 */
function syncEntryPoints(
  text: string,
  { dir, manifest }: Workspace,
  problems: string[],
) {
  const exportsMap = manifest.exports ?? {};
  const keys = Object.keys(exportsMap);
  const section = ENTRY_POINTS.exec(text)?.[0];
  if (!section) {
    if (keys.length > 1) {
      problems.push("no ## Entry points table, though it has several exports");
    }
    return text;
  }
  const entryOf = (key: string, stem = "<name>") =>
    `${manifest.name}${key.slice(1).replace("*", stem)}`;
  const stemsOf = (key: string) => {
    const target = exportsMap[key];
    const source =
      typeof target === "string" ? target : target?.["@orz/source"];
    return source ? stems(dir, source) : [];
  };
  // A wildcard export takes one row listing what it reaches, or a row for each of them.
  const expected = new Map(keys.map((key) => [entryOf(key), key]));
  const each = new Map(
    keys
      .filter((key) => key.includes("*"))
      .flatMap((key) => stemsOf(key).map((stem) => [entryOf(key, stem), key])),
  );
  const seen = new Set<string>();
  const rewritten = section
    .split("\n")
    .map((line) => {
      const [, entry = "", contents = ""] = ROW.exec(line) ?? [];
      if (!entry) return line;
      const key = expected.get(entry) ?? each.get(entry);
      if (key === undefined) {
        problems.push(
          `entry-point row for ${entry}, which exports no such path`,
        );
        return line;
      }
      seen.add(entry);
      if (!expected.has(entry) || !key.includes("*")) return line;
      const names = stemsOf(key).map((stem) => `\`${stem}\``);
      return names.join(", ") === contents.trim()
        ? line
        : `| \`${entry}\` | ${names.join(", ")} |`;
    })
    .join("\n");
  for (const [entry, key] of expected) {
    if (seen.has(entry)) continue;
    const missing = key.includes("*")
      ? stemsOf(key)
          .map((stem) => entryOf(key, stem))
          .filter((one) => !seen.has(one))
      : [entry];
    if (key.includes("*") && missing.length === stemsOf(key).length) {
      problems.push(`no entry-point row for ${entry}`);
    } else {
      for (const one of missing) problems.push(`no entry-point row for ${one}`);
    }
  }
  return text.replace(section, rewritten);
}

const all = workspaces();

function sync(check: boolean): string[] {
  const out: string[] = [];
  for (const workspace of all.values()) {
    const file = join(workspace.dir, "README.md");
    const text = readFileSync(file, "utf8");
    const problems: string[] = [];
    const next = syncEntryPoints(
      syncBlocks(text, workspace, problems),
      workspace,
      problems,
    );
    const name = relative(ROOT, file);
    out.push(...problems.map((problem) => `${name}: ${problem}`));
    if (next === text) continue;
    if (check) out.push(`${name}: stale; run \`pnpm fmt\``);
    else writeFileSync(file, next);
  }
  const ui = all.get("@orz/ui");
  if (!ui) throw new Error("no @orz/ui workspace");
  const template = readFileSync(SKILL_TEMPLATE, "utf8");
  const problems: string[] = [];
  const filled = syncBlocks(template, ui, problems, false);
  out.push(
    ...problems.map(
      (problem) => `${relative(ROOT, SKILL_TEMPLATE)}: ${problem}`,
    ),
  );
  for (const [file, want] of [
    [SKILL_TEMPLATE, filled],
    [SKILL, filled.replace(MARKER, "")],
  ] as const) {
    const has = existsSync(file) ? readFileSync(file, "utf8") : "";
    if (has === want) continue;
    if (check) out.push(`${relative(ROOT, file)}: stale; run \`pnpm fmt\``);
    else writeFileSync(file, want);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = sync(process.argv.includes("--check"));
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
}
