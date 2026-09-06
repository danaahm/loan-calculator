import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useDueThresholds } from "../settings/DueThresholdsProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type ReminderStatus } from "../types/reminder";
import { daysUntil } from "../utils/dateIso";
import { dueTone, isReminderOverdue } from "../utils/dueTone";

interface DueChipProps {
  dateIso: string;
  status: ReminderStatus;
}

export const DueChip = ({ dateIso, status }: DueChipProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const { thresholds } = useDueThresholds();
  const until = daysUntil(dateIso);
  const paidOff = status === "completed";
  const overdue = isReminderOverdue(dateIso, status);
  const label = paidOff
    ? t("due.paidOff")
    : overdue
      ? t("due.overdue")
      : until === 0
        ? t("due.today")
        : until === 1
          ? t("due.tomorrow")
          : t("due.inDays", { count: until });

  const tone = dueTone(dateIso, status, thresholds);
  const backgroundColor =
    tone === "paid"
      ? colors.savingsBg
      : tone === "urgent"
        ? colors.dangerBg
        : tone === "soon"
          ? colors.warningBg
          : colors.primarySoft;
  const color =
    tone === "paid"
      ? colors.savingsText
      : tone === "urgent"
        ? colors.danger
        : tone === "soon"
          ? colors.warning
          : colors.accentTextDeep;

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontWeight: "700",
    fontSize: 11,
  },
});
