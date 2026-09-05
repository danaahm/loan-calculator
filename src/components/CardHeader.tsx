import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const CardHeader = ({
  title,
  subtitle,
  collapsed,
  onToggleCollapse,
}: CardHeaderProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        {onToggleCollapse ? (
          <Pressable onPress={onToggleCollapse} style={styles.toggleButton}>
            <Text style={styles.toggleText}>{collapsed ? "+" : "-"}</Text>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginHorizontal: -16,
      marginTop: -16,
      marginBottom: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.headerTint,
      borderBottomWidth: 1,
      borderBottomColor: colors.headerTintBorder,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.accentText,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toggleButton: {
      borderWidth: 1,
      borderColor: colors.headerToggleBorder,
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primarySoft,
    },
    toggleText: {
      color: colors.accentTextStrong,
      fontWeight: "800",
      fontSize: 20,
      lineHeight: 22,
    },
    subtitle: {
      marginTop: 2,
      color: colors.textSecondary,
      fontWeight: "600",
    },
  });
