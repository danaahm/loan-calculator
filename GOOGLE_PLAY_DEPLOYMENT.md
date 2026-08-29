# Google Play Deployment Guide (Expo)

This project is now prepared for Android release builds with EAS.

## 1) Finalize app identity

Check `app.json`:

- `expo.android.package` is set to `com.danaa.loancalculator`
- `expo.android.versionCode` starts at `1`
- `expo.version` is your public app version (currently `1.0.0`)

If you want a different package id, change it before first production release.

## 2) Create privacy policy URL

Google Play requires a publicly accessible privacy policy URL.

Use the content in `PRIVACY_POLICY.md` and publish it on a public URL, for example:

- Your website
- GitHub Pages
- Notion public page

Keep that URL ready for Play Console.

## 3) Install EAS CLI and login

```bash
npm install -g eas-cli
eas login
```

## 4) Configure build credentials

From project root:

```bash
eas build:configure
```

When asked:

- Platform: `Android`
- Let EAS manage the keystore (recommended)

## 5) Build Android App Bundle (.aab)

```bash
eas build -p android --profile production
```

After build completes, download the generated `.aab`.

## 6) Create Google Play app

In Google Play Console:

1. Create app
2. Complete store listing (title, short/full description, screenshots, icon, feature graphic)
3. App content forms (privacy policy URL, ads declaration, content rating, target audience, etc.)
4. Data safety form:
   - If app only stores data locally and does not collect/transmit user data, mark accordingly

## 7) Upload release

1. Go to `Testing` (Internal test recommended first)
2. Create release
3. Upload `.aab`
4. Add release notes
5. Save and roll out to testers

When testing is approved, promote to Production.

## 8) Future updates

For each new release:

- Increase `expo.version` (for users)
- `expo.android.versionCode` is auto-incremented by EAS (`appVersionSource: remote` + `autoIncrement: true`), so you do not need to bump it manually
- Build again:

```bash
eas build -p android --profile production
```

## 9) Automated releases (GitHub Actions)

The workflow `.github/workflows/android-release.yml` automates the build → upload →
release flow so you no longer have to build locally, download the artifact, and
upload it to Play Console by hand.

What it does:

1. Builds the production `.aab` on the GitHub runner with `eas build --local`
   (free public-repo Actions minutes; does not use EAS cloud build credits).
2. Submits it to Google Play with `eas submit`, releasing to the chosen track.

### Triggering it

- Push a version tag: `git tag v1.0.2 && git push origin v1.0.2` (submits to the
  `internal` track by default), or
- Run it manually: GitHub → Actions → "Android Release" → "Run workflow", and pick
  the track (`internal`, `alpha`, `beta`, or `production`).

The workflow intentionally does not run on pull requests, so the secrets below are
never exposed to outside contributors on this public repo.

### Required GitHub secrets

Create these under GitHub → repo → Settings → Secrets and variables → Actions →
"New repository secret" (only a repo admin can add/edit/delete them, and their
values can never be read back once saved):

| Secret name | What it is | How to create it |
| --- | --- | --- |
| `EXPO_TOKEN` | Expo access token used by EAS to build with your managed keystore and submit | expo.dev → Account settings → Access tokens → Create token |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full JSON contents of a Google Play service account key with release permission | Play Console → Users and permissions (or Google Cloud) → create a service account, grant it release access, create a JSON key, and paste the whole file contents as the secret value |

The workflow writes `GOOGLE_SERVICE_ACCOUNT_KEY` to `service-account.json` at
runtime (gitignored) and `eas.json` points each submit profile at that path.

### One-time Google Play prerequisites

- The app must already exist in Play Console with at least one release uploaded
  manually; the Play Developer API rejects automated uploads until then. While the
  app is still in testing, leave the default track as `internal` (or `alpha`/`beta`).
- Enable the Google Play Android Developer API and grant the service account the
  "Release to production, exclude devices, and use Play App Signing" permission.

