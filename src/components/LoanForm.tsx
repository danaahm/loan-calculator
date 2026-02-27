import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
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
import {
  getAvailableCurrencies,
  getCurrencySymbol,
  type CurrencyOption,
  formatFrequencyLabel,
} from "../utils/format";
import { CardHeader } from "./CardHeader";

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
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const currencies = useMemo(() => getAvailableCurrencies(), []);

  const [amountBorrowed, setAmountBorrowed] = useState(
    String(initialValue.amountBorrowed)
  );
  const [currencyCode, setCurrencyCode] = useState(initialValue.currencyCode);
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
    setCurrencyCode(initialValue.currencyCode);
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
      currencyCode,
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
    currencyCode,
    extraAmount,
    extraEnabled,
    extraFrequency,
    extraStartAfter,
    interestRate,
    loanLengthYears,
    repaymentFrequency,
  ]);
  const moneySymbol = useMemo(() => getCurrencySymbol(currencyCode), [currencyCode]);

  const filteredCurrencies = useMemo(() => {
    const query = currencySearch.trim().toLowerCase();
    if (!query) {
      return currencies;
    }
    return currencies.filter((currency) => {
      return (
        currency.code.toLowerCase().includes(query) ||
        currency.symbol.toLowerCase().includes(query)
      );
    });
  }, [currencies, currencySearch]);

  const renderCurrencyItem = ({ item }: { item: CurrencyOption }) => {
    const selected = item.code === currencyCode;
    return (
      <Pressable
        style={[styles.currencyRow, selected && styles.currencyRowActive]}
        onPress={() => {
          setCurrencyCode(item.code);
          setCurrencyModalVisible(false);
        }}
      >
        <Text style={styles.currencyRowCode}>{item.code}</Text>
        <Text style={styles.currencyRowLabel}>{item.label}</Text>
      </Pressable>
    );
  };

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
      <CardHeader title="Loan Inputs" subtitle="Enter values to calculate repayments." />

      <Text style={styles.label}>Currency</Text>
      <Pressable
        style={styles.currencySelectButton}
        onPress={() => setCurrencyModalVisible(true)}
      >
        <Text style={styles.currencySelectText}>
          {currencyCode} ({moneySymbol})
        </Text>
      </Pressable>

      <Text style={styles.label}>Amount Borrowed</Text>
      <View style={styles.inputWrap}>
        <Text style={styles.prefixText}>{moneySymbol}</Text>
        <TextInput
          keyboardType="decimal-pad"
          value={amountBorrowed}
          onChangeText={setAmountBorrowed}
          style={styles.input}
          placeholder="e.g. 500000"
        />
      </View>

      <Text style={styles.label}>Interest Rate (% per year)</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={interestRate}
        onChangeText={setInterestRate}
        style={styles.simpleInput}
        placeholder="e.g. 6.25%"
      />

      <Text style={styles.label}>Repayment Frequency</Text>
      <FrequencySelector value={repaymentFrequency} onChange={setRepaymentFrequency} />

      <Text style={styles.label}>Loan Length (years)</Text>
      <TextInput
        keyboardType="decimal-pad"
        value={loanLengthYears}
        onChangeText={setLoanLengthYears}
        style={styles.simpleInput}
        placeholder="e.g. 30"
      />

      <Text style={styles.label}>Account Fee (per fee event)</Text>
      <View style={styles.inputWrap}>
        <Text style={styles.prefixText}>{moneySymbol}</Text>
        <TextInput
          keyboardType="decimal-pad"
          value={accountFee}
          onChangeText={setAccountFee}
          style={styles.input}
          placeholder="e.g. 10"
        />
      </View>

      <Text style={styles.label}>Account Fee Frequency</Text>
      <FrequencySelector value={accountFeeFrequency} onChange={setAccountFeeFrequency} />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Enable Extra Repayment</Text>
        <Switch value={extraEnabled} onValueChange={setExtraEnabled} />
      </View>

      {extraEnabled ? (
        <View>
          <Text style={styles.label}>Extra Repayment Amount</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.prefixText}>{moneySymbol}</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={extraAmount}
              onChangeText={setExtraAmount}
              style={styles.input}
              placeholder="e.g. 250"
            />
          </View>

          <Text style={styles.label}>Extra Repayment Frequency</Text>
          <FrequencySelector value={extraFrequency} onChange={setExtraFrequency} />

          <Text style={styles.label}>Start Extra After N Repayment Periods</Text>
          <TextInput
            keyboardType="number-pad"
            value={extraStartAfter}
            onChangeText={setExtraStartAfter}
            style={styles.simpleInput}
            placeholder="e.g. 12"
          />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable style={styles.calculateButton} onPress={submit}>
        <Text style={styles.calculateButtonText}>Calculate</Text>
      </Pressable>

      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Select Currency</Text>
          <TextInput
            style={styles.modalSearch}
            placeholder="Search currency code or symbol"
            value={currencySearch}
            onChangeText={setCurrencySearch}
          />
          <FlatList
            data={filteredCurrencies}
            keyExtractor={(item) => item.code}
            renderItem={renderCurrencyItem}
            contentContainerStyle={styles.currencyList}
          />
          <Pressable
            style={styles.modalCloseButton}
            onPress={() => setCurrencyModalVisible(false)}
          >
            <Text style={styles.modalCloseText}>Close</Text>
          </Pressable>
        </View>
      </Modal>
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
  label: {
    marginBottom: 6,
    marginTop: 10,
    color: "#374151",
    fontWeight: "600",
  },
  input: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#f9fafb",
  },
  simpleInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: "#f9fafb",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    backgroundColor: "#f9fafb",
  },
  prefixText: {
    paddingLeft: 12,
    fontSize: 15,
    color: "#111827",
    fontWeight: "700",
  },
  currencySelectButton: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
  },
  currencySelectText: {
    color: "#111827",
    fontWeight: "600",
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
  modalContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 16,
    paddingTop: 56,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  modalSearch: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  currencyList: {
    paddingBottom: 16,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  currencyRowActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  currencyRowCode: {
    width: 56,
    fontWeight: "700",
    color: "#111827",
  },
  currencyRowLabel: {
    color: "#374151",
    flex: 1,
  },
  modalCloseButton: {
    borderRadius: 10,
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  modalCloseText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
