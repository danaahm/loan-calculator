import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useLocale } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import { type ReminderStatus } from "../types/reminder";
import { formatDisplayDate, parseIsoDate, todayLocalIso } from "../utils/dateIso";
import { formatCurrency } from "../utils/format";
import { type UpcomingCycle } from "../utils/reminderMath";
import { DueChip } from "./DueChip";

interface UpcomingTimelineProps {
  cycles: UpcomingCycle[];
  currencyCode: string;
  status: ReminderStatus;
}

/**
 * Upcoming repayments as a timeline: a calendar tile per date, joined by a
 * line, beside what is due and what will be left owing afterwards.
 */
export const UpcomingTimeline = ({ cycles, currencyCode, status }: UpcomingTimelineProps) => {
  const { colors } = useTheme();
  const { t, language } = useLocale();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Month names come from Intl, so they follow the app's language.
  const monthFormat = useMemo(
    () => new Intl.DateTimeFormat(language, { month: "short" }),
    [language]
  );
  const currentYear = parseIsoDate(todayLocalIso()).getFullYear();

  return (
    <View>
      {cycles.map((cycle, index) => {
        const date = parseIsoDate(cycle.date);
        const isNext = index === 0;
        const isLast = index === cycles.length - 1;
        const amount = formatCurrency(cycle.amountDue, currencyCode);
        const balance = t("detail.upcomingBalanceAfter", {
          amount: formatCurrency(cycle.remainingAfter, currencyCode),
        });
        return (
          <View
            key={cycle.date}
            style={styles.row}
            accessible
            accessibilityLabel={[
              formatDisplayDate(cycle.date),
              amount,
              cycle.interestOnly ? t("detail.upcomingInterestOnly") : null,
              balance,
            ]
              .filter(Boolean)
              .join(", ")}
          >
            <View style={styles.rail}>
              <View style={[styles.tile, isNext && styles.tileNext]}>
                <Text style={[styles.tileMonth, isNext && styles.tileMonthNext]}>
                  {monthFormat.format(date).replace(".", "").toUpperCase()}
                </Text>
                <Text style={[styles.tileDay, isNext && styles.tileDayNext]}>
                  {date.getDate()}
                </Text>
                {date.getFullYear() !== currentYear ? (
                  <Text style={[styles.tileYear, isNext && styles.tileMonthNext]}>
                    {date.getFullYear()}
                  </Text>
                ) : null}
              </View>
              {isLast ? null : <View style={styles.connector} />}
            </View>

            <View style={[styles.body, !isLast && styles.bodySpaced]}>
              <View style={styles.amountRow}>
                <Text style={styles.amount}>{amount}</Text>
                {isNext ? <DueChip dateIso={cycle.date} status={status} /> : null}
              </View>
              <View style={styles.metaRow}>
                {cycle.interestOnly ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{t("detail.upcomingInterestOnly")}</Text>
                  </View>
                ) : null}
                <Text style={styles.balance}>{balance}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const TILE_WIDTH = 52;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
    },
    rail: {
      width: TILE_WIDTH,
      alignItems: "center",
    },
    tile: {
      width: TILE_WIDTH,
      paddingVertical: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.inputBg,
      alignItems: "center",
    },
    tileNext: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    tileMonth: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.6,
      color: colors.textMuted,
    },
    tileMonthNext: {
      color: colors.accentTextDeep,
    },
    tileDay: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.text,
    },
    tileDayNext: {
      color: colors.accentTextDeep,
    },
    tileYear: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textMuted,
    },
    connector: {
      flex: 1,
      width: 2,
      minHeight: 10,
      marginVertical: 4,
      borderRadius: 1,
      backgroundColor: colors.border,
    },
    body: {
      flex: 1,
      marginLeft: 12,
      paddingTop: 4,
    },
    bodySpaced: {
      paddingBottom: 18,
    },
    amountRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    amount: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    tag: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      backgroundColor: colors.warningBg,
    },
    tagText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.warning,
    },
    balance: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
  });
