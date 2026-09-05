import { type LoanCalculationResult } from "../types/loan";

export type BalanceChartPoint = {
  year: number;
  baseline: number;
  extra: number | null;
};

const MAX_CHART_POINTS = 420;

const clampNonNegative = (value: number | undefined, fallback: number): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return Math.max(0, fallback);
  }
  return Math.max(0, value);
};

const downsampleChartPoints = (
  points: BalanceChartPoint[],
  maxPoints: number
): BalanceChartPoint[] => {
  if (points.length <= maxPoints) {
    return points;
  }

  const keepIndexes = new Set<number>([0, points.length - 1]);
  for (let index = points.length - 1; index >= 0; index -= 1) {
    if (points[index].extra !== null) {
      keepIndexes.add(index);
      break;
    }
  }

  const used = new Set<number>();
  const sampled: BalanceChartPoint[] = [];
  const pushIndex = (sourceIndex: number) => {
    if (used.has(sourceIndex)) {
      return;
    }
    used.add(sourceIndex);
    sampled.push(points[sourceIndex]);
  };

  for (let index = 0; index < maxPoints; index += 1) {
    pushIndex(Math.round((index / (maxPoints - 1)) * (points.length - 1)));
  }
  for (const keepIndex of keepIndexes) {
    pushIndex(keepIndex);
  }

  sampled.sort((left, right) => left.year - right.year);
  return sampled;
};

export const buildBalanceChartPoints = (
  result: LoanCalculationResult,
  periodsPerYear: number
): BalanceChartPoint[] => {
  const baselineRows = result.baseline.periodRows;
  const extraRows = result.withExtra?.periodRows ?? [];
  const opening = clampNonNegative(baselineRows[0]?.openingBalance, 0);
  const count = Math.max(baselineRows.length, extraRows.length);
  const hasExtra = extraRows.length > 0;
  const safePeriodsPerYear = Math.max(1, periodsPerYear);

  const raw: BalanceChartPoint[] = [
    {
      year: 0,
      baseline: opening,
      extra: opening,
    },
  ];

  for (let index = 0; index < count; index += 1) {
    const previous = raw[raw.length - 1];
    const baseline = clampNonNegative(
      baselineRows[index]?.closingBalance,
      previous.baseline
    );
    let extra: number | null;
    if (!hasExtra) {
      extra = baseline;
    } else if (index < extraRows.length) {
      extra = clampNonNegative(extraRows[index]?.closingBalance, 0);
    } else {
      extra = null;
    }

    raw.push({
      year: (index + 1) / safePeriodsPerYear,
      baseline,
      extra,
    });
  }

  return downsampleChartPoints(raw, MAX_CHART_POINTS);
};

export const getBalanceChartDomain = (
  points: BalanceChartPoint[]
): { xMin: number; xMax: number; yMin: number; yMax: number } => {
  let xMax = 0;
  let yMax = 0;

  for (const point of points) {
    xMax = Math.max(xMax, point.year);
    yMax = Math.max(yMax, point.baseline);
    if (typeof point.extra === "number") {
      yMax = Math.max(yMax, point.extra);
    }
  }

  return {
    xMin: 0,
    xMax: Math.max(xMax, 0.01),
    yMin: 0,
    yMax: Math.max(yMax, 1),
  };
};

export const formatChartTimeLabel = (
  year: number,
  useMonths: boolean
): string => {
  if (useMonths) {
    return `${Math.max(0, Math.round(year * 12))}`;
  }
  const rounded = Math.round(year * 10) / 10;
  if (Number.isInteger(rounded)) {
    return `${rounded}`;
  }
  return rounded.toFixed(1);
};

export const formatChartTimeDetail = (
  year: number,
  useMonths: boolean
): string => {
  const totalMonths = Math.max(0, Math.round(year * 12));
  if (useMonths || year < 2) {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years === 0) {
      return `${months} month${months === 1 ? "" : "s"}`;
    }
    if (months === 0) {
      return `${years} year${years === 1 ? "" : "s"}`;
    }
    return `${years} year${years === 1 ? "" : "s"} ${months} month${
      months === 1 ? "" : "s"
    }`;
  }
  return `${year.toFixed(1)} years`;
};
