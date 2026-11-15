import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import {
  COMMON_FREQUENCIES,
  LESS_COMMON_FREQUENCIES,
  type RepaymentFrequency,
} from "../types/loan";
import { formatFrequencyLabel } from "../utils/format";
import { BottomSheet } from "./BottomSheet";
import { SegmentedOptions } from "./SegmentedOptions";

interface FrequencySelectorProps {
  value: RepaymentFrequency;
  onChange: (next: RepaymentFrequency) => void;
  /** What is being chosen, such as "Repayment Frequency". Read by screen readers. */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Picks how often something is paid, on one line. The three everyday
 * frequencies are a tap away; quarterly and yearly sit behind "More", which
 * shows the chosen one in its place once picked.
 */
export const FrequencySelector = ({
  value,
  onChange,
  accessibilityLabel,
  style,
}: FrequencySelectorProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const commonOptions = COMMON_FREQUENCIES.map((frequency) => ({
    value: frequency,
    label: formatFrequencyLabel(frequency),
  }));
  const moreSelected = LESS_COMMON_FREQUENCIES.includes(value);
  const moreTint = moreSelected ? colors.accentTextStrong : colors.textSecondary;

  return (
    <>
      <View style={[styles.row, style]}>
        <SegmentedOptions
          style={styles.track}
          options={commonOptions}
          value={moreSelected ? null : value}
          onChange={onChange}
          accessibilityLabel={accessibilityLabel}
        />
        <Pressable
          onPress={() => setSheetOpen(true)}
          style={[styles.moreButton, moreSelected && styles.moreButtonSelected]}
          accessibilityRole="button"
          accessibilityLabel={
            moreSelected
              ? t("frequencyPicker.moreSelectedLabel", {
                  frequency: formatFrequencyLabel(value),
                })
              : t("frequencyPicker.moreLabel")
          }
        >
          <Text style={[styles.moreText, { color: moreTint }]} numberOfLines={1}>
            {moreSelected ? formatFrequencyLabel(value) : t("frequencyPicker.more")}
          </Text>
          <Ionicons name="chevron-down" size={12} color={moreTint} />
        </Pressable>
      </View>

      <BottomSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        style={styles.sheet}
      >
        <Text style={styles.sheetTitle}>{t("frequencyPicker.sheetTitle")}</Text>
        {LESS_COMMON_FREQUENCIES.map((frequency) => {
          const selected = frequency === value;
          return (
            <Pressable
              key={frequency}
              onPress={() => {
                onChange(frequency);
                setSheetOpen(false);
              }}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionTitle, selected && styles.optionTitleSelected]}>
                {formatFrequencyLabel(frequency)}
              </Text>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          );
        })}
        <Pressable style={styles.closeButton} onPress={() => setSheetOpen(false)}>
          <Text style={styles.closeText}>{t("common.close")}</Text>
        </Pressable>
      </BottomSheet>
    </>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: 6,
    },
    track: {
      flex: 1,
    },
    moreButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.segmentTrack,
    },
    moreButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.segmentThumb,
    },
    moreText: {
      fontSize: 13,
      fontWeight: "600",
    },
    // The sheet matches the pickers in Settings.
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 16,
      paddingBottom: 24,
    },
    sheetTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 12,
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderRadius: 12,
      borderColor: colors.borderStrong,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 8,
    },
    optionRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    optionTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    optionTitleSelected: {
      color: colors.accentTextDeep,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    closeButton: {
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 12,
      backgroundColor: colors.primary,
    },
    closeText: {
      fontWeight: "700",
      color: colors.textInverse,
    },
  });
