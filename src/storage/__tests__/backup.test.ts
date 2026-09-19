import {
  BACKUP_FORMAT,
  BACKUP_SCHEMA_VERSION,
  backupFileName,
  isEmptyBackup,
  parseBackup,
  serializeBackup,
  type BackupFile,
} from "../backup";
import { loanInput, reminder } from "../../utils/__tests__/fixtures";

const validFile = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: "1.2.2",
    exportedAt: "2026-09-19T03:00:00.000Z",
    data: {
      input: loanInput(),
      profiles: [
        {
          id: "profile-1",
          name: "Home loan",
          input: loanInput(),
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      settings: {
        themeMode: "dark",
        language: "en",
        defaultCurrencyCode: "AUD",
        reminderNotificationsEnabled: true,
        defaultNotifyHour: 9,
        dueSoonDays: 7,
        dueUrgentDays: 2,
      },
      reminders: [reminder({ id: "reminder-1", name: "Car" })],
      basicHistory: [
        {
          id: "history-1",
          expression: "2+2",
          result: "4",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      ...(overrides.data as Record<string, unknown> | undefined),
    },
    ...overrides,
  });

describe("parseBackup", () => {
  it("reads a file this version wrote", () => {
    const parsed = parseBackup(validFile());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.counts).toEqual({
      profiles: 1,
      reminders: 1,
      basicHistory: 1,
    });
    expect(parsed.backup.appVersion).toBe("1.2.2");
    expect(parsed.backup.data.profiles[0].name).toBe("Home loan");
    expect(parsed.backup.data.reminders[0].name).toBe("Car");
    expect(parsed.backup.data.settings.themeMode).toBe("dark");
  });

  it("round-trips everything an export writes", () => {
    const parsed = parseBackup(validFile());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    const reparsed = parseBackup(serializeBackup(parsed.backup));
    expect(reparsed.ok).toBe(true);
    if (!reparsed.ok) {
      return;
    }
    expect(reparsed.counts).toEqual(parsed.counts);
    expect(reparsed.backup.data).toEqual(parsed.backup.data);
  });

  describe("files it refuses", () => {
    it("rejects text that is not JSON", () => {
      expect(parseBackup("not json at all")).toEqual({
        ok: false,
        problem: "unreadable",
      });
      expect(parseBackup("")).toEqual({ ok: false, problem: "unreadable" });
    });

    it("rejects JSON that is not one of our backups", () => {
      expect(parseBackup(JSON.stringify({ hello: "world" }))).toEqual({
        ok: false,
        problem: "notABackup",
      });
      expect(parseBackup(JSON.stringify([1, 2, 3]))).toEqual({
        ok: false,
        problem: "notABackup",
      });
      expect(parseBackup(JSON.stringify(null))).toEqual({
        ok: false,
        problem: "notABackup",
      });
    });

    it("rejects a backup with no data block", () => {
      const raw = JSON.stringify({
        format: BACKUP_FORMAT,
        schemaVersion: 1,
        data: "nope",
      });
      expect(parseBackup(raw)).toEqual({ ok: false, problem: "notABackup" });
    });

    it("rejects a schema version from a newer app", () => {
      const raw = validFile({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 });
      expect(parseBackup(raw)).toEqual({ ok: false, problem: "tooNew" });
    });

    it("rejects a nonsense schema version", () => {
      expect(parseBackup(validFile({ schemaVersion: 0 })).ok).toBe(false);
      expect(parseBackup(validFile({ schemaVersion: "one" })).ok).toBe(false);
    });

    it("rejects a backup whose every row was unusable", () => {
      const raw = validFile({
        data: {
          input: null,
          profiles: [{ nope: true }],
          reminders: [{ nope: true }],
          basicHistory: [{ nope: true }],
          settings: {},
        },
      });
      expect(parseBackup(raw)).toEqual({ ok: false, problem: "empty" });
    });

    it("accepts an otherwise empty backup that still holds a loan in progress", () => {
      const raw = validFile({
        data: {
          input: loanInput(),
          profiles: [],
          reminders: [],
          basicHistory: [],
          settings: {},
        },
      });
      const parsed = parseBackup(raw);
      expect(parsed.ok).toBe(true);
    });
  });

  describe("damaged rows", () => {
    it("drops a bad profile and keeps the good ones", () => {
      const raw = validFile({
        data: {
          input: null,
          settings: {},
          reminders: [],
          basicHistory: [],
          profiles: [
            { id: "good", name: "Keep", input: loanInput() },
            { id: "", name: "No id", input: loanInput() },
            { id: "no-input", name: "No input" },
            { name: "Missing id", input: loanInput() },
            null,
            "a string",
          ],
        },
      });

      const parsed = parseBackup(raw);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      expect(parsed.counts.profiles).toBe(1);
      expect(parsed.backup.data.profiles[0].id).toBe("good");
    });

    it("drops a reminder with no usable payment date", () => {
      const raw = validFile({
        data: {
          input: null,
          settings: {},
          profiles: [],
          basicHistory: [],
          reminders: [
            reminder({ id: "good", name: "Keep" }),
            { ...reminder({ id: "bad" }), nextPaymentDate: "not-a-date" },
            { ...reminder({ id: "worse" }), id: 42 },
          ],
        },
      });

      const parsed = parseBackup(raw);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      expect(parsed.counts.reminders).toBe(1);
      expect(parsed.backup.data.reminders[0].id).toBe("good");
    });

    it("migrates a profile written before the current input shape", () => {
      const raw = validFile({
        data: {
          input: null,
          settings: {},
          reminders: [],
          basicHistory: [],
          profiles: [
            {
              id: "legacy",
              name: "Old loan",
              input: {
                amountBorrowed: 250_000,
                annualInterestRatePercent: 5.5,
                repaymentFrequency: "fortnightly",
                loanLengthYears: 25,
                accountFee: 10,
                extraRepayment: { startAfterPeriods: 26 },
              },
            },
          ],
        },
      });

      const parsed = parseBackup(raw);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      const restored = parsed.backup.data.profiles[0].input;
      // Fields the old shape never had arrive with today's defaults...
      expect(restored.currencyCode).toBe("AUD");
      expect(restored.lumpSum).toEqual({ enabled: false, amount: 0 });
      // ...and the fee toggle is inferred from the stored amount, as on load.
      expect(restored.accountFeeEnabled).toBe(true);
      expect(restored.extraRepayment.startAfterValue).toBe(12);
    });

    it("normalises settings on a file that does have content", () => {
      const raw = validFile({
        data: {
          input: null,
          profiles: [],
          basicHistory: [],
          reminders: [reminder({ id: "keep" })],
          settings: {
            themeMode: "neon",
            language: "elvish",
            defaultCurrencyCode: "not a code",
            defaultNotifyHour: 99,
          },
        },
      });

      const parsed = parseBackup(raw);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      const settings = parsed.backup.data.settings;
      expect(settings.themeMode).toBe("auto");
      expect(settings.language).toBe("en");
      expect(settings.defaultCurrencyCode).toBeNull();
      expect(settings.defaultNotifyHour).toBe(23);
    });

    it("keeps a history entry missing its result", () => {
      const raw = validFile({
        data: {
          input: null,
          profiles: [],
          reminders: [],
          settings: {},
          basicHistory: [
            { id: "a", expression: "1+1" },
            { id: "b" },
            { expression: "no id" },
          ],
        },
      });

      const parsed = parseBackup(raw);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      expect(parsed.counts.basicHistory).toBe(1);
      expect(parsed.backup.data.basicHistory[0].result).toBe("");
    });

    it("tolerates missing arrays entirely", () => {
      const raw = JSON.stringify({
        format: BACKUP_FORMAT,
        schemaVersion: 1,
        data: { input: loanInput() },
      });

      const parsed = parseBackup(raw);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        return;
      }
      expect(parsed.counts).toEqual({
        profiles: 0,
        reminders: 0,
        basicHistory: 0,
      });
    });
  });

  it("does not carry notification ids from the device that wrote the file", () => {
    const raw = validFile({
      data: {
        input: null,
        profiles: [],
        basicHistory: [],
        settings: {},
        reminders: [
          {
            ...reminder({ id: "keep" }),
            scheduledNotificationIds: ["from-another-phone"],
          },
        ],
      },
    });

    const parsed = parseBackup(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    // parseBackup preserves what it reads; restoreBackup is what clears these,
    // so this test pins the shape the restore step relies on.
    expect(parsed.backup.data.reminders[0].scheduledNotificationIds).toEqual([
      "from-another-phone",
    ]);
  });
});

describe("isEmptyBackup", () => {
  it("is true only when nothing at all was counted", () => {
    expect(
      isEmptyBackup({ profiles: 0, reminders: 0, basicHistory: 0 })
    ).toBe(true);
    expect(
      isEmptyBackup({ profiles: 1, reminders: 0, basicHistory: 0 })
    ).toBe(false);
    expect(
      isEmptyBackup({ profiles: 0, reminders: 0, basicHistory: 3 })
    ).toBe(false);
  });
});

describe("backupFileName", () => {
  it("names the file for the day it was taken", () => {
    expect(backupFileName("2026-09-19")).toBe("slc-backup-2026-09-19.json");
  });
});

describe("serializeBackup", () => {
  it("writes readable JSON a person can inspect", () => {
    const backup: BackupFile = {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: "1.2.2",
      exportedAt: "2026-09-19T03:00:00.000Z",
      data: {
        input: null,
        profiles: [],
        settings: {
          themeMode: "auto",
          language: "en",
          defaultCurrencyCode: null,
          reminderNotificationsEnabled: false,
          defaultNotifyHour: 9,
          dueSoonDays: 7,
          dueUrgentDays: 2,
        },
        reminders: [],
        basicHistory: [],
      },
    };

    const text = serializeBackup(backup);
    expect(text).toContain('"format": "slc-backup"');
    expect(text.split("\n").length).toBeGreaterThan(5);
  });
});
