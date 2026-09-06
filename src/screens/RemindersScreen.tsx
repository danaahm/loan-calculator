import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ReminderCard } from "../components/ReminderCard";
import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { REMINDER_DISCLAIMER, type LoanReminder } from "../types/reminder";

interface RemindersScreenProps {
  reminders: LoanReminder[];
  showArchived: boolean;
  onSelectArchived: (showArchived: boolean) => void;
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
  onSelectArchived,
  notificationsAvailable,
  onBack,
  onAdd,
  onOpen,
  onToggleNotifications,
  onArchive,
  onDelete,
}: RemindersScreenProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const archivedCount = reminders.filter((item) => item.status === "archived").length;
  const activeCount = reminders.length - archivedCount;
  const visible = reminders.filter((item) =>
    showArchived ? item.status === "archived" : item.status !== "archived"
  );

  const renderTab = (labelKey: string, count: number, archivedTab: boolean) => {
    const selected = showArchived === archivedTab;
    return (
      <Pressable
        onPress={() => onSelectArchived(archivedTab)}
        style={[
          styles.tab,
          {
            backgroundColor: selected ? colors.primary : "transparent",
          },
        ]}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
      >
        <Text
          style={[
            styles.tabText,
            { color: selected ? colors.textInverse : colors.textSecondary },
          ]}
        >
          {t("reminders.tabLabel", { label: t(labelKey), count })}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      <Pressable
        onPress={onBack}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name="chevron-back" size={22} color={colors.accentTextStrong} />
        <Text style={[styles.backText, { color: colors.accentTextStrong }]}>{t("common.back")}</Text>
      </Pressable>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.text }]}>{t("reminders.title")}</Text>
        <Pressable
          onPress={onAdd}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={t("reminders.addA11y")}
        >
          <Ionicons name="add" size={22} color={colors.textInverse} />
        </Pressable>
      </View>
      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        {REMINDER_DISCLAIMER()}
      </Text>
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
      >
        {renderTab("reminders.tabActive", activeCount, false)}
        {renderTab("reminders.tabArchived", archivedCount, true)}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {visible.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            {showArchived
              ? t("reminders.emptyArchived")
              : t("reminders.emptyActive")}
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
  tabBar: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 999,
    padding: 3,
    gap: 3,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  tabText: {
    fontWeight: "700",
    fontSize: 13,
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
