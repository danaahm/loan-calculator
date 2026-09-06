import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { formatDisplayDate } from "../utils/dateIso";
import { formatCurrency } from "../utils/format";
import {
  estimatePayoffDate,
  payoffProgress,
  type UpcomingRepayment,
} from "../utils/reminderMath";
import { DueChip } from "./DueChip";
import { ProgressBar } from "./ProgressBar";

interface UpcomingRepaymentCardProps {
  item: UpcomingRepayment;
  expanded: boolean;
  /** The soonest repayment overall, regardless of which card is expanded. */
  isNext: boolean;
  onPress: () => void;
}

export const UpcomingRepaymentCard = ({
  item,
  expanded,
  isNext,
  onPress,
}: UpcomingRepaymentCardProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const { reminder } = item;
  // Projecting to payoff walks the whole schedule, so only pay for it on the
  // card that is actually showing it.
  const payoffDate = useMemo(
    () => (expanded ? estimatePayoffDate(reminder) : null),
    [expanded, reminder]
  );
  // Redundant when this repayment is itself the last one.
  const showPayoffDate = payoffDate !== null && payoffDate !== item.date;

  if (!expanded) {
    return (
      <Pressable
        style={[
          styles.compactCard,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("upcoming.compactA11y", {
          name: reminder.name,
          amount: formatCurrency(item.amountDue, reminder.currencyCode),
          date: formatDisplayDate(item.date),
        })}
      >
        <View style={styles.compactMain}>
          <Text
            style={[styles.compactTitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {reminder.name}
          </Text>
          <Text style={[styles.compactAmount, { color: colors.text }]}>
            {formatCurrency(item.amountDue, reminder.currencyCode)}
          </Text>
        </View>
        <DueChip dateIso={item.date} status={reminder.status} />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.liveCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[styles.liveKicker, { color: colors.accentText }]}>
        {isNext ? t("upcoming.next") : t("upcoming.upcoming")}
      </Text>
      <View style={styles.titleRow}>
        <Text style={[styles.liveTitle, { color: colors.text }]} numberOfLines={1}>
          {reminder.name}
        </Text>
        <DueChip dateIso={item.date} status={reminder.status} />
      </View>
      <Text style={[styles.liveHero, { color: colors.text }]}>
        {formatCurrency(item.amountDue, reminder.currencyCode)}
      </Text>
      <Text style={[styles.liveMeta, { color: colors.textSecondary }]}>
        {t("upcoming.due", { date: formatDisplayDate(item.date) })}
      </Text>
      {showPayoffDate ? (
        <Text style={[styles.liveMeta, { color: colors.textMuted }]}>
          {t("upcoming.paidOffOn", { date: formatDisplayDate(payoffDate) })}
        </Text>
      ) : null}
      <Text style={[styles.liveMeta, { color: colors.textMuted }]}>
        {t("reminderCard.remainingOf", {
          remaining: formatCurrency(reminder.remainingBalance, reminder.currencyCode),
          original: formatCurrency(reminder.originalAmount, reminder.currencyCode),
        })}
      </Text>
      <ProgressBar progress={payoffProgress(reminder)} showPercent />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  liveCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  titleRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveKicker: {
    fontWeight: "800",
    fontSize: 12,
    textTransform: "uppercase",
  },
  liveTitle: {
    flex: 1,
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
  compactCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  compactMain: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  compactAmount: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "800",
  },
});
