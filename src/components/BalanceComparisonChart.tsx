import { Dimensions, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-chart-kit";

import { type LoanCalculationResult, type RepaymentFrequency } from "../types/loan";
import { formatCurrency, formatYearsAndPeriods } from "../utils/format";

interface BalanceComparisonChartProps {
  result: LoanCalculationResult;
  repaymentFrequency: RepaymentFrequency;
}

const periodsByFrequency: Record<RepaymentFrequency, number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

export const BalanceComparisonChart = ({
  result,
  repaymentFrequency,
}: BalanceComparisonChartProps) => {
  const baselineData = result.baseline.yearlyBalancePoints.map((point) => ({
    x: point.year,
    y: point.balance,
  }));
  const extraData = result.withExtra?.yearlyBalancePoints.map((point) => ({
    x: point.year,
    y: point.balance,
  }));

  const periodsPerYear = periodsByFrequency[repaymentFrequency];
  const savedTime = formatYearsAndPeriods(
    result.savings.yearsSaved,
    result.savings.periodsSaved,
    periodsPerYear
  );
  const chartWidth = Math.min(Dimensions.get("window").width - 48, 380);

  const labels = baselineData.map((point) => `Y${point.x}`);
  const datasets: Array<{ data: number[]; color: () => string; strokeWidth: number }> = [
    {
      data: baselineData.map((point) => point.y),
      color: () => "#2563eb",
      strokeWidth: 3,
    },
  ];
  if (extraData) {
    datasets.push({
      data: extraData.map((point) => point.y),
      color: () => "#10b981",
      strokeWidth: 3,
    });
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Loan Balance Over Time</Text>
      <Text style={styles.subtitle}>Yearly remaining loan balance</Text>

      <LineChart
        data={{
          labels,
          datasets,
        }}
        width={chartWidth}
        height={240}
        yAxisLabel="$"
        withHorizontalLabels
        withVerticalLabels
        bezier
        chartConfig={{
          backgroundGradientFrom: "#ffffff",
          backgroundGradientTo: "#ffffff",
          color: (opacity = 1) => `rgba(17,24,39,${opacity})`,
          labelColor: (opacity = 1) => `rgba(75,85,99,${opacity})`,
          decimalPlaces: 0,
          propsForDots: {
            r: "0",
          },
        }}
        style={styles.chart}
        fromZero
      />

      <View style={styles.legendRow}>
        <View style={[styles.dot, { backgroundColor: "#2563eb" }]} />
        <Text style={styles.legendText}>Original repayment path</Text>
      </View>
      {extraData ? (
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
          <Text style={styles.legendText}>With extra repayment</Text>
        </View>
      ) : null}

      {extraData ? (
        <View style={styles.savingsWrap}>
          <Text style={styles.savingsTitle}>Extra Repayment Benefit</Text>
          <Text style={styles.savingsLine}>
            Money saved: {formatCurrency(result.savings.moneySaved)}
          </Text>
          <Text style={styles.savingsLine}>Time saved: {savedTime}</Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6b7280",
    marginBottom: 8,
  },
  chart: {
    borderRadius: 12,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendText: {
    color: "#374151",
    fontWeight: "600",
  },
  savingsWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  savingsTitle: {
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  savingsLine: {
    color: "#374151",
    fontWeight: "600",
  },
});
