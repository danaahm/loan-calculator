import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type YearlyRow } from "../types/loan";
import { formatCurrency } from "../utils/format";
import { CardHeader } from "./CardHeader";

interface AmortizationGridProps {
  rows: YearlyRow[];
  currencyCode: string;
}

export const AmortizationGrid = ({ rows, currencyCode }: AmortizationGridProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <View style={styles.card}>
      <CardHeader
        title="Yearly Loan Grid"
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

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  gridShell: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    backgroundColor: "#ffffff",
  },
  stickyYearColumn: {
    width: 72,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    alignItems: "center",
    minHeight: 40,
  },
  headerRow: {
    backgroundColor: "#f3f4f6",
  },
  yearHeaderCellWrap: {
    justifyContent: "center",
  },
  evenRow: {
    backgroundColor: "#ffffff",
  },
  oddRow: {
    backgroundColor: "#f9fafb",
  },
  cell: {
    width: 120,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    color: "#1f2937",
  },
  yearCell: {
    width: 72,
    textAlign: "center",
    paddingHorizontal: 8,
    fontWeight: "700",
    color: "#111827",
  },
  headerCell: {
    fontWeight: "700",
    color: "#111827",
  },
});
