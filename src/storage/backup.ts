import { type BasicCalcHistoryEntry } from "../types/basicCalculator";
import { type LoanInput, type SavedLoanProfile } from "../types/loan";
import { type LoanReminder } from "../types/reminder";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../types/settings";
import { normalizeInput } from "../utils/loanMath";
import {
  MAX_BASIC_CALC_HISTORY,
  clearLoanInput,
  loadAppSettings,
  loadBasicCalcHistory,
  loadLoanInput,
  loadLoanReminders,
  loadSavedLoanProfiles,
  normalizeAppSettings,
  normalizeReminder,
  saveAppSettings,
  saveBasicCalcHistory,
  saveLoanInput,
  saveLoanReminders,
  saveSavedLoanProfiles,
} from "./localState";

/**
 * Bumped only when a backup written by an older build can no longer be read
 * as-is. Readers accept anything at or below their own version and migrate on
 * the way in, so a file from an older app keeps working.
 */
export const BACKUP_SCHEMA_VERSION = 1;

/** Marks the file as ours before we trust anything else inside it. */
export const BACKUP_FORMAT = "slc-backup";

export interface BackupPayload {
  input: Partial<LoanInput> | null;
  profiles: SavedLoanProfile[];
  settings: AppSettings;
  reminders: LoanReminder[];
  basicHistory: BasicCalcHistoryEntry[];
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  /** App version that wrote the file, for support rather than for logic. */
  appVersion: string;
  exportedAt: string;
  data: BackupPayload;
}

/** What a file holds, shown to the user before anything is overwritten. */
export interface BackupCounts {
  profiles: number;
  reminders: number;
  basicHistory: number;
}

export type BackupProblem =
  | "unreadable"
  | "notABackup"
  | "tooNew"
  | "empty";

export type ParsedBackup =
  | { ok: true; backup: BackupFile; counts: BackupCounts }
  | { ok: false; problem: BackupProblem };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Saved profiles are re-read through `normalizeInput`, so a loan written by an
 * older build arrives with today's shape and a hand-edited file cannot inject
 * a half-built input into the calculator.
 */
const normalizeProfile = (value: unknown): SavedLoanProfile | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { id, name, input, createdAt, updatedAt } = value;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  if (typeof name !== "string") {
    return null;
  }
  if (!isRecord(input)) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    id,
    name,
    input: normalizeInput(input as Partial<LoanInput>),
    createdAt: typeof createdAt === "string" ? createdAt : now,
    updatedAt: typeof updatedAt === "string" ? updatedAt : now,
  };
};

const normalizeHistoryEntry = (
  value: unknown
): BasicCalcHistoryEntry | null => {
  if (!isRecord(value)) {
    return null;
  }
  const { id, expression, result, createdAt } = value;
  if (typeof id !== "string" || typeof expression !== "string") {
    return null;
  }
  return {
    id,
    expression,
    result: typeof result === "string" ? result : "",
    createdAt:
      typeof createdAt === "string" ? createdAt : new Date().toISOString(),
  };
};

const countsOf = (payload: BackupPayload): BackupCounts => ({
  profiles: payload.profiles.length,
  reminders: payload.reminders.length,
  basicHistory: payload.basicHistory.length,
});

export const isEmptyBackup = (counts: BackupCounts): boolean =>
  counts.profiles === 0 && counts.reminders === 0 && counts.basicHistory === 0;

/**
 * Reads a backup file's text into a payload the app can restore.
 *
 * Pure and total: every malformed file produces a `problem` rather than a
 * throw, because the input is a file the user picked and may not be ours at
 * all. Individual rows that fail validation are dropped instead of failing the
 * whole restore, so one corrupt reminder cannot cost someone the rest of their
 * data.
 */
export const parseBackup = (raw: string): ParsedBackup => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, problem: "unreadable" };
  }

  if (!isRecord(parsed) || parsed.format !== BACKUP_FORMAT) {
    return { ok: false, problem: "notABackup" };
  }

  const schemaVersion = Number(parsed.schemaVersion);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
    return { ok: false, problem: "notABackup" };
  }
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    return { ok: false, problem: "tooNew" };
  }

  const data = isRecord(parsed.data) ? parsed.data : null;
  if (!data) {
    return { ok: false, problem: "notABackup" };
  }

  const profiles = Array.isArray(data.profiles)
    ? data.profiles
        .map(normalizeProfile)
        .filter((item): item is SavedLoanProfile => item !== null)
    : [];
  const reminders = Array.isArray(data.reminders)
    ? data.reminders
        .map((item) => normalizeReminder(item as Partial<LoanReminder>))
        .filter((item): item is LoanReminder => item !== null)
    : [];
  const basicHistory = Array.isArray(data.basicHistory)
    ? data.basicHistory
        .map(normalizeHistoryEntry)
        .filter((item): item is BasicCalcHistoryEntry => item !== null)
        .slice(0, MAX_BASIC_CALC_HISTORY)
    : [];

  const payload: BackupPayload = {
    input: isRecord(data.input)
      ? normalizeInput(data.input as Partial<LoanInput>)
      : null,
    profiles,
    settings: isRecord(data.settings)
      ? normalizeAppSettings(data.settings as Partial<AppSettings>)
      : { ...DEFAULT_APP_SETTINGS },
    reminders,
    basicHistory,
  };

  const counts = countsOf(payload);
  // A file whose every row was dropped is almost certainly the wrong file, and
  // restoring it would silently wipe whatever the user already had.
  if (isEmptyBackup(counts) && !payload.input) {
    return { ok: false, problem: "empty" };
  }

  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      schemaVersion,
      appVersion:
        typeof parsed.appVersion === "string" ? parsed.appVersion : "unknown",
      exportedAt:
        typeof parsed.exportedAt === "string"
          ? parsed.exportedAt
          : new Date().toISOString(),
      data: payload,
    },
    counts,
  };
};

/** `slc-backup-2026-09-19.json` - sorts by date and says what it is. */
export const backupFileName = (isoDay: string): string =>
  `slc-backup-${isoDay}.json`;

export const buildBackup = async (appVersion: string): Promise<BackupFile> => {
  const [input, profiles, settings, reminders, basicHistory] =
    await Promise.all([
      loadLoanInput(),
      loadSavedLoanProfiles(),
      loadAppSettings(),
      loadLoanReminders(),
      loadBasicCalcHistory(),
    ]);

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt: new Date().toISOString(),
    data: { input, profiles, settings, reminders, basicHistory },
  };
};

export const serializeBackup = (backup: BackupFile): string =>
  JSON.stringify(backup, null, 2);

export const countStoredData = async (): Promise<BackupCounts> => {
  const [profiles, reminders, basicHistory] = await Promise.all([
    loadSavedLoanProfiles(),
    loadLoanReminders(),
    loadBasicCalcHistory(),
  ]);
  return {
    profiles: profiles.length,
    reminders: reminders.length,
    basicHistory: basicHistory.length,
  };
};

/**
 * Replaces everything on the device with the file's contents. A restore is a
 * whole-state swap rather than a merge: merging two sets of loans would need
 * the user to resolve conflicts row by row, and the point of the feature is
 * getting a phone back to a known state.
 *
 * Scheduled notifications are deliberately not written here. The ids in the
 * file belong to the device that wrote it, so the caller re-schedules from the
 * restored reminders instead.
 */
export const restoreBackup = async (backup: BackupFile): Promise<void> => {
  const { input, profiles, settings, reminders, basicHistory } = backup.data;

  await Promise.all([
    saveSavedLoanProfiles(profiles),
    saveAppSettings(settings),
    saveLoanReminders(
      reminders.map((item) => ({ ...item, scheduledNotificationIds: [] }))
    ),
    saveBasicCalcHistory(basicHistory),
    // A backup taken with no calculation in progress has to clear the one on
    // this device too, or the restore would leave a loan behind that the file
    // never described.
    input ? saveLoanInput(normalizeInput(input)) : clearLoanInput(),
  ]);
};
