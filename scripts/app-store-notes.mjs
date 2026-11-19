#!/usr/bin/env node
/**
 * Publishes the release notes in `release-notes/<version>/` to App Store
 * Connect, the way the Android release sends them to Google Play.
 *
 *   node scripts/app-store-notes.mjs publish [--build <build number>] [--dry-run]
 *
 * Two places get the same text, per locale:
 *
 * - The App Store version's "What's New in This Version". The version for
 *   app.json's version is created in "Prepare for Submission" if it does not
 *   exist yet, so the notes are waiting when the build is submitted by hand.
 * - The TestFlight build's "What to Test". Apple processes an upload for 10 to
 *   30 minutes before it can be edited, so this waits for the build to finish
 *   processing. `--build` names the build number the release just uploaded;
 *   without it the newest build of the version is used.
 *
 * `eas submit` cannot send either text, so this talks to the App Store Connect
 * API itself. It needs an API key with the App Manager role, in three
 * environment variables:
 *
 *   ASC_KEY_ID       the key's ID
 *   ASC_ISSUER_ID    the issuer ID shown above the key list
 *   ASC_PRIVATE_KEY  the contents of the downloaded AuthKey_<id>.p8
 *
 * Apple refusing an edit it does not allow, such as "What's New" on an app's
 * very first version or on a version already in review, is reported as a
 * warning rather than a failure: the build itself is already in TestFlight.
 * `--dry-run` reads and checks the notes and prints what would be sent,
 * without credentials or network calls.
 */
import { createPrivateKey, sign } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const API = "https://api.appstoreconnect.apple.com";
const NOTES_DIR = "release-notes";
const FILE_PATTERN = /^whatsnew-([A-Za-z]{2,3}(?:-[A-Za-z0-9]+)*)$/;
/** App Store Connect allows 4000; the Play limit of 500 is already enforced. */
const MAX_CHARS = 4000;
const BUILD_POLL_MS = 60_000;
const BUILD_WAIT_MS = 45 * 60_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (message) => {
  console.error(`\n${message}\n`);
  process.exit(1);
};
// GitHub Actions shows these as annotations on the run; elsewhere they read fine.
const warn = (message) => console.log(`::warning::${message}`);

const appVersion = () => JSON.parse(readFileSync("app.json", "utf8")).expo.version;

const appStoreAppId = () => {
  const id = JSON.parse(readFileSync("eas.json", "utf8")).submit?.testflight?.ios?.ascAppId;
  if (!/^\d+$/.test(id ?? "")) {
    fail("eas.json has no submit.testflight.ios.ascAppId.");
  }
  return id;
};

/** Every `whatsnew-<locale>` file for the version, as { locale, text }. */
export const readNotes = (version, root = NOTES_DIR) => {
  const dir = join(root, version);
  if (!existsSync(dir)) {
    fail(`No release notes folder for ${version}: add ${dir.replace(/\\/g, "/")}/whatsnew-en-US.`);
  }
  const notes = [];
  for (const file of readdirSync(dir).sort()) {
    const match = FILE_PATTERN.exec(file);
    if (!match) {
      continue;
    }
    const text = readFileSync(join(dir, file), "utf8").trim();
    if ([...text].length > MAX_CHARS) {
      fail(`${file} is longer than the ${MAX_CHARS} characters App Store Connect allows.`);
    }
    if (text) {
      notes.push({ locale: match[1], text });
    }
  }
  if (notes.length === 0) {
    fail(`release-notes/${version} has no whatsnew-<locale> files with text in them.`);
  }
  return notes;
};

const base64url = (input) => Buffer.from(input).toString("base64url");

/** A short-lived App Store Connect token, signed ES256 with the API key. */
export const createToken = ({ keyId, issuerId, privateKey }, now = Date.now()) => {
  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  // Apple refuses tokens that live longer than 20 minutes.
  const payload = base64url(
    JSON.stringify({ iss: issuerId, iat, exp: iat + 15 * 60, aud: "appstoreconnect-v1" })
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key: createPrivateKey(privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${signature.toString("base64url")}`;
};

class AppleError extends Error {
  constructor(status, body) {
    const detail = (body?.errors ?? [])
      .map((error) => error.detail || error.title)
      .filter(Boolean)
      .join(" ");
    super(`App Store Connect answered ${status}${detail ? `: ${detail}` : ""}`);
    this.status = status;
  }
}

const createClient = (credentials) => async (method, path, body) => {
  // A fresh token per call: waiting on a build outlives any single token.
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${createToken(credentials)}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new AppleError(response.status, json);
  }
  return json;
};

/** Finds the App Store version for `version`, creating it if there is none. */
const findOrCreateVersion = async (api, appId, version) => {
  const query = new URLSearchParams({
    "filter[platform]": "IOS",
    "filter[versionString]": version,
  });
  const found = await api("GET", `/v1/apps/${appId}/appStoreVersions?${query}`);
  if (found.data.length > 0) {
    return found.data[0];
  }
  console.log(`Creating App Store version ${version} in Prepare for Submission.`);
  const created = await api("POST", "/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: { platform: "IOS", versionString: version },
      relationships: { app: { data: { type: "apps", id: appId } } },
    },
  });
  return created.data;
};

const publishAppStoreNotes = async (api, appId, version, notes) => {
  let appStoreVersion;
  try {
    appStoreVersion = await findOrCreateVersion(api, appId, version);
  } catch (error) {
    // Most often another version is still being prepared or reviewed.
    warn(`Could not find or create App Store version ${version}. ${error.message}`);
    return;
  }
  const localizations = await api(
    "GET",
    `/v1/appStoreVersions/${appStoreVersion.id}/appStoreVersionLocalizations`
  );
  for (const { locale, text } of notes) {
    const localization = localizations.data.find((item) => item.attributes.locale === locale);
    if (!localization) {
      // Adding a language to the listing needs a description and more, which
      // is a store-listing decision, not something a release should make.
      warn(`The App Store listing has no ${locale} language, so whatsnew-${locale} was not sent.`);
      continue;
    }
    try {
      await api("PATCH", `/v1/appStoreVersionLocalizations/${localization.id}`, {
        data: {
          type: "appStoreVersionLocalizations",
          id: localization.id,
          attributes: { whatsNew: text },
        },
      });
      console.log(`App Store "What's New" set for ${version} (${locale}).`);
    } catch (error) {
      warn(`App Store "What's New" for ${version} (${locale}) was not set. ${error.message}`);
    }
  }
};

/** Waits for the uploaded build to appear and finish processing. */
const waitForBuild = async (api, appId, version, buildNumber) => {
  const query = new URLSearchParams({
    "filter[app]": appId,
    "filter[preReleaseVersion.version]": version,
    sort: "-uploadedDate",
    limit: "1",
  });
  if (buildNumber) {
    query.set("filter[version]", buildNumber);
  }
  const label = buildNumber ? `${version} (${buildNumber})` : `${version}`;
  const deadline = Date.now() + BUILD_WAIT_MS;
  for (;;) {
    const found = await api("GET", `/v1/builds?${query}`);
    const build = found.data[0];
    const state = build?.attributes.processingState;
    if (state === "VALID") {
      return build;
    }
    if (state === "FAILED" || state === "INVALID") {
      warn(`Build ${label} finished processing as ${state}; TestFlight notes were not set.`);
      return null;
    }
    if (Date.now() > deadline) {
      warn(`Build ${label} was still not processed after 45 minutes; TestFlight notes were not set.`);
      return null;
    }
    console.log(`Waiting for build ${label}: ${state ?? "not visible yet"}.`);
    await sleep(BUILD_POLL_MS);
  }
};

const publishTestFlightNotes = async (api, appId, version, buildNumber, notes) => {
  const build = await waitForBuild(api, appId, version, buildNumber);
  if (!build) {
    return;
  }
  const localizations = await api("GET", `/v1/builds/${build.id}/betaBuildLocalizations`);
  for (const { locale, text } of notes) {
    const existing = localizations.data.find((item) => item.attributes.locale === locale);
    try {
      if (existing) {
        await api("PATCH", `/v1/betaBuildLocalizations/${existing.id}`, {
          data: { type: "betaBuildLocalizations", id: existing.id, attributes: { whatsNew: text } },
        });
      } else {
        await api("POST", "/v1/betaBuildLocalizations", {
          data: {
            type: "betaBuildLocalizations",
            attributes: { locale, whatsNew: text },
            relationships: { build: { data: { type: "builds", id: build.id } } },
          },
        });
      }
      console.log(
        `TestFlight "What to Test" set for build ${build.attributes.version} (${locale}).`
      );
    } catch (error) {
      warn(`TestFlight "What to Test" (${locale}) was not set. ${error.message}`);
    }
  }
};

const publish = async ({ buildNumber, dryRun }) => {
  const version = appVersion();
  const appId = appStoreAppId();
  const notes = readNotes(version);

  if (dryRun) {
    console.log(`Dry run: app ${appId}, version ${version}, build ${buildNumber ?? "newest"}.`);
    for (const { locale, text } of notes) {
      console.log(`\n[${locale}] ${[...text].length} characters\n${text}`);
    }
    return;
  }

  const credentials = {
    keyId: process.env.ASC_KEY_ID,
    issuerId: process.env.ASC_ISSUER_ID,
    // Secrets pasted with literal "\n" still make a valid key.
    privateKey: process.env.ASC_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
  if (!credentials.keyId || !credentials.issuerId || !credentials.privateKey) {
    fail("Set ASC_KEY_ID, ASC_ISSUER_ID and ASC_PRIVATE_KEY to an App Store Connect API key.");
  }
  const api = createClient(credentials);

  await publishAppStoreNotes(api, appId, version, notes);
  await publishTestFlightNotes(api, appId, version, buildNumber, notes);
};

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isMain) {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== "publish") {
    fail("Usage: node scripts/app-store-notes.mjs publish [--build <build number>] [--dry-run]");
  }
  const buildFlag = rest.indexOf("--build");
  publish({
    buildNumber: buildFlag >= 0 ? rest[buildFlag + 1] || undefined : undefined,
    dryRun: rest.includes("--dry-run"),
  }).catch((error) => fail(error.message));
}
