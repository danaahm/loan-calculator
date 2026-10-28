#!/usr/bin/env node
/**
 * Checks the Google Play "What's new" text that ships with each release.
 *
 *   node scripts/release-notes.mjs check [--tag <git tag>]
 *
 * Notes live in `release-notes/<version>/whatsnew-<locale>`, one folder per
 * app version, in the layout the Play upload action reads. Keying them by
 * version means a release can only publish notes written for it: if the
 * folder for the version in app.json is missing, the check fails rather than
 * shipping the previous release's text.
 *
 * `check` runs in CI on every pull request and again at the start of a
 * release. With `--tag` it also fails when the tag does not name the version
 * in app.json, so a mistyped tag stops in seconds instead of after the build.
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const NOTES_DIR = "release-notes";
/** Locales the Play listing has. Each release needs notes for every one. */
const LOCALES = ["en-US"];
/** Google Play rejects longer release notes, per language. */
const MAX_CHARS = 500;
const FILE_PATTERN = /^whatsnew-[A-Za-z]{2,3}(-[A-Za-z0-9]+)*$/;

const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};

const appVersion = () =>
  JSON.parse(readFileSync("app.json", "utf8")).expo.version;

/** Play counts Unicode characters, not bytes or UTF-16 units. */
const charCount = (text) => [...text].length;

const checkFile = (path) => {
  const text = readFileSync(path, "utf8").trim();
  if (text.length === 0) {
    return `${path} is empty.`;
  }
  const count = charCount(text);
  if (count > MAX_CHARS) {
    return `${path} is ${count} characters; Google Play allows ${MAX_CHARS}.`;
  }
  return null;
};

const check = (tag) => {
  const version = appVersion();
  const problems = [];

  if (tag !== undefined && tag !== `v${version}`) {
    problems.push(
      `Tag ${tag} does not match app.json, which is at ${version}.\n` +
        `  Tag the commit that carries the version instead: v${version}`
    );
  }

  const versionDir = join(NOTES_DIR, version);
  for (const locale of LOCALES) {
    const path = join(versionDir, `whatsnew-${locale}`);
    if (!existsSync(path)) {
      problems.push(
        `No ${locale} release notes for ${version}.\n` +
          `  Add ${path.replace(/\\/g, "/")} with the "What's new" text for Google Play.`
      );
    }
  }

  // Every version's notes are checked, not just the current one, so an edit
  // to an older file cannot slip past its own limits either.
  if (existsSync(NOTES_DIR)) {
    for (const dir of readdirSync(NOTES_DIR)) {
      const dirPath = join(NOTES_DIR, dir);
      if (!statSync(dirPath).isDirectory()) {
        continue;
      }
      for (const file of readdirSync(dirPath)) {
        const path = join(dirPath, file).replace(/\\/g, "/");
        if (!FILE_PATTERN.test(file)) {
          problems.push(`${path} is not named whatsnew-<locale>, so Google Play would never see it.`);
          continue;
        }
        const problem = checkFile(path);
        if (problem) {
          problems.push(problem);
        }
      }
    }
  }

  if (problems.length > 0) {
    fail(problems.join("\n\n"));
  }

  // Lets the release workflow point the upload at this version's folder.
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${version}\nnotes_dir=${versionDir.replace(/\\/g, "/")}\n`
    );
  }
  console.log(`Release notes for ${version} are present and within ${MAX_CHARS} characters.`);
};

const [command, ...rest] = process.argv.slice(2);
if (command === "check") {
  const flag = rest.indexOf("--tag");
  check(flag >= 0 ? rest[flag + 1] : undefined);
} else {
  fail("Usage: node scripts/release-notes.mjs check [--tag <git tag>]");
}
