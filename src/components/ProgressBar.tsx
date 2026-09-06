import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";

interface ProgressBarProps {
  /** Fraction paid down, 0..1. */
  progress: number;
  /** Render an "N% paid" label under the bar. */
  showPercent?: boolean;
  percentLabelSuffix?: string;
}

export const ProgressBar = ({
  progress,
  showPercent = false,
  percentLabelSuffix = "paid",
}: ProgressBarProps) => {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const percent = Math.round(clamped * 100);

  return (
    <View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[styles.fill, { width: `${percent}%`, backgroundColor: colors.primary }]}
        />
      </View>
      {showPercent ? (
        <Text style={[styles.percent, { color: colors.textSecondary }]}>
          {percent}% {percentLabelSuffix}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 12,
  },
  fill: {
    height: 8,
    borderRadius: 999,
  },
  percent: {
    marginTop: 6,
    fontWeight: "700",
    fontSize: 12,
  },
});
