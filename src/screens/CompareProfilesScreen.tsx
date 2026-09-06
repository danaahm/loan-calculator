import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type SavedLoanProfile } from "../types/loan";
import {
  betterHigher,
  betterLower,
  buildComparedProfile,
  type WinnerSide,
} from "../utils/profileCompare";

interface CompareProfilesScreenProps {
  leftProfile: SavedLoanProfile;
  rightProfile: SavedLoanProfile;
  onBack: () => void;
  onOpenProfile: (profile: SavedLoanProfile) => void;
}

const CompareRow = ({
  label,
  left,
  right,
  winner,
}: {
  label: string;
  left: string;
  right: string;
  winner: WinnerSide;
}) => {
  const { colors } = useTheme();
  const leftWin = winner === "left";
  const rightWin = winner === "right";
  return (
    <View style={[styles.metricRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.metricValues}>
        <View
          style={[
            styles.metricCell,
            leftWin && { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text
            style={[
              styles.metricValue,
              { color: leftWin ? colors.accentTextDeep : colors.text },
            ]}
          >
            {left}
          </Text>
        </View>
        <View
          style={[
            styles.metricCell,
            rightWin && { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text
            style={[
              styles.metricValue,
              { color: rightWin ? colors.accentTextDeep : colors.text },
            ]}
          >
            {right}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const CompareProfilesScreen = ({
  leftProfile,
  rightProfile,
  onBack,
  onOpenProfile,
}: CompareProfilesScreenProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const left = buildComparedProfile(leftProfile);
  const right = buildComparedProfile(rightProfile);
  const sameCurrency = left.input.currencyCode === right.input.currencyCode;

  const rows: Array<{
    labelKey: string;
    leftText: string;
    rightText: string;
    winner: WinnerSide;
  }> = [
    {
      labelKey: "compare.row.amount",
      leftText: left.amountLabel,
      rightText: right.amountLabel,
      winner: null,
    },
    {
      labelKey: "compare.row.interestRate",
      leftText: left.rateLabel,
      rightText: right.rateLabel,
      winner: betterLower(
        left.input.annualInterestRatePercent,
        right.input.annualInterestRatePercent,
        true
      ),
    },
    {
      labelKey: "compare.row.term",
      leftText: left.termLabel,
      rightText: right.termLabel,
      winner: null,
    },
    {
      labelKey: "compare.row.frequency",
      leftText: left.frequencyLabel,
      rightText: right.frequencyLabel,
      winner: null,
    },
    {
      labelKey: "compare.row.minRepayment",
      leftText: left.periodRepaymentLabel,
      rightText: right.periodRepaymentLabel,
      winner: betterLower(left.periodRepayment, right.periodRepayment, sameCurrency),
    },
    {
      labelKey: "compare.row.monthlyEquivalent",
      leftText: left.monthlyEquivalentLabel,
      rightText: right.monthlyEquivalentLabel,
      winner: betterLower(left.monthlyEquivalent, right.monthlyEquivalent, sameCurrency),
    },
    {
      labelKey: "compare.row.extraRepayment",
      leftText: left.extraLabel,
      rightText: right.extraLabel,
      winner: null,
    },
    {
      labelKey: "compare.row.offset",
      leftText: left.offsetLabel,
      rightText: right.offsetLabel,
      winner: null,
    },
    {
      labelKey: "compare.row.totalInterest",
      leftText: left.totalInterestLabel,
      rightText: right.totalInterestLabel,
      winner: betterLower(left.totalInterest, right.totalInterest, sameCurrency),
    },
    {
      labelKey: "compare.row.totalPaid",
      leftText: left.totalPaidLabel,
      rightText: right.totalPaidLabel,
      winner: betterLower(left.totalPaid, right.totalPaid, sameCurrency),
    },
    {
      labelKey: "compare.row.totalFees",
      leftText: left.totalFeesLabel,
      rightText: right.totalFeesLabel,
      winner: betterLower(left.totalFees, right.totalFees, sameCurrency),
    },
    {
      labelKey: "compare.row.payoff",
      leftText: left.payoffLabel,
      rightText: right.payoffLabel,
      winner: betterLower(left.payoffYears, right.payoffYears, true),
    },
    {
      labelKey: "compare.row.extraSavings",
      leftText: left.extraSavingsLabel,
      rightText: right.extraSavingsLabel,
      winner:
        left.extraEnabled || right.extraEnabled
          ? betterHigher(left.extraSavingsMoney, right.extraSavingsMoney, sameCurrency)
          : null,
    },
  ];

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      <Pressable
        onPress={onBack}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name="chevron-back" size={22} color={colors.accentTextStrong} />
        <Text style={[styles.backText, { color: colors.accentTextStrong }]}>{t("common.back")}</Text>
      </Pressable>

      <Text style={[styles.title, { color: colors.text }]}>{t("compare.title")}</Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Highlighted values are lower cost, lower repayment, or an earlier payoff.
        {sameCurrency ? "" : " Currencies differ, so money totals are not ranked."}
      </Text>

      <View style={styles.headerRow}>
        <Pressable
          style={[styles.nameCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => onOpenProfile(left.profile)}
        >
          <Text style={[styles.nameTitle, { color: colors.text }]} numberOfLines={2}>
            {left.profile.name}
          </Text>
          <Text style={[styles.nameAction, { color: colors.accentTextStrong }]}>{t("common.open")}</Text>
        </Pressable>
        <Pressable
          style={[styles.nameCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          onPress={() => onOpenProfile(right.profile)}
        >
          <Text style={[styles.nameTitle, { color: colors.text }]} numberOfLines={2}>
            {right.profile.name}
          </Text>
          <Text style={[styles.nameAction, { color: colors.accentTextStrong }]}>{t("common.open")}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View
          style={[styles.tableCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        >
          {rows.map((row) => (
            <CompareRow
              key={row.labelKey}
              label={t(row.labelKey)}
              left={row.leftText}
              right={row.rightText}
              winner={row.winner}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    marginLeft: 16,
    gap: 2,
  },
  backText: {
    fontWeight: "700",
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  hint: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 12,
    fontWeight: "600",
  },
  headerRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  nameCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  nameTitle: {
    fontWeight: "800",
    fontSize: 15,
  },
  nameAction: {
    marginTop: 6,
    fontWeight: "700",
    fontSize: 13,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  tableCard: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  metricRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metricLabel: {
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  metricValues: {
    flexDirection: "row",
    gap: 8,
  },
  metricCell: {
    flex: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metricValue: {
    fontWeight: "700",
    fontSize: 13,
  },
});
