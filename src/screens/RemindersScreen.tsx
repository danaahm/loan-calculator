import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ReminderCard } from "../components/ReminderCard";
import { useTheme } from "../theme/ThemeProvider";
import { REMINDER_DISCLAIMER, type LoanReminder } from "../types/reminder";

interface RemindersScreenProps {
  reminders: LoanReminder[];
  showArchived: boolean;
  onToggleArchived: () => void;
  notificationsAvailable: boolean;
  onBack: () => void;
  onAdd: () => void;
  onOpen: (reminder: LoanReminder) => void;
  onToggleNotifications: (reminder: LoanReminder, enabled: boolean) => void;
  onArchive: (reminder: LoanReminder) => void;
  onDelete: (reminder: LoanReminder) => void;
}

export const RemindersScreen = ({
  reminders,
  showArchived,
  onToggleArchived,
  notificationsAvailable,
  onBack,
  onAdd,
  onOpen,
  onToggleNotifications,
  onArchive,
  onDelete,
}: RemindersScreenProps) => {
  const { colors } = useTheme();
  const visible = reminders.filter((item) =>
    showArchived ? item.status === "archived" : item.status !== "archived"
  );

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      <Pressable
        onPress={onBack}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color={colors.accentTextStrong} />
        <Text style={[styles.backText, { color: colors.accentTextStrong }]}>Back</Text>
      </Pressable>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>Reminders</Text>
        <Pressable
          onPress={onAdd}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Add reminder"
        >
          <Ionicons name="add" size={22} color={colors.textInverse} />
        </Pressable>
      </View>
      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        {REMINDER_DISCLAIMER}
      </Text>
      <Pressable onPress={onToggleArchived} style={styles.filterRow}>
        <Text style={[styles.filterText, { color: colors.accentTextStrong }]}>
          {showArchived ? "Show active reminders" : "Show archived"}
        </Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {visible.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {showArchived
              ? "No archived reminders."
              : "No repayment reminders yet. Add one to track a loan and get alerts before it is due."}
          </Text>
        ) : (
          visible.map((item) => (
            <ReminderCard
              key={item.id}
              reminder={item}
              notificationsAvailable={notificationsAvailable}
              onPress={() => onOpen(item)}
              onToggleNotifications={(enabled) => onToggleNotifications(item, enabled)}
              onArchive={() => onArchive(item)}
              onDelete={() => onDelete(item)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    padding: 16,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 12,
    gap: 2,
  },
  backText: {
    fontWeight: "700",
    fontSize: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    fontWeight: "600",
    marginBottom: 10,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterText: {
    fontWeight: "700",
  },
  list: {
    paddingBottom: 24,
  },
  empty: {
    textAlign: "center",
    marginTop: 24,
    fontWeight: "600",
  },
});
