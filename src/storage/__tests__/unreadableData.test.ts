import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_APP_SETTINGS } from "../../types/settings";
import { reminder } from "../../utils/__tests__/fixtures";
import {
  OWNED_STORAGE_KEYS,
  UNREADABLE_STORAGE_KEYS,
  clearAllStoredData,
  loadAppSettings,
  loadBasicCalcHistory,
  loadLoanInput,
  loadLoanReminders,
  loadSavedLoanProfiles,
  saveLoanReminders,
  takeUnreadableStoredData,
} from "../localState";

const [INPUT_KEY, PROFILES_KEY, SETTINGS_KEY, HISTORY_KEY, REMINDERS_KEY] =
  OWNED_STORAGE_KEYS;
const copyOf = (key: string): Promise<string | null> =>
  AsyncStorage.getItem(`${key}-unreadable`);

beforeEach(async () => {
  await AsyncStorage.clear();
  takeUnreadableStoredData();
});

describe("unreadable stored data", () => {
  it("keeps a copy of reminders that are not valid JSON", async () => {
    const damaged = '[{"id":"r1","name":"Home lo';
    await AsyncStorage.setItem(REMINDERS_KEY, damaged);

    expect(await loadLoanReminders()).toEqual([]);
    expect(await copyOf(REMINDERS_KEY)).toBe(damaged);
    expect(takeUnreadableStoredData()).toEqual(["reminders"]);
  });

  it("keeps the copy after the empty list is saved over the original", async () => {
    const damaged = "{not json";
    await AsyncStorage.setItem(REMINDERS_KEY, damaged);

    await saveLoanReminders(await loadLoanReminders());

    expect(await AsyncStorage.getItem(REMINDERS_KEY)).toBe("[]");
    expect(await copyOf(REMINDERS_KEY)).toBe(damaged);
  });

  it("keeps the whole list when one reminder cannot be read", async () => {
    const good = reminder({ id: "good", nextPaymentDate: "2026-03-15" });
    const raw = JSON.stringify([good, { id: "bad", name: "No date" }]);
    await AsyncStorage.setItem(REMINDERS_KEY, raw);

    const loaded = await loadLoanReminders();

    expect(loaded.map((item) => item.id)).toEqual(["good"]);
    expect(await copyOf(REMINDERS_KEY)).toBe(raw);
  });

  it("sets nothing aside when every reminder reads cleanly", async () => {
    await saveLoanReminders([reminder({ nextPaymentDate: "2026-03-15" })]);

    await loadLoanReminders();

    expect(await copyOf(REMINDERS_KEY)).toBeNull();
    expect(takeUnreadableStoredData()).toEqual([]);
  });

  it("keeps a copy of saved loans that are not a list", async () => {
    await AsyncStorage.setItem(PROFILES_KEY, '{"oops":true}');

    expect(await loadSavedLoanProfiles()).toEqual([]);
    expect(await copyOf(PROFILES_KEY)).toBe('{"oops":true}');
  });

  it("keeps copies of the loan in progress, settings and calculator history", async () => {
    await AsyncStorage.setItem(INPUT_KEY, "{");
    await AsyncStorage.setItem(SETTINGS_KEY, "{");
    await AsyncStorage.setItem(HISTORY_KEY, "{");

    expect(await loadLoanInput()).toBeNull();
    expect(await loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
    expect(await loadBasicCalcHistory()).toEqual([]);

    expect(await copyOf(INPUT_KEY)).toBe("{");
    expect(await copyOf(SETTINGS_KEY)).toBe("{");
    expect(await copyOf(HISTORY_KEY)).toBe("{");
    expect(takeUnreadableStoredData().sort()).toEqual([
      "basicHistory",
      "input",
      "settings",
    ]);
  });

  it("reports each kind once, then forgets it", async () => {
    await AsyncStorage.setItem(REMINDERS_KEY, "{");
    await loadLoanReminders();
    await loadLoanReminders();

    expect(takeUnreadableStoredData()).toEqual(["reminders"]);
    expect(takeUnreadableStoredData()).toEqual([]);
  });

  it("is removed by delete everything", async () => {
    await AsyncStorage.setItem(REMINDERS_KEY, "{");
    await AsyncStorage.setItem(PROFILES_KEY, "{");
    await loadLoanReminders();
    await loadSavedLoanProfiles();

    await clearAllStoredData();

    const copies = await AsyncStorage.multiGet([...UNREADABLE_STORAGE_KEYS]);
    expect(copies.every(([, value]) => value === null)).toBe(true);
  });
});
