import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { todayLocalIso } from "../utils/dateIso";
import {
  backupFileName,
  buildBackup,
  parseBackup,
  serializeBackup,
  type ParsedBackup,
} from "./backup";

export type ExportOutcome =
  | { status: "shared" }
  | { status: "unavailable"; uri: string }
  | { status: "failed" };

export type ImportOutcome =
  | { status: "cancelled" }
  | { status: "read"; parsed: ParsedBackup }
  | { status: "failed" };

/**
 * Writes the backup to the cache directory and hands it to the share sheet.
 *
 * Cache rather than documents: once the user has sent the file somewhere, the
 * copy here is dead weight, and the system is free to reclaim it. The file is
 * named for the day it was taken so several backups do not collide in the
 * target app's folder.
 */
export const exportBackupToFile = async (
  appVersion: string
): Promise<ExportOutcome> => {
  try {
    const backup = await buildBackup(appVersion);
    const file = new File(Paths.cache, backupFileName(todayLocalIso()));
    file.create({ overwrite: true, intermediates: true });
    file.write(serializeBackup(backup));

    if (!(await Sharing.isAvailableAsync())) {
      return { status: "unavailable", uri: file.uri };
    }

    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: backupFileName(todayLocalIso()),
      UTI: "public.json",
    });
    return { status: "shared" };
  } catch {
    return { status: "failed" };
  }
};

/**
 * Asks for a file and reads it, stopping short of writing anything. The caller
 * shows the user what the file holds and only then restores it.
 *
 * The picker accepts any file type rather than only `application/json`,
 * because files arriving from cloud storage and messaging apps regularly carry
 * a generic or missing MIME type and would otherwise be unselectable. Content
 * is what decides whether the file is ours, not its type.
 */
export const pickBackupFile = async (): Promise<ImportOutcome> => {
  try {
    const picked = await File.pickFileAsync({ mimeTypes: ["*/*"] });
    if (picked.canceled || !picked.result) {
      return { status: "cancelled" };
    }
    const raw = await picked.result.text();
    return { status: "read", parsed: parseBackup(raw) };
  } catch {
    return { status: "failed" };
  }
};
