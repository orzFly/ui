// The `pnpm add` lines for every package, worked out from the package.json files and the imports
// in src/, so that no README or docs page lists a package's peers by hand. scripts/readme.ts
// writes them into the READMEs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES = join(ROOT, "packages");
const WIDTH = 100;

export interface Manifest {
  name: string;
  description?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  exports?: Record<string, string | Record<string, string>>;
}

export interface Workspace {
  dir: string;
  manifest: Manifest;
}

export interface OptionalInstall {
  /** The optional peers these entry points import, and what they need that the required line does not install. */
  packages: string[];
  /** The entry points, as an app imports them. */
  for: string[];
}

export interface Install {
  name: string;
  /** The package, then everything an app installs beside it. */
  packages: string[];
  optional: OptionalInstall[];
}

export function workspaces(): Map<string, Workspace> {
  const found = new Map<string, Workspace>();
  for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
    const file = join(PACKAGES, entry.name, "package.json");
    if (!entry.isDirectory() || !existsSync(file)) continue;
    const manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest;
    if (!manifest.private) {
      found.set(manifest.name, { dir: join(PACKAGES, entry.name), manifest });
    }
  }
  return found;
}

const isOrz = (name: string) => name.startsWith("@orz/");

/**
 * What an app installs to use `start`: the required peers, because pnpm does not put a peer
 * in place for it, and the `@orz/` dependencies, because their exports are part of the
 * dependent's API (`@orz/ui`'s theme store takes `@orz/themes`' themes) and pnpm does not
 * hoist a dependency where the app can import it. Both again for each of those.
 */
function needs(start: string, all: Map<string, Workspace>): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  for (let name = queue.shift(); name; name = queue.shift()) {
    if (seen.has(name)) continue;
    seen.add(name);
    const manifest = all.get(name)?.manifest;
    if (!manifest) continue;
    const meta = manifest.peerDependenciesMeta ?? {};
    for (const peer of Object.keys(manifest.peerDependencies ?? {})) {
      if (!meta[peer]?.optional) queue.push(peer);
    }
    queue.push(...Object.keys(manifest.dependencies ?? {}).filter(isOrz));
  }
  return seen;
}

/** `first`, then the `@orz/` packages, then the rest, each group by name. */
function ordered(names: Iterable<string>, first?: string): string[] {
  const rest = [...new Set(names)].filter((name) => name !== first);
  const byName = (a: string, b: string) => a.localeCompare(b);
  return [
    ...(first ? [first] : []),
    ...rest.filter(isOrz).sort(byName),
    ...rest.filter((name) => !isOrz(name)).sort(byName),
  ];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(join(dir, "src"), { recursive: true, encoding: "utf8" })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .map((file) => join(dir, "src", file));
}

const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*"([^"]+)"/g;

/** The entry points of a package whose module graph imports `peer` or one of its subpaths. */
export function entriesImporting(workspace: Workspace, peer: string): string[] {
  const { dir, manifest } = workspace;
  const importers = new Map<string, string[]>();
  const reached: string[] = [];
  for (const file of sourceFiles(dir)) {
    for (const [, spec = ""] of readFileSync(file, "utf8").matchAll(IMPORT)) {
      if (spec === peer || spec.startsWith(`${peer}/`)) reached.push(file);
      if (spec.startsWith(".")) {
        const target = join(dirname(file), spec);
        importers.set(target, [...(importers.get(target) ?? []), file]);
      }
    }
  }
  const seen = new Set<string>();
  for (let file = reached.pop(); file; file = reached.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    reached.push(...(importers.get(file) ?? []));
  }
  const entries = new Set<string>();
  for (const file of seen) {
    const path = `./${relative(dir, file)}`;
    for (const [key, target] of Object.entries(manifest.exports ?? {})) {
      const source =
        typeof target === "string" ? target : target["@orz/source"];
      if (!source) continue;
      const [before = "", after = ""] = source.split("*");
      const star = source.includes("*");
      if (
        star
          ? !(path.startsWith(before) && path.endsWith(after))
          : path !== source
      ) {
        continue;
      }
      const stem = star
        ? path.slice(before.length, path.length - after.length)
        : "";
      entries.add(`${manifest.name}${key.slice(1).replace("*", stem)}`);
    }
  }
  return [...entries].sort();
}

export function install(name: string, all = workspaces()): Install {
  const workspace = all.get(name);
  if (!workspace) throw new Error(`${name}: not a published workspace package`);
  const required = needs(name, all);
  const { peerDependencies = {}, peerDependenciesMeta = {} } =
    workspace.manifest;
  // Peers that the same entry points import share one line.
  const groups = new Map<string, OptionalInstall>();
  for (const peer of Object.keys(peerDependencies)) {
    if (!peerDependenciesMeta[peer]?.optional || required.has(peer)) continue;
    const entries = entriesImporting(workspace, peer);
    if (entries.length === 0) {
      throw new Error(
        `${name}: no entry point imports its optional peer ${peer}`,
      );
    }
    const key = entries.join(" ");
    const group = groups.get(key) ?? { packages: [], for: entries };
    group.packages.push(...needs(peer, all));
    groups.set(key, group);
  }
  const optional = [...groups.values()]
    .map((group) => ({
      ...group,
      packages: ordered(group.packages.filter((need) => !required.has(need))),
    }))
    .sort((a, b) => a.for.join(" ").localeCompare(b.for.join(" ")));
  return { name, packages: ordered(required, name), optional };
}

export function installs(all = workspaces()): Install[] {
  return [...all.keys()].sort().map((name) => install(name, all));
}

/** One `pnpm add` line, broken with `\` where it passes `WIDTH` columns. */
export function command(packages: string[], width = WIDTH): string {
  const lines = ["pnpm add"];
  for (const name of packages) {
    const last = lines.length - 1;
    if (`${lines[last]} ${name} \\`.length > width) {
      lines[last] += " \\";
      lines.push(`  ${name}`);
    } else {
      lines[last] += ` ${name}`;
    }
  }
  return lines.join("\n");
}

/** The whole install block: the required line, then each optional line under what needs it. */
export function block({ packages, optional }: Install, width = WIDTH): string {
  return [
    command(packages, width),
    ...optional.flatMap((group) => [
      `# only for ${group.for.join(", ")}:`,
      command(group.packages, width),
    ]),
  ].join("\n");
}

/** An install as text: the README's block, and each line unbroken for a table cell. */
export interface InstallText {
  name: string;
  block: string;
  command: string;
  optional: { for: string[]; command: string }[];
}

export function installText(install: Install): InstallText {
  return {
    name: install.name,
    block: block(install),
    command: command(install.packages, Infinity),
    optional: install.optional.map((group) => ({
      for: group.for,
      command: command(group.packages, Infinity),
    })),
  };
}
