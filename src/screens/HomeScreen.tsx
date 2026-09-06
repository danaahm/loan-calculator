import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { UpcomingRepaymentCard } from "../components/UpcomingRepaymentCard";
import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import {
  type LoanCalculationResult,
  type LoanInput,
} from "../types/loan";
import { type LoanReminder } from "../types/reminder";
import {
  formatCurrency,
  formatDurationLabel,
  formatFrequencyLabel,
  formatYearsAndPeriods,
} from "../utils/format";
import { type UpcomingRepayment } from "../utils/reminderMath";

const PERIODS_PER_YEAR: Record<LoanInput["repaymentFrequency"], number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

interface HomeScreenProps {
  upcoming: UpcomingRepayment[];
  activeReminderCount: number;
  input: LoanInput;
  result: LoanCalculationResult | null;
  minimumMonthlyRepayment: number;
  savedProfileCount: number;
  onOpenCalculator: () => void;
  onOpenBasic: () => void;
  onOpenSaved: () => void;
  onOpenReminders: () => void;
  onOpenReminder: (reminder: LoanReminder) => void;
}

export const HomeScreen = ({
  upcoming,
  activeReminderCount,
  input,
  result,
  minimumMonthlyRepayment,
  savedProfileCount,
  onOpenCalculator,
  onOpenBasic,
  onOpenSaved,
  onOpenReminders,
  onOpenReminder,
}: HomeScreenProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // Derive rather than sync via an effect, so a reminder disappearing from the
  // list silently falls back to expanding the soonest one.
  const activeKey = upcoming.some((item) => item.key === expandedKey)
    ? expandedKey
    : (upcoming[0]?.key ?? null);
  const periodsPerYear = PERIODS_PER_YEAR[input.repaymentFrequency];
  const extraSavings =
    result && result.hasPlanComparison && result.savings.moneySaved > 0
      ? t("home.savingsValue", {
          money: formatCurrency(result.savings.moneySaved, input.currencyCode),
          time: formatYearsAndPeriods(
            Math.max(0, result.savings.yearsSaved),
            Math.max(0, result.savings.periodsSaved),
            periodsPerYear
          ),
        })
      : null;
  const offsetNote =
    input.offsetSavings.enabled && input.offsetSavings.contribution?.enabled
      ? t("home.offsetDeposits", {
          amount: formatCurrency(
            input.offsetSavings.contribution.amount,
            input.currencyCode
          ),
          frequency: formatFrequencyLabel(
            input.offsetSavings.contribution.frequency
          ).toLowerCase(),
        })
      : input.offsetSavings.enabled
        ? t("home.offsetAmount", {
            amount: formatCurrency(input.offsetSavings.amount, input.currencyCode),
          })
        : null;

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: colors.page }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {upcoming.length > 0 ? (
        upcoming.map((item, index) => (
          <UpcomingRepaymentCard
            key={item.key}
            item={item}
            expanded={item.key === activeKey}
            isNext={index === 0}
            onPress={() => {
              if (item.key === activeKey) {
                onOpenReminder(item.reminder);
              } else {
                setExpandedKey(item.key);
              }
            }}
          />
        ))
      ) : (
        <Pressable
          style={[styles.liveCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={onOpenReminders}
        >
          <Text style={[styles.liveKicker, { color: colors.accentText }]}>{t("upcoming.next")}</Text>
          <Text style={[styles.liveTitle, { color: colors.text }]}>{t("home.noActiveReminders")}</Text>
          <Text style={[styles.liveMeta, { color: colors.textMuted }]}>
            {t("home.noRemindersHint")}
          </Text>
          <Text style={[styles.liveHint, { color: colors.accentTextStrong }]}>
            {t("home.addReminder")}
          </Text>
        </Pressable>
      )}

      {result ? (
        <Pressable
          style={[styles.liveCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={onOpenCalculator}
        >
          <Text style={[styles.liveKicker, { color: colors.accentText }]}>{t("home.lastCalculation")}</Text>
          <Text style={[styles.liveTitle, { color: colors.text }]}>{t("home.minimumMonthly")}</Text>
          <Text style={[styles.liveHero, { color: colors.text }]}>
            {formatCurrency(minimumMonthlyRepayment, input.currencyCode)}
          </Text>
          <Text style={[styles.liveMeta, { color: colors.textSecondary }]}>
            {t("home.totalInterest", {
              amount: formatCurrency(
                result.activeSchedule.summary.totalInterestPaid,
                input.currencyCode
              ),
            })}
          </Text>
          <Text style={[styles.liveMeta, { color: colors.textMuted }]}>
            {t("home.payoff", {
              duration: formatDurationLabel(
                result.activeSchedule.summary.payoffYears
              ),
            })}
          </Text>
          {extraSavings ? (
            <Text style={[styles.liveMeta, { color: colors.textSecondary }]}>
              {t("home.planSaves", { value: extraSavings })}
            </Text>
          ) : null}
          {offsetNote ? (
            <Text style={[styles.liveMeta, { color: colors.textMuted }]}>{offsetNote}</Text>
          ) : null}
          <Text style={[styles.liveHint, { color: colors.accentTextStrong }]}>{t("home.openCalculator")}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.liveCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={onOpenCalculator}
        >
          <Text style={[styles.liveKicker, { color: colors.accentText }]}>{t("home.lastCalculation")}</Text>
          <Text style={[styles.liveTitle, { color: colors.text }]}>{t("home.noCalculation")}</Text>
          <Text style={[styles.liveMeta, { color: colors.textMuted }]}>
            {t("home.noCalculationHint")}
          </Text>
          <Text style={[styles.liveHint, { color: colors.accentTextStrong }]}>
            {t("home.openCalculator")}
          </Text>
        </Pressable>
      )}

      <View style={styles.dashboardGrid}>
        <Pressable
          style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={onOpenCalculator}
        >
          <Ionicons name="cash-outline" size={22} color={colors.accentTextStrong} />
          <Text style={[styles.dashboardTitle, { color: colors.text }]}>{t("home.tileCalculator")}</Text>
          <Text style={[styles.dashboardHint, { color: colors.textMuted }]}>{t("home.tileCalculatorHint")}</Text>
        </Pressable>
        <Pressable
          style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={onOpenBasic}
        >
          <Ionicons name="calculator-outline" size={22} color={colors.accentTextStrong} />
          <Text style={[styles.dashboardTitle, { color: colors.text }]}>{t("home.tileBasic")}</Text>
          <Text style={[styles.dashboardHint, { color: colors.textMuted }]}>{t("home.tileBasicHint")}</Text>
        </Pressable>
        <Pressable
          style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={onOpenSaved}
        >
          <Ionicons name="document-text-outline" size={22} color={colors.accentTextStrong} />
          <Text style={[styles.dashboardTitle, { color: colors.text }]}>{t("home.tileSaved")}</Text>
          <Text style={[styles.dashboardHint, { color: colors.textMuted }]}>
            {t("home.profileCount", { count: savedProfileCount })}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.dashboardCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={onOpenReminders}
        >
          <Ionicons name="notifications-outline" size={22} color={colors.accentTextStrong} />
          <Text style={[styles.dashboardTitle, { color: colors.text }]}>{t("reminders.title")}</Text>
          <Text style={[styles.dashboardHint, { color: colors.textMuted }]}>
            {activeReminderCount > 0
              ? t("home.activeCount", { count: activeReminderCount })
              : t("home.tileRemindersHint")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  liveCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  liveKicker: {
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
  },
  liveTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: "800",
  },
  liveHero: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: "800",
  },
  liveMeta: {
    marginTop: 4,
    fontWeight: "600",
  },
  liveHint: {
    marginTop: 10,
    fontWeight: "700",
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 4,
  },
  dashboardCard: {
    width: "48%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  dashboardTitle: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "800",
  },
  dashboardHint: {
    marginTop: 4,
    fontWeight: "600",
  },
});
