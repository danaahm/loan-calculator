import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import { COLLAPSE_DURATION_MS, COLLAPSE_EASING } from "./CollapsibleSection";

/** Card padding the header bleeds into, so a collapsed header fills the card. */
const CARD_PADDING = 16;
const CARD_RADIUS = 14;
const EXPANDED_GAP = 12;

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
  const progress = useSharedValue(collapsed ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(collapsed ? 1 : 0, {
      duration: COLLAPSE_DURATION_MS,
      easing: COLLAPSE_EASING,
    });
  }, [collapsed, progress]);

  /**
   * Collapsed, the header is the whole card: the gap below it turns into a
   * negative margin that eats the card's bottom padding, and the bottom
   * corners round to match the card.
   */
  const animatedStyle = useAnimatedStyle(() => ({
    marginBottom: interpolate(progress.value, [0, 1], [EXPANDED_GAP, -CARD_PADDING]),
    borderBottomLeftRadius: interpolate(progress.value, [0, 1], [0, CARD_RADIUS]),
    borderBottomRightRadius: interpolate(progress.value, [0, 1], [0, CARD_RADIUS]),
    borderBottomWidth: interpolate(progress.value, [0, 1], [1, 0]),
  }));

  return (
    <Animated.View style={[styles.wrap, animatedStyle]}>
      <View style={styles.row}>
        <View style={styles.textColumn}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {onToggleCollapse ? (
          <Pressable onPress={onToggleCollapse} style={styles.toggleButton}>
            <Text style={styles.toggleText}>{collapsed ? "+" : "-"}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginHorizontal: -CARD_PADDING,
      marginTop: -CARD_PADDING,
      paddingHorizontal: CARD_PADDING,
      paddingVertical: 12,
      backgroundColor: colors.headerTint,
      borderBottomColor: colors.headerTintBorder,
      borderTopLeftRadius: CARD_RADIUS,
      borderTopRightRadius: CARD_RADIUS,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    textColumn: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.accentText,
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
