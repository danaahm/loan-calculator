import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import { type YearlyRow } from "../types/loan";
import { formatCurrency } from "../utils/format";
import { CardHeader } from "./CardHeader";

interface AmortizationGridProps {
  rows: YearlyRow[];
  currencyCode: string;
}

export const AmortizationGrid = ({ rows, currencyCode }: AmortizationGridProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <View style={styles.card}>
      <CardHeader
        title="Yearly Loan Plan"
        subtitle="Opening balance, yearly payments, and closing balance."
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      {!collapsed ? (
        <View style={styles.gridShell}>
          <View style={styles.stickyYearColumn}>
            <View style={[styles.row, styles.headerRow, styles.yearHeaderCellWrap]}>
              <Text style={[styles.yearCell, styles.headerCell]}>Year</Text>
            </View>
            {rows.map((row, index) => (
              <View
                key={`year-${row.year}`}
                style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}
              >
                <Text style={styles.yearCell}>{row.year}</Text>
              </View>
            ))}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.headerCell]}>Opening</Text>
                <Text style={[styles.cell, styles.headerCell]}>Principal</Text>
                <Text style={[styles.cell, styles.headerCell]}>Interest</Text>
                <Text style={[styles.cell, styles.headerCell]}>Fees</Text>
                <Text style={[styles.cell, styles.headerCell]}>Extra</Text>
                <Text style={[styles.cell, styles.headerCell]}>Closing</Text>
              </View>

              {rows.map((row, index) => (
                <View
                  key={`data-${row.year}`}
                  style={[styles.row, index % 2 === 0 ? styles.evenRow : styles.oddRow]}
                >
                  <Text style={styles.cell}>
                    {formatCurrency(row.openingBalance, currencyCode)}
                  </Text>
                  <Text style={styles.cell}>
                    {formatCurrency(row.principalPaid, currencyCode)}
                  </Text>
                  <Text style={styles.cell}>
                    {formatCurrency(row.interestPaid, currencyCode)}
                  </Text>
                  <Text style={styles.cell}>
                    {formatCurrency(row.feesPaid, currencyCode)}
                  </Text>
                  <Text style={styles.cell}>{formatCurrency(row.extraPaid, currencyCode)}</Text>
                  <Text style={styles.cell}>
                    {formatCurrency(row.closingBalance, currencyCode)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
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
      marginBottom: 24,
    },
    gridShell: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 12,
      overflow: "hidden",
      flexDirection: "row",
      backgroundColor: colors.card,
    },
    stickyYearColumn: {
      width: 72,
      borderRightWidth: 1,
      borderRightColor: colors.borderStrong,
      backgroundColor: colors.card,
    },
    row: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      alignItems: "center",
      minHeight: 40,
    },
    headerRow: {
      backgroundColor: colors.gridHeaderBg,
    },
    yearHeaderCellWrap: {
      justifyContent: "center",
    },
    evenRow: {
      backgroundColor: colors.card,
    },
    oddRow: {
      backgroundColor: colors.gridOddRow,
    },
    cell: {
      width: 120,
      paddingHorizontal: 8,
      paddingVertical: 8,
      fontSize: 12,
      color: colors.textSecondary,
    },
    yearCell: {
      width: 72,
      textAlign: "center",
      paddingHorizontal: 8,
      fontWeight: "700",
      color: colors.text,
    },
    headerCell: {
      fontWeight: "700",
      color: colors.text,
    },
  });
