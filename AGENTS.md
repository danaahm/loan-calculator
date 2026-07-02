# AGENTS.md

## Cursor Cloud specific instructions

This is an offline Expo + React Native (TypeScript) loan calculator app. There is no backend, no auth, and no database — all state is local (AsyncStorage). Standard commands live in `package.json` scripts and `README.md`.

### Services / how to run

- **Web (only feasible target in the cloud VM):** `npm run web` starts the Expo/Metro dev server on `http://localhost:8081` and serves the app for browser-based testing. Android/iOS targets require simulators/devices and cannot be exercised in this headless VM.
- The web target depends on `react-dom` and `react-native-web` (already in `package.json`); `npm install` installs them.

### Checks

- **Type-check:** `npx tsc --noEmit` (project has `strict: true`). There is **no** ESLint config and **no** automated test suite in this repo, so type-checking + manual web testing is the validation path.

### Gotchas

- Expo may print a compatibility warning suggesting a slightly newer `expo` patch version; it is non-blocking and the app runs fine.
- Metro's first web bundle takes a few seconds; wait for `Web Bundled ... index.ts` in the log before loading the page.
