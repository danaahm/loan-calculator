/**
 * AsyncStorage is a native module, so importing anything under `src/storage/`
 * would otherwise fail before a test runs. The package ships an in-memory
 * stand-in for exactly this; registering it here keeps the mock out of the
 * individual suites.
 */
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
