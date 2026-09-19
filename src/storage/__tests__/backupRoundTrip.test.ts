import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_APP_SETTINGS } from "../../types/settings";
import { loanInput, reminder } from "../../utils/__tests__/fixtures";
import {
  buildBackup,
  countStoredData,
  parseBackup,
  restoreBackup,
  serializeBackup,
} from "../backup";
import {
  OWNED_STORAGE_KEYS,
  clearAllStoredData,
  loadAppSettings,
  loadBasicCalcHistory,
  loadLoanInput,
  loadLoanReminders,
  loadSavedLoanProfiles,
  saveAppSettings,
  saveBasicCalcHistory,
  saveLoanInput,
  saveLoanReminders,
  saveSavedLoanProfiles,
} from "../localState";

const seedDevice = async (): Promise<void> => {
  await saveLoanInput(loanInput({ amountBorrowed: 450_000 }));
  await saveSavedLoanProfiles([
    {
      id: "profile-1",
      name: "Home loan",
      input: loanInput(),
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
  ]);
  await saveLoanReminders([
    reminder({
      id: "reminder-1",
      name: "Car",
      remainingBalance: 12_345,
      scheduledNotificationIds: ["local-notification-id"],
    }),
  ]);
  await saveAppSettings({
    ...DEFAULT_APP_SETTINGS,
    themeMode: "dark",
    reminderNotificationsEnabled: true,
    dueSoonDays: 10,
    dueUrgentDays: 3,
  });
  await saveBasicCalcHistory([
    {
      id: "history-1",
      expression: "12*12",
      result: "144",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("backup round trip", () => {
  it("restores a wiped device from its own backup file", async () => {
    await seedDevice();

    const text = serializeBackup(await buildBackup("1.2.2"));
    await clearAllStoredData();

    expect(await loadSavedLoanProfiles()).toEqual([]);
    expect(await loadLoanReminders()).toEqual([]);
    expect(await loadBasicCalcHistory()).toEqual([]);
    expect(await loadLoanInput()).toBeNull();
    expect(await loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);

    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    await restoreBackup(parsed.backup);

    const profiles = await loadSavedLoanProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Home loan");

    const reminders = await loadLoanReminders();
    expect(reminders).toHaveLength(1);
    expect(reminders[0].name).toBe("Car");
    expect(reminders[0].remainingBalance).toBe(12_345);

    const settings = await loadAppSettings();
    expect(settings.themeMode).toBe("dark");
    expect(settings.reminderNotificationsEnabled).toBe(true);
    expect(settings.dueSoonDays).toBe(10);

    expect(await loadBasicCalcHistory()).toHaveLength(1);
    expect((await loadLoanInput())?.amountBorrowed).toBe(450_000);
  });

  it("drops notification ids belonging to the device that wrote the file", async () => {
    await seedDevice();
    const text = serializeBackup(await buildBackup("1.2.2"));
    await clearAllStoredData();

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      throw new Error("expected a readable backup");
    }
    await restoreBackup(parsed.backup);

    // The ids identify notifications scheduled on the old phone; keeping them
    // would leave reminders that can never be cancelled.
    const reminders = await loadLoanReminders();
    expect(reminders[0].scheduledNotificationIds).toEqual([]);
  });

  it("clears a loan in progress when the backup had none", async () => {
    await seedDevice();
    const backup = await buildBackup("1.2.2");
    await restoreBackup({
      ...backup,
      data: { ...backup.data, input: null },
    });

    expect(await loadLoanInput()).toBeNull();
    // The saved loans are untouched: only the in-progress calculation goes.
    expect(await loadSavedLoanProfiles()).toHaveLength(1);
  });

  it("replaces rather than merges what is already there", async () => {
    await seedDevice();
    const text = serializeBackup(await buildBackup("1.2.2"));

    await saveSavedLoanProfiles([
      {
        id: "profile-2",
        name: "Added later",
        input: loanInput(),
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      },
    ]);

    const parsed = parseBackup(text);
    if (!parsed.ok) {
      throw new Error("expected a readable backup");
    }
    await restoreBackup(parsed.backup);

    const profiles = await loadSavedLoanProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe("profile-1");
  });

  it("counts what is stored for the confirmation dialogs", async () => {
    expect(await countStoredData()).toEqual({
      profiles: 0,
      reminders: 0,
      basicHistory: 0,
    });

    await seedDevice();
    expect(await countStoredData()).toEqual({
      profiles: 1,
      reminders: 1,
      basicHistory: 1,
    });
  });
});

describe("clearAllStoredData", () => {
  it("removes every key the app owns", async () => {
    await seedDevice();
    const before = await AsyncStorage.multiGet([...OWNED_STORAGE_KEYS]);
    expect(before.every(([, value]) => value !== null)).toBe(true);

    await clearAllStoredData();

    const after = await AsyncStorage.multiGet([...OWNED_STORAGE_KEYS]);
    expect(after.every(([, value]) => value === null)).toBe(true);
  });

  it("leaves keys owned by other libraries alone", async () => {
    await seedDevice();
    await AsyncStorage.setItem("some-other-library-key", "keep me");

    await clearAllStoredData();

    expect(await AsyncStorage.getItem("some-other-library-key")).toBe("keep me");
  });
});
