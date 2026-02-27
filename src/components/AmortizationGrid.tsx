import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type YearlyRow } from "../types/loan";
import { formatCurrency } from "../utils/format";

interface AmortizationGridProps {
  rows: YearlyRow[];
}

export const AmortizationGrid = ({ rows }: AmortizationGridProps) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Yearly Loan Grid</Text>
      <Text style={styles.subtitle}>
        Opening balance, yearly payments, and closing balance.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.headerCell, styles.yearCell]}>Year</Text>
            <Text style={[styles.cell, styles.headerCell]}>Opening</Text>
            <Text style={[styles.cell, styles.headerCell]}>Principal</Text>
            <Text style={[styles.cell, styles.headerCell]}>Interest</Text>
            <Text style={[styles.cell, styles.headerCell]}>Fees</Text>
            <Text style={[styles.cell, styles.headerCell]}>Extra</Text>
            <Text style={[styles.cell, styles.headerCell]}>Closing</Text>
          </View>

          {rows.map((row) => (
            <View key={row.year} style={styles.row}>
              <Text style={[styles.cell, styles.yearCell]}>{row.year}</Text>
              <Text style={styles.cell}>{formatCurrency(row.openingBalance)}</Text>
              <Text style={styles.cell}>{formatCurrency(row.principalPaid)}</Text>
              <Text style={styles.cell}>{formatCurrency(row.interestPaid)}</Text>
              <Text style={styles.cell}>{formatCurrency(row.feesPaid)}</Text>
              <Text style={styles.cell}>{formatCurrency(row.extraPaid)}</Text>
              <Text style={styles.cell}>{formatCurrency(row.closingBalance)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    color: "#6b7280",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    alignItems: "center",
    minHeight: 38,
  },
  headerRow: {
    backgroundColor: "#f3f4f6",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  cell: {
    width: 120,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    color: "#1f2937",
  },
  yearCell: {
    width: 60,
    fontWeight: "700",
  },
  headerCell: {
    fontWeight: "700",
    color: "#111827",
  },
});
