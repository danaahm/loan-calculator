import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { type LoanReminder } from "../types/reminder";
import { daysUntil, formatDisplayDate } from "../utils/dateIso";
import { formatCurrency, formatFrequencyLabel } from "../utils/format";
import { amountDueForReminder } from "../utils/reminderMath";

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
  const due = amountDueForReminder(reminder);
  const until = daysUntil(reminder.nextPaymentDate);
  const overdue = reminder.status === "active" && until < 0;
  const paidOff = reminder.status === "completed";
  const badge = paidOff
    ? "Paid off"
    : overdue
      ? "Overdue"
      : until === 0
        ? "Due today"
        : until === 1
          ? "Due tomorrow"
          : `Due in ${until} days`;

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
        <View
          style={[
            styles.badge,
            {
              backgroundColor: paidOff
                ? colors.savingsBg
                : overdue
                  ? colors.dangerBg
                  : colors.primarySoft,
            },
          ]}
        >
          <Text
            style={{
              color: paidOff
                ? colors.savingsText
                : overdue
                  ? colors.danger
                  : colors.accentTextDeep,
              fontWeight: "700",
              fontSize: 11,
            }}
          >
            {badge}
          </Text>
        </View>
      </View>
      <Text style={[styles.meta, { color: colors.textMuted }]}>
        Remaining {formatCurrency(reminder.remainingBalance, reminder.currencyCode)} of{" "}
        {formatCurrency(reminder.originalAmount, reminder.currencyCode)}
      </Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        Next {formatDisplayDate(reminder.nextPaymentDate)} ·{" "}
        {formatCurrency(due, reminder.currencyCode)} ·{" "}
        {formatFrequencyLabel(reminder.repaymentFrequency)}
      </Text>

      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>Notifications</Text>
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
            <Text style={[styles.actionText, { color: colors.textSecondary }]}>Archive</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onDelete}
          style={[styles.actionBtn, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }]}
        >
          <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
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
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
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
