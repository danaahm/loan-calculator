import { StyleSheet, Text, View } from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type ReminderStatus } from "../types/reminder";
import { daysUntil } from "../utils/dateIso";

interface DueChipProps {
  dateIso: string;
  status: ReminderStatus;
}

export const isReminderOverdue = (dateIso: string, status: ReminderStatus): boolean => {
  return status === "active" && daysUntil(dateIso) < 0;
};

/** Due within this many days reads as urgent (red). */
const URGENT_DAYS = 3;
/** Due within this many days reads as approaching (amber). */
const SOON_DAYS = 7;

export type DueTone = "paid" | "urgent" | "soon" | "normal";

/**
 * Urgency only applies to live reminders; archived and paid-off ones stay
 * neutral regardless of how close the stored date is.
 */
export const dueTone = (dateIso: string, status: ReminderStatus): DueTone => {
  if (status === "completed") {
    return "paid";
  }
  if (status !== "active") {
    return "normal";
  }
  const until = daysUntil(dateIso);
  if (until <= URGENT_DAYS) {
    return "urgent";
  }
  if (until <= SOON_DAYS) {
    return "soon";
  }
  return "normal";
};

export const DueChip = ({ dateIso, status }: DueChipProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
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

  const tone = dueTone(dateIso, status);
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
