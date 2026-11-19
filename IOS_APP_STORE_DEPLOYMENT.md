# App Store Deployment Guide (Expo)

How the iOS build gets from this repo to the App Store, and the one-time setup
that makes the automated release work. The Android equivalent is
`GOOGLE_PLAY_DEPLOYMENT.md`.

## How the pieces talk to each other

```
GitHub Actions (macOS runner)
  │  eas build --local        ← EXPO_TOKEN; EAS hands over the signing certificate
  │                             and provisioning profile it stores for this project
  ▼
app.ipa
  │  eas submit               ← EAS uses the App Store Connect API key it stores
  ▼
App Store Connect → TestFlight
  │  app-store-notes.mjs      ← GitHub Actions (Linux runner), ASC_* secrets; sets
  │                             What to Test and the App Store version's What's New
  │  by hand: pick the build, submit for review
  ▼
App Store
```

The build never hands Apple anything from GitHub: EAS holds the three Apple credentials it uses:

| Credential | What it does | Created by |
| --- | --- | --- |
| Distribution certificate | Proves the app was signed by your Apple developer account | `eas credentials` |
| Provisioning profile | Ties the certificate to the bundle ID `com.danaa.loancalculator` | `eas credentials` |
| App Store Connect API key | Lets EAS upload builds without your Apple ID password or 2FA | `eas credentials` |

So the build needs only the `EXPO_TOKEN` secret, which the Android release
already uses. Publishing the release notes needs an API key of its own (step 8).

## One-time setup

### 1) Join the Apple Developer Program

Enrol at <https://developer.apple.com/programs/enroll/> with an Apple ID that
has two-factor authentication on. It costs USD 99 a year (prices vary by
country). Enrolling as an individual publishes the app under your personal name;
enrolling as an organisation needs a D-U-N-S number. Approval can take up to
48 hours, and nothing below works until it is done.

### 2) Create the signing credentials and API key on EAS

This runs on Windows; no Mac is needed. From the project root:

```bash
npm install -g eas-cli
eas login
eas credentials -p ios
```

1. Pick the `production` build profile and sign in with your Apple ID when asked.
2. Choose **Build Credentials → All: set up all the required credentials**. EAS
   registers the bundle ID `com.danaa.loancalculator` with Apple, then creates
   the distribution certificate and the App Store provisioning profile.
3. Back in the main menu, choose **App Store Connect: Manage your API Key → Set
   up your project to use an API Key for EAS Submit → Generate a new API key**.

### 3) Create the app in App Store Connect

At <https://appstoreconnect.apple.com> → **Apps** → **+** → **New App**:

- Platform: iOS
- Name: the store name. App Store names must be unique, so plain "SLC" may be
  taken; something like "SLC Loan Calculator" is more likely to be free. The
  name under the icon on the phone stays "SLC" either way.
- Primary language: English
- Bundle ID: `com.danaa.loancalculator` (registered by step 2)
- SKU: any internal reference, for example `loan-calculator`
- User access: Full access

Open **App Information** and copy the **Apple ID** under General Information.
It is a number such as `6741234567`.

### 4) Put the app ID in `eas.json`

The `testflight` submit profile in `eas.json` holds that number as `ascAppId`
(currently `6828378613`). The release workflow refuses to build without it.

### 5) Run the first release

Run **Actions → iOS Release → Run workflow** on `main`, or push a version tag
(see below). The build takes 30 to 60 minutes. Apple then processes the upload
for 10 to 30 minutes before it shows under **TestFlight** in App Store Connect.

### 6) Test it on your iPhone

In App Store Connect → **TestFlight** → **Internal Testing**, create a group, add
yourself, and turn on automatic distribution. Install the **TestFlight** app
from the App Store on your iPhone and accept the invitation. Later builds then
arrive in TestFlight without any further steps.

### 7) Complete the store listing and submit for review

On the app's **App Store** tab:

- Screenshots: 6.9" iPhone (1320 × 2868). `app.json` sets `supportsTablet: true`,
  so Apple also requires 13" iPad screenshots (2064 × 2752). Run **Actions → iOS
  Screenshots** to get both: it builds the app for the simulator, fills it with
  sample loans and reminders (`scripts/screenshots/seed.mjs`), taps through the
  screens with Maestro (`scripts/screenshots/tour.yaml`), and attaches the PNGs
  to the run as `app-store-screenshots`. Drag each folder into the matching
  size on the version page.
- Description, keywords, and a support URL. The GitHub repo or the privacy
  policy page is enough as a support URL.
- Privacy policy URL: <https://slc.danaahmadi2014.workers.dev>
- **App Privacy**: "Data Not Collected". Everything stays on the device, and
  backups only leave the device when the user shares the file themselves.
- Category Finance, age rating questionnaire, price Free, availability.
- Say in the description that the app is a calculator and does not offer loans.
  App Review holds lending apps to extra rules, and this avoids the question.

Then under the version, pick the TestFlight build, choose **Add for Review**,
and submit. Review usually takes one to two days.

### 8) Let the release publish its notes

The release workflow sends `release-notes/<version>/whatsnew-<locale>` (the same
text Google Play shows) to App Store Connect, the way the Android release sends
it to Play:

- the App Store version's **What's New in This Version**. The workflow creates
  the version in **Prepare for Submission** if it does not exist yet.
- the TestFlight build's **What to Test**, once Apple has finished processing
  the upload.

`eas submit` cannot send notes, so `scripts/app-store-notes.mjs` calls the App
Store Connect API itself. The API key EAS stores cannot be read back out of
EAS, so this step needs a key of its own as GitHub secrets:

1. App Store Connect → **Users and Access** → **Integrations** → **App Store
   Connect API** → **Team Keys** → **+**. Name it `GitHub release notes`, role
   **App Manager** (a Developer key cannot edit version text), and generate it.
2. Download the `AuthKey_<id>.p8` file. Apple lets you download it only once.
3. In GitHub → the repo → **Settings** → **Secrets and variables** → **Actions**,
   add:

   | Secret | Value |
   | --- | --- |
   | `ASC_KEY_ID` | The key's **Key ID** |
   | `ASC_ISSUER_ID` | The **Issuer ID** shown above the key list |
   | `ASC_PRIVATE_KEY` | The whole contents of the `.p8` file, including the `BEGIN`/`END` lines |

4. Delete the `.p8` file from your computer, or keep it in a password manager.
   `*.p8` is git-ignored, but it should not stay in the project folder.

Until the secrets exist, the notes job is skipped with a warning and releases
carry on as before. To check the notes without credentials:
`node scripts/app-store-notes.mjs publish --dry-run`.

Apple does not allow **What's New** on an app's very first App Store version,
or on a version already in review. The job reports those as warnings rather
than failing the release.

## Every release after that

The same tag that releases Android also releases iOS:

```bash
git tag -a v1.7.0 -m "1.7.0" origin/main && git push origin v1.7.0
```

`.github/workflows/ios-release.yml` builds the `.ipa` on a GitHub macOS runner
with `eas build --local` (free Actions minutes on this public repo; no EAS build
credits) and uploads it to TestFlight with `eas submit`. A follow-up job then
publishes the release notes to the TestFlight build and to the App Store
version (step 8). The iOS build number, like the Android `versionCode`, is
managed remotely by EAS and increases on its own.

Releasing the build to the App Store stays manual, as Play production does:

1. App Store Connect → the app → the version from `app.json`, which the
   workflow created with **What's New** already filled in. (If the notes job
   was skipped or warned, create the version with **+** next to iOS App and
   paste `release-notes/<version>/whatsnew-en-US` yourself.)
2. Under **Build**, pick the build the workflow uploaded.
3. **Add for Review** and submit.

Edited the notes after the release ran? Run **Actions → iOS Release → Run
workflow** with **notes_only** ticked to send them again without a build.
