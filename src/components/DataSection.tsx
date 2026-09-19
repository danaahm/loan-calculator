import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useLocale } from "../i18n/LocaleProvider";
import { useDueThresholds } from "../settings/DueThresholdsProvider";
import {
  countStoredData,
  isEmptyBackup,
  restoreBackup,
  type BackupCounts,
  type BackupFile,
} from "../storage/backup";
import { exportBackupToFile, pickBackupFile } from "../storage/backupFile";
import { clearAllStoredData } from "../storage/localState";
import { useTheme } from "../theme/ThemeProvider";
import { formatDisplayDate } from "../utils/dateIso";

interface DataSectionProps {
  /** Recorded in the file so a support request can name the build. */
  appVersion: string;
  /**
   * Called once storage holds different data, so the screens above can reload
   * from it. Reminder notifications are re-scheduled by the same handler.
   */
  onDataReplaced: () => Promise<void>;
  onNotify: (message: string) => void;
}

type Busy = "export" | "import" | "delete" | null;

interface PendingRestore {
  backup: BackupFile;
  counts: BackupCounts;
}

export const DataSection = ({
  appVersion,
  onDataReplaced,
  onNotify,
}: DataSectionProps) => {
  const { colors, reloadFromStorage: reloadTheme } = useTheme();
  const { t, reloadFromStorage: reloadLocale } = useLocale();
  const { reloadFromStorage: reloadThresholds } = useDueThresholds();

  const [busy, setBusy] = useState<Busy>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(
    null
  );
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteCounts, setDeleteCounts] = useState<BackupCounts | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  const confirmWord = t("settings.data.deleteWord");
  const confirmed =
    typedConfirmation.trim().toUpperCase() === confirmWord.toUpperCase();

  /**
   * Settings live in three providers that each read storage once on mount, so
   * replacing the stored data has to push every one of them to re-read before
   * the screens above reload.
   */
  const reloadEverything = useCallback(async () => {
    await Promise.all([reloadTheme(), reloadLocale(), reloadThresholds()]);
    await onDataReplaced();
  }, [onDataReplaced, reloadLocale, reloadTheme, reloadThresholds]);

  const describe = useCallback(
    (counts: BackupCounts): string => {
      if (isEmptyBackup(counts)) {
        return t("settings.data.countNothing");
      }
      return [
        t("settings.data.countProfiles", { count: counts.profiles }),
        t("settings.data.countReminders", { count: counts.reminders }),
        t("settings.data.countHistory", { count: counts.basicHistory }),
      ].join(" · ");
    },
    [t]
  );

  const handleExport = useCallback(async () => {
    setBusy("export");
    const outcome = await exportBackupToFile(appVersion);
    setBusy(null);
    if (outcome.status === "shared") {
      onNotify(t("settings.data.exportDone"));
    } else if (outcome.status === "unavailable") {
      onNotify(t("settings.data.exportNoShare"));
    } else {
      onNotify(t("settings.data.exportFailed"));
    }
  }, [appVersion, onNotify, t]);

  const handlePickImport = useCallback(async () => {
    setBusy("import");
    const outcome = await pickBackupFile();
    setBusy(null);

    if (outcome.status === "cancelled") {
      return;
    }
    if (outcome.status === "failed") {
      onNotify(t("settings.data.importFailed"));
      return;
    }
    if (!outcome.parsed.ok) {
      onNotify(t(`settings.data.problem.${outcome.parsed.problem}`));
      return;
    }
    setPendingRestore({
      backup: outcome.parsed.backup,
      counts: outcome.parsed.counts,
    });
  }, [onNotify, t]);

  const handleConfirmRestore = useCallback(async () => {
    if (!pendingRestore) {
      return;
    }
    setBusy("import");
    try {
      await restoreBackup(pendingRestore.backup);
      await reloadEverything();
      onNotify(t("settings.data.importDone"));
    } catch {
      onNotify(t("settings.data.importFailed"));
    } finally {
      setBusy(null);
      setPendingRestore(null);
    }
  }, [onNotify, pendingRestore, reloadEverything, t]);

  const handleOpenDelete = useCallback(async () => {
    const counts = await countStoredData();
    setDeleteCounts(counts);
    setTypedConfirmation("");
    setDeleteVisible(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmed) {
      return;
    }
    setBusy("delete");
    try {
      await clearAllStoredData();
      await reloadEverything();
      onNotify(t("settings.data.deleteDone"));
    } catch {
      onNotify(t("settings.data.deleteFailed"));
    } finally {
      setBusy(null);
      setDeleteVisible(false);
      setTypedConfirmation("");
    }
  }, [confirmed, onNotify, reloadEverything, t]);

  return (
    <>
      <View
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            marginTop: 14,
          },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.accentText }]}>
          {t("settings.data.title")}
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {t("settings.data.hint")}
        </Text>

        <Pressable
          onPress={() => {
            handleExport().catch(() => {});
          }}
          disabled={busy !== null}
          style={[
            styles.optionRow,
            {
              borderColor: colors.borderStrong,
              backgroundColor: colors.inputBg,
              opacity: busy !== null && busy !== "export" ? 0.5 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("settings.data.export")}
          accessibilityState={{ disabled: busy !== null }}
        >
          <Ionicons
            name="save-outline"
            size={20}
            color={colors.accentTextStrong}
            style={styles.rowIcon}
          />
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              {t("settings.data.export")}
            </Text>
            <Text style={[styles.optionHint, { color: colors.textMuted }]}>
              {busy === "export"
                ? t("settings.data.exporting")
                : t("settings.data.exportHint")}
            </Text>
          </View>
          {busy === "export" ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            handlePickImport().catch(() => {});
          }}
          disabled={busy !== null}
          style={[
            styles.optionRow,
            {
              borderColor: colors.borderStrong,
              backgroundColor: colors.inputBg,
              opacity: busy !== null && busy !== "import" ? 0.5 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("settings.data.import")}
          accessibilityState={{ disabled: busy !== null }}
        >
          <Ionicons
            name="download-outline"
            size={20}
            color={colors.accentTextStrong}
            style={styles.rowIcon}
          />
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              {t("settings.data.import")}
            </Text>
            <Text style={[styles.optionHint, { color: colors.textMuted }]}>
              {busy === "import"
                ? t("settings.data.importing")
                : t("settings.data.importHint")}
            </Text>
          </View>
          {busy === "import" ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          )}
        </Pressable>
      </View>

      {/*
        Deleting sits in its own card below the backup options rather than as a
        third row among them, so reaching it is a separate decision. The row is
        outlined rather than filled: legible, but not the thing a thumb lands on
        while scrolling.
      */}
      <View
        style={[
          styles.sectionCard,
          styles.dangerCard,
          { backgroundColor: colors.card, borderColor: colors.dangerBorder },
        ]}
      >
        <Pressable
          onPress={() => {
            handleOpenDelete().catch(() => {});
          }}
          disabled={busy !== null}
          style={[
            styles.optionRow,
            styles.dangerRow,
            { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t("settings.data.delete")}
          accessibilityHint={t("settings.data.deleteHint")}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color={colors.danger}
            style={styles.rowIcon}
          />
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: colors.danger }]}>
              {t("settings.data.delete")}
            </Text>
            <Text style={[styles.optionHint, { color: colors.textMuted }]}>
              {t("settings.data.deleteHint")}
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={pendingRestore !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPendingRestore(null)}
      >
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: colors.modalBackdrop },
          ]}
        >
          <View style={[styles.dialog, { backgroundColor: colors.card }]}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>
              {t("settings.data.importTitle")}
            </Text>
            <Text style={[styles.dialogBody, { color: colors.textSecondary }]}>
              {t("settings.data.importBody")}
            </Text>

            {pendingRestore ? (
              <View
                style={[
                  styles.summaryBox,
                  {
                    borderColor: colors.borderStrong,
                    backgroundColor: colors.inputBg,
                  },
                ]}
              >
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                  {t("settings.data.importFileFrom", {
                    date: formatDisplayDate(
                      pendingRestore.backup.exportedAt.slice(0, 10)
                    ),
                  })}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {describe(pendingRestore.counts)}
                </Text>
              </View>
            ) : null}

            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setPendingRestore(null)}
                style={[
                  styles.dialogButton,
                  { borderColor: colors.borderStrong },
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.dialogButtonText, { color: colors.text }]}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  handleConfirmRestore().catch(() => {});
                }}
                disabled={busy === "import"}
                style={[
                  styles.dialogButton,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary,
                    opacity: busy === "import" ? 0.6 : 1,
                  },
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.dialogButtonText, { color: colors.textInverse }]}
                >
                  {t("settings.data.importConfirm")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteVisible(false)}
      >
        <View
          style={[
            styles.modalBackdrop,
            { backgroundColor: colors.modalBackdrop },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.dialogScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.dialog, { backgroundColor: colors.card }]}>
              <Text style={[styles.dialogTitle, { color: colors.danger }]}>
                {t("settings.data.deleteTitle")}
              </Text>
              <Text style={[styles.dialogBody, { color: colors.textSecondary }]}>
                {t("settings.data.deleteBody")}
              </Text>

              {deleteCounts ? (
                <View
                  style={[
                    styles.summaryBox,
                    {
                      borderColor: colors.dangerBorder,
                      backgroundColor: colors.dangerBg,
                    },
                  ]}
                >
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
                    {t("settings.data.contains")}
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {describe(deleteCounts)}
                  </Text>
                </View>
              ) : null}

              {/*
                An escape hatch in the one place it is most wanted: the moment
                someone reads what they are about to lose.
              */}
              <Pressable
                onPress={() => {
                  setDeleteVisible(false);
                  handleExport().catch(() => {});
                }}
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.borderStrong },
                ]}
                accessibilityRole="button"
              >
                <Ionicons
                  name="save-outline"
                  size={18}
                  color={colors.accentTextStrong}
                />
                <Text
                  style={[
                    styles.secondaryButtonText,
                    { color: colors.accentTextStrong },
                  ]}
                >
                  {t("settings.data.deleteBackupFirst")}
                </Text>
              </Pressable>

              {/*
                Typing the word is the second confirmation. It is deliberately
                not a second tap: a tap can be repeated by muscle memory, while
                typing cannot happen by accident.
              */}
              <Text style={[styles.typePrompt, { color: colors.text }]}>
                {t("settings.data.deleteTypePrompt", { word: confirmWord })}
              </Text>
              <TextInput
                value={typedConfirmation}
                onChangeText={setTypedConfirmation}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder={t("settings.data.deletePlaceholder", {
                  word: confirmWord,
                })}
                placeholderTextColor={colors.textMuted}
                style={[
                  styles.typeInput,
                  {
                    borderColor: confirmed ? colors.danger : colors.borderStrong,
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                  },
                ]}
                accessibilityLabel={t("settings.data.deleteTypePrompt", {
                  word: confirmWord,
                })}
              />

              <View style={styles.dialogActions}>
                <Pressable
                  onPress={() => {
                    setDeleteVisible(false);
                    setTypedConfirmation("");
                  }}
                  style={[
                    styles.dialogButton,
                    { borderColor: colors.borderStrong },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.dialogButtonText, { color: colors.text }]}>
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    handleConfirmDelete().catch(() => {});
                  }}
                  disabled={!confirmed || busy === "delete"}
                  style={[
                    styles.dialogButton,
                    {
                      borderColor: confirmed ? colors.danger : colors.borderStrong,
                      backgroundColor: confirmed ? colors.danger : "transparent",
                      opacity: confirmed ? 1 : 0.4,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !confirmed }}
                >
                  <Text
                    style={[
                      styles.dialogButtonText,
                      { color: confirmed ? colors.textInverse : colors.textMuted },
                    ]}
                  >
                    {t("settings.data.deleteConfirm")}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  sectionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  dangerCard: {
    marginTop: 14,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  sectionHint: {
    marginTop: 4,
    marginBottom: 14,
    fontWeight: "600",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  dangerRow: {
    marginBottom: 0,
  },
  rowIcon: {
    marginRight: 12,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  optionHint: {
    marginTop: 2,
    fontWeight: "600",
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  dialogScroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  dialog: {
    borderRadius: 16,
    padding: 20,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  dialogBody: {
    fontWeight: "600",
    lineHeight: 20,
  },
  summaryBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    marginTop: 4,
    fontWeight: "700",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
  },
  secondaryButtonText: {
    fontWeight: "700",
  },
  typePrompt: {
    marginTop: 18,
    fontWeight: "700",
  },
  typeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    fontWeight: "700",
    letterSpacing: 1,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  dialogButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  dialogButtonText: {
    fontWeight: "800",
  },
});
