import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  notificationUnavailableHint,
  permissionStatusLabel,
  type OsPermissionStatus,
} from "../notifications/reminderNotifications";
import { useLocale } from "../i18n/LocaleProvider";
import { SUPPORTED_LANGUAGES } from "../i18n/languages";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeMode } from "../types/settings";
import { getAvailableCurrencies } from "../utils/format";

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

const APPEARANCE_MODES: ThemeMode[] = ["auto", "light", "dark"];

const NOTIFY_HOURS = [7, 8, 9, 10, 12, 18, 21];

/**
 * Rendered through `Intl` rather than hand-built so a 24-hour language shows
 * "13:00" instead of an English-only "1:00 pm".
 */
const formatHour = (hour: number, language: string): string => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  try {
    return new Intl.DateTimeFormat(language, {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return `${hour}:00`;
  }
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
  const {
    t,
    language,
    setLanguage,
    defaultCurrencyCode,
    setDefaultCurrencyCode,
  } = useLocale();
  const blockedOnPhone = osPermissionStatus === "denied";
  const currencies = useMemo(() => getAvailableCurrencies(), []);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const filteredCurrencies = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) {
      return currencies;
    }
    return currencies.filter(
      (item) =>
        item.code.toLowerCase().includes(query) ||
        item.symbol.toLowerCase().includes(query)
    );
  }, [currencies, currencySearch]);
  const selectedCurrency = currencies.find(
    (item) => item.code === defaultCurrencyCode
  );

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: colors.page }]}
      contentContainerStyle={styles.content}
    >
      <Pressable
        onPress={onBack}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name="chevron-back" size={22} color={colors.accentTextStrong} />
        <Text style={[styles.backText, { color: colors.accentTextStrong }]}>{t("common.back")}</Text>
      </Pressable>

      <Text style={[styles.pageTitle, { color: colors.text }]}>{t("settings.title")}</Text>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.accentText }]}>{t("settings.appearance")}</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {t("settings.appearanceHint")}
        </Text>

        {APPEARANCE_MODES.map((option) => {
          const selected = mode === option;
          return (
            <Pressable
              key={option}
              onPress={() => setThemeMode(option)}
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
                  {t(`settings.theme.${option}.title`)}
                </Text>
                <Text style={[styles.optionHint, { color: colors.textMuted }]}>
                  {t(`settings.theme.${option}.hint`)}
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
          {t("settings.language")}
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {t("settings.languageHint")}
        </Text>

        {SUPPORTED_LANGUAGES.map((option) => {
          const selected = language === option.code;
          return (
            <Pressable
              key={option.code}
              onPress={() => setLanguage(option.code)}
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
                  {option.endonym}
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
          {t("settings.defaultCurrency")}
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {t("settings.defaultCurrencyHint")}
        </Text>

        <Pressable
          onPress={() => setCurrencyModalVisible(true)}
          style={[
            styles.optionRow,
            { borderColor: colors.borderStrong, backgroundColor: colors.inputBg },
          ]}
          accessibilityRole="button"
        >
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              {selectedCurrency
                ? selectedCurrency.label
                : t("settings.currencyAuto", { code: defaultCurrencyCode })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View
        style={[
          styles.sectionCard,
          { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 14 },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.accentText }]}>
          {t("settings.reminders")}
        </Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          {notificationsSupported
            ? t("settings.remindersHint")
            : notificationUnavailableHint()}
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.optionCopy}>
            <Text style={[styles.optionTitle, { color: colors.text }]}>
              {t("settings.reminderNotifications")}
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
              {t("settings.openPhoneSettings")}
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.hourLabel, { color: colors.textSecondary }]}>{t("settings.defaultAlertTime")}</Text>
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
                  {formatHour(hour, language)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.page }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {t("settings.selectDefaultCurrency")}
          </Text>
          <TextInput
            style={[
              styles.modalSearch,
              {
                borderColor: colors.borderStrong,
                backgroundColor: colors.inputBg,
                color: colors.text,
              },
            ]}
            placeholder={t("loanForm.currencySearchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={currencySearch}
            onChangeText={setCurrencySearch}
          />
          <FlatList
            data={filteredCurrencies}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.currencyRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setDefaultCurrencyCode(item.code);
                  setCurrencyModalVisible(false);
                }}
              >
                <Text style={[styles.currencyRowCode, { color: colors.text }]}>
                  {item.code}
                </Text>
                <Text style={[styles.currencyRowLabel, { color: colors.textMuted }]}>
                  {item.symbol}
                </Text>
              </Pressable>
            )}
          />
          <Pressable
            style={[styles.modalCloseButton, { backgroundColor: colors.primary }]}
            onPress={() => setCurrencyModalVisible(false)}
          >
            <Text style={[styles.modalCloseText, { color: colors.textInverse }]}>
              {t("common.close")}
            </Text>
          </Pressable>
        </View>
      </Modal>
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
  modalContainer: {
    flex: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalSearch: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  currencyRowCode: {
    fontWeight: "700",
    fontSize: 15,
  },
  currencyRowLabel: {
    fontWeight: "600",
  },
  modalCloseButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  modalCloseText: {
    fontWeight: "700",
  },
});
