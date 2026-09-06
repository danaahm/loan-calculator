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

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import {
  FREQUENCIES,
  type ExtraRepaymentStartUnit,
  type LoanInput,
  type RepaymentFrequency,
} from "../types/loan";
import {
  composeLoanYears,
  decomposeLoanYears,
  getAvailableCurrencies,
  getCurrencySymbol,
  type CurrencyOption,
  formatFrequencyLabel,
} from "../utils/format";
import { CardHeader } from "./CardHeader";

type FormStyles = ReturnType<typeof createStyles>;

interface LoanFormProps {
  initialValue: LoanInput;
  /** Fires on every field change so the sticky Calculate bar can react. */
  onDraftChange: (value: LoanInput) => void;
}

const parsePositiveNumber = (value: string): number => {
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

const digitsOnly = (value: string): string => value.replace(/[^0-9]/g, "");

/** Digits only, capped at `max`, and blank is allowed while editing. */
const clampWholeNumberInput = (value: string, max?: number): string => {
  const digits = digitsOnly(value).replace(/^0+(?=\d)/, "");
  if (digits === "") {
    return "";
  }
  if (max !== undefined && Number(digits) > max) {
    return String(max);
  }
  return digits;
};

const parsePositiveInt = (value: string): number => {
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
};

const defaultOffsetContribution = (value: LoanInput) =>
  value.offsetSavings.contribution ?? {
    enabled: false,
    amount: 0,
    frequency: "monthly" as RepaymentFrequency,
  };

/** Zero means "not filled in yet", so show an empty field rather than "0". */
const blankIfZero = (value: number): string => (value > 0 ? String(value) : "");

const formatGroupedNumberInput = (value: string): string => {
  const cleaned = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  if (!cleaned) {
    return "";
  }

  const firstDotIndex = cleaned.indexOf(".");
  const integerRaw =
    firstDotIndex >= 0 ? cleaned.slice(0, firstDotIndex) : cleaned;
  const decimalRaw =
    firstDotIndex >= 0 ? cleaned.slice(firstDotIndex + 1).replace(/\./g, "") : "";

  const integerPart = integerRaw.replace(/^0+(?=\d)/, "") || "0";
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (firstDotIndex >= 0) {
    return `${groupedInteger}.${decimalRaw}`;
  }
  return groupedInteger;
};

const FrequencySelector = ({
  value,
  onChange,
  styles,
}: {
  value: RepaymentFrequency;
  onChange: (next: RepaymentFrequency) => void;
  styles: FormStyles;
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

export const LoanForm = ({ initialValue, onDraftChange }: LoanFormProps) => {
  const { colors } = useTheme();
  const t = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [collapsed, setCollapsed] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const currencies = useMemo(() => getAvailableCurrencies(), []);

  const [amountBorrowed, setAmountBorrowed] = useState(
    formatGroupedNumberInput(blankIfZero(initialValue.amountBorrowed))
  );
  const [currencyCode, setCurrencyCode] = useState(initialValue.currencyCode);
  const [interestRate, setInterestRate] = useState(
    blankIfZero(initialValue.annualInterestRatePercent)
  );
  const [loanLengthYears, setLoanLengthYears] = useState(
    blankIfZero(decomposeLoanYears(initialValue.loanLengthYears).years)
  );
  const [loanLengthMonths, setLoanLengthMonths] = useState(
    blankIfZero(decomposeLoanYears(initialValue.loanLengthYears).months)
  );
  const [accountFeeEnabled, setAccountFeeEnabled] = useState(
    initialValue.accountFeeEnabled
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
    formatGroupedNumberInput(String(initialValue.extraRepayment.amount))
  );
  const [extraFrequency, setExtraFrequency] = useState(
    initialValue.extraRepayment.frequency
  );
  const [extraStartAfter, setExtraStartAfter] = useState(
    String(initialValue.extraRepayment.startAfterValue)
  );
  const [extraStartAfterUnit, setExtraStartAfterUnit] =
    useState<ExtraRepaymentStartUnit>(initialValue.extraRepayment.startAfterUnit);
  const [lumpSumEnabled, setLumpSumEnabled] = useState(initialValue.lumpSum.enabled);
  const [lumpSumAmount, setLumpSumAmount] = useState(
    formatGroupedNumberInput(String(initialValue.lumpSum.amount))
  );
  const [offsetEnabled, setOffsetEnabled] = useState(initialValue.offsetSavings.enabled);
  const [offsetAmount, setOffsetAmount] = useState(
    formatGroupedNumberInput(String(initialValue.offsetSavings.amount))
  );
  const [offsetContributionEnabled, setOffsetContributionEnabled] = useState(
    defaultOffsetContribution(initialValue).enabled
  );
  const [offsetContributionAmount, setOffsetContributionAmount] = useState(
    formatGroupedNumberInput(
      String(defaultOffsetContribution(initialValue).amount || 0)
    )
  );
  const [offsetContributionFrequency, setOffsetContributionFrequency] =
    useState<RepaymentFrequency>(defaultOffsetContribution(initialValue).frequency);

  useEffect(() => {
    setCurrencyCode(initialValue.currencyCode);
    setAmountBorrowed(formatGroupedNumberInput(blankIfZero(initialValue.amountBorrowed)));
    setInterestRate(blankIfZero(initialValue.annualInterestRatePercent));
    const loanLength = decomposeLoanYears(initialValue.loanLengthYears);
    setLoanLengthYears(blankIfZero(loanLength.years));
    setLoanLengthMonths(blankIfZero(loanLength.months));
    setAccountFeeEnabled(initialValue.accountFeeEnabled);
    setAccountFee(String(initialValue.accountFee));
    setRepaymentFrequency(initialValue.repaymentFrequency);
    setAccountFeeFrequency(initialValue.accountFeeFrequency);
    setExtraEnabled(initialValue.extraRepayment.enabled);
    setExtraAmount(formatGroupedNumberInput(String(initialValue.extraRepayment.amount)));
    setExtraFrequency(initialValue.extraRepayment.frequency);
    setExtraStartAfter(String(initialValue.extraRepayment.startAfterValue));
    setExtraStartAfterUnit(initialValue.extraRepayment.startAfterUnit);
    setLumpSumEnabled(initialValue.lumpSum.enabled);
    setLumpSumAmount(formatGroupedNumberInput(String(initialValue.lumpSum.amount)));
    setOffsetEnabled(initialValue.offsetSavings.enabled);
    setOffsetAmount(
      formatGroupedNumberInput(String(initialValue.offsetSavings.amount))
    );
    setOffsetContributionEnabled(defaultOffsetContribution(initialValue).enabled);
    setOffsetContributionAmount(
      formatGroupedNumberInput(
        String(defaultOffsetContribution(initialValue).amount || 0)
      )
    );
    setOffsetContributionFrequency(defaultOffsetContribution(initialValue).frequency);
  }, [initialValue]);

  const fieldValue = useMemo<LoanInput>(() => {
    return {
      currencyCode,
      amountBorrowed: parsePositiveNumber(amountBorrowed),
      annualInterestRatePercent: parsePositiveNumber(interestRate),
      repaymentFrequency,
      loanLengthYears: composeLoanYears(
        parsePositiveInt(loanLengthYears),
        parsePositiveInt(loanLengthMonths)
      ),
      accountFeeEnabled,
      accountFee: parsePositiveNumber(accountFee),
      accountFeeFrequency,
      extraRepayment: {
        enabled: extraEnabled,
        amount: parsePositiveNumber(extraAmount),
        frequency: extraFrequency,
        startAfterValue: parsePositiveInt(extraStartAfter),
        startAfterUnit: extraStartAfterUnit,
      },
      lumpSum: {
        enabled: lumpSumEnabled,
        amount: parsePositiveNumber(lumpSumAmount),
      },
      offsetSavings: {
        enabled: offsetEnabled,
        amount: parsePositiveNumber(offsetAmount),
        contribution: {
          enabled: offsetContributionEnabled,
          amount: parsePositiveNumber(offsetContributionAmount),
          frequency: offsetContributionFrequency,
        },
      },
    };
  }, [
    accountFee,
    accountFeeEnabled,
    accountFeeFrequency,
    amountBorrowed,
    currencyCode,
    extraAmount,
    extraEnabled,
    extraFrequency,
    extraStartAfter,
    extraStartAfterUnit,
    lumpSumAmount,
    lumpSumEnabled,
    interestRate,
    loanLengthMonths,
    loanLengthYears,
    offsetAmount,
    offsetContributionAmount,
    offsetContributionEnabled,
    offsetContributionFrequency,
    offsetEnabled,
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

  // Publish the live draft upward so the sticky Calculate bar can enable
  // itself. Runs only when a parsed field actually changes, not per keystroke.
  useEffect(() => {
    onDraftChange(fieldValue);
  }, [fieldValue, onDraftChange]);

  return (
    <View style={styles.card}>
      <CardHeader
        title={t("loanForm.title")}
        subtitle={t("loanForm.subtitle")}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
      />

      {!collapsed ? (
        <View>
          <Text style={styles.label}>{t("loanForm.currency")}</Text>
          <Pressable
            style={styles.currencySelectButton}
            onPress={() => setCurrencyModalVisible(true)}
          >
            <Text style={styles.currencySelectText}>
              {currencyCode} ({moneySymbol})
            </Text>
          </Pressable>

          <Text style={styles.label}>{t("loanForm.amountBorrowed")}</Text>
          <View style={styles.inputWrap}>
            <Text style={styles.prefixText}>{moneySymbol}</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={amountBorrowed}
          onChangeText={(value) => setAmountBorrowed(formatGroupedNumberInput(value))}
              style={styles.input}
              placeholder={t("loanForm.amountPlaceholder")}
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={styles.label}>{t("loanForm.interestRate")}</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={interestRate}
            onChangeText={setInterestRate}
            style={styles.simpleInput}
            placeholder={t("loanForm.interestPlaceholder")}
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>{t("loanForm.repaymentFrequency")}</Text>
          <FrequencySelector
            value={repaymentFrequency}
            onChange={setRepaymentFrequency}
            styles={styles}
          />

          <Text style={styles.label}>{t("loanForm.loanLength")}</Text>
          <View style={styles.loanLengthRow}>
            <View style={styles.startAfterInputWrap}>
              <TextInput
                keyboardType="number-pad"
                value={loanLengthYears}
                onChangeText={(value) =>
                  setLoanLengthYears(clampWholeNumberInput(value))
                }
                style={styles.simpleInput}
                placeholder={t("loanForm.yearsPlaceholder")}
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldUnitText}>{t("loanForm.unitYears")}</Text>
            </View>
            <View style={styles.startAfterInputWrap}>
              <TextInput
                keyboardType="number-pad"
                value={loanLengthMonths}
                onChangeText={(value) =>
                  setLoanLengthMonths(clampWholeNumberInput(value, 11))
                }
                style={styles.simpleInput}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={styles.fieldUnitText}>{t("loanForm.unitMonthsOptional")}</Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("loanForm.enableAccountFee")}</Text>
            <Switch
              value={accountFeeEnabled}
              onValueChange={setAccountFeeEnabled}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          <Text style={styles.hintText}>
            {t("loanForm.accountFeeHint")}
          </Text>

          {accountFeeEnabled ? (
            <View>
              <Text style={styles.label}>{t("loanForm.accountFee")}</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.prefixText}>{moneySymbol}</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={accountFee}
                  onChangeText={setAccountFee}
                  style={styles.input}
                  placeholder={t("loanForm.accountFeePlaceholder")}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Text style={styles.label}>{t("loanForm.accountFeeFrequency")}</Text>
              <FrequencySelector
                value={accountFeeFrequency}
                onChange={setAccountFeeFrequency}
                styles={styles}
              />
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("loanForm.enableExtra")}</Text>
            <Switch
              value={extraEnabled}
              onValueChange={setExtraEnabled}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>

          {extraEnabled ? (
            <View>
              <Text style={styles.label}>{t("loanForm.extraAmount")}</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.prefixText}>{moneySymbol}</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={extraAmount}
                  onChangeText={(value) => setExtraAmount(formatGroupedNumberInput(value))}
                  style={styles.input}
                  placeholder={t("loanForm.extraPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Text style={styles.label}>{t("loanForm.extraFrequency")}</Text>
              <FrequencySelector
                value={extraFrequency}
                onChange={setExtraFrequency}
                styles={styles}
              />

              <Text style={styles.label}>{t("loanForm.startExtraAfter")}</Text>
              <View style={styles.startAfterRow}>
                <View style={styles.startAfterInputWrap}>
                  <TextInput
                    keyboardType="number-pad"
                    value={extraStartAfter}
                    onChangeText={setExtraStartAfter}
                    style={styles.simpleInput}
                    placeholder={t("loanForm.startAfterPlaceholder")}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.startAfterToggle}>
                  <Pressable
                    style={[
                      styles.startAfterToggleButton,
                      extraStartAfterUnit === "months" &&
                        styles.startAfterToggleButtonActive,
                    ]}
                    onPress={() => setExtraStartAfterUnit("months")}
                  >
                    <Text
                      style={[
                        styles.startAfterToggleText,
                        extraStartAfterUnit === "months" &&
                          styles.startAfterToggleTextActive,
                      ]}
                    >
                      {t("loanForm.unitMonths")}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.startAfterToggleButton,
                      extraStartAfterUnit === "years" &&
                        styles.startAfterToggleButtonActive,
                    ]}
                    onPress={() => setExtraStartAfterUnit("years")}
                  >
                    <Text
                      style={[
                        styles.startAfterToggleText,
                        extraStartAfterUnit === "years" &&
                          styles.startAfterToggleTextActive,
                      ]}
                    >
                      {t("loanForm.unitYears")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("loanForm.enableLumpSum")}</Text>
            <Switch
              value={lumpSumEnabled}
              onValueChange={setLumpSumEnabled}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          <Text style={styles.hintText}>
            {t("loanForm.lumpSumHint")}
          </Text>
          {lumpSumEnabled ? (
            <View>
              <Text style={styles.label}>{t("loanForm.lumpSumAmount")}</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.prefixText}>{moneySymbol}</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={lumpSumAmount}
                  onChangeText={(value) => setLumpSumAmount(formatGroupedNumberInput(value))}
                  style={styles.input}
                  placeholder={t("loanForm.lumpSumPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("loanForm.enableOffset")}</Text>
            <Switch
              value={offsetEnabled}
              onValueChange={setOffsetEnabled}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          <Text style={styles.hintText}>
            {t("loanForm.offsetHint")}
          </Text>
          {offsetEnabled ? (
            <View>
              <Text style={styles.label}>{t("loanForm.offsetAmount")}</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.prefixText}>{moneySymbol}</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={offsetAmount}
                  onChangeText={(value) => setOffsetAmount(formatGroupedNumberInput(value))}
                  style={styles.input}
                  placeholder={t("loanForm.offsetPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>{t("loanForm.offsetDeposit")}</Text>
                <Switch
                  value={offsetContributionEnabled}
                  onValueChange={setOffsetContributionEnabled}
                  trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                  thumbColor={colors.switchThumb}
                />
              </View>
              <Text style={styles.hintText}>
                {t("loanForm.offsetDepositHint")}
              </Text>
              {offsetContributionEnabled ? (
                <View>
                  <Text style={styles.label}>{t("loanForm.offsetDepositAmount")}</Text>
                  <View style={styles.inputWrap}>
                    <Text style={styles.prefixText}>{moneySymbol}</Text>
                    <TextInput
                      keyboardType="decimal-pad"
                      value={offsetContributionAmount}
                      onChangeText={(value) =>
                        setOffsetContributionAmount(formatGroupedNumberInput(value))
                      }
                      style={styles.input}
                      placeholder={t("loanForm.offsetDepositPlaceholder")}
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                  <Text style={styles.label}>{t("loanForm.offsetDepositFrequency")}</Text>
                  <FrequencySelector
                    value={offsetContributionFrequency}
                    onChange={setOffsetContributionFrequency}
                    styles={styles}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

        </View>
      ) : null}

      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{t("loanForm.selectCurrency")}</Text>
          <TextInput
            style={styles.modalSearch}
            placeholder={t("loanForm.currencySearchPlaceholder")}
            placeholderTextColor={colors.textMuted}
            value={currencySearch}
            onChangeText={setCurrencySearch}
          />
          {currencySearch.trim().length > 0 ? (
            <Pressable
              style={styles.clearSearchButton}
              onPress={() => setCurrencySearch("")}
            >
              <Text style={styles.clearSearchButtonText}>{t("loanForm.clearFilter")}</Text>
            </Pressable>
          ) : null}
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
            <Text style={styles.modalCloseText}>{t("common.close")}</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 16,
      marginBottom: 16,
    },
    label: {
      marginBottom: 6,
      marginTop: 10,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    input: {
      flex: 1,
      borderWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      backgroundColor: "transparent",
      color: colors.text,
    },
    simpleInput: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      backgroundColor: colors.inputBg,
      color: colors.text,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      backgroundColor: colors.inputBg,
      overflow: "hidden",
    },
    prefixText: {
      paddingLeft: 12,
      fontSize: 15,
      color: colors.text,
      fontWeight: "700",
    },
    currencySelectButton: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.inputBg,
    },
    currencySelectText: {
      color: colors.text,
      fontWeight: "600",
    },
    frequencyWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    frequencyButton: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBg,
    },
    frequencyButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    frequencyText: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    frequencyTextActive: {
      color: colors.accentTextDeep,
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
      color: colors.text,
      fontWeight: "600",
      flex: 1,
      paddingRight: 12,
    },
    hintText: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 16,
      color: colors.textMuted,
      fontWeight: "600",
    },
    startAfterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    startAfterInputWrap: {
      flex: 1,
    },
    loanLengthRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    fieldUnitText: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: "600",
    },
    startAfterToggle: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      overflow: "hidden",
    },
    startAfterToggleButton: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.inputBg,
    },
    startAfterToggleButtonActive: {
      backgroundColor: colors.primarySoft,
    },
    startAfterToggleText: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
    startAfterToggleTextActive: {
      color: colors.accentTextDeep,
      fontWeight: "700",
    },
    modalContainer: {
      flex: 1,
      backgroundColor: colors.card,
      padding: 16,
      paddingTop: 56,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 12,
    },
    modalSearch: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
      color: colors.text,
      backgroundColor: colors.inputBg,
    },
    clearSearchButton: {
      alignSelf: "flex-end",
      marginTop: -4,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: colors.inputBg,
    },
    clearSearchButtonText: {
      color: colors.textSecondary,
      fontWeight: "700",
      fontSize: 12,
    },
    currencyList: {
      paddingBottom: 16,
    },
    currencyRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
    },
    currencyRowActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    currencyRowCode: {
      width: 56,
      fontWeight: "700",
      color: colors.text,
    },
    currencyRowLabel: {
      color: colors.textSecondary,
      flex: 1,
    },
    modalCloseButton: {
      borderRadius: 10,
      backgroundColor: colors.primary,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 8,
    },
    modalCloseText: {
      color: colors.textInverse,
      fontWeight: "700",
    },
  });
