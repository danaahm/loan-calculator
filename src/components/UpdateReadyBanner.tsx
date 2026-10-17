import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";

interface UpdateReadyBannerProps {
  onRestart: () => void;
  onLater: () => void;
}

/** Shown once Google Play has downloaded a new version in the background. */
export const UpdateReadyBanner = ({ onRestart, onLater }: UpdateReadyBannerProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Ionicons name="arrow-down-circle" size={22} color={colors.primary} />
      <View style={styles.copy}>
        <Text style={styles.title}>{t("updates.readyTitle")}</Text>
        <Text style={styles.body}>{t("updates.readyBody")}</Text>
      </View>
      <Pressable onPress={onLater} style={styles.laterButton} accessibilityRole="button">
        <Text style={styles.laterText}>{t("updates.later")}</Text>
      </Pressable>
      <Pressable onPress={onRestart} style={styles.restartButton} accessibilityRole="button">
        <Text style={styles.restartText}>{t("updates.restart")}</Text>
      </Pressable>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.card,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    copy: {
      flex: 1,
    },
    title: {
      color: colors.text,
      fontWeight: "800",
      fontSize: 14,
    },
    body: {
      marginTop: 2,
      color: colors.textMuted,
      fontWeight: "600",
      fontSize: 12,
    },
    laterButton: {
      paddingVertical: 8,
      paddingHorizontal: 8,
    },
    laterText: {
      color: colors.textSecondary,
      fontWeight: "700",
    },
    restartButton: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    restartText: {
      color: colors.textInverse,
      fontWeight: "800",
    },
  });
