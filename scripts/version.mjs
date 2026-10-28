#!/usr/bin/env node
/**
 * Keeps the app version in step across app.json, package.json and
 * package-lock.json, and checks that a branch raises it.
 *
 *   node scripts/version.mjs bump <patch|minor|major|x.y.z>
 *   node scripts/version.mjs check [--against <git ref>]
 *
 * `bump` is run by hand (`npm run version:bump -- minor`): only a person can
 * judge whether a change is a fix, a feature or a breaking change. `check`
 * runs in CI. On its own it fails when the three files disagree; with
 * `--against` it also fails when the branch changes the app without raising
 * the version above the one on that ref.
 *
 * The Android versionCode is not touched: EAS increments it remotely.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const KINDS = ["patch", "minor", "major"];

/** Paths that never reach the app binary, so changing only these needs no bump. */
const NON_APP_PATH = /^(docs\/|\.github\/|\.claude\/|scripts\/|release-notes\/)|\.md$/;

const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const parse = (version) => {
  const match = SEMVER.exec(String(version ?? "").trim());
  if (!match) {
    fail(`"${version}" is not a plain x.y.z version.`);
  }
  return match.slice(1).map(Number);
};

const compare = (left, right) => {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }
  return 0;
};

const next = (current, kind) => {
  const [major, minor, patch] = parse(current);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const versions = () => {
  const lock = readJson("package-lock.json");
  return {
    "app.json": readJson("app.json").expo.version,
    "package.json": readJson("package.json").version,
    "package-lock.json": lock.version,
    'package-lock.json (packages[""])': lock.packages?.[""]?.version,
  };
};

const writeJson = (path, data) =>
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);

const setVersion = (version) => {
  // app.json is edited in place so the rest of its formatting survives.
  const appRaw = readFileSync("app.json", "utf8");
  const appUpdated = appRaw.replace(
    /("version"\s*:\s*")\d+\.\d+\.\d+(")/,
    `$1${version}$2`
  );
  writeFileSync("app.json", appUpdated);
  if (readJson("app.json").expo.version !== version) {
    fail("Could not find expo.version in app.json to update.");
  }

  const pkg = readJson("package.json");
  pkg.version = version;
  writeJson("package.json", pkg);

  const lock = readJson("package-lock.json");
  lock.version = version;
  if (lock.packages?.[""]) {
    lock.packages[""].version = version;
  }
  writeJson("package-lock.json", lock);
};

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const bump = (arg) => {
  if (!arg) {
    fail("Usage: npm run version:bump -- <patch|minor|major|x.y.z>");
  }
  const current = versions()["app.json"];
  const target = KINDS.includes(arg) ? next(current, arg) : arg;
  if (compare(parse(target), parse(current)) <= 0) {
    fail(`${target} is not higher than the current ${current}.`);
  }
  setVersion(target);
  console.log(`Version ${current} -> ${target} in app.json, package.json and package-lock.json.`);
};

const check = (againstRef) => {
  const found = versions();
  const distinct = new Set(Object.values(found));
  if (distinct.size !== 1) {
    const lines = Object.entries(found).map(([file, value]) => `  ${file}: ${value}`);
    fail(
      `The app version differs between files:\n${lines.join("\n")}\n` +
        "Run `npm run version:bump -- <x.y.z>` to set them all at once."
    );
  }
  const current = found["app.json"];
  parse(current);

  if (!againstRef) {
    console.log(`Version ${current} is consistent across app.json and package files.`);
    return;
  }

  const changed = git("diff", "--name-only", `${againstRef}...HEAD`)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const appChanges = changed.filter((path) => !NON_APP_PATH.test(path));
  if (appChanges.length === 0) {
    console.log(`Only docs, CI or tooling changed since ${againstRef}; no version bump needed.`);
    return;
  }

  const base = JSON.parse(git("show", `${againstRef}:app.json`)).expo.version;
  if (compare(parse(current), parse(base)) <= 0) {
    fail(
      `This branch changes the app but its version is still ${current} (${againstRef} has ${base}).\n` +
        "Raise it with one of:\n" +
        `  npm run version:bump -- patch   # fixes            -> ${next(base, "patch")}\n` +
        `  npm run version:bump -- minor   # new features     -> ${next(base, "minor")}\n` +
        `  npm run version:bump -- major   # breaking changes -> ${next(base, "major")}`
    );
  }
  console.log(`Version ${base} -> ${current}: bumped.`);
};

const [command, ...rest] = process.argv.slice(2);
if (command === "bump") {
  bump(rest[0]);
} else if (command === "check") {
  const flag = rest.indexOf("--against");
  check(flag >= 0 ? rest[flag + 1] : undefined);
} else {
  fail("Usage: node scripts/version.mjs <bump|check> ...");
}
