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
import { addMonthsClamped, parseIsoDate, todayLocalIso } from "../utils/dateIso";
import { loanYearsBetween } from "../utils/loanMath";
import {
  formatGroupedNumberInput,
  formatGroupedNumberValue,
  formatGroupedNumberValueOrBlank,
  formatNumberForInput,
  formatNumberForInputOrBlank,
  formatPlainNumberInput,
} from "../utils/numberInput";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import {
  FREQUENCIES,
  type ExtraRepaymentStartUnit,
  type LoanInput,
  type LoanTermMode,
  type RateChange,
  type RepaymentFrequency,
} from "../types/loan";
import {
  composeLoanYears,
  decomposeLoanYears,
  getAvailableCurrencies,
  getCurrencySymbol,
  type CurrencyOption,
  formatFrequencyLabel,
  formatLoanLengthLabel,
} from "../utils/format";
import { CardHeader } from "./CardHeader";
import { CollapsibleSection } from "./CollapsibleSection";
import { DatePickerField } from "./DatePickerField";
import { ModalPage } from "./ModalPage";

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

/** A rate change as typed, before parsing. */
interface RateChangeDraft {
  id: string;
  startAfter: string;
  startAfterUnit: ExtraRepaymentStartUnit;
  rate: string;
}

const toRateChangeDrafts = (value: LoanInput): RateChangeDraft[] =>
  value.rateChanges.changes.map((change) => ({
    id: change.id,
    startAfter: formatNumberForInputOrBlank(change.startAfterValue, 0),
    startAfterUnit: change.startAfterUnit,
    rate: formatNumberForInput(change.annualInterestRatePercent),
  }));

const parseRateChangeDraft = (draft: RateChangeDraft): RateChange => ({
  id: draft.id,
  startAfterValue: parsePositiveInt(draft.startAfter),
  startAfterUnit: draft.startAfterUnit,
  annualInterestRatePercent: parsePositiveNumber(draft.rate),
});

const newRateChangeDraft = (): RateChangeDraft => ({
  id: `rate-change-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  startAfter: "",
  startAfterUnit: "years",
  rate: "",
});

const StartAfterUnitToggle = ({
  value,
  onChange,
  styles,
}: {
  value: ExtraRepaymentStartUnit;
  onChange: (next: ExtraRepaymentStartUnit) => void;
  styles: FormStyles;
}) => {
  const t = useTranslation();
  return (
    <View style={styles.startAfterToggle}>
      {(["months", "years"] as const).map((unit) => (
        <Pressable
          key={unit}
          style={[
            styles.startAfterToggleButton,
            value === unit && styles.startAfterToggleButtonActive,
          ]}
          onPress={() => onChange(unit)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === unit }}
        >
          <Text
            style={[
              styles.startAfterToggleText,
              value === unit && styles.startAfterToggleTextActive,
            ]}
          >
            {t(unit === "months" ? "loanForm.unitMonths" : "loanForm.unitYears")}
          </Text>
        </Pressable>
      ))}
    </View>
  );
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
    formatGroupedNumberValueOrBlank(initialValue.amountBorrowed)
  );
  const [currencyCode, setCurrencyCode] = useState(initialValue.currencyCode);
  const [interestRate, setInterestRate] = useState(
    formatNumberForInputOrBlank(initialValue.annualInterestRatePercent)
  );
  const [loanLengthYears, setLoanLengthYears] = useState(
    formatNumberForInputOrBlank(decomposeLoanYears(initialValue.loanLengthYears).years)
  );
  const [loanLengthMonths, setLoanLengthMonths] = useState(
    formatNumberForInputOrBlank(decomposeLoanYears(initialValue.loanLengthYears).months)
  );
  const [loanTermMode, setLoanTermMode] = useState<LoanTermMode>(
    initialValue.loanTermMode
  );
  const [rateChangesEnabled, setRateChangesEnabled] = useState(
    initialValue.rateChanges.enabled
  );
  const [rateChangeDrafts, setRateChangeDrafts] = useState(() =>
    toRateChangeDrafts(initialValue)
  );
  const [interestOnlyEnabled, setInterestOnlyEnabled] = useState(
    initialValue.interestOnly.enabled
  );
  const [interestOnlyLength, setInterestOnlyLength] = useState(
    formatNumberForInputOrBlank(initialValue.interestOnly.lengthValue, 0)
  );
  const [interestOnlyUnit, setInterestOnlyUnit] = useState<ExtraRepaymentStartUnit>(
    initialValue.interestOnly.lengthUnit
  );
  const [loanStartDate, setLoanStartDate] = useState(
    initialValue.loanStartDate ?? todayLocalIso()
  );
  const [loanEndDate, setLoanEndDate] = useState<string | null>(
    initialValue.loanEndDate
  );
  const [accountFeeEnabled, setAccountFeeEnabled] = useState(
    initialValue.accountFeeEnabled
  );
  const [accountFee, setAccountFee] = useState(formatNumberForInput(initialValue.accountFee));
  const [repaymentFrequency, setRepaymentFrequency] = useState(
    initialValue.repaymentFrequency
  );
  const [accountFeeFrequency, setAccountFeeFrequency] = useState(
    initialValue.accountFeeFrequency
  );
  const [extraEnabled, setExtraEnabled] = useState(initialValue.extraRepayment.enabled);
  const [extraAmount, setExtraAmount] = useState(
    formatGroupedNumberValue(initialValue.extraRepayment.amount)
  );
  const [extraFrequency, setExtraFrequency] = useState(
    initialValue.extraRepayment.frequency
  );
  const [extraStartAfter, setExtraStartAfter] = useState(
    formatNumberForInput(initialValue.extraRepayment.startAfterValue, 0)
  );
  const [extraStartAfterUnit, setExtraStartAfterUnit] =
    useState<ExtraRepaymentStartUnit>(initialValue.extraRepayment.startAfterUnit);
  const [lumpSumEnabled, setLumpSumEnabled] = useState(initialValue.lumpSum.enabled);
  const [lumpSumAmount, setLumpSumAmount] = useState(
    formatGroupedNumberValue(initialValue.lumpSum.amount)
  );
  const [offsetEnabled, setOffsetEnabled] = useState(initialValue.offsetSavings.enabled);
  const [offsetAmount, setOffsetAmount] = useState(
    formatGroupedNumberValue(initialValue.offsetSavings.amount)
  );
  const [offsetContributionEnabled, setOffsetContributionEnabled] = useState(
    defaultOffsetContribution(initialValue).enabled
  );
  const [offsetContributionAmount, setOffsetContributionAmount] = useState(
    formatGroupedNumberValue(defaultOffsetContribution(initialValue).amount || 0)
  );
  const [offsetContributionFrequency, setOffsetContributionFrequency] =
    useState<RepaymentFrequency>(defaultOffsetContribution(initialValue).frequency);

  useEffect(() => {
    setCurrencyCode(initialValue.currencyCode);
    setAmountBorrowed(formatGroupedNumberValueOrBlank(initialValue.amountBorrowed));
    setInterestRate(formatNumberForInputOrBlank(initialValue.annualInterestRatePercent));
    const loanLength = decomposeLoanYears(initialValue.loanLengthYears);
    setLoanLengthYears(formatNumberForInputOrBlank(loanLength.years));
    setLoanLengthMonths(formatNumberForInputOrBlank(loanLength.months));
    setLoanTermMode(initialValue.loanTermMode);
    setRateChangesEnabled(initialValue.rateChanges.enabled);
    setRateChangeDrafts(toRateChangeDrafts(initialValue));
    setInterestOnlyEnabled(initialValue.interestOnly.enabled);
    setInterestOnlyLength(
      formatNumberForInputOrBlank(initialValue.interestOnly.lengthValue, 0)
    );
    setInterestOnlyUnit(initialValue.interestOnly.lengthUnit);
    setLoanStartDate(initialValue.loanStartDate ?? todayLocalIso());
    setLoanEndDate(initialValue.loanEndDate);
    setAccountFeeEnabled(initialValue.accountFeeEnabled);
    setAccountFee(formatNumberForInput(initialValue.accountFee));
    setRepaymentFrequency(initialValue.repaymentFrequency);
    setAccountFeeFrequency(initialValue.accountFeeFrequency);
    setExtraEnabled(initialValue.extraRepayment.enabled);
    setExtraAmount(formatGroupedNumberValue(initialValue.extraRepayment.amount));
    setExtraFrequency(initialValue.extraRepayment.frequency);
    setExtraStartAfter(formatNumberForInput(initialValue.extraRepayment.startAfterValue, 0));
    setExtraStartAfterUnit(initialValue.extraRepayment.startAfterUnit);
    setLumpSumEnabled(initialValue.lumpSum.enabled);
    setLumpSumAmount(formatGroupedNumberValue(initialValue.lumpSum.amount));
    setOffsetEnabled(initialValue.offsetSavings.enabled);
    setOffsetAmount(
      formatGroupedNumberValue(initialValue.offsetSavings.amount)
    );
    setOffsetContributionEnabled(defaultOffsetContribution(initialValue).enabled);
    setOffsetContributionAmount(
      formatGroupedNumberValue(defaultOffsetContribution(initialValue).amount || 0)
    );
    setOffsetContributionFrequency(defaultOffsetContribution(initialValue).frequency);
  }, [initialValue]);

  const termFromLength = composeLoanYears(
    parsePositiveInt(loanLengthYears),
    parsePositiveInt(loanLengthMonths)
  );
  const termFromDates = loanYearsBetween(loanStartDate, loanEndDate);

  // Carry the term across when switching, so neither mode starts blank.
  const changeTermMode = (next: LoanTermMode) => {
    if (next === loanTermMode) {
      return;
    }
    if (next === "endDate" && !loanEndDate && termFromLength > 0) {
      setLoanEndDate(
        addMonthsClamped(
          loanStartDate,
          Math.round(termFromLength * 12),
          parseIsoDate(loanStartDate).getDate()
        )
      );
    }
    if (next === "length" && termFromDates > 0) {
      const parts = decomposeLoanYears(termFromDates);
      setLoanLengthYears(formatNumberForInputOrBlank(parts.years));
      setLoanLengthMonths(formatNumberForInputOrBlank(parts.months));
    }
    setLoanTermMode(next);
  };

  // Switching on with nothing entered opens a blank change, so the section is
  // never an empty heading.
  const toggleRateChanges = (next: boolean) => {
    setRateChangesEnabled(next);
    if (next && rateChangeDrafts.length === 0) {
      setRateChangeDrafts([newRateChangeDraft()]);
    }
  };

  const updateRateChange = (id: string, patch: Partial<RateChangeDraft>) => {
    setRateChangeDrafts((drafts) =>
      drafts.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft))
    );
  };

  const fieldValue = useMemo<LoanInput>(() => {
    return {
      currencyCode,
      amountBorrowed: parsePositiveNumber(amountBorrowed),
      annualInterestRatePercent: parsePositiveNumber(interestRate),
      rateChanges: {
        enabled: rateChangesEnabled,
        changes: rateChangeDrafts.map(parseRateChangeDraft),
      },
      interestOnly: {
        enabled: interestOnlyEnabled,
        lengthValue: parsePositiveInt(interestOnlyLength),
        lengthUnit: interestOnlyUnit,
      },
      repaymentFrequency,
      loanLengthYears:
        loanTermMode === "endDate" ? termFromDates : termFromLength,
      loanTermMode,
      loanStartDate: loanTermMode === "endDate" ? loanStartDate : null,
      loanEndDate: loanTermMode === "endDate" ? loanEndDate : null,
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
    interestOnlyEnabled,
    interestOnlyLength,
    interestOnlyUnit,
    interestRate,
    loanEndDate,
    loanStartDate,
    loanTermMode,
    offsetAmount,
    offsetContributionAmount,
    offsetContributionEnabled,
    offsetContributionFrequency,
    offsetEnabled,
    rateChangeDrafts,
    rateChangesEnabled,
    repaymentFrequency,
    termFromDates,
    termFromLength,
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

      <CollapsibleSection collapsed={collapsed}>
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
            onChangeText={(value) => setInterestRate(formatPlainNumberInput(value))}
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
          <View style={[styles.startAfterToggle, styles.termModeToggle]}>
            {(["length", "endDate"] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[
                  styles.startAfterToggleButton,
                  styles.termModeButton,
                  loanTermMode === mode && styles.startAfterToggleButtonActive,
                ]}
                onPress={() => changeTermMode(mode)}
                accessibilityRole="button"
                accessibilityState={{ selected: loanTermMode === mode }}
              >
                <Text
                  style={[
                    styles.startAfterToggleText,
                    loanTermMode === mode && styles.startAfterToggleTextActive,
                  ]}
                >
                  {t(mode === "length" ? "loanForm.termByLength" : "loanForm.termByEndDate")}
                </Text>
              </Pressable>
            ))}
          </View>
          {loanTermMode === "endDate" ? (
            <View>
              <Text style={styles.label}>{t("loanForm.loanStartDate")}</Text>
              <DatePickerField value={loanStartDate} onChange={setLoanStartDate} />
              <Text style={styles.label}>{t("loanForm.loanEndDate")}</Text>
              <DatePickerField
                value={loanEndDate}
                onChange={setLoanEndDate}
                placeholderKey="loanForm.loanEndDatePlaceholder"
                minimumDate={parseIsoDate(loanStartDate)}
              />
              <Text style={styles.hintText}>
                {termFromDates > 0
                  ? t("loanForm.termFromDates", {
                      term: formatLoanLengthLabel(termFromDates),
                    })
                  : t("loanForm.endDateHint")}
              </Text>
            </View>
          ) : (
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
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("loanForm.rateChangesToggle")}</Text>
            <Switch
              value={rateChangesEnabled}
              onValueChange={toggleRateChanges}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          {rateChangesEnabled ? (
            <View>
              <Text style={styles.hintText}>{t("loanForm.rateChangesHint")}</Text>
              {rateChangeDrafts.map((draft, index) => (
                <View key={draft.id} style={styles.rateChangeBlock}>
                  <View style={styles.rateChangeHeader}>
                    <Text style={styles.rateChangeTitle}>
                      {t("loanForm.rateChangeTitle", { number: index + 1 })}
                    </Text>
                    <Pressable
                      onPress={() =>
                        setRateChangeDrafts((drafts) =>
                          drafts.filter((item) => item.id !== draft.id)
                        )
                      }
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t("loanForm.rateChangeRemoveLabel", {
                        number: index + 1,
                      })}
                    >
                      <Text style={styles.rateChangeRemoveText}>
                        {t("loanForm.rateChangeRemove")}
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.label}>{t("loanForm.rateChangeAfter")}</Text>
                  <View style={styles.startAfterRow}>
                    <View style={styles.startAfterInputWrap}>
                      <TextInput
                        keyboardType="number-pad"
                        value={draft.startAfter}
                        onChangeText={(value) =>
                          updateRateChange(draft.id, {
                            startAfter: formatPlainNumberInput(value, 0),
                          })
                        }
                        style={styles.simpleInput}
                        placeholder={t("loanForm.startAfterPlaceholder")}
                        placeholderTextColor={colors.textMuted}
                      />
                    </View>
                    <StartAfterUnitToggle
                      value={draft.startAfterUnit}
                      onChange={(startAfterUnit) =>
                        updateRateChange(draft.id, { startAfterUnit })
                      }
                      styles={styles}
                    />
                  </View>

                  <Text style={styles.label}>{t("loanForm.rateChangeRate")}</Text>
                  <TextInput
                    keyboardType="decimal-pad"
                    value={draft.rate}
                    onChangeText={(value) =>
                      updateRateChange(draft.id, { rate: formatPlainNumberInput(value) })
                    }
                    style={styles.simpleInput}
                    placeholder={t("loanForm.interestPlaceholder")}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              ))}
              <Pressable
                style={styles.addRateChangeButton}
                onPress={() =>
                  setRateChangeDrafts((drafts) => [...drafts, newRateChangeDraft()])
                }
                accessibilityRole="button"
              >
                <Text style={styles.addRateChangeText}>
                  + {t("loanForm.addRateChange")}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("loanForm.interestOnlyToggle")}</Text>
            <Switch
              value={interestOnlyEnabled}
              onValueChange={setInterestOnlyEnabled}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          {interestOnlyEnabled ? (
            <View>
              <Text style={styles.hintText}>{t("loanForm.interestOnlyHint")}</Text>
              <Text style={styles.label}>{t("loanForm.interestOnlyLength")}</Text>
              <View style={styles.startAfterRow}>
                <View style={styles.startAfterInputWrap}>
                  <TextInput
                    keyboardType="number-pad"
                    value={interestOnlyLength}
                    onChangeText={(value) =>
                      setInterestOnlyLength(formatPlainNumberInput(value, 0))
                    }
                    style={styles.simpleInput}
                    placeholder={t("loanForm.interestOnlyPlaceholder")}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <StartAfterUnitToggle
                  value={interestOnlyUnit}
                  onChange={setInterestOnlyUnit}
                  styles={styles}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("loanForm.accountFeeToggle")}</Text>
            <Switch
              value={accountFeeEnabled}
              onValueChange={setAccountFeeEnabled}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          {accountFeeEnabled ? (
            <View>
              <Text style={styles.hintText}>{t("loanForm.accountFeeHint")}</Text>
              <Text style={styles.label}>{t("loanForm.accountFee")}</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.prefixText}>{moneySymbol}</Text>
                <TextInput
                  keyboardType="decimal-pad"
                  value={accountFee}
                  onChangeText={(value) => setAccountFee(formatGroupedNumberInput(value))}
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
            <Text style={styles.switchLabel}>{t("loanForm.extraToggle")}</Text>
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
                    onChangeText={(value) =>
                      setExtraStartAfter(formatPlainNumberInput(value, 0))
                    }
                    style={styles.simpleInput}
                    placeholder={t("loanForm.startAfterPlaceholder")}
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <StartAfterUnitToggle
                  value={extraStartAfterUnit}
                  onChange={setExtraStartAfterUnit}
                  styles={styles}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("loanForm.lumpSumToggle")}</Text>
            <Switch
              value={lumpSumEnabled}
              onValueChange={setLumpSumEnabled}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          {lumpSumEnabled ? (
            <View>
              <Text style={styles.hintText}>{t("loanForm.lumpSumHint")}</Text>
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
            <Text style={styles.switchLabel}>{t("loanForm.offsetToggle")}</Text>
            <Switch
              value={offsetEnabled}
              onValueChange={setOffsetEnabled}
              trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
              thumbColor={colors.switchThumb}
            />
          </View>
          {offsetEnabled ? (
            <View>
              <Text style={styles.hintText}>{t("loanForm.offsetHint")}</Text>
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
              {offsetContributionEnabled ? (
                <View>
                  <Text style={styles.hintText}>{t("loanForm.offsetDepositHint")}</Text>
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
      </CollapsibleSection>

      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <ModalPage style={styles.modalContainer}>
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
        </ModalPage>
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
    rateChangeBlock: {
      marginTop: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
    },
    rateChangeHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    rateChangeTitle: {
      fontSize: 14,
      color: colors.text,
      fontWeight: "700",
    },
    rateChangeRemoveText: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "700",
    },
    addRateChangeButton: {
      alignSelf: "flex-start",
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: colors.primarySoft,
    },
    addRateChangeText: {
      color: colors.accentTextDeep,
      fontWeight: "700",
    },
    termModeToggle: {
      alignSelf: "flex-start",
      marginBottom: 4,
    },
    termModeButton: {
      paddingHorizontal: 16,
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
      backgroundColor: colors.card,
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
