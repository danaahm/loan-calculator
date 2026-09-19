# Simple Loan Calculator (Expo React Native)

A cross-platform loan calculator built with Expo + React Native (TypeScript).

It runs on Android and iOS, works fully offline, and stores data on the device only (no backend, no authentication). Store listing name is **SLC**.

## Features

- Home dashboard with the next repayment, current loan snapshot, and shortcuts
- Loan calculator with repayment frequencies: yearly, quarterly, monthly, fortnightly, weekly
- Advanced repayment options:
  - extra repayments (amount, frequency, start after months or years)
  - optional lump sum
  - offset savings, including optional recurring offset deposits
- Currency selection with symbols
- Principal / interest / fees / extra pie chart
- Loan balance comparison chart (baseline vs extra-repayment scenario)
- Yearly amortization grid
- Save, load, rename, delete, and reorder loan profiles
- Side-by-side comparison of two saved loans
- Basic calculator with local history
- Repayment reminders: schedule, extra payments, rate changes, archive, and local notifications
- Settings: light / dark / system theme and reminder notification preferences
- Backup and restore: save every loan, reminder and setting to a JSON file, restore one on another phone, or delete everything stored on the device

## Tech Stack

- Expo SDK 57
- React Native 0.86
- TypeScript
- AsyncStorage for local persistence
- `victory-native` + `@shopify/react-native-skia` for charts
- `react-native-reanimated` and `react-native-gesture-handler` for chart gestures
- `expo-notifications` for local repayment alerts (development and production builds)
- `@react-native-community/datetimepicker` for reminder dates
- `react-native-format-currency` for currency formatting
- `expo-file-system` + `expo-sharing` for backup files

## Project Structure

- `App.tsx` — app shell, tabs, and screen routing
- `index.ts` — Expo entry
- `src/screens/` — Home, loan calculator, basic calculator, saved loans, compare, reminders, settings
- `src/components/` — form, charts, amortization grid, reminder cards, date picker
- `src/notifications/reminderNotifications.ts` — local notification scheduling
- `src/utils/loanMath.ts` — loan amortization
- `src/utils/reminderMath.ts` — reminder balances, catch-up, and extra payments
- `src/utils/profileCompare.ts` — saved-loan comparison
- `src/utils/__tests__/`, `src/storage/__tests__/` — unit tests
- `src/storage/localState.ts` — AsyncStorage helpers
- `src/storage/backup.ts` — backup file format, validation and restore
- `src/storage/backupFile.ts` — writing, sharing and picking the backup file
- `src/theme/` — light/dark tokens and theme provider
- `src/types/` — shared TypeScript types
- `.github/workflows/` — CI and Android Play release
- `PRIVACY_POLICY.md` — privacy policy source
- `docs/index.html` — hosted privacy policy page (GitHub Pages from `/docs`)
- `GOOGLE_PLAY_DEPLOYMENT.md` — Play Store and automated release guide

## Getting Started

### Prerequisites

- Node.js 22.13+ (recommended)
- npm
- For the full app (charts + reminders with phone alerts): a development build or Android emulator/device with a native binary
- Expo Go still runs the calculator UI, but **local notification banners are not available in Expo Go** from SDK 53 onward

### Install

```bash
npm install
```

### Run

```bash
npm run start
```

Then choose:

- `a` for Android
- `i` for iOS
- scan the QR code with Expo Go (calculator only; notifications stay in-app)

To use a development client (required for repayment notification banners):

```bash
npm run start:dev
```

Build a development client first if you do not already have one:

```bash
npx eas-cli build -p android --profile development
```

## Scripts

- `npm run start` — start Expo (Expo Go)
- `npm run start:dev` — start Expo against a development build
- `npm run android` — open the Android flow
- `npm run ios` — open the iOS flow
- `npm run web` — run the web target
- `npm run typecheck` — TypeScript check (`tsc --noEmit`)
- `npm test` — Jest unit tests
- `npm run test:watch` — Jest in watch mode
- `npm run test:coverage` — Jest with a coverage report for the maths and backup modules

## Testing

Unit tests live in `src/utils/__tests__/` and `src/storage/__tests__/`, and
cover the modules that produce the numbers users act on and the ones that can
lose their data:

- `loanMath.test.ts` — amortization against the standard annuity formula,
  account fees at every frequency, offset savings, extra repayments, the
  lump-sum residual, plan-versus-contracted savings, validation and the
  migration of older saved profiles
- `reminderMath.test.ts` — the fee carry, rate changes, catch-up across missed
  cycles, undo, extra payments, payoff projection and the saved-profile handoff
- `reminderSchedule.test.ts` — repayment date arithmetic, including month-end
  clamping, leap years, custom one-off dates and notification lead times
- `backup.test.ts` — backup file validation: damaged files, files from a newer
  app, individual rows that fail to parse, and migration of older saved loans
- `backupRoundTrip.test.ts` — save, export, wipe and restore against the
  AsyncStorage mock

Expected values are derived independently of the implementation, so a change
that alters a repayment figure fails the suite rather than quietly updating it.
Tests that read the clock freeze it, so the results never depend on the day
they run.

```bash
npm test
```

`jest.setup.js` swaps AsyncStorage for the in-memory mock the package ships, so
the storage tests exercise the real read and write paths.

`jest.environment.js` wraps the standard Node environment. Node 22.4 and newer
expose a `localStorage` global that throws unless the process is started with
`--localstorage-file`, and Jest 29 trips it while building the test context;
the wrapper neutralises it so the suite runs on Node 22 through 25.

## CI / CD

GitHub Actions workflows live in `.github/workflows/`.

**CI** (`.github/workflows/ci.yml`) runs on pull requests targeting `main`:

1. `npm ci`
2. `npx expo install --check` (SDK 57 package versions)
3. `npm run typecheck`
4. `npm test -- --ci` (loan and reminder maths, backup validation)
5. `npx expo-doctor` (advisory; does not fail the job)
6. `npx expo export --platform web` (JS bundle smoke test)

Keep `package-lock.json` in sync with `package.json`. CI uses `npm ci` and will fail if they drift.

Do not add an `index.html` at the project root. Expo treats that file as the web export template; the privacy page lives in `docs/` instead.

**Android release** (`.github/workflows/android-release.yml`) builds a production `.aab` with `eas build --local` and submits it to Google Play. It runs on `v*` tags (internal track) or from **Actions → Android Release** (choose a track).

That workflow installs JDK 17 plus the Android SDK/NDK used by Expo SDK 57, because charts (Skia) and notifications are native modules. Required secrets and Play Console setup are in `GOOGLE_PLAY_DEPLOYMENT.md`.

## Build and Release (Android / Google Play)

See the full guide in `GOOGLE_PLAY_DEPLOYMENT.md`.

Quick commands:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile production
```

## Privacy

Privacy policy source is in `PRIVACY_POLICY.md`.
A public HTML version is in `docs/index.html` (GitHub Pages source folder: `/docs`).
For Play Console, host this policy on a public URL and use that URL in your listing.

## Disclaimer

This app is for informational and educational purposes only and does not provide financial advice.
All loan calculations are estimates and should not be considered professional financial guidance.

## Security Notes

- This app does not include backend APIs or server secrets.
- Loan profiles, reminders, calculator history, and settings stay on the device.
- Sensitive files and credentials are excluded via `.gitignore`.
