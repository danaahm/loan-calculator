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

import { DatePickerField } from "../components/DatePickerField";
import { ProgressBar } from "../components/ProgressBar";
import { notificationUnavailableHint } from "../notifications/reminderNotifications";
import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type SavedLoanProfile } from "../types/loan";
import { REMINDER_DISCLAIMER, type LoanReminder } from "../types/reminder";
import { formatDisplayDate, todayLocalIso } from "../utils/dateIso";
import {
  formatGroupedNumberInput,
  formatPlainNumberInput,
} from "../utils/numberInput";
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
  payoffProgress,
  rateAsOf,
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
  onAddRateChange: (effectiveDate: string, rate: number) => void;
  onRemoveRateChange: (id: string) => void;
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
  onAddRateChange,
  onRemoveRateChange,
  onArchive,
  onUnarchive,
  onDelete,
  onRefreshFromProfile,
}: ReminderDetailScreenProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const [extraInput, setExtraInput] = useState("");
  const [rateDate, setRateDate] = useState(todayLocalIso());
  const [rateInput, setRateInput] = useState("");
  const due = amountDueForReminder(reminder);
  const payoff = estimatePayoffDate(reminder);
  const upcoming = listUpcomingDates(reminder, 6);
  const currentRate = rateAsOf(reminder, todayLocalIso());
  const rateChanges = [...(reminder.rateChanges ?? [])].sort((left, right) =>
    left.effectiveDate.localeCompare(right.effectiveDate)
  );
  const progress = payoffProgress(reminder);
  const lastPayments = useMemo(
    () => [...reminder.payments].reverse().slice(0, 8),
    [reminder.payments]
  );

  const submitExtra = () => {
    const amount = Number(extraInput.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert(t("detail.amountRequired"), t("detail.amountRequiredBody"));
      return;
    }
    onExtraPayment(amount);
    setExtraInput("");
  };

  const submitRateChange = () => {
    const rate = Number(rateInput.replace(/,/g, ""));
    if (!Number.isFinite(rate) || rate < 0) {
      Alert.alert(t("detail.rateRequired"), t("detail.rateRequiredBody"));
      return;
    }
    onAddRateChange(rateDate, rate);
    setRateInput("");
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={colors.accentTextStrong} />
        <Text style={[styles.backText, { color: colors.accentTextStrong }]}>{t("common.back")}</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>{reminder.name}</Text>
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {REMINDER_DISCLAIMER()}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>{t("detail.remaining")}</Text>
          <Text style={[styles.hero, { color: colors.text }]}>
            {formatCurrency(reminder.remainingBalance, reminder.currencyCode)}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {t("detail.ofOriginal", {
              amount: formatCurrency(reminder.originalAmount, reminder.currencyCode),
            })}
          </Text>
          <ProgressBar
            progress={progress}
            showPercent
            percentLabelKey="progress.estimatedPaidDown"
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{t("detail.nextPayment")}</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {formatDisplayDate(reminder.nextPaymentDate)}
          </Text>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{t("detail.amountDue")}</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {formatCurrency(due, reminder.currencyCode)}
          </Text>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{t("detail.frequency")}</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {formatFrequencyLabel(reminder.repaymentFrequency)}
            {reminder.repaymentFrequency === "monthly"
              ? ` · ${formatMonthAnchorLabel(reminder.monthlyAnchor)}`
              : ""}
          </Text>
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{t("detail.interestRate")}</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>
            {t("detail.rateAsOfToday", { rate: formatPercent(currentRate) })}
          </Text>
          {payoff ? (
            <>
              <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>
                {t("detail.estimatedPayoff")}
              </Text>
              <Text style={[styles.rowValue, { color: colors.text }]}>
                {formatDisplayDate(payoff)}
              </Text>
            </>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>{t("detail.rateChanges")}</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t("detail.rateChangesHint")}
          </Text>
          {rateChanges.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              {t("detail.noRateChanges", {
                rate: formatPercent(reminder.annualInterestRatePercent),
              })}
            </Text>
          ) : (
            rateChanges.map((change) => (
              <View key={change.id} style={styles.historyRow}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listLine, { color: colors.text }]}>
                      {formatDisplayDate(change.effectiveDate)}
                    </Text>
                    <Text style={[styles.hint, { color: colors.textMuted }]}>
                      {formatPercent(change.annualInterestRatePercent)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onRemoveRateChange(change.id)}
                    style={[styles.secondaryBtn, { borderColor: colors.borderStrong, marginTop: 0 }]}
                  >
                    <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                      {t("common.remove")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{t("detail.effectiveDate")}</Text>
          <DatePickerField value={rateDate} onChange={setRateDate} />
          <Text style={[styles.rowLabel, { color: colors.textSecondary }]}>{t("detail.newRate")}</Text>
          <View style={styles.row}>
            <TextInput
              keyboardType="decimal-pad"
              value={rateInput}
              onChangeText={(value) => setRateInput(formatPlainNumberInput(value))}
              placeholder={t("detail.ratePlaceholder")}
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
              onPress={submitRateChange}
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>{t("common.add")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>{t("reminderCard.notifications")}</Text>
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
              {notificationUnavailableHint()}
            </Text>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>{t("detail.upcomingDates")}</Text>
          {upcoming.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t("detail.noUpcomingDates")}</Text>
          ) : (
            upcoming.map((date) => (
              <Text key={date} style={[styles.listLine, { color: colors.text }]}>
                {formatDisplayDate(date)}
              </Text>
            ))
          )}
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>{t("detail.extraPayment")}</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t("detail.extraPaymentHint")}
          </Text>
          <View style={styles.row}>
            <TextInput
              keyboardType="decimal-pad"
              value={extraInput}
              onChangeText={(value) => setExtraInput(formatGroupedNumberInput(value))}
              placeholder={t("detail.amountPlaceholder")}
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
              <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>{t("common.apply")}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.accentText }]}>{t("detail.paymentHistory")}</Text>
          {lastPayments.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>{t("detail.noPayments")}</Text>
          ) : (
            lastPayments.map((item) => (
              <View key={item.id} style={styles.historyRow}>
                <Text style={[styles.listLine, { color: colors.text }]}>
                  {t("detail.historyLine", {
                    date: formatDisplayDate(item.date),
                    source: t(`detail.source.${item.source}`),
                  })}
                </Text>
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  {t("detail.historyAmounts", {
                    paid: formatCurrency(item.amountPaid, reminder.currencyCode),
                    remaining: formatCurrency(
                      item.remainingAfter,
                      reminder.currencyCode
                    ),
                  })}
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
                {t("detail.undoLast")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={onEdit}
          style={[styles.primaryBtnFull, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>{t("detail.editDetails")}</Text>
        </Pressable>

        {linkedProfile ? (
          <Pressable
            onPress={onRefreshFromProfile}
            style={[styles.secondaryBtnFull, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              {t("detail.refreshFrom", { name: linkedProfile.name })}
            </Text>
          </Pressable>
        ) : null}

        {reminder.status === "archived" ? (
          <Pressable
            onPress={onUnarchive}
            style={[styles.secondaryBtnFull, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
              {t("common.unarchive")}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onArchive}
            style={[styles.secondaryBtnFull, { borderColor: colors.borderStrong }]}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>{t("common.archive")}</Text>
          </Pressable>
        )}

        <Pressable
          onPress={onDelete}
          style={[styles.dangerBtn, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerBg }]}
        >
          <Text style={[styles.dangerBtnText, { color: colors.danger }]}>{t("detail.deleteReminder")}</Text>
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
