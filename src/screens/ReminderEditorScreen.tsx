import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { DatePickerField } from "../components/DatePickerField";
import { notificationUnavailableHint } from "../notifications/reminderNotifications";
import { useTheme } from "../theme/ThemeProvider";
import { FREQUENCIES, type SavedLoanProfile } from "../types/loan";
import {
  MONTHLY_ANCHORS,
  NOTIFY_LEAD_PRESETS,
  REMINDER_DISCLAIMER,
  formatLeadLabel,
  leadKey,
  type LoanReminder,
  type MonthlyAnchor,
  type NotifyLead,
} from "../types/reminder";
import { formatDisplayDate, parseIsoDate } from "../utils/dateIso";
import {
  formatFrequencyLabel,
  formatMonthAnchorLabel,
  getCurrencySymbol,
} from "../utils/format";
import { draftFromSavedProfile } from "../utils/reminderMath";
import { normalizeCustomDates } from "../utils/reminderSchedule";

interface ReminderEditorScreenProps {
  initialReminder: LoanReminder;
  savedProfiles: SavedLoanProfile[];
  notificationsSupported: boolean;
  onBack: () => void;
  onSave: (reminder: LoanReminder) => void;
  onRequestEnableNotifications: () => Promise<boolean>;
}

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

const parseAmount = (value: string): number => {
  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};

const Chip = ({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.primary : colors.borderStrong,
          backgroundColor: selected ? colors.primarySoft : colors.inputBg,
        },
      ]}
    >
      <Text
        style={{
          color: selected ? colors.accentTextDeep : colors.textSecondary,
          fontWeight: selected ? "700" : "600",
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
};

export const ReminderEditorScreen = ({
  initialReminder,
  savedProfiles,
  notificationsSupported,
  onBack,
  onSave,
  onRequestEnableNotifications,
}: ReminderEditorScreenProps) => {
  const { colors } = useTheme();
  const [name, setName] = useState(initialReminder.name);
  const [linkedProfileId, setLinkedProfileId] = useState(
    initialReminder.linkedProfileId
  );
  const [currencyCode, setCurrencyCode] = useState(initialReminder.currencyCode);
  const [originalAmount, setOriginalAmount] = useState(
    formatGroupedNumberInput(String(initialReminder.originalAmount || ""))
  );
  const [alreadyPaid, setAlreadyPaid] = useState(
    formatGroupedNumberInput(
      String(
        Math.max(0, initialReminder.originalAmount - initialReminder.remainingBalance)
      )
    )
  );
  const [remainingBalance, setRemainingBalance] = useState(
    formatGroupedNumberInput(String(initialReminder.remainingBalance || ""))
  );
  const [interestRate, setInterestRate] = useState(
    String(initialReminder.annualInterestRatePercent || "")
  );
  const [repaymentAmount, setRepaymentAmount] = useState(
    formatGroupedNumberInput(String(initialReminder.repaymentAmount || ""))
  );
  const [repaymentFrequency, setRepaymentFrequency] = useState(
    initialReminder.repaymentFrequency
  );
  const [monthlyAnchor, setMonthlyAnchor] = useState<MonthlyAnchor>(
    initialReminder.monthlyAnchor
  );
  const [nextPaymentIso, setNextPaymentIso] = useState(
    initialReminder.nextPaymentDate
  );
  const [accountFee, setAccountFee] = useState(
    formatGroupedNumberInput(String(initialReminder.accountFee || ""))
  );
  const [accountFeeFrequency, setAccountFeeFrequency] = useState(
    initialReminder.accountFeeFrequency
  );
  const [customUpcomingDates, setCustomUpcomingDates] = useState(
    initialReminder.customUpcomingDates
  );
  const [notes, setNotes] = useState(initialReminder.notes);
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    initialReminder.notificationsEnabled
  );
  const [notifyLeads, setNotifyLeads] = useState<NotifyLead[]>(
    initialReminder.notifyLeads
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialReminder.name);
    setLinkedProfileId(initialReminder.linkedProfileId);
    setCurrencyCode(initialReminder.currencyCode);
    setOriginalAmount(
      formatGroupedNumberInput(String(initialReminder.originalAmount || ""))
    );
    setAlreadyPaid(
      formatGroupedNumberInput(
        String(
          Math.max(
            0,
            initialReminder.originalAmount - initialReminder.remainingBalance
          )
        )
      )
    );
    setRemainingBalance(
      formatGroupedNumberInput(String(initialReminder.remainingBalance || ""))
    );
    setInterestRate(String(initialReminder.annualInterestRatePercent || ""));
    setRepaymentAmount(
      formatGroupedNumberInput(String(initialReminder.repaymentAmount || ""))
    );
    setRepaymentFrequency(initialReminder.repaymentFrequency);
    setMonthlyAnchor(initialReminder.monthlyAnchor);
    setNextPaymentIso(initialReminder.nextPaymentDate);
    setAccountFee(formatGroupedNumberInput(String(initialReminder.accountFee || "")));
    setAccountFeeFrequency(initialReminder.accountFeeFrequency);
    setCustomUpcomingDates(initialReminder.customUpcomingDates);
    setNotes(initialReminder.notes);
    setNotificationsEnabled(initialReminder.notificationsEnabled);
    setNotifyLeads(initialReminder.notifyLeads);
    setError(null);
  }, [initialReminder]);

  const moneySymbol = useMemo(() => getCurrencySymbol(currencyCode), [currencyCode]);
  const isNew = !initialReminder.name && initialReminder.payments.length === 0;

  const applyProfile = (profile: SavedLoanProfile) => {
    const draft = draftFromSavedProfile(profile, {
      ...initialReminder,
      name: name || profile.name,
    });
    setLinkedProfileId(profile.id);
    setName(draft.name);
    setCurrencyCode(draft.currencyCode);
    setOriginalAmount(formatGroupedNumberInput(String(draft.originalAmount)));
    setAlreadyPaid("0");
    setRemainingBalance(formatGroupedNumberInput(String(draft.remainingBalance)));
    setInterestRate(String(draft.annualInterestRatePercent));
    setRepaymentAmount(formatGroupedNumberInput(String(draft.repaymentAmount)));
    setRepaymentFrequency(draft.repaymentFrequency);
    setAccountFee(formatGroupedNumberInput(String(draft.accountFee)));
    setAccountFeeFrequency(draft.accountFeeFrequency);
  };

  const onChangeOriginal = (value: string) => {
    const formatted = formatGroupedNumberInput(value);
    setOriginalAmount(formatted);
    const original = parseAmount(formatted);
    const paid = parseAmount(alreadyPaid);
    setRemainingBalance(
      formatGroupedNumberInput(String(Math.max(0, original - paid)))
    );
  };

  const onChangePaid = (value: string) => {
    const formatted = formatGroupedNumberInput(value);
    setAlreadyPaid(formatted);
    const original = parseAmount(originalAmount);
    const paid = parseAmount(formatted);
    setRemainingBalance(
      formatGroupedNumberInput(String(Math.max(0, original - paid)))
    );
  };

  const onChangeRemaining = (value: string) => {
    const formatted = formatGroupedNumberInput(value);
    setRemainingBalance(formatted);
    const original = parseAmount(originalAmount);
    const remaining = parseAmount(formatted);
    setAlreadyPaid(
      formatGroupedNumberInput(String(Math.max(0, original - remaining)))
    );
  };

  const toggleLead = (lead: NotifyLead) => {
    const key = leadKey(lead);
    const exists = notifyLeads.some((item) => leadKey(item) === key);
    if (exists) {
      const next = notifyLeads.filter((item) => leadKey(item) !== key);
      setNotifyLeads(next.length > 0 ? next : [lead]);
      return;
    }
    setNotifyLeads([...notifyLeads, lead]);
  };

  const addCustomDate = (iso: string) => {
    setCustomUpcomingDates(normalizeCustomDates([...customUpcomingDates, iso]));
    setError(null);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!enabled) {
      setNotificationsEnabled(false);
      return;
    }
    if (!notificationsSupported) {
      setError(notificationUnavailableHint);
      return;
    }
    const allowed = await onRequestEnableNotifications();
    setNotificationsEnabled(allowed);
    if (!allowed) {
      setError("Notifications are off on this phone. You can enable them in Settings.");
    }
  };

  const submit = () => {
    const trimmedName = name.trim();
    const original = parseAmount(originalAmount);
    const remaining = parseAmount(remainingBalance);
    const repayment = parseAmount(repaymentAmount);
    const rate = Number(interestRate);
    const nextIso = nextPaymentIso;

    if (!trimmedName) {
      setError("Please enter a name for this reminder.");
      return;
    }
    if (original <= 0) {
      setError("Enter the original loan amount.");
      return;
    }
    if (remaining < 0) {
      setError("Remaining balance cannot be negative.");
      return;
    }
    if (repayment <= 0) {
      setError("Enter how much you repay each cycle.");
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError("Enter a valid interest rate.");
      return;
    }
    if (!nextIso) {
      setError("Choose the next repayment date.");
      return;
    }

    const day = parseIsoDate(nextIso).getDate();
    const now = new Date().toISOString();
    onSave({
      ...initialReminder,
      name: trimmedName,
      linkedProfileId,
      currencyCode: currencyCode.trim().toUpperCase() || "AUD",
      originalAmount: original,
      remainingBalance: remaining,
      annualInterestRatePercent: rate,
      repaymentAmount: repayment,
      repaymentFrequency,
      monthlyAnchor: repaymentFrequency === "monthly" ? monthlyAnchor : "onDate",
      paymentDayOfMonth: day,
      nextPaymentDate: nextIso,
      customUpcomingDates: normalizeCustomDates(
        customUpcomingDates.filter((date) => date > nextIso)
      ),
      accountFee: parseAmount(accountFee),
      accountFeeFrequency,
      notificationsEnabled: notificationsSupported ? notificationsEnabled : false,
      notifyLeads: notifyLeads.length > 0 ? notifyLeads : NOTIFY_LEAD_PRESETS.slice(1, 2),
      notes: notes.trim(),
      status: remaining <= 0.005 ? "completed" : initialReminder.status === "archived"
        ? "archived"
        : "active",
      updatedAt: now,
      createdAt: initialReminder.createdAt || now,
    });
  };

  return (
    <View style={[styles.page, { backgroundColor: colors.page }]}>
      <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
        <Ionicons name="chevron-back" size={22} color={colors.accentTextStrong} />
        <Text style={[styles.backText, { color: colors.accentTextStrong }]}>Back</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>
          {isNew ? "New reminder" : "Edit reminder"}
        </Text>
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          {REMINDER_DISCLAIMER}
        </Text>

        {savedProfiles.length > 0 ? (
          <View>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Link a saved loan profile
            </Text>
            <View style={styles.chipWrap}>
              <Chip
                label="None"
                selected={linkedProfileId === null}
                onPress={() => setLinkedProfileId(null)}
              />
              {savedProfiles.map((profile) => (
                <Chip
                  key={profile.id}
                  label={profile.name}
                  selected={linkedProfileId === profile.id}
                  onPress={() => applyProfile(profile)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.borderStrong }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Car loan"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Currency code</Text>
        <TextInput
          autoCapitalize="characters"
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.borderStrong }]}
          value={currencyCode}
          onChangeText={setCurrencyCode}
          placeholder="AUD"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Original loan amount</Text>
        <View style={[styles.inputWrap, { borderColor: colors.borderStrong, backgroundColor: colors.inputBg }]}>
          <Text style={[styles.prefix, { color: colors.text }]}>{moneySymbol}</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={originalAmount}
            onChangeText={onChangeOriginal}
            style={[styles.bareInput, { color: colors.text }]}
            placeholder="3,000"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Already paid</Text>
        <View style={[styles.inputWrap, { borderColor: colors.borderStrong, backgroundColor: colors.inputBg }]}>
          <Text style={[styles.prefix, { color: colors.text }]}>{moneySymbol}</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={alreadyPaid}
            onChangeText={onChangePaid}
            style={[styles.bareInput, { color: colors.text }]}
            placeholder="400"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Remaining balance</Text>
        <View style={[styles.inputWrap, { borderColor: colors.borderStrong, backgroundColor: colors.inputBg }]}>
          <Text style={[styles.prefix, { color: colors.text }]}>{moneySymbol}</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={remainingBalance}
            onChangeText={onChangeRemaining}
            style={[styles.bareInput, { color: colors.text }]}
            placeholder="2,600"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Annual interest rate (%)</Text>
        <TextInput
          keyboardType="decimal-pad"
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.borderStrong }]}
          value={interestRate}
          onChangeText={setInterestRate}
          placeholder="6.2"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Repayment each cycle</Text>
        <View style={[styles.inputWrap, { borderColor: colors.borderStrong, backgroundColor: colors.inputBg }]}>
          <Text style={[styles.prefix, { color: colors.text }]}>{moneySymbol}</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={repaymentAmount}
            onChangeText={(value) => setRepaymentAmount(formatGroupedNumberInput(value))}
            style={[styles.bareInput, { color: colors.text }]}
            placeholder="120"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Repayment frequency</Text>
        <View style={styles.chipWrap}>
          {FREQUENCIES.map((item) => (
            <Chip
              key={item}
              label={formatFrequencyLabel(item)}
              selected={repaymentFrequency === item}
              onPress={() => setRepaymentFrequency(item)}
            />
          ))}
        </View>

        {repaymentFrequency === "monthly" ? (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Monthly timing</Text>
            <View style={styles.chipWrap}>
              {MONTHLY_ANCHORS.map((item) => (
                <Chip
                  key={item}
                  label={formatMonthAnchorLabel(item)}
                  selected={monthlyAnchor === item}
                  onPress={() => setMonthlyAnchor(item)}
                />
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.label, { color: colors.textSecondary }]}>Next repayment date</Text>
        <DatePickerField
          value={nextPaymentIso}
          onChange={setNextPaymentIso}
          placeholder="Choose next repayment date"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Account fee (optional)</Text>
        <View style={[styles.inputWrap, { borderColor: colors.borderStrong, backgroundColor: colors.inputBg }]}>
          <Text style={[styles.prefix, { color: colors.text }]}>{moneySymbol}</Text>
          <TextInput
            keyboardType="decimal-pad"
            value={accountFee}
            onChangeText={(value) => setAccountFee(formatGroupedNumberInput(value))}
            style={[styles.bareInput, { color: colors.text }]}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Fee frequency</Text>
        <View style={styles.chipWrap}>
          {FREQUENCIES.map((item) => (
            <Chip
              key={item}
              label={formatFrequencyLabel(item)}
              selected={accountFeeFrequency === item}
              onPress={() => setAccountFeeFrequency(item)}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Extra upcoming dates (optional)</Text>
        <DatePickerField
          value={null}
          placeholder="Add another date"
          onChange={addCustomDate}
        />
        {customUpcomingDates.map((date) => (
          <View key={date} style={styles.customDateRow}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>
              {formatDisplayDate(date)}
            </Text>
            <Pressable
              onPress={() =>
                setCustomUpcomingDates(customUpcomingDates.filter((item) => item !== date))
              }
            >
              <Text style={{ color: colors.danger, fontWeight: "700" }}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.borderStrong }]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Lender, last 4 digits, etc."
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Enable notifications</Text>
            {!notificationsSupported ? (
              <Text style={{ color: colors.textMuted, fontWeight: "600", marginTop: 4 }}>
                {notificationUnavailableHint}
              </Text>
            ) : null}
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={(value) => {
              handleNotificationToggle(value).catch(() => {});
            }}
            disabled={!notificationsSupported}
            trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
            thumbColor={colors.switchThumb}
          />
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Alert me</Text>
        <View style={styles.chipWrap}>
          {NOTIFY_LEAD_PRESETS.map((lead) => (
            <Chip
              key={leadKey(lead)}
              label={formatLeadLabel(lead)}
              selected={notifyLeads.some((item) => leadKey(item) === leadKey(lead))}
              onPress={() => toggleLead(lead)}
            />
          ))}
        </View>

        {error ? <Text style={[styles.error, { color: colors.errorText }]}>{error}</Text> : null}

        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={submit}
        >
          <Text style={[styles.saveButtonText, { color: colors.textInverse }]}>Save reminder</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 8,
    marginLeft: 16,
    gap: 2,
  },
  backText: {
    fontWeight: "700",
    fontSize: 16,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  disclaimer: {
    fontWeight: "600",
    marginBottom: 14,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
  },
  prefix: {
    paddingLeft: 12,
    fontWeight: "700",
  },
  bareInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  smallButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  smallButtonText: {
    fontWeight: "700",
  },
  customDateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  switchRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  error: {
    marginTop: 12,
    fontWeight: "600",
  },
  saveButton: {
    marginTop: 18,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: {
    fontWeight: "700",
    fontSize: 16,
  },
});
