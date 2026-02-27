import { Dimensions, StyleSheet, Text, View } from "react-native";
import { PieChart } from "react-native-chart-kit";

import { formatCurrency } from "../utils/format";

interface PieBreakdownChartProps {
  principal: number;
  interest: number;
  fees: number;
}

const COLORS = {
  principal: "#2563eb",
  interest: "#f59e0b",
  fees: "#14b8a6",
};

export const PieBreakdownChart = ({
  principal,
  interest,
  fees,
}: PieBreakdownChartProps) => {
  const total = principal + interest + fees;
  const data = [
    {
      name: "Principal",
      population: Math.max(0, principal),
      color: COLORS.principal,
      legendFontColor: "#111827",
      legendFontSize: 12,
    },
    {
      name: "Interest",
      population: Math.max(0, interest),
      color: COLORS.interest,
      legendFontColor: "#111827",
      legendFontSize: 12,
    },
    {
      name: "Account Fees",
      population: Math.max(0, fees),
      color: COLORS.fees,
      legendFontColor: "#111827",
      legendFontSize: 12,
    },
  ];
  const chartWidth = Math.min(Dimensions.get("window").width - 48, 380);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Repayment Breakdown</Text>

      <View style={styles.chartWrap}>
        <PieChart
          data={data}
          width={chartWidth}
          height={220}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="20"
          chartConfig={{
            color: () => "#111827",
          }}
          hasLegend={false}
        />
      </View>

      <View style={styles.legend}>
        {data.map((item) => (
          <View key={item.name} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <Text style={styles.legendLabel}>{item.name}</Text>
            <Text style={styles.legendValue}>
              {formatCurrency(item.population)}
            </Text>
          </View>
        ))}
        <View style={[styles.legendRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Paid</Text>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
        </View>
      </View>
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
    marginBottom: 8,
    color: "#111827",
  },
  chartWrap: {
    alignItems: "center",
  },
  legend: {
    marginTop: 4,
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    color: "#374151",
    fontWeight: "600",
  },
  legendValue: {
    color: "#111827",
    fontWeight: "700",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    marginTop: 4,
    paddingTop: 8,
  },
  totalLabel: {
    flex: 1,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
  totalValue: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },
});
