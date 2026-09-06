import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type LoanReminder } from "../types/reminder";
import { formatDisplayDate } from "../utils/dateIso";
import { formatCurrency, formatFrequencyLabel } from "../utils/format";
import { amountDueForReminder } from "../utils/reminderMath";
import { DueChip, isReminderOverdue } from "./DueChip";

interface ReminderCardProps {
  reminder: LoanReminder;
  notificationsAvailable: boolean;
  onPress: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  onArchive: () => void;
  onDelete: () => void;
}

export const ReminderCard = ({
  reminder,
  notificationsAvailable,
  onPress,
  onToggleNotifications,
  onArchive,
  onDelete,
}: ReminderCardProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const due = amountDueForReminder(reminder);
  const overdue = isReminderOverdue(reminder.nextPaymentDate, reminder.status);
  const paidOff = reminder.status === "completed";

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: overdue ? colors.dangerBorder : colors.border,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {reminder.name}
        </Text>
        <DueChip dateIso={reminder.nextPaymentDate} status={reminder.status} />
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        {t("reminderCard.remainingOf", {
          remaining: formatCurrency(reminder.remainingBalance, reminder.currencyCode),
          original: formatCurrency(reminder.originalAmount, reminder.currencyCode),
        })}
      </Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        {t("reminderCard.nextLine", {
          date: formatDisplayDate(reminder.nextPaymentDate),
          amount: formatCurrency(due, reminder.currencyCode),
          frequency: formatFrequencyLabel(reminder.repaymentFrequency),
        })}
      </Text>

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>{t("reminderCard.notifications")}</Text>
        <Switch
          value={reminder.notificationsEnabled && notificationsAvailable}
          disabled={!notificationsAvailable || paidOff || reminder.status === "archived"}
          onValueChange={onToggleNotifications}
          trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
          thumbColor={colors.switchThumb}
        />
      </View>

      <View style={styles.actions}>
        {reminder.status !== "archived" ? (
          <Pressable
            onPress={onArchive}
            style={[styles.actionBtn, { borderColor: colors.borderStrong, backgroundColor: colors.inputBg }]}
          >
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t("common.archive")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDelete}
          style={[styles.actionBtn, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }]}
        >
          <Text style={[styles.actionText, { color: colors.danger }]}>{t("common.delete")}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    marginTop: 4,
    fontWeight: "600",
  },
  switchRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    fontWeight: "600",
  },
  actions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    fontWeight: "700",
    fontSize: 12,
  },
});
