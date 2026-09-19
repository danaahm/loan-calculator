/**
 * Phase 0 harness. The amortization and reminder maths in `src/utils/` are
 * plain modules with no native dependencies, but they do import the bundled
 * translation catalogue, so the Expo preset is here to apply the same
 * TypeScript and JSON transforms Metro applies at runtime.
 */
module.exports = {
  preset: "jest-expo",
  testEnvironment: "<rootDir>/jest.environment.js",
  setupFiles: ["<rootDir>/jest.setup.js"],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/", "/.expo/"],
  collectCoverageFrom: [
    "src/storage/backup.ts",
    "src/utils/loanMath.ts",
    "src/utils/reminderMath.ts",
    "src/utils/reminderSchedule.ts",
    "src/utils/dateIso.ts",
  ],
};
