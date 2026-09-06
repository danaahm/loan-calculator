import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { formatDisplayDate } from "../utils/dateIso";
import { formatCurrency } from "../utils/format";
import { payoffProgress, type UpcomingRepayment } from "../utils/reminderMath";
import { DueChip } from "./DueChip";
import { ProgressBar } from "./ProgressBar";

interface UpcomingRepaymentCardProps {
  item: UpcomingRepayment;
  expanded: boolean;
  /** The soonest repayment overall, regardless of which card is expanded. */
  isNext: boolean;
  /** Shown on the expanded card only. */
  activeReminderCount: number;
  onPress: () => void;
}

export const UpcomingRepaymentCard = ({
  item,
  expanded,
  isNext,
  activeReminderCount,
  onPress,
}: UpcomingRepaymentCardProps) => {
  const { colors } = useTheme();
  const { reminder } = item;

  if (!expanded) {
    return (
      <Pressable
        style={[
          styles.compactCard,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${reminder.name}, ${formatCurrency(
          item.amountDue,
          reminder.currencyCode
        )} due ${formatDisplayDate(item.date)}. Tap to expand.`}
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
        {isNext ? "Next repayment" : "Upcoming repayment"}
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
        Due {formatDisplayDate(item.date)}
      </Text>
      <Text style={[styles.liveMeta, { color: colors.textMuted }]}>
        Remaining {formatCurrency(reminder.remainingBalance, reminder.currencyCode)} of{" "}
        {formatCurrency(reminder.originalAmount, reminder.currencyCode)}
      </Text>
      <ProgressBar progress={payoffProgress(reminder)} showPercent />
      <Text style={[styles.liveHint, { color: colors.accentTextStrong }]}>
        {activeReminderCount} active reminder{activeReminderCount === 1 ? "" : "s"} · Open
      </Text>
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
  liveHint: {
    marginTop: 10,
    fontWeight: "700",
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
