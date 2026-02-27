import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  FREQUENCIES,
  type LoanInput,
  type RepaymentFrequency,
} from "../types/loan";
import { formatFrequencyLabel } from "../utils/format";

interface LoanFormProps {
  initialValue: LoanInput;
  onSubmit: (value: LoanInput) => void;
}

const parsePositiveNumber = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

const parsePositiveInt = (value: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
};

const FrequencySelector = ({
  value,
  onChange,
}: {
  value: RepaymentFrequency;
  onChange: (next: RepaymentFrequency) => void;
}) => {
  return (
    <View style={styles.frequencyWrap}>
      {FREQUENCIES.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.frequencyButton, selected && styles.frequencyButtonActive]}
          >
            <Text style={[styles.frequencyText, selected && styles.frequencyTextActive]}>
              {formatFrequencyLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const LoanForm = ({ initialValue, onSubmit }: LoanFormProps) => {
  const [amountBorrowed, setAmountBorrowed] = useState(
    String(initialValue.amountBorrowed)
  );
  const [interestRate, setInterestRate] = useState(
    String(initialValue.annualInterestRatePercent)
  );
  const [loanLengthYears, setLoanLengthYears] = useState(
    String(initialValue.loanLengthYears)
  );
  const [accountFee, setAccountFee] = useState(String(initialValue.accountFee));
  const [repaymentFrequency, setRepaymentFrequency] = useState(
    initialValue.repaymentFrequency
  );
  const [accountFeeFrequency, setAccountFeeFrequency] = useState(
    initialValue.accountFeeFrequency
  );
  const [extraEnabled, setExtraEnabled] = useState(initialValue.extraRepayment.enabled);
  const [extraAmount, setExtraAmount] = useState(
    String(initialValue.extraRepayment.amount)
  );
  const [extraFrequency, setExtraFrequency] = useState(
    initialValue.extraRepayment.frequency
  );
  const [extraStartAfter, setExtraStartAfter] = useState(
    String(initialValue.extraRepayment.startAfterPeriods)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAmountBorrowed(String(initialValue.amountBorrowed));
    setInterestRate(String(initialValue.annualInterestRatePercent));
    setLoanLengthYears(String(initialValue.loanLengthYears));
    setAccountFee(String(initialValue.accountFee));
    setRepaymentFrequency(initialValue.repaymentFrequency);
    setAccountFeeFrequency(initialValue.accountFeeFrequency);
    setExtraEnabled(initialValue.extraRepayment.enabled);
    setExtraAmount(String(initialValue.extraRepayment.amount));
    setExtraFrequency(initialValue.extraRepayment.frequency);
    setExtraStartAfter(String(initialValue.extraRepayment.startAfterPeriods));
  }, [initialValue]);

  const fieldValue = useMemo<LoanInput>(() => {
    return {
      amountBorrowed: parsePositiveNumber(amountBorrowed),
      annualInterestRatePercent: parsePositiveNumber(interestRate),
      repaymentFrequency,
      loanLengthYears: parsePositiveNumber(loanLengthYears),
      accountFee: parsePositiveNumber(accountFee),
      accountFeeFrequency,
      extraRepayment: {
        enabled: extraEnabled,
        amount: parsePositiveNumber(extraAmount),
        frequency: extraFrequency,
        startAfterPeriods: parsePositiveInt(extraStartAfter),
      },
    };
  }, [
    accountFee,
    accountFeeFrequency,
    amountBorrowed,
    extraAmount,
    extraEnabled,
    extraFrequency,
    extraStartAfter,
    interestRate,
    loanLengthYears,
    repaymentFrequency,
  ]);

  const submit = () => {
    if (fieldValue.amountBorrowed <= 0) {
      setError("Amount borrowed must be greater than zero.");
      return;
    }

    if (fieldValue.loanLengthYears <= 0) {
      setError("Loan length must be greater than zero.");
      return;
    }

    if (fieldValue.extraRepayment.enabled && fieldValue.extraRepayment.amount <= 0) {
      setError("Extra repayment amount must be greater than zero.");
      return;
    }

    setError(null);
    onSubmit(fieldValue);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Loan Inputs</Text>

      <Text style={styles.label}>Amount Borrowed</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={amountBorrowed}
        onChangeText={setAmountBorrowed}
        style={styles.input}
        placeholder="e.g. 500000"
      />

      <Text style={styles.label}>Interest Rate (% per year)</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={interestRate}
        onChangeText={setInterestRate}
        style={styles.input}
        placeholder="e.g. 6.25"
      />

      <Text style={styles.label}>Repayment Frequency</Text>
      <FrequencySelector value={repaymentFrequency} onChange={setRepaymentFrequency} />

      <Text style={styles.label}>Loan Length (years)</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={loanLengthYears}
        onChangeText={setLoanLengthYears}
        style={styles.input}
        placeholder="e.g. 30"
      />

      <Text style={styles.label}>Account Fee (per fee event)</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={accountFee}
        onChangeText={setAccountFee}
        style={styles.input}
        placeholder="e.g. 10"
      />

      <Text style={styles.label}>Account Fee Frequency</Text>
      <FrequencySelector value={accountFeeFrequency} onChange={setAccountFeeFrequency} />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Enable Extra Repayment</Text>
        <Switch value={extraEnabled} onValueChange={setExtraEnabled} />
      </View>

      {extraEnabled ? (
        <View>
          <Text style={styles.label}>Extra Repayment Amount</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={extraAmount}
            onChangeText={setExtraAmount}
            style={styles.input}
            placeholder="e.g. 250"
          />

          <Text style={styles.label}>Extra Repayment Frequency</Text>
          <FrequencySelector value={extraFrequency} onChange={setExtraFrequency} />

          <Text style={styles.label}>Start Extra After N Repayment Periods</Text>
          <TextInput
            keyboardType="number-pad"
            value={extraStartAfter}
            onChangeText={setExtraStartAfter}
            style={styles.input}
            placeholder="e.g. 12"
          />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable style={styles.calculateButton} onPress={submit}>
        <Text style={styles.calculateButtonText}>Calculate</Text>
      </Pressable>
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
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111827",
  },
  label: {
    marginBottom: 6,
    marginTop: 10,
    color: "#374151",
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#f9fafb",
  },
  frequencyWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  frequencyButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
  },
  frequencyButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  frequencyText: {
    fontSize: 13,
    color: "#374151",
  },
  frequencyTextActive: {
    color: "#1e40af",
    fontWeight: "700",
  },
  switchRow: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },
  errorText: {
    color: "#dc2626",
    marginTop: 12,
    fontWeight: "600",
  },
  calculateButton: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    alignItems: "center",
  },
  calculateButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
});
