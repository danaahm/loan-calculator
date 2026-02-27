import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { PieChart } from "react-native-chart-kit";

import { formatCurrency, formatDurationLabel } from "../utils/format";
import { CardHeader } from "./CardHeader";

interface PieBreakdownChartProps {
  principal: number;
  interest: number;
  fees: number;
  currencyCode: string;
  loanLengthYears: number;
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
  currencyCode,
  loanLengthYears,
}: PieBreakdownChartProps) => {
  const [visibleSeries, setVisibleSeries] = useState({
    principal: true,
    interest: true,
    fees: true,
  });
  const [animatedValues, setAnimatedValues] = useState({
    principal,
    interest,
    fees,
  });
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const previous = { ...animatedValues };
    const durationMs = 280;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      setAnimatedValues({
        principal: previous.principal + (principal - previous.principal) * progress,
        interest: previous.interest + (interest - previous.interest) * progress,
        fees: previous.fees + (fees - previous.fees) * progress,
      });
      if (progress >= 1) {
        clearInterval(timer);
      }
    }, 16);

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.7,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    return () => clearInterval(timer);
  }, [principal, interest, fees]);

  const rawData = [
    {
      id: "principal",
      name: "Principal",
      population: Math.max(0, animatedValues.principal),
      color: COLORS.principal,
      legendFontColor: "#111827",
      legendFontSize: 12,
    },
    {
      id: "interest",
      name: "Interest",
      population: Math.max(0, animatedValues.interest),
      color: COLORS.interest,
      legendFontColor: "#111827",
      legendFontSize: 12,
    },
    {
      id: "fees",
      name: "Account Fees",
      population: Math.max(0, animatedValues.fees),
      color: COLORS.fees,
      legendFontColor: "#111827",
      legendFontSize: 12,
    },
  ] as const;
  const data = rawData.filter((item) => visibleSeries[item.id]);
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.population, 0),
    [data]
  );
  const chartWidth = Math.min(Dimensions.get("window").width - 96, 300);

  return (
    <View style={styles.card}>
      <CardHeader
        title="Repayment Breakdown"
        subtitle={`(${formatDurationLabel(loanLengthYears)})`}
      />

      <Animated.View style={[styles.chartWrap, { opacity }]}>
        {data.length > 0 ? (
          <PieChart
            data={data}
            width={chartWidth}
            height={220}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="46"
            chartConfig={{
              color: () => "#111827",
            }}
            hasLegend={false}
            style={styles.pieChart}
          />
        ) : (
          <Text style={styles.hiddenAllText}>Enable at least one series.</Text>
        )}
      </Animated.View>

      <View style={styles.legend}>
        {rawData.map((item) => (
          <Pressable
            key={item.name}
            style={[styles.legendRow, !visibleSeries[item.id] && styles.legendRowMuted]}
            onPress={() =>
              setVisibleSeries((previous) => ({
                ...previous,
                [item.id]: !previous[item.id],
              }))
            }
          >
            <View style={[styles.dot, { backgroundColor: item.color }]} />
            <Text style={styles.legendLabel}>{item.name}</Text>
            <Text style={styles.legendValue}>
              {formatCurrency(item.population, currencyCode)}
            </Text>
          </Pressable>
        ))}
        <View style={[styles.legendRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total Paid</Text>
          <Text style={styles.totalValue}>{formatCurrency(total, currencyCode)}</Text>
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
  chartWrap: {
    alignItems: "center",
    width: "100%",
  },
  pieChart: {
    alignSelf: "center",
  },
  legend: {
    marginTop: 4,
    gap: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  legendRowMuted: {
    opacity: 0.45,
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
  hiddenAllText: {
    color: "#6b7280",
    fontWeight: "600",
    marginVertical: 40,
  },
});
