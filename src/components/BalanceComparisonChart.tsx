import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import {
  Circle,
  Line as SkiaLine,
  matchFont,
  multiply4,
  scale,
  translate,
  vec,
  type Matrix4,
} from "@shopify/react-native-skia";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import {
  Area,
  CartesianChart,
  Line,
  getTransformComponents,
  setScale,
  setTranslate,
  useChartPressState,
  useChartTransformState,
  type ChartBounds,
} from "victory-native";

import { type LoanCalculationResult, type RepaymentFrequency } from "../types/loan";
import {
  formatDurationLabel,
  formatYearsAndPeriods,
  getCurrencySymbol,
} from "../utils/format";
import {
  buildBalanceChartPoints,
  formatChartTimeDetail,
  formatChartTimeLabel,
  getBalanceChartDomain,
} from "../utils/chartData";
import { CardHeader } from "./CardHeader";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";

const MIN_CHART_ZOOM = 1;
const MAX_CHART_ZOOM = 10;

const clampChartTransformToData = (
  matrix: Matrix4,
  plotLeft: number,
  plotRight: number
): Matrix4 => {
  "worklet";

  const { scaleX, scaleY, translateX, translateY } = getTransformComponents(matrix);
  const plotWidth = plotRight - plotLeft;
  if (!(plotWidth > 1) || !Number.isFinite(plotWidth)) {
    return matrix;
  }

  const nextScaleX = Math.min(
    MAX_CHART_ZOOM,
    Math.max(MIN_CHART_ZOOM, Number.isFinite(scaleX) ? scaleX : MIN_CHART_ZOOM)
  );
  const nextScaleY = 1;
  const minTranslateX = plotRight * (1 - nextScaleX);
  const maxTranslateX = plotLeft * (1 - nextScaleX);
  const nextTranslateX = Math.min(
    maxTranslateX,
    Math.max(minTranslateX, Number.isFinite(translateX) ? translateX : 0)
  );
  const nextTranslateY = 0;

  if (
    Math.abs(nextScaleX - scaleX) < 0.0001 &&
    Math.abs(nextScaleY - scaleY) < 0.0001 &&
    Math.abs(nextTranslateX - translateX) < 0.05 &&
    Math.abs(nextTranslateY - translateY) < 0.05
  ) {
    return matrix;
  }

  return setScale(setTranslate(matrix, nextTranslateX, nextTranslateY), nextScaleX, nextScaleY);
};

const FitOneLineText = ({
  value,
  style,
  maxFontSize = 30,
  minFontSize = 13,
}: {
  value: string;
  style?: StyleProp<TextStyle>;
  maxFontSize?: number;
  minFontSize?: number;
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const fontSize = useMemo(() => {
    if (containerWidth <= 0 || value.length === 0) {
      return maxFontSize;
    }
    const estimatedGlyphWidth = 0.62;
    const fitted = Math.floor(containerWidth / (value.length * estimatedGlyphWidth));
    return Math.max(minFontSize, Math.min(maxFontSize, fitted));
  }, [containerWidth, maxFontSize, minFontSize, value]);

  return (
    <View
      style={fitStyles.savingsValueWrap}
      onLayout={(event) => {
        const nextWidth = Math.floor(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== containerWidth) {
          setContainerWidth(nextWidth);
        }
      }}
    >
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={minFontSize / maxFontSize}
        style={[style, { fontSize }]}
      >
        {value}
      </Text>
    </View>
  );
};

interface BalanceComparisonChartProps {
  result: LoanCalculationResult;
  repaymentFrequency: RepaymentFrequency;
  currencyCode: string;
  loanLengthYears: number;
}

const PERIODS_PER_YEAR: Record<RepaymentFrequency, number> = {
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

const axisFont = matchFont({
  fontFamily: Platform.select({
    ios: "Helvetica",
    android: "sans-serif",
    default: "sans-serif",
  }) as string,
  fontSize: 11,
  fontWeight: "500",
});

type ActivePoint = {
  year: number;
  baseline: number;
  extra: number | null;
};

const ChartTooltipMarkers = ({
  x,
  baselineY,
  extraY,
  extraValue,
  top,
  bottom,
  showExtra,
  lineColor,
}: {
  x: SharedValue<number>;
  baselineY: SharedValue<number>;
  extraY: SharedValue<number>;
  extraValue: SharedValue<number>;
  top: number;
  bottom: number;
  showExtra: boolean;
  lineColor: string;
}) => {
  const p1 = useDerivedValue(() => vec(x.value, top));
  const p2 = useDerivedValue(() => vec(x.value, bottom));
  const extraOpacity = useDerivedValue(() =>
    showExtra && Number.isFinite(extraValue.value) ? 1 : 0
  );

  return (
    <>
      <SkiaLine p1={p1} p2={p2} color={lineColor} strokeWidth={1} />
      <Circle cx={x} cy={baselineY} r={5} color="#2563eb" />
      {showExtra ? (
        <Circle cx={x} cy={extraY} r={5} color="#10b981" opacity={extraOpacity} />
      ) : null}
    </>
  );
};

export const BalanceComparisonChart = ({
  result,
  repaymentFrequency,
  currencyCode,
  loanLengthYears,
}: BalanceComparisonChartProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [collapsed, setCollapsed] = useState(false);
  const [showBaseline, setShowBaseline] = useState(true);
  const [showExtra, setShowExtra] = useState(true);
  const [activePoint, setActivePoint] = useState<ActivePoint | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  const periodsPerYear = PERIODS_PER_YEAR[repaymentFrequency];
  const hasExtraSeries = Boolean(result.withExtra);
  const useMonthAxis = loanLengthYears <= 2;
  const currencySymbol = getCurrencySymbol(currencyCode);
  const chartData = useMemo(
    () => buildBalanceChartPoints(result, periodsPerYear),
    [periodsPerYear, result]
  );
  const chartDomain = useMemo(() => getBalanceChartDomain(chartData), [chartData]);
  const { state: pressState, isActive } = useChartPressState({
    x: 0,
    y: { baseline: 0, extra: 0 },
  });
  const { state: transformState } = useChartTransformState();
  const plotLeft = useSharedValue(0);
  const plotRight = useSharedValue(0);
  const chartTransformGestures = useMemo(
    () =>
      Gesture.Simultaneous(
        Gesture.Pinch()
          .shouldCancelWhenOutside(false)
          .onBegin((event) => {
            transformState.offset.value = transformState.matrix.value;
            transformState.origin.value = {
              x: event.focalX,
              y: event.focalY,
            };
            transformState.zoomActive.value = true;
          })
          .onChange((event) => {
            transformState.matrix.value = multiply4(
              transformState.offset.value,
              scale(event.scale, 1, 1, transformState.origin.value)
            );
          })
          .onFinalize(() => {
            transformState.zoomActive.value = false;
          }),
        Gesture.Pan()
          .activeOffsetX([-16, 16])
          .failOffsetY([-12, 12])
          .onStart(() => {
            transformState.panActive.value = true;
          })
          .onChange((event) => {
            transformState.matrix.value = multiply4(
              translate(event.changeX, 0, 0),
              transformState.matrix.value
            );
          })
          .onFinalize(() => {
            transformState.panActive.value = false;
          })
      ),
    [transformState]
  );

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

  const formatMoney = useCallback(
    (value: number): string => {
      return `${currencySymbol}${Math.round(value).toLocaleString()}`;
    },
    [currencySymbol]
  );

  const applyActivePoint = useCallback((next: ActivePoint | null) => {
    setActivePoint(next);
  }, []);

  useAnimatedReaction(
    () => ({
      active: pressState.isActive.value,
      year: Number(pressState.x.value.value),
      baseline: pressState.y.baseline.value.value,
      extra: pressState.y.extra.value.value,
    }),
    (current) => {
      if (!current.active) {
        runOnJS(applyActivePoint)(null);
        return;
      }
      runOnJS(applyActivePoint)({
        year: current.year,
        baseline: current.baseline,
        extra: Number.isFinite(current.extra) ? current.extra : null,
      });
    }
  );

  useAnimatedReaction(
    () => ({
      matrix: transformState.matrix.value,
      left: plotLeft.value,
      right: plotRight.value,
    }),
    ({ matrix, left, right }) => {
      const nextMatrix = clampChartTransformToData(matrix, left, right);
      if (nextMatrix !== matrix) {
        transformState.matrix.value = nextMatrix;
      }
    }
  );

  useEffect(() => {
    transformState.matrix.value = setScale(
      setTranslate(transformState.matrix.value, 0, 0),
      1,
      1
    );
  }, [chartData, transformState.matrix]);

  const handleChartBoundsChange = useCallback(
    (bounds: ChartBounds) => {
      plotLeft.value = bounds.left;
      plotRight.value = bounds.right;
    },
    [plotLeft, plotRight]
  );

  const releaseChartTouches = useCallback(() => {
    transformState.panActive.value = false;
    transformState.zoomActive.value = false;
  }, [transformState]);

  const visibleSeriesCount = Number(showBaseline) + Number(showExtra && hasExtraSeries);

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
          <View
            style={styles.chartArea}
            onLayout={(event) => {
              const nextWidth = Math.round(event.nativeEvent.layout.width);
              if (nextWidth > 0 && nextWidth !== chartWidth) {
                setChartWidth(nextWidth);
              }
            }}
            onTouchEnd={(event) => {
              if (event.nativeEvent.touches.length === 0) {
                releaseChartTouches();
              }
            }}
            onTouchCancel={releaseChartTouches}
          >
            {visibleSeriesCount > 0 && chartWidth > 0 ? (
              <CartesianChart
                data={chartData}
                xKey="year"
                yKeys={["baseline", "extra"]}
                explicitSize={{ width: chartWidth, height: 260 }}
                domain={{
                  x: [chartDomain.xMin, chartDomain.xMax],
                  y: [chartDomain.yMin, chartDomain.yMax],
                }}
                padding={{ left: 8, right: 8, top: 12, bottom: 4 }}
                domainPadding={{ top: 12 }}
                chartPressState={pressState}
                chartPressConfig={{
                  pan: {
                    activateAfterLongPress: 120,
                  },
                }}
                transformState={transformState}
                transformConfig={{
                  pan: { enabled: false },
                  pinch: { enabled: false },
                }}
                customGestures={chartTransformGestures}
                onChartBoundsChange={handleChartBoundsChange}
                xAxis={{
                  font: axisFont,
                  tickCount: useMonthAxis ? 7 : 6,
                  lineColor: colors.chartLine,
                  labelColor: colors.textMuted,
                  enableRescaling: true,
                  formatXLabel: (value) => {
                    const year = Number(value);
                    if (
                      !Number.isFinite(year) ||
                      year < -0.001 ||
                      year > chartDomain.xMax + 0.001
                    ) {
                      return "";
                    }
                    return formatChartTimeLabel(year, useMonthAxis);
                  },
                }}
                yAxis={[
                  {
                    font: axisFont,
                    tickCount: 6,
                    lineColor: colors.chartLine,
                    labelColor: colors.textMuted,
                    enableRescaling: true,
                    domain: [chartDomain.yMin, chartDomain.yMax],
                    formatYLabel: (value) => {
                      const amount = Number(value);
                      if (!Number.isFinite(amount) || amount < 0) {
                        return "";
                      }
                      return formatCompactThousands(amount);
                    },
                  },
                ]}
                frame={{ lineColor: colors.chartLine }}
              >
                {({ points, chartBounds, yScale }) => {
                  const zeroY = yScale(0);
                  return (
                    <>
                      {showBaseline ? (
                        <>
                          <Area
                            points={points.baseline}
                            y0={zeroY}
                            color="rgba(37,99,235,0.16)"
                            curveType="linear"
                          />
                          <Line
                            points={points.baseline}
                            color="#2563eb"
                            strokeWidth={3}
                            curveType="linear"
                          />
                        </>
                      ) : null}
                      {hasExtraSeries && showExtra ? (
                        <>
                          <Area
                            points={points.extra}
                            y0={zeroY}
                            color="rgba(16,185,129,0.14)"
                            curveType="linear"
                          />
                          <Line
                            points={points.extra}
                            color="#10b981"
                            strokeWidth={3}
                            curveType="linear"
                          />
                        </>
                      ) : null}
                      {isActive ? (
                        <ChartTooltipMarkers
                          x={pressState.x.position}
                          baselineY={pressState.y.baseline.position}
                          extraY={pressState.y.extra.position}
                          extraValue={pressState.y.extra.value}
                          top={chartBounds.top}
                          bottom={zeroY}
                          showExtra={hasExtraSeries && showExtra}
                          lineColor={colors.chartTooltipLine}
                        />
                      ) : null}
                    </>
                  );
                }}
              </CartesianChart>
            ) : (
              <Text style={styles.chartFallbackText}>Enable at least one series.</Text>
            )}
          </View>
          <Text style={styles.xAxisTitle}>{useMonthAxis ? "Months" : "Years"}</Text>
          <Text style={styles.chartHint}>
            Hold a point for details. Pinch to zoom.
          </Text>

          {activePoint ? (
            <View style={styles.tooltipCard}>
              <Text style={styles.tooltipTime}>
                {formatChartTimeDetail(activePoint.year, useMonthAxis)}
              </Text>
              {showBaseline ? (
                <Text style={styles.tooltipBaseline}>
                  Original: {formatMoney(activePoint.baseline)}
                </Text>
              ) : null}
              {hasExtraSeries && showExtra ? (
                <Text style={styles.tooltipExtra}>
                  With extra:{" "}
                  {activePoint.extra === null
                    ? "Paid off"
                    : formatMoney(activePoint.extra)}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            style={[styles.legendRow, !showBaseline && styles.legendRowMuted]}
            onPress={() => setShowBaseline((prev) => !prev)}
          >
            <View style={[styles.dot, { backgroundColor: "#2563eb" }]} />
            <Text style={styles.legendText}>Original repayment</Text>
          </Pressable>
          {hasExtraSeries ? (
            <Pressable
              style={[styles.legendRow, !showExtra && styles.legendRowMuted]}
              onPress={() => setShowExtra((prev) => !prev)}
            >
              <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
              <Text style={styles.legendText}>With extra repayment</Text>
            </Pressable>
          ) : null}

          {hasExtraSeries ? (
            <View style={styles.savingsWrap}>
              <Text style={styles.savingsTitle}>Extra Repayment Benefit</Text>
              <View style={styles.savingsCardsRow}>
                <View style={styles.savingsCard}>
                  <Text style={styles.savingsCardLabel}>Interest saved:</Text>
                  <FitOneLineText
                    value={`${currencySymbol}${Math.round(result.savings.moneySaved).toLocaleString()}`}
                    style={styles.savingsCardValue}
                  />
                </View>
                <View style={styles.savingsCard}>
                  <Text style={styles.savingsCardLabel}>Time saved:</Text>
                  <FitOneLineText value={savedTime} style={styles.savingsCardValue} />
                </View>
              </View>
              <View style={styles.savingsCardWide}>
                <Text style={styles.savingsCardLabel}>Total loan time:</Text>
                <FitOneLineText value={totalLoanTime} style={styles.savingsCardValue} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const fitStyles = StyleSheet.create({
  savingsValueWrap: {
    width: "100%",
  },
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    chartArea: {
      width: "100%",
      height: 260,
      overflow: "hidden",
    },
    xAxisTitle: {
      textAlign: "center",
      color: colors.text,
      fontWeight: "700",
      marginTop: 4,
    },
    chartHint: {
      textAlign: "center",
      color: colors.textMuted,
      fontWeight: "600",
      fontSize: 12,
      marginTop: 4,
      marginBottom: 4,
    },
    tooltipCard: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.tooltipBg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tooltipTime: {
      color: colors.text,
      fontWeight: "800",
      marginBottom: 4,
    },
    tooltipBaseline: {
      color: colors.accentTextStrong,
      fontWeight: "700",
    },
    tooltipExtra: {
      color: colors.extraText,
      fontWeight: "700",
      marginTop: 2,
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
      color: colors.textSecondary,
      fontWeight: "600",
    },
    savingsWrap: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    savingsTitle: {
      fontWeight: "700",
      color: colors.text,
      marginBottom: 10,
    },
    savingsCardsRow: {
      flexDirection: "row",
      gap: 10,
    },
    savingsCard: {
      flex: 1,
      minWidth: 0,
      backgroundColor: colors.savingsBg,
      borderColor: colors.savingsBorder,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 10,
    },
    savingsCardWide: {
      marginTop: 10,
      width: "100%",
      backgroundColor: colors.savingsBg,
      borderColor: colors.savingsBorder,
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 10,
    },
    savingsCardLabel: {
      color: colors.savingsText,
      fontWeight: "600",
      marginBottom: 6,
      textAlign: "center",
    },
    savingsCardValue: {
      color: colors.savingsText,
      fontWeight: "500",
      fontSize: 30,
      textAlign: "center",
    },
    chartFallbackText: {
      color: colors.textMuted,
      fontWeight: "600",
      marginTop: 24,
      textAlign: "center",
    },
  });
