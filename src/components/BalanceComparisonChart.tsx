import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import {
  PinchGestureHandler,
  type PinchGestureHandlerGestureEvent,
  type PinchGestureHandlerStateChangeEvent,
  State,
} from "react-native-gesture-handler";

import { type LoanCalculationResult, type RepaymentFrequency } from "../types/loan";
import {
  formatCurrency,
  formatDurationLabel,
  formatYearsAndPeriods,
} from "../utils/format";
import { CardHeader } from "./CardHeader";

interface BalanceComparisonChartProps {
  result: LoanCalculationResult;
  repaymentFrequency: RepaymentFrequency;
  currencyCode: string;
  loanLengthYears: number;
}

const periodsByFrequency: Record<RepaymentFrequency, number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

const formatCompactThousands = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const absolute = Math.abs(value);
  if (absolute >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return `${Math.round(value)}`;
};

export const BalanceComparisonChart = ({
  result,
  repaymentFrequency,
  currencyCode,
  loanLengthYears,
}: BalanceComparisonChartProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showExtra, setShowExtra] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusedYearIndex, setFocusedYearIndex] = useState<number | null>(null);
  const opacity = useRef(new Animated.Value(1)).current;
  const pinchStartZoom = useRef(1);

  useEffect(() => {
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
  }, [result]);

  const baselineData = result.baseline.yearlyBalancePoints;
  const extraData = result.withExtra?.yearlyBalancePoints;
  const openingBalance = result.baseline.yearlyRows[0]?.openingBalance ?? 0;
  const baselineSeries = useMemo(
    () => [{ year: 0, balance: openingBalance }, ...baselineData],
    [baselineData, openingBalance]
  );
  const extraSeries = useMemo(
    () => (extraData ? [{ year: 0, balance: openingBalance }, ...extraData] : []),
    [extraData, openingBalance]
  );

  const periodsPerYear = periodsByFrequency[repaymentFrequency];
  const savedTime = formatYearsAndPeriods(
    result.savings.yearsSaved,
    result.savings.periodsSaved,
    periodsPerYear
  );
  const totalLoanTime = result.withExtra
    ? formatYearsAndPeriods(
        result.withExtra.summary.payoffYears,
        result.withExtra.summary.payoffPeriods,
        periodsPerYear
      )
    : formatDurationLabel(loanLengthYears);
  const baseWidth = Math.min(Dimensions.get("window").width - 48, 380);
  const chartWidth = baseWidth;

  const visiblePoints = useMemo(() => {
    const total = baselineSeries.length;
    const windowSize = Math.max(4, Math.ceil(total / zoomLevel));
    const safeFocus = focusedYearIndex ?? 0;
    const half = Math.floor(windowSize / 2);
    const startIndex = Math.max(
      0,
      Math.min(total - windowSize, Math.max(0, safeFocus - half))
    );
    const endIndex = Math.min(total, startIndex + windowSize);

    return {
      startIndex,
      baseline: baselineSeries.slice(startIndex, endIndex),
      extra: extraSeries.slice(startIndex, endIndex),
    };
  }, [baselineSeries, extraSeries, focusedYearIndex, zoomLevel]);

  const labels = useMemo(() => {
    const years = visiblePoints.baseline.map((point) => point.year);
    const step = zoomLevel <= 1.25 ? 5 : zoomLevel <= 2.2 ? 2 : 1;
    return years.map((year, index) => {
      const isFirst = index === 0;
      const isLast = index === years.length - 1;
      return year % step === 0 || isFirst || isLast ? `${year}` : "";
    });
  }, [visiblePoints.baseline, zoomLevel]);
  const datasetMeta: Array<{
    name: string;
    visible: boolean;
    data: number[];
    color: () => string;
  }> = [
    {
      name: "Original repayment path",
      visible: showBaseline,
      data: visiblePoints.baseline.map((point) => point.balance),
      color: () => "#2563eb",
    },
    {
      name: "With extra repayment",
      visible: showExtra && Boolean(extraData),
      data: visiblePoints.extra.map((point) => point.balance),
      color: () => "#10b981",
    },
  ];
  const datasets = datasetMeta
    .filter((dataset) => dataset.visible)
    .map((dataset) => ({
      data: dataset.data,
      color: dataset.color,
      strokeWidth: 3,
      seriesName: dataset.name,
    }));

  const clampZoom = (value: number): number => {
    return Math.max(1, Math.min(4, value));
  };
  const clampFocusIndex = (index: number): number => {
    return Math.max(0, Math.min(baselineSeries.length - 1, index));
  };

  const handlePinchStateChange = (event: PinchGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      pinchStartZoom.current = zoomLevel;
      return;
    }

    if (event.nativeEvent.state === State.ACTIVE) {
      const nextZoom = clampZoom(pinchStartZoom.current * event.nativeEvent.scale);
      setZoomLevel(nextZoom);
      if (focusedYearIndex === null) {
        setFocusedYearIndex(Math.floor(baselineSeries.length / 2));
      }
      return;
    }

    if (
      event.nativeEvent.state === State.END ||
      event.nativeEvent.state === State.CANCELLED ||
      event.nativeEvent.state === State.FAILED
    ) {
      const nextZoom = clampZoom(pinchStartZoom.current * event.nativeEvent.scale);
      setZoomLevel(nextZoom);
      pinchStartZoom.current = nextZoom;
      if (focusedYearIndex === null) {
        setFocusedYearIndex(Math.floor(baselineSeries.length / 2));
      }
    }
  };

  const handlePinchGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
    const nextZoom = clampZoom(pinchStartZoom.current * event.nativeEvent.scale);
    setZoomLevel(nextZoom);
    if (focusedYearIndex === null) {
      setFocusedYearIndex(Math.floor(baselineSeries.length / 2));
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return zoomLevel > 1 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (zoomLevel <= 1) {
            return;
          }

          const baseIndex =
            focusedYearIndex ?? Math.floor(baselineSeries.length / 2);
          const pointsPerSwipe = Math.max(1, Math.round(zoomLevel * 2));
          const steps = Math.round(gestureState.dx / 35);
          const next = clampFocusIndex(baseIndex - steps * pointsPerSwipe);
          setFocusedYearIndex(next);
        },
      }),
    [baselineSeries.length, focusedYearIndex, zoomLevel]
  );

  return (
    <View style={styles.card}>
      <CardHeader
        title="Loan Balance Over Time"
        subtitle={`(${formatDurationLabel(loanLengthYears)})`}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      {!collapsed ? (
        <View>
          <View style={styles.toolbar}>
            <View style={styles.zoomButtons}>
              <Pressable
                style={styles.toolButton}
                onPress={() => {
                  setZoomLevel((prev) => Math.min(4, prev + 0.5));
                  if (focusedYearIndex === null) {
                    setFocusedYearIndex(Math.floor(baselineSeries.length / 2));
                  }
                }}
              >
                <Text style={styles.toolButtonText}>Zoom In</Text>
              </Pressable>
              <Pressable
                style={styles.toolButton}
                onPress={() => setZoomLevel((prev) => Math.max(1, prev - 0.5))}
              >
                <Text style={styles.toolButtonText}>Zoom Out</Text>
              </Pressable>
              {zoomLevel > 1 ? (
                <Pressable
                  style={styles.toolButton}
                  onPress={() => {
                    setZoomLevel(1);
                    setFocusedYearIndex(null);
                  }}
                >
                  <Text style={styles.toolButtonText}>Reset</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.chartArea}>
            <PinchGestureHandler
              onGestureEvent={handlePinchGestureEvent}
              onHandlerStateChange={handlePinchStateChange}
            >
              <View style={styles.chartCanvasWrap} {...panResponder.panHandlers}>
                <Animated.View style={{ opacity }}>
                  {datasets.length > 0 ? (
                    <LineChart
                      data={{
                        labels,
                        datasets,
                      }}
                      width={chartWidth}
                      height={260}
                      yAxisLabel=""
                      withHorizontalLabels
                      withVerticalLabels
                      withInnerLines
                      withOuterLines
                      withHorizontalLines
                      withVerticalLines
                      verticalLabelRotation={0}
                      formatXLabel={(value) => value}
                      formatYLabel={(value) => formatCompactThousands(Number(value))}
                      bezier
                      onDataPointClick={({ index }) => {
                        const absoluteIndex = visiblePoints.startIndex + index;
                        setFocusedYearIndex(absoluteIndex);
                      }}
                      chartConfig={{
                        backgroundGradientFrom: "#ffffff",
                        backgroundGradientTo: "#ffffff",
                        color: (opacityValue = 1) =>
                          `rgba(17,24,39,${opacityValue})`,
                        labelColor: (opacityValue = 1) =>
                          `rgba(75,85,99,${opacityValue})`,
                        decimalPlaces: 0,
                        propsForDots: {
                          r: "2",
                          strokeWidth: "1",
                          stroke: "#ffffff",
                        },
                        propsForBackgroundLines: {
                          stroke: "#d1d5db",
                          strokeDasharray: "0",
                          strokeWidth: 1,
                        },
                      }}
                      style={styles.chart}
                      fromZero
                      segments={6}
                    />
                  ) : (
                    <Text style={styles.chartFallbackText}>
                      Enable at least one series.
                    </Text>
                  )}
                </Animated.View>
                <Text style={styles.xAxisTitle}>Years</Text>
              </View>
            </PinchGestureHandler>
          </View>

          <Pressable
            style={[styles.legendRow, !showBaseline && styles.legendRowMuted]}
            onPress={() => setShowBaseline((prev) => !prev)}
          >
            <View style={[styles.dot, { backgroundColor: "#2563eb" }]} />
            <Text style={styles.legendText}>Original repayment</Text>
          </Pressable>
          {extraData ? (
            <Pressable
              style={[styles.legendRow, !showExtra && styles.legendRowMuted]}
              onPress={() => setShowExtra((prev) => !prev)}
            >
              <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
              <Text style={styles.legendText}>With extra repayment</Text>
            </Pressable>
          ) : null}

          {extraData ? (
            <View style={styles.savingsWrap}>
              <Text style={styles.savingsTitle}>Extra Repayment Benefit</Text>
              <View style={styles.savingsCardsRow}>
                <View style={styles.savingsCard}>
                  <Text style={styles.savingsCardLabel}>Interest saved:</Text>
                  <Text style={styles.savingsCardValue}>
                    {formatCurrency(result.savings.moneySaved, currencyCode)}
                  </Text>
                </View>
                <View style={styles.savingsCard}>
                  <Text style={styles.savingsCardLabel}>Time saved:</Text>
                  <Text style={styles.savingsCardValue}>{savedTime}</Text>
                </View>
              </View>
              <View style={styles.savingsCardWide}>
                <Text style={styles.savingsCardLabel}>Total loan time:</Text>
                <Text style={styles.savingsCardValue}>{totalLoanTime}</Text>
              </View>
            </View>
          ) : null}
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
  toolbar: {
    marginBottom: 8,
  },
  zoomButtons: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  toolButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f9fafb",
  },
  toolButtonText: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 12,
  },
  chart: {
    borderRadius: 12,
  },
  chartArea: {
    width: "100%",
  },
  chartCanvasWrap: {
    flex: 1,
  },
  xAxisTitle: {
    textAlign: "center",
    color: "#111827",
    fontWeight: "700",
    marginTop: 4,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
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
    marginBottom: 10,
  },
  savingsCardsRow: {
    flexDirection: "row",
    gap: 10,
  },
  savingsCard: {
    flex: 1,
    backgroundColor: "rgba(34, 197, 94, 0.5)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  savingsCardWide: {
    marginTop: 10,
    width: "100%",
    backgroundColor: "rgba(34, 197, 94, 0.5)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  savingsCardLabel: {
    color: "#14532d",
    fontWeight: "600",
    marginBottom: 6,
    textAlign: "center",

  },
  savingsCardValue: {
    color: "#14532d",
    fontWeight: "500",
    fontSize: 30,
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  chartFallbackText: {
    color: "#6b7280",
    fontWeight: "600",
    marginTop: 24,
  },
});

