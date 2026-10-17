import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

/** Inset between the track's edge and the sliding thumb. */
const TRACK_PADDING = 4;
const SLIDE_DURATION_MS = 220;

/**
 * One-line choice between a few options, with a thumb that slides to the
 * selected one. Reanimated follows the system's reduce-motion setting, so the
 * slide becomes a jump for anyone who has turned animations off.
 */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const position = useSharedValue(selectedIndex);
  const segmentWidth = useSharedValue(0);

  useEffect(() => {
    position.value = withTiming(selectedIndex, {
      duration: SLIDE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [position, selectedIndex]);

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const inner = event.nativeEvent.layout.width - TRACK_PADDING * 2;
    segmentWidth.value = inner / options.length;
  };

  // Hidden until the track is measured, so it never flashes at zero width.
  const thumbStyle = useAnimatedStyle(() => ({
    width: segmentWidth.value,
    opacity: segmentWidth.value > 0 ? 1 : 0,
    transform: [{ translateX: position.value * segmentWidth.value }],
  }));

  return (
    <View
      style={styles.track}
      onLayout={onTrackLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View pointerEvents="none" style={[styles.thumb, thumbStyle]} />
      {options.map((option) => {
        const selected = option.value === value;
        const tint = selected ? colors.accentTextDeep : colors.textSecondary;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={styles.segment}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
          >
            <Ionicons name={option.icon} size={16} color={tint} />
            <Text
              style={[styles.label, { color: tint }, selected && styles.labelSelected]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    track: {
      flexDirection: "row",
      padding: TRACK_PADDING,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.inputBg,
    },
    thumb: {
      position: "absolute",
      top: TRACK_PADDING,
      bottom: TRACK_PADDING,
      left: TRACK_PADDING,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minHeight: 40,
      paddingHorizontal: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
    },
    labelSelected: {
      fontWeight: "700",
    },
  });
