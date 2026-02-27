import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AmortizationGrid } from "./src/components/AmortizationGrid";
import { BalanceComparisonChart } from "./src/components/BalanceComparisonChart";
import { LoanForm } from "./src/components/LoanForm";
import { PieBreakdownChart } from "./src/components/PieBreakdownChart";
import { loadLoanInput, saveLoanInput } from "./src/storage/localState";
import { type LoanCalculationResult, type LoanInput } from "./src/types/loan";
import { calculateLoan, normalizeInput } from "./src/utils/loanMath";

const DEFAULT_INPUT: LoanInput = {
  amountBorrowed: 500000,
  annualInterestRatePercent: 6.2,
  repaymentFrequency: "monthly",
  loanLengthYears: 30,
  accountFee: 8,
  accountFeeFrequency: "monthly",
  extraRepayment: {
    enabled: false,
    amount: 200,
    frequency: "monthly",
    startAfterPeriods: 12,
  },
};

export default function App() {
  const [input, setInput] = useState<LoanInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<LoanCalculationResult | null>(null);
  const [loadingState, setLoadingState] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const savedInput = await loadLoanInput();
      const initial = normalizeInput(savedInput ?? DEFAULT_INPUT);
      setInput(initial);
      setResult(calculateLoan(initial));
      setLoadingState(false);
    };

    bootstrap().catch(() => {
      setInput(DEFAULT_INPUT);
      setResult(calculateLoan(DEFAULT_INPUT));
      setLoadingState(false);
    });
  }, []);

  const handleSubmit = async (nextInput: LoanInput) => {
    const normalized = normalizeInput(nextInput);
    setInput(normalized);
    setResult(calculateLoan(normalized));
    await saveLoanInput(normalized);
  };

  if (loadingState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Loan Calculator</Text>
        <Text style={styles.subheading}>
          Compare your normal repayment path with optional extra repayments.
        </Text>

        <LoanForm initialValue={input} onSubmit={handleSubmit} />

        {result ? (
          <View>
            <PieBreakdownChart
              principal={result.activeSchedule.summary.totalPrincipalPaid}
              interest={result.activeSchedule.summary.totalInterestPaid}
              fees={result.activeSchedule.summary.totalFeesPaid}
            />

            <BalanceComparisonChart
              result={result}
              repaymentFrequency={input.repaymentFrequency}
            />

            <AmortizationGrid rows={result.activeSchedule.yearlyRows} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
  },
  subheading: {
    color: "#4b5563",
    marginBottom: 16,
  },
});
