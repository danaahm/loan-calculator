/**
 * Node 22.4 and newer ship a `localStorage` global that throws on access
 * unless the process was started with `--localstorage-file`. Constructing
 * jest-environment-node@29 copies every Node global into the test context, so
 * it trips that getter and the whole suite fails before a single test runs.
 *
 * Replacing the global with a plain value here - module scope, which Jest
 * evaluates before it builds the environment - keeps `npm test` working on
 * Node 22 through 25 without contributors having to pass extra node flags.
 * Nothing under test touches web storage; the app uses AsyncStorage.
 */
const nodeEnvironment = require("jest-environment-node");

for (const key of ["localStorage", "sessionStorage"]) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  if (descriptor && descriptor.configurable) {
    Object.defineProperty(globalThis, key, {
      value: undefined,
      configurable: true,
      writable: true,
    });
  }
}

module.exports = nodeEnvironment.default ?? nodeEnvironment.TestEnvironment;
