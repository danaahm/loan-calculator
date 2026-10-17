## What changed

<!-- A short description of the change. -->

## Privacy policy

Tick one:

- [ ] This change does not affect what data the app stores, shares, or sends off the device.
- [ ] `PRIVACY_POLICY.md` is updated, its `Effective date:` is bumped, and `npm run build:privacy` has been run.

A policy update is needed when a change adds or removes a stored data category,
writes user data to a file or another app, reads data back in, adds a permission
or network call, or changes how users delete their data.

## Checks

- [ ] Version bumped with `npm run version:bump -- <patch|minor|major>` (patch for fixes, minor for features, major for breaking changes)
- [ ] `npm run typecheck`
- [ ] `npm test`
