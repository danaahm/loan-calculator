import { Ionicons } from "@expo/vector-icons";
import { useDeferredValue, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import { type LoanInput } from "../types/loan";
import { formatCurrencyWhole } from "../utils/format";
import { buildLiveEstimate } from "../utils/liveEstimate";
import { validateLoanInput } from "../utils/loanMath";
import { CollapsibleSection } from "./CollapsibleSection";

interface LiveRepaymentCardProps {
  /** The form as it stands right now, keystroke by keystroke. */
  input: LoanInput;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * The repayment and loan totals, updated as the form is typed. Tapping the
 * card folds it down to a single line that keeps the repayment in view.
 */
export const LiveRepaymentCard = ({
  input,
  collapsed,
  onToggleCollapsed,
}: LiveRepaymentCardProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Deferred so a full schedule is never worked out between two keystrokes.
  const deferredInput = useDeferredValue(input);
  const estimate = useMemo(() => buildLiveEstimate(deferredInput), [deferredInput]);
  // The card is the one part of the page always in view, so a form that cannot
  // be worked out says why here, not beside results scrolled out of sight.
  const validation = useMemo(() => validateLoanInput(deferredInput), [deferredInput]);
  const hint =
    validation.ready && validation.error ? validation.error : t("liveCalc.emptyHint");

  const frequency = estimate?.frequency ?? input.repaymentFrequency;
  const currencyCode = input.currencyCode;
  // Before there is a loan to work out, the card reads as a zero repayment.
  const repaymentText = formatCurrencyWhole(estimate?.repayment ?? 0, currencyCode);
  const perText = t(`liveCalc.per.${frequency}`);
  const stats = estimate
    ? [
        { key: "principal", label: t("liveCalc.principal"), value: estimate.principal },
        {
          key: "interest",
          label: t("liveCalc.totalInterest"),
          value: estimate.totalInterest,
        },
        {
          key: "total",
          label: t("liveCalc.totalRepayments"),
          value: estimate.totalRepayments,
        },
      ]
    : [];

  return (
    <Pressable
      onPress={onToggleCollapsed}
      style={styles.card}
      accessibilityRole="button"
      accessibilityState={{ expanded: !collapsed }}
      accessibilityHint={t(collapsed ? "liveCalc.showDetails" : "liveCalc.hideDetails")}
    >
      <View style={styles.headerRow}>
        {collapsed ? (
          <View style={styles.compactValue}>
            <Text
              style={styles.compactAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {repaymentText}
            </Text>
            <Text style={styles.compactPer} numberOfLines={1}>
              {perText}
            </Text>
          </View>
        ) : (
          // Two lines at most: the longest title wraps on a narrow phone
          // instead of being cut short.
          <Text style={styles.title} numberOfLines={2}>
            {t(`liveCalc.title.${frequency}`)}
          </Text>
        )}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t("liveCalc.badge")}</Text>
        </View>
        {collapsed ? (
          <Ionicons name="chevron-down" size={18} color={colors.heroText} />
        ) : null}
      </View>

      <CollapsibleSection collapsed={collapsed}>
        <View style={styles.amountRow}>
          <Text
            style={styles.amount}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {repaymentText}
          </Text>
          <Text style={styles.per} numberOfLines={1}>
            {perText}
          </Text>
          <View style={styles.amountRowSpacer} />
          <Ionicons
            name="chevron-up"
            size={18}
            color={colors.heroText}
            style={styles.collapseIcon}
          />
        </View>
        <View style={styles.divider} />
        {estimate ? (
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.key} style={styles.stat}>
                <Text style={styles.statLabel} numberOfLines={1}>
                  {stat.label}
                </Text>
                <Text
                  style={styles.statValue}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCurrencyWhole(stat.value, currencyCode)}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.hint}>{hint}</Text>
        )}
      </CollapsibleSection>
    </Pressable>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      // The solid colour shows wherever a gradient cannot be drawn.
      backgroundColor: colors.heroGradientStart,
      backgroundImage: `linear-gradient(135deg, ${colors.heroGradientStart} 0%, ${colors.heroGradientEnd} 100%)`,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 28,
    },
    title: {
      flex: 1,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      color: colors.heroTextMuted,
    },
    compactValue: {
      flex: 1,
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
    },
    compactAmount: {
      flexShrink: 1,
      fontSize: 20,
      fontWeight: "800",
      color: colors.heroText,
    },
    compactPer: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.heroTextMuted,
    },
    badge: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.heroPillBorder,
      backgroundColor: colors.heroPillBg,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.heroText,
    },
    amountRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      marginTop: 4,
    },
    amount: {
      flexShrink: 1,
      fontSize: 34,
      fontWeight: "800",
      color: colors.heroText,
    },
    per: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.heroTextMuted,
    },
    amountRowSpacer: {
      flex: 1,
    },
    collapseIcon: {
      alignSelf: "center",
    },
    divider: {
      height: StyleSheet.hairlineWidth * 2,
      marginTop: 12,
      marginBottom: 12,
      backgroundColor: colors.heroDivider,
    },
    // Columns are as wide as their figures, so a short one leaves its spare
    // room to a long one instead of both being cut to a third of the card.
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    stat: {
      flexShrink: 1,
    },
    statLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.heroTextMuted,
    },
    statValue: {
      marginTop: 2,
      fontSize: 15,
      fontWeight: "800",
      color: colors.heroText,
    },
    hint: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "600",
      color: colors.heroTextMuted,
    },
  });
