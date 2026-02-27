# Simple Loan Calculator (Expo React Native)

A cross-platform Simple loan calculator app built with Expo + React Native (TypeScript).

It runs on Android and iOS, works fully offline, and stores user data locally on device (no backend, no authentication).

## Features

- Loan input form with repayment frequency options:
  - yearly, quarterly, monthly, fortnightly, weekly
- Optional advanced repayment controls:
  - extra repayment (amount, frequency, start after months/years)
  - lump sum amount (optional)
  - offset savings amount (optional)
- Currency selection with broad currency support and symbols
- Repayment breakdown pie chart
- Loan balance comparison line chart (with extra repayment scenario)
- Yearly amortization grid
- Save, load, rename, delete, and reorder loan profiles (local storage)
- Dashboard + calculator + saved loans navigation

## Tech Stack

- Expo SDK 54
- React Native 0.81
- TypeScript
- AsyncStorage for local persistence
- `react-native-chart-kit` for charts
- `react-native-gesture-handler` for chart gestures
- `react-native-format-currency` for currency formatting

## Project Structure

- `App.tsx` - app shell, navigation, saved profiles flow
- `src/components/` - UI components (form, charts, grid, headers)
- `src/utils/loanMath.ts` - loan amortization calculations
- `src/utils/format.ts` - currency/label formatting
- `src/storage/localState.ts` - AsyncStorage helpers
- `src/types/loan.ts` - shared TypeScript types
- `PRIVACY_POLICY.md` - privacy policy content
- `GOOGLE_PLAY_DEPLOYMENT.md` - release checklist for Play Store

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)
- npm
- Expo Go on your phone (Android/iOS) or Android/iOS simulator

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
- scan QR code with Expo Go

## Build and Release (Android / Google Play)

See full guide in `GOOGLE_PLAY_DEPLOYMENT.md`.

Quick commands:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile production
```

## Privacy

Privacy policy source is in `PRIVACY_POLICY.md`.
For Play Console, host this policy on a public URL and use that URL in your listing.

## Disclaimer

This app is for informational and educational purposes only and does not provide financial advice.
All loan calculations are estimates and should not be considered professional financial guidance.

## Security Notes

- This app does not include backend APIs or server secrets.
- Local loan data is stored on device only.
- Sensitive files and credentials are excluded via `.gitignore`.

## Scripts

- `npm run start` - start Expo dev server
- `npm run android` - open in Android flow
- `npm run ios` - open in iOS flow
- `npm run web` - run web target
