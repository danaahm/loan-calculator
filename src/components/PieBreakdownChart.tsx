import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { matchFont } from "@shopify/react-native-skia";
import { Pie, PolarChart } from "victory-native";

import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import { formatDurationLabel, getCurrencySymbol } from "../utils/format";
import { CardHeader } from "./CardHeader";

interface PieBreakdownChartProps {
  principal: number;
  interest: number;
  fees: number;
  extraRepayment: number;
  currencyCode: string;
  loanLengthYears: number;
}

type SeriesId = "principal" | "interest" | "fees" | "extra";

type BreakdownSeries = {
  id: SeriesId;
  label: string;
  value: number;
  color: string;
  percent: number;
};

const COLORS = {
  principal: "#2563eb",
  interest: "#f59e0b",
  fees: "#14b8a6",
  extra: "#22c55e",
};

const MIN_SLICE_LABEL_PERCENT = 6;
const DONUT_INNER_RADIUS = "58%";
const LABEL_RADIUS_OFFSET = 0.79;

const sliceLabelFont = matchFont({
  fontFamily: Platform.select({
    ios: "Helvetica",
    android: "sans-serif",
    default: "sans-serif",
  }) as string,
  fontSize: 12,
  fontWeight: "700",
});

const formatPercent = (value: number, total: number): string => {
  if (!(total > 0) || !(value > 0)) {
    return "0%";
  }
  const percent = (value / total) * 100;
  if (percent < 0.1) {
    return "<0.1%";
  }
  if (percent < 10) {
    return `${percent.toFixed(1)}%`;
  }
  return `${Math.round(percent)}%`;
};

export const PieBreakdownChart = ({
  principal,
  interest,
  fees,
  extraRepayment,
  currencyCode,
  loanLengthYears,
}: PieBreakdownChartProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const currencySymbol = getCurrencySymbol(currencyCode);
  const formatCurrencyTwoDecimals = (value: number): string => {
    const safe = Number.isFinite(value) ? value : 0;
    const absFormatted = Math.abs(safe).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return safe < 0
      ? `-${currencySymbol}${absFormatted}`
      : `${currencySymbol}${absFormatted}`;
  };

  const [collapsed, setCollapsed] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [visibleSeries, setVisibleSeries] = useState({
    principal: true,
    interest: true,
    fees: true,
    extra: true,
  });
  const [animatedValues, setAnimatedValues] = useState({
    principal,
    interest,
    fees,
    extra: extraRepayment,
  });
  const previousValues = useRef({
    principal,
    interest,
    fees,
    extra: extraRepayment,
  });
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const previous = previousValues.current;
    const durationMs = 280;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / durationMs);
      const nextValues = {
        principal: previous.principal + (principal - previous.principal) * progress,
        interest: previous.interest + (interest - previous.interest) * progress,
        fees: previous.fees + (fees - previous.fees) * progress,
        extra: previous.extra + (extraRepayment - previous.extra) * progress,
      };
      setAnimatedValues(nextValues);
      if (progress >= 1) {
        previousValues.current = nextValues;
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
  }, [extraRepayment, fees, interest, opacity, principal]);

  const series: BreakdownSeries[] = useMemo(() => {
    const rows = [
      {
        id: "principal" as const,
        label: "Principal",
        value: Math.max(0, animatedValues.principal),
        color: COLORS.principal,
      },
      {
        id: "interest" as const,
        label: "Interest",
        value: Math.max(0, animatedValues.interest),
        color: COLORS.interest,
      },
      {
        id: "fees" as const,
        label: "Account Fees",
        value: Math.max(0, animatedValues.fees),
        color: COLORS.fees,
      },
      {
        id: "extra" as const,
        label: "Extra Repayment",
        value: Math.max(0, animatedValues.extra),
        color: COLORS.extra,
      },
    ];
    const totalValue = rows.reduce((sum, item) => sum + item.value, 0);
    return rows.map((item) => ({
      ...item,
      percent: totalValue > 0 ? (item.value / totalValue) * 100 : 0,
    }));
  }, [animatedValues]);

  const visibleSlices = series.filter(
    (item) => visibleSeries[item.id] && item.value > 0.005
  );
  const total = series.reduce((sum, item) => sum + item.value, 0);
  const visibleTotal = visibleSlices.reduce((sum, item) => sum + item.value, 0);
  const donutSize = Math.min(Math.max(chartWidth, 0), 280);

  return (
    <View style={styles.card}>
      <CardHeader
        title="Repayment Breakdown"
        subtitle={`(${formatDurationLabel(loanLengthYears)})`}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      {!collapsed ? (
        <View>
          <Animated.View
            style={[styles.chartWrap, { opacity }]}
            onLayout={(event) => {
              const nextWidth = Math.round(event.nativeEvent.layout.width);
              if (nextWidth > 0 && nextWidth !== chartWidth) {
                setChartWidth(nextWidth);
              }
            }}
          >
            {visibleSlices.length > 0 && donutSize > 0 ? (
              <View style={[styles.donutBox, { width: donutSize, height: donutSize }]}>
                <PolarChart
                  data={visibleSlices}
                  labelKey="label"
                  valueKey="value"
                  colorKey="color"
                  explicitSize={{ width: donutSize, height: donutSize }}
                  containerStyle={styles.donutCanvas}
                >
                  <Pie.Chart
                    innerRadius={DONUT_INNER_RADIUS}
                    startAngle={-90}
                    size={Math.max(donutSize - 12, 0)}
                  >
                    {({ slice }) => {
                      const percent =
                        visibleTotal > 0 ? (slice.value / visibleTotal) * 100 : 0;
                      const percentLabel = formatPercent(slice.value, visibleTotal);

                      return (
                        <>
                          <Pie.Slice>
                            {percent >= MIN_SLICE_LABEL_PERCENT ? (
                              <Pie.Label
                                font={sliceLabelFont}
                                color="#ffffff"
                                radiusOffset={LABEL_RADIUS_OFFSET}
                                text={percentLabel}
                              />
                            ) : null}
                          </Pie.Slice>
                          {visibleSlices.length > 1 ? (
                            <Pie.SliceAngularInset
                              angularInset={{
                                angularStrokeWidth: 3,
                                angularStrokeColor: colors.pieInset,
                              }}
                            />
                          ) : null}
                        </>
                      );
                    }}
                  </Pie.Chart>
                </PolarChart>
                <View
                  pointerEvents="none"
                  style={[
                    styles.holeLabel,
                    { paddingHorizontal: Math.round(donutSize * 0.24) },
                  ]}
                >
                  <Text style={styles.holeTitle}>Total</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.55}
                    style={styles.holeValue}
                  >
                    {formatCurrencyTwoDecimals(total)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.hiddenAllText}>Enable at least one series.</Text>
            )}
          </Animated.View>

          <View style={styles.legend}>
            {series.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.legendRow, !visibleSeries[item.id] && styles.legendRowMuted]}
                onPress={() =>
                  setVisibleSeries((previous) => ({
                    ...previous,
                    [item.id]: !previous[item.id],
                  }))
                }
              >
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={styles.legendLabel}>{item.label}</Text>
                <Text style={styles.legendPercent}>{formatPercent(item.value, total)}</Text>
                <Text style={styles.legendValue}>
                  {formatCurrencyTwoDecimals(item.value)}
                </Text>
              </Pressable>
            ))}
            <View style={[styles.legendRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>{formatCurrencyTwoDecimals(total)}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    chartWrap: {
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      minHeight: 220,
    },
    donutBox: {
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    donutCanvas: {
      pointerEvents: "none",
    },
    holeLabel: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    holeTitle: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 2,
    },
    holeValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    legend: {
      marginTop: 8,
      gap: 8,
    },
    legendRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      gap: 8,
    },
    legendRowMuted: {
      opacity: 0.45,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      flex: 1,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    legendPercent: {
      color: colors.textMuted,
      fontWeight: "700",
      minWidth: 44,
      textAlign: "right",
    },
    legendValue: {
      color: colors.text,
      fontWeight: "700",
      textAlign: "right",
      minWidth: 108,
    },
    totalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 4,
      paddingTop: 8,
    },
    totalLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    totalValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    hiddenAllText: {
      color: colors.textMuted,
      fontWeight: "600",
      marginVertical: 40,
    },
  });
