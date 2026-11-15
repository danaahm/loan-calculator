import { useMemo } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedOptionsProps<T extends string> {
  options: SegmentedOption<T>[];
  /** `null` leaves every segment unselected, for a choice made elsewhere. */
  value: T | null;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  /**
   * Equal segments suit a two-way switch. Left off, each segment is as wide as
   * its label needs, so a long label is not squeezed to match a short one.
   */
  equalWidths?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A choice between a few text options on one line: a tinted track with the
 * selected option raised on it.
 */
export const SegmentedOptions = <T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  equalWidths = false,
  style,
}: SegmentedOptionsProps<T>) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[styles.track, style]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              equalWidths && styles.segmentEqual,
              selected && styles.segmentSelected,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
          >
            {/* The weight stays the same when selected, so the segments do not
                shift sideways as the choice moves. */}
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
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
      padding: 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.segmentTrack,
    },
    segment: {
      flexGrow: 1,
      flexShrink: 1,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 38,
      paddingHorizontal: 4,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: "transparent",
    },
    segmentEqual: {
      flexBasis: 0,
    },
    segmentSelected: {
      backgroundColor: colors.segmentThumb,
      borderColor: colors.border,
      shadowColor: "#000000",
      shadowOpacity: 0.08,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    label: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    labelSelected: {
      color: colors.accentTextStrong,
    },
  });
