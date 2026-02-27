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
- Increase `expo.android.versionCode` (integer, must always go up)
- Build again:

```bash
eas build -p android --profile production
```

