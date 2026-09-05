import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import {
  notificationUnavailableHint,
  permissionStatusLabel,
  type OsPermissionStatus,
} from "../notifications/reminderNotifications";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeMode } from "../types/settings";

interface SettingsScreenProps {
  onBack: () => void;
  reminderNotificationsEnabled: boolean;
  defaultNotifyHour: number;
  osPermissionStatus: OsPermissionStatus;
  notificationsSupported: boolean;
  onToggleReminderNotifications: (enabled: boolean) => void;
  onChangeNotifyHour: (hour: number) => void;
  onOpenPhoneSettings: () => void;
}

const APPEARANCE_OPTIONS: { mode: ThemeMode; title: string; hint: string }[] = [
  { mode: "auto", title: "Auto", hint: "Match system setting" },
  { mode: "light", title: "Light", hint: "Always use light mode" },
  { mode: "dark", title: "Dark", hint: "Always use dark mode" },
];

const NOTIFY_HOURS = [7, 8, 9, 10, 12, 18, 21];

const formatHour = (hour: number): string => {
  const suffix = hour >= 12 ? "pm" : "am";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${suffix}`;
};

export const SettingsScreen = ({
  onBack,
  reminderNotificationsEnabled,
  defaultNotifyHour,
  osPermissionStatus,
  notificationsSupported,
  onToggleReminderNotifications,
  onChangeNotifyHour,
  onOpenPhoneSettings,
}: SettingsScreenProps) => {
  const { colors, mode, setThemeMode } = useTheme();
  const blockedOnPhone = osPermissionStatus === "denied";

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: colors.page }]}
      contentContainerStyle={styles.content}
    >
      <Pressable
        onPress={onBack}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={22} color={colors.accentTextStrong} />
        <Text style={[styles.backText, { color: colors.accentTextStrong }]}>Back</Text>
      </Pressable>

      <Text style={[styles.pageTitle, { color: colors.text }]}>Settings</Text>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.accentText }]}>Appearance</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          Choose how the app looks
        </Text>

        {APPEARANCE_OPTIONS.map((option) => {
          const selected = mode === option.mode;
          return (
            <Pressable
              key={option.mode}
              onPress={() => setThemeMode(option.mode)}
              style={[
                styles.optionRow,
                {
                  borderColor: selected ? colors.primary : colors.borderStrong,
                  backgroundColor: selected ? colors.primarySoft : colors.inputBg,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={styles.optionCopy}>
                <Text
                  style={[
                    styles.optionTitle,
                    { color: selected ? colors.accentTextDeep : colors.text },
                  ]}
                >
                  {option.title}
                </Text>
                <Text style={[styles.optionHint, { color: colors.textMuted }]}>
                  {option.hint}
                </Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: selected ? colors.primary : colors.borderStrong },
                ]}
              >
                {selected ? (
                  <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 14 },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.accentText }]}>
          Repayment reminders
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {notificationsSupported
            ? "Your phone will show the reminder at the time you chose, even if you have not opened this app."
            : notificationUnavailableHint}
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              Reminder notifications
            </Text>
            <Text style={[styles.optionHint, { color: colors.textMuted }]}>
              {permissionStatusLabel(osPermissionStatus)}
            </Text>
          </View>
          <Switch
            value={reminderNotificationsEnabled && osPermissionStatus === "granted"}
            disabled={!notificationsSupported || blockedOnPhone}
            onValueChange={onToggleReminderNotifications}
            trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
            thumbColor={colors.switchThumb}
          />
        </View>

        {blockedOnPhone ? (
          <Pressable
            onPress={onOpenPhoneSettings}
            style={[
              styles.openSettingsButton,
              { borderColor: colors.borderStrong, backgroundColor: colors.inputBg },
            ]}
          >
            <Text style={[styles.openSettingsText, { color: colors.accentTextStrong }]}>
              Open phone Settings
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.hourLabel, { color: colors.textSecondary }]}>Default alert time</Text>
        <View style={styles.hourWrap}>
          {NOTIFY_HOURS.map((hour) => {
            const selected = defaultNotifyHour === hour;
            return (
              <Pressable
                key={hour}
                onPress={() => onChangeNotifyHour(hour)}
                style={[
                  styles.hourChip,
                  {
                    borderColor: selected ? colors.primary : colors.borderStrong,
                    backgroundColor: selected ? colors.primarySoft : colors.inputBg,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected ? colors.accentTextDeep : colors.textSecondary,
                    fontWeight: selected ? "700" : "600",
                    fontSize: 13,
                  }}
                >
                  {formatHour(hour)}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
    paddingBottom: 32,
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
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 16,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  sectionHint: {
    marginTop: 4,
    marginBottom: 14,
    fontWeight: "600",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  optionHint: {
    marginTop: 2,
    fontWeight: "600",
    fontSize: 13,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  openSettingsButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  openSettingsText: {
    fontWeight: "700",
  },
  hourLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontWeight: "600",
  },
  hourWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hourChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
});
