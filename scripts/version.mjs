#!/usr/bin/env node
// Every published package shares one version.
//
//   node scripts/version.mjs set <version>     write it into every package
//   node scripts/version.mjs check <version>   fail unless every package already has it
//   node scripts/version.mjs snapshot <sha> <unix-time>
//                                              set a `master` prerelease and print it
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "packages");
const manifests = readdirSync(root).map((dir) =>
  join(root, dir, "package.json"),
);
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const write = (file, pkg) =>
  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z.-]+)?$/;

function set(version, { pin = false } = {}) {
  if (!SEMVER.test(version)) throw new Error(`not a version: ${version}`);
  for (const file of manifests) {
    const pkg = read(file);
    pkg.version = version;
    if (pin) {
      // `workspace:^` publishes as `^<version>`, and a caret on a prerelease also accepts a
      // sibling's other snapshots of the same patch. A snapshot depends on exactly its own set.
      for (const deps of [pkg.dependencies, pkg.peerDependencies]) {
        for (const [name, range] of Object.entries(deps ?? {})) {
          if (range.startsWith("workspace:")) deps[name] = "workspace:*";
        }
      }
    }
    write(file, pkg);
  }
}

function check(version) {
  const wrong = manifests
    .map((file) => read(file))
    .filter((pkg) => pkg.version !== version)
    .map((pkg) => `${pkg.name}@${pkg.version}`);
  if (wrong.length > 0)
    throw new Error(`expected ${version}, found ${wrong.join(", ")}`);
}

function snapshot(sha, time) {
  const versions = new Set(manifests.map((file) => read(file).version));
  if (versions.size !== 1)
    throw new Error(`packages disagree: ${[...versions].join(", ")}`);
  const [, major, minor, patch] = SEMVER.exec([...versions][0]);
  // The commit time keeps snapshots in order, which the hash alone does not, and keeps a rerun
  // of the same commit on the same version. The `g` keeps an all-digit hash from reading as a
  // number, which semver forbids to start with 0.
  const stamp = new Date(Number(time) * 1000)
    .toISOString()
    .replace(/\D/g, "")
    .slice(0, 14);
  const version = `${major}.${minor}.${Number(patch) + 1}-master.${stamp}.g${sha.slice(0, 7)}`;
  set(version, { pin: true });
  return version;
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "set" && args.length === 1) set(args[0]);
  else if (command === "check" && args.length === 1) check(args[0]);
  else if (command === "snapshot" && args.length === 2)
    console.log(snapshot(...args));
  else {
    console.error(
      "usage: version.mjs set <version> | check <version> | snapshot <sha> <unix-time>",
    );
    process.exit(2);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
