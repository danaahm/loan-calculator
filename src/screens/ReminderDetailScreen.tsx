import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { notificationUnavailableHint } from "../notifications/reminderNotifications";
import { useTheme } from "../theme/ThemeProvider";
import { type SavedLoanProfile } from "../types/loan";
import { REMINDER_DISCLAIMER, type LoanReminder } from "../types/reminder";
import { formatDisplayDate } from "../utils/dateIso";
import {
  formatCurrency,
  formatFrequencyLabel,
  formatMonthAnchorLabel,
  formatPercent,
} from "../utils/format";
import {
  amountDueForReminder,
  estimatePayoffDate,
  listUpcomingDates,
} from "../utils/reminderMath";

interface ReminderDetailScreenProps {
  reminder: LoanReminder;
  linkedProfile: SavedLoanProfile | null;
  notificationsSupported: boolean;
  onBack: () => void;
  onEdit: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  onExtraPayment: (amount: number) => void;
  onUndoLast: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onRefreshFromProfile: () => void;
}

export const ReminderDetailScreen = ({
  reminder,
  linkedProfile,
  notificationsSupported,
  onBack,
  onEdit,
  onToggleNotifications,
  onExtraPayment,
  onUndoLast,
  onArchive,
  onUnarchive,
  onDelete,
  onRefreshFromProfile,
}: ReminderDetailScreenProps) => {
  const { colors } = useTheme();
  const [extraInput, setExtraInput] = useState("");
  const due = amountDueForReminder(reminder);
  const payoff = estimatePayoffDate(reminder);
  const upcoming = listUpcomingDates(reminder, 6);
  const progress =
    reminder.originalAmount > 0
      ? Math.min(1, Math.max(0, 1 - reminder.remainingBalance / reminder.originalAmount))
      : 0;
  const lastPayments = useMemo(
    () => [...reminder.payments].reverse().slice(0, 8),
    [reminder.payments]
  );

  const submitExtra = () => {
    const amount = Number(extraInput.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert("Amount required", "Enter an extra payment amount.");
      return;
    }
    onExtraPayment(amount);
    setExtraInput("");
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={colors.accentTextStrong} />
        <Text style={[styles.backText, { color: colors.accentTextStrong }]}>Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>{reminder.name}</Text>
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {REMINDER_DISCLAIMER}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Remaining</Text>
          <Text style={[styles.hero, { color: colors.text }]}>
            {formatCurrency(reminder.remainingBalance, reminder.currencyCode)}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            of {formatCurrency(reminder.originalAmount, reminder.currencyCode)}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {Math.round(progress * 100)}% estimated paid down
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Next payment</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {formatDisplayDate(reminder.nextPaymentDate)}
          </Text>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Amount due</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {formatCurrency(due, reminder.currencyCode)}
          </Text>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Frequency</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {formatFrequencyLabel(reminder.repaymentFrequency)}
            {reminder.repaymentFrequency === "monthly"
              ? ` · ${formatMonthAnchorLabel(reminder.monthlyAnchor)}`
              : ""}
          </Text>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>Interest rate</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {formatPercent(reminder.annualInterestRatePercent)}
          </Text>
          {payoff ? (
            <>
              <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                Estimated payoff
              </Text>
              <Text style={[styles.rowValue, { color: colors.text }]}>
                {formatDisplayDate(payoff)}
              </Text>
            </>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Notifications</Text>
            <Switch
              value={reminder.notificationsEnabled && notificationsSupported}
              disabled={!notificationsSupported || reminder.status !== "active"}
              onValueChange={onToggleNotifications}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          {!notificationsSupported ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {notificationUnavailableHint}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Upcoming dates</Text>
          {upcoming.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>No upcoming dates.</Text>
          ) : (
            upcoming.map((date) => (
              <Text key={date} style={[styles.listLine, { color: colors.text }]}>
                {formatDisplayDate(date)}
              </Text>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Extra payment</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Reduces remaining now. Does not skip the next scheduled date.
          </Text>
          <View style={styles.row}>
            <TextInput
              keyboardType="decimal-pad"
              value={extraInput}
              onChangeText={setExtraInput}
              placeholder="Amount"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderColor: colors.borderStrong,
                },
              ]}
            />
            <Pressable
              onPress={submitExtra}
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>Apply</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Payment history</Text>
          {lastPayments.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>No payments recorded yet.</Text>
          ) : (
            lastPayments.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <Text style={[styles.listLine, { color: colors.text }]}>
                  {formatDisplayDate(item.date)} · {item.source}
                </Text>
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  Paid {formatCurrency(item.amountPaid, reminder.currencyCode)} · remaining{" "}
                  {formatCurrency(item.remainingAfter, reminder.currencyCode)}
                </Text>
              </View>
            ))
          )}
          {reminder.payments.length > 0 ? (
            <Pressable
              onPress={onUndoLast}
              style={[styles.secondaryBtn, { borderColor: colors.borderStrong }]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                Undo last payment
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={onEdit}
          style={[styles.primaryBtnFull, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>Edit details</Text>
        </Pressable>

        {linkedProfile ? (
          <Pressable
            onPress={onRefreshFromProfile}
            style={[styles.secondaryBtnFull, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              Refresh terms from {linkedProfile.name}
            </Text>
          </Pressable>
        ) : null}

        {reminder.status === "archived" ? (
          <Pressable
            onPress={onUnarchive}
            style={[styles.secondaryBtnFull, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              Unarchive
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onArchive}
            style={[styles.secondaryBtnFull, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Archive</Text>
          </Pressable>
        )}

        <Pressable
          onPress={onDelete}
          style={[styles.dangerBtn, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }]}
        >
          <Text style={[styles.dangerBtnText, { color: colors.danger }]}>Delete reminder</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    marginLeft: 16,
    gap: 2,
  },
  backText: {
    fontWeight: "700",
    fontSize: 16,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  disclaimer: {
    marginTop: 6,
    marginBottom: 14,
    fontWeight: "600",
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  cardLabel: {
    fontWeight: "600",
  },
  hero: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "800",
  },
  meta: {
    marginTop: 4,
    fontWeight: "600",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 12,
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  rowLabel: {
    marginTop: 8,
    fontWeight: "600",
  },
  rowValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  listLine: {
    fontWeight: "700",
    marginBottom: 4,
  },
  hint: {
    fontWeight: "600",
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchLabel: {
    fontWeight: "700",
    fontSize: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primaryBtnFull: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryBtnText: {
    fontWeight: "700",
  },
  secondaryBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryBtnFull: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
    backgroundColor: "transparent",
  },
  secondaryBtnText: {
    fontWeight: "700",
  },
  dangerBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  dangerBtnText: {
    fontWeight: "700",
  },
  historyRow: {
    marginBottom: 8,
  },
});
