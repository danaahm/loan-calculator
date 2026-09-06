import { StyleSheet, Text, View } from "react-native";

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

export const DueChip = ({ dateIso, status }: DueChipProps) => {
  const { colors } = useTheme();
  const until = daysUntil(dateIso);
  const paidOff = status === "completed";
  const overdue = isReminderOverdue(dateIso, status);
  const label = paidOff
    ? "Paid off"
    : overdue
      ? "Overdue"
      : until === 0
        ? "Due today"
        : until === 1
          ? "Due tomorrow"
          : `Due in ${until} days`;

  return (
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
        style={[
          styles.text,
          {
            color: paidOff
              ? colors.savingsText
              : overdue
                ? colors.danger
                : colors.accentTextDeep,
          },
        ]}
      >
        {label}
      </Text>
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
