import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { type ThemeMode } from "../types/settings";

interface SettingsScreenProps {
  onBack: () => void;
}

const APPEARANCE_OPTIONS: { mode: ThemeMode; title: string; hint: string }[] = [
  { mode: "auto", title: "Auto", hint: "Match system setting" },
  { mode: "light", title: "Light", hint: "Always use light mode" },
  { mode: "dark", title: "Dark", hint: "Always use dark mode" },
];

export const SettingsScreen = ({ onBack }: SettingsScreenProps) => {
  const { colors, mode, setThemeMode } = useTheme();

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
});
