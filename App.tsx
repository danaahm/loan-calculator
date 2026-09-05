import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView, ScrollView } from "react-native-gesture-handler";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AmortizationGrid } from "./src/components/AmortizationGrid";
import { BalanceComparisonChart } from "./src/components/BalanceComparisonChart";
import { LoanForm } from "./src/components/LoanForm";
import { PieBreakdownChart } from "./src/components/PieBreakdownChart";
import { SwipeBackView } from "./src/components/SwipeBackView";
import { BasicCalculatorScreen } from "./src/screens/BasicCalculatorScreen";
import { ReminderDetailScreen } from "./src/screens/ReminderDetailScreen";
import { ReminderEditorScreen } from "./src/screens/ReminderEditorScreen";
import { RemindersScreen } from "./src/screens/RemindersScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import {
  loadAppSettings,
  loadLoanInput,
  loadLoanReminders,
  loadSavedLoanProfiles,
  patchAppSettings,
  saveLoanInput,
  saveLoanReminders,
  saveSavedLoanProfiles,
} from "./src/storage/localState";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { type ThemeColors } from "./src/theme/tokens";
import {
  type LoanCalculationResult,
  type LoanInput,
  type RepaymentFrequency,
  type SavedLoanProfile,
} from "./src/types/loan";
import { type LoanReminder } from "./src/types/reminder";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "./src/types/settings";
import { calculateLoan, normalizeInput } from "./src/utils/loanMath";
import { formatCurrency } from "./src/utils/format";
import { formatDisplayDate, todayLocalIso } from "./src/utils/dateIso";
import {
  applyExtraPayment,
  catchUpReminders,
  createEmptyReminder,
  draftFromSavedProfile,
  refreshTermsFromProfile,
  setReminderStatus,
  undoLastPayment,
} from "./src/utils/reminderMath";
import {
  getOsPermissionStatus,
  notificationUnavailableHint,
  openPhoneNotificationSettings,
  refillReminderNotifications,
  reminderNotificationsSupported,
  requestReminderPermissions,
  type OsPermissionStatus,
} from "./src/notifications/reminderNotifications";

type TabScreen = "home" | "calculator" | "basic" | "saved";
type AppScreen = TabScreen | "settings" | "reminders" | "reminder-edit" | "reminder-detail";

const NAV_TABS: {
  id: TabScreen;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "home", label: "Home", icon: "home-outline", iconActive: "home" },
  { id: "calculator", label: "Loan", icon: "cash-outline", iconActive: "cash" },
  { id: "basic", label: "Calc", icon: "calculator-outline", iconActive: "calculator" },
  { id: "saved", label: "Saved", icon: "document-text-outline", iconActive: "document-text" },
];

const DEFAULT_INPUT: LoanInput = {
  currencyCode: "AUD",
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
    startAfterValue: 12,
    startAfterUnit: "months",
  },
  lumpSum: {
    enabled: false,
    amount: 0,
  },
  offsetSavings: {
    enabled: false,
    amount: 0,
  },
};

const REPAYMENT_PERIODS_PER_YEAR: Record<RepaymentFrequency, number> = {
  yearly: 1,
  quarterly: 4,
  monthly: 12,
  fortnightly: 26,
  weekly: 52,
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [screen, setScreen] = useState<AppScreen>("home");
  const previousScreenRef = useRef<Exclude<AppScreen, "settings">>("home");
  const [input, setInput] = useState<LoanInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<LoanCalculationResult | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<SavedLoanProfile[]>([]);
  const [reminders, setReminders] = useState<LoanReminder[]>([]);
  const [reminderSettings, setReminderSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [osPermissionStatus, setOsPermissionStatus] =
    useState<OsPermissionStatus>("undetermined");
  const [editingReminder, setEditingReminder] = useState<LoanReminder | null>(null);
  const [detailReminderId, setDetailReminderId] = useState<string | null>(null);
  const [showArchivedReminders, setShowArchivedReminders] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("My Loan Profile");
  const [saveDialogVisible, setSaveDialogVisible] = useState(false);
  const [renameDialogVisible, setRenameDialogVisible] = useState(false);
  const [renameProfileId, setRenameProfileId] = useState<string | null>(null);
  const [renameProfileName, setRenameProfileName] = useState("");
  const [lastCalculatedHash, setLastCalculatedHash] = useState("");
  const [lastSavedHash, setLastSavedHash] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarText, setSnackbarText] = useState("");
  const [loadingState, setLoadingState] = useState(true);
  const snackbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reminderSettingsRef = useRef(reminderSettings);
  reminderSettingsRef.current = reminderSettings;
  const remindersRef = useRef(reminders);
  remindersRef.current = reminders;
  const editorBackRef = useRef<AppScreen>("reminders");
  const remindersReturnRef = useRef<TabScreen>("home");
  const insets = useSafeAreaInsets();

  const inputHash = JSON.stringify(input);
  const canSaveCalculatedProfile =
    result !== null && lastCalculatedHash.length > 0 && lastCalculatedHash !== lastSavedHash;
  const minimumMonthlyRepayment = (() => {
    if (!result) {
      return 0;
    }
    const firstPeriod = result.baseline.periodRows[0];
    if (!firstPeriod) {
      return 0;
    }
    const principalAndInterestPerPeriod =
      firstPeriod.principalPaid + firstPeriod.interestPaid;
    const periodsPerYear = REPAYMENT_PERIODS_PER_YEAR[input.repaymentFrequency];
    const monthlyEquivalent = (principalAndInterestPerPeriod * periodsPerYear) / 12;
    return Math.round(monthlyEquivalent * 100) / 100;
  })();
  const extraMonthlyRepayment = (() => {
    if (!result || !input.extraRepayment.enabled) {
      return 0;
    }
    const extraEventsPerYear = REPAYMENT_PERIODS_PER_YEAR[input.extraRepayment.frequency];
    const monthlyEquivalent = (input.extraRepayment.amount * extraEventsPerYear) / 12;
    return Math.round(monthlyEquivalent * 100) / 100;
  })();
  const totalMonthlyPayment = Math.round(
    (minimumMonthlyRepayment + extraMonthlyRepayment) * 100
  ) / 100;
  const activeReminders = reminders.filter((item) => item.status === "active");
  const nextDueReminder = [...activeReminders].sort((a, b) =>
    a.nextPaymentDate.localeCompare(b.nextPaymentDate)
  )[0];
  const detailReminder =
    reminders.find((item) => item.id === detailReminderId) ?? null;

  const showSnackbar = (text: string) => {
    setSnackbarText(text);
    setSnackbarVisible(true);
    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
    }
    snackbarTimeoutRef.current = setTimeout(() => {
      setSnackbarVisible(false);
    }, 4000);
  };

  const ignoreCurrentCalculationSavePrompt = () => {
    setLastSavedHash(lastCalculatedHash);
  };

  const openSettings = () => {
    if (screen !== "settings") {
      previousScreenRef.current = screen;
    }
    setScreen("settings");
  };

  const isTabScreen = (value: AppScreen): value is TabScreen =>
    value === "home" || value === "calculator" || value === "basic" || value === "saved";

  const openReminders = () => {
    if (screen === "reminders") {
      setScreen(remindersReturnRef.current);
      return;
    }
    if (isTabScreen(screen)) {
      remindersReturnRef.current = screen;
    }
    setScreen("reminders");
  };

  const refillAndPersist = async (next: LoanReminder[]) => {
    const settings = reminderSettingsRef.current;
    const refilled = await refillReminderNotifications(next, {
      masterEnabled: settings.reminderNotificationsEnabled,
      notifyHour: settings.defaultNotifyHour,
    });
    setReminders(refilled);
    await saveLoanReminders(refilled);
    return refilled;
  };

  const runCatchUp = async (list: LoanReminder[]) => {
    const { reminders: caught, summaries } = catchUpReminders(list, todayLocalIso());
    await refillAndPersist(caught);
    if (summaries.length > 0) {
      showSnackbar(
        summaries
          .map((item) => `Applied ${item.appliedCount} payment(s) on ${item.name}`)
          .join(" · ")
      );
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      const [savedInput, loadedProfiles, loadedReminders, loadedSettings] =
        await Promise.all([
          loadLoanInput(),
          loadSavedLoanProfiles(),
          loadLoanReminders(),
          loadAppSettings(),
        ]);
      const initial = normalizeInput(savedInput ?? DEFAULT_INPUT);
      const initialHash = JSON.stringify(initial);
      setInput(initial);
      setResult(calculateLoan(initial));
      setLastCalculatedHash(initialHash);
      setLastSavedHash(initialHash);
      setSavedProfiles(loadedProfiles);
      setReminderSettings(loadedSettings);
      reminderSettingsRef.current = loadedSettings;
      const osStatus = await getOsPermissionStatus();
      setOsPermissionStatus(osStatus);
      const { reminders: caught, summaries } = catchUpReminders(
        loadedReminders,
        todayLocalIso()
      );
      const refilled = await refillReminderNotifications(caught, {
        masterEnabled: loadedSettings.reminderNotificationsEnabled,
        notifyHour: loadedSettings.defaultNotifyHour,
      });
      setReminders(refilled);
      await saveLoanReminders(refilled);
      setLoadingState(false);
      if (summaries.length > 0) {
        showSnackbar(
          summaries
            .map((item) => `Applied ${item.appliedCount} payment(s) on ${item.name}`)
            .join(" · ")
        );
      }
    };

    bootstrap().catch(() => {
      setInput(DEFAULT_INPUT);
      setResult(calculateLoan(DEFAULT_INPUT));
      const defaultHash = JSON.stringify(DEFAULT_INPUT);
      setLastCalculatedHash(defaultHash);
      setLastSavedHash(defaultHash);
      setLoadingState(false);
    });
  }, []);

  const handleSubmit = async (nextInput: LoanInput) => {
    const normalized = normalizeInput(nextInput);
    setIsCalculating(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setInput(normalized);
    setResult(calculateLoan(normalized));
    setLastCalculatedHash(JSON.stringify(normalized));
    await saveLoanInput(normalized);
    setIsCalculating(false);
    showSnackbar("Your loan calculation is ready");
  };

  useEffect(() => {
    return () => {
      if (snackbarTimeoutRef.current) {
        clearTimeout(snackbarTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        getOsPermissionStatus()
          .then(setOsPermissionStatus)
          .catch(() => {});
        runCatchUp(remindersRef.current).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  const persistProfiles = async (profiles: SavedLoanProfile[]) => {
    setSavedProfiles(profiles);
    await saveSavedLoanProfiles(profiles);
  };

  const openProfile = (profile: SavedLoanProfile) => {
    const normalized = normalizeInput(profile.input);
    const hash = JSON.stringify(normalized);
    setInput(normalized);
    setResult(calculateLoan(normalized));
    setProfileName(profile.name);
    setSelectedProfileId(profile.id);
    setLastCalculatedHash(hash);
    setLastSavedHash(hash);
    setScreen("calculator");
  };

  const saveCurrentProfile = async (asNew: boolean) => {
    const name = profileName.trim();
    if (!name) {
      Alert.alert("Profile name required", "Please enter a profile name.");
      return;
    }

    const now = new Date().toISOString();
    if (selectedProfileId && !asNew) {
      const updated = savedProfiles.map((profile) =>
        profile.id === selectedProfileId
          ? { ...profile, name, input, updatedAt: now }
          : profile
      );
      await persistProfiles(updated);
      setLastSavedHash(inputHash);
      setSaveDialogVisible(false);
      Alert.alert("Updated", "Loan profile updated.", [
        { text: "OK" },
        {
          text: "Create reminder",
          onPress: () => {
            const profile = updated.find((item) => item.id === selectedProfileId);
            if (profile) {
              openReminderFromProfile(profile);
            }
          },
        },
      ]);
      return;
    }

    const newProfile: SavedLoanProfile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      input,
      createdAt: now,
      updatedAt: now,
    };
    await persistProfiles([newProfile, ...savedProfiles]);
    setSelectedProfileId(newProfile.id);
    setLastSavedHash(inputHash);
    setSaveDialogVisible(false);
    Alert.alert("Saved", "Loan profile saved.", [
      { text: "OK" },
      {
        text: "Create reminder",
        onPress: () => openReminderFromProfile(newProfile),
      },
    ]);
  };

  const deleteProfile = async (id: string) => {
    const updated = savedProfiles.filter((profile) => profile.id !== id);
    await persistProfiles(updated);
    if (selectedProfileId === id) {
      setSelectedProfileId(null);
      setProfileName("");
    }
  };

  const confirmDeleteProfile = (profile: SavedLoanProfile) => {
    Alert.alert("Delete profile", `Are you sure you want to delete "${profile.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteProfile(profile.id).catch(() => {});
        },
      },
    ]);
  };

  const openRenameDialog = (profile: SavedLoanProfile) => {
    setRenameProfileId(profile.id);
    setRenameProfileName(profile.name);
    setRenameDialogVisible(true);
  };

  const saveRenamedProfile = async () => {
    if (!renameProfileId) {
      return;
    }
    const trimmed = renameProfileName.trim();
    if (!trimmed) {
      Alert.alert("Profile name required", "Please enter a profile name.");
      return;
    }
    const now = new Date().toISOString();
    const updated = savedProfiles.map((profile) =>
      profile.id === renameProfileId
        ? { ...profile, name: trimmed, updatedAt: now }
        : profile
    );
    await persistProfiles(updated);
    if (selectedProfileId === renameProfileId) {
      setProfileName(trimmed);
    }
    setRenameDialogVisible(false);
    setRenameProfileId(null);
  };

  const moveProfile = async (id: string, direction: "up" | "down") => {
    const index = savedProfiles.findIndex((profile) => profile.id === id);
    if (index < 0) {
      return;
    }
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= savedProfiles.length) {
      return;
    }
    const clone = [...savedProfiles];
    const temp = clone[index];
    clone[index] = clone[nextIndex];
    clone[nextIndex] = temp;
    await persistProfiles(clone);
  };

  const openReminderEditor = (reminder: LoanReminder, backScreen: AppScreen = "reminders") => {
    editorBackRef.current = backScreen;
    setEditingReminder(reminder);
    setScreen("reminder-edit");
  };

  const openReminderFromProfile = (profile: SavedLoanProfile) => {
    openReminderEditor(draftFromSavedProfile(profile), "saved");
  };

  const openReminderDetail = (reminder: LoanReminder) => {
    setDetailReminderId(reminder.id);
    setScreen("reminder-detail");
  };

  const enableMasterNotifications = async (): Promise<boolean> => {
    if (!reminderNotificationsSupported) {
      return false;
    }
    const status = await requestReminderPermissions();
    setOsPermissionStatus(status);
    if (status !== "granted") {
      return false;
    }
    const next = await patchAppSettings({ reminderNotificationsEnabled: true });
    setReminderSettings(next);
    reminderSettingsRef.current = next;
    return true;
  };

  const updateReminder = async (nextReminder: LoanReminder) => {
    const current = remindersRef.current;
    const exists = current.some((item) => item.id === nextReminder.id);
    const next = exists
      ? current.map((item) => (item.id === nextReminder.id ? nextReminder : item))
      : [nextReminder, ...current];
    await refillAndPersist(next);
  };

  const toggleReminderNotifications = async (
    reminder: LoanReminder,
    enabled: boolean
  ) => {
    if (enabled) {
      const allowed = await enableMasterNotifications();
      if (!allowed) {
        Alert.alert(
          "Notifications are off",
          reminderNotificationsSupported
            ? "Allow notifications in your phone settings to get repayment reminders."
            : notificationUnavailableHint
        );
        return;
      }
    }
    await updateReminder({
      ...reminder,
      notificationsEnabled: enabled,
      updatedAt: new Date().toISOString(),
    });
  };

  const confirmDeleteReminder = (reminder: LoanReminder) => {
    Alert.alert("Delete reminder", `Delete "${reminder.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          const next = remindersRef.current.filter((item) => item.id !== reminder.id);
          refillAndPersist(next).catch(() => {});
          if (detailReminderId === reminder.id) {
            setDetailReminderId(null);
            setScreen("reminders");
          }
        },
      },
    ]);
  };

  const archiveReminder = async (reminder: LoanReminder) => {
    await updateReminder(setReminderStatus(reminder, "archived"));
    if (screen === "reminder-detail") {
      setScreen("reminders");
    }
  };

  const handleMasterNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      const allowed = await enableMasterNotifications();
      if (!allowed) {
        Alert.alert(
          "Notifications are off",
          reminderNotificationsSupported
            ? "Allow notifications in your phone settings, then turn them on here."
            : notificationUnavailableHint
        );
        return;
      }
      await refillAndPersist(remindersRef.current);
      return;
    }
    const next = await patchAppSettings({ reminderNotificationsEnabled: false });
    setReminderSettings(next);
    reminderSettingsRef.current = next;
    await refillAndPersist(remindersRef.current);
  };

  const handleNotifyHourChange = async (hour: number) => {
    const next = await patchAppSettings({ defaultNotifyHour: hour });
    setReminderSettings(next);
    reminderSettingsRef.current = next;
    await refillAndPersist(remindersRef.current);
  };

  const overlayScreen =
    screen === "settings" ||
    screen === "reminders" ||
    screen === "reminder-edit" ||
    screen === "reminder-detail";
  const remindersSectionActive =
    screen === "reminders" || screen === "reminder-edit" || screen === "reminder-detail";

  if (loadingState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.stickyHeader}>
          <View style={styles.headerRow}>
            <View style={styles.brandRow}>
              <Image source={require("./assets/loan-calculator.png")} style={styles.logo} />
              <Text style={styles.heading} numberOfLines={1}>
                Simple Loan Calculator
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                onPress={openReminders}
                style={styles.settingsButton}
                accessibilityRole="button"
                accessibilityLabel="Repayment reminders"
              >
                <Ionicons
                  name={remindersSectionActive ? "notifications" : "notifications-outline"}
                  size={22}
                  color={remindersSectionActive ? colors.accentTextStrong : colors.text}
                />
                {activeReminders.length > 0 ? (
                  <View style={styles.headerBadge}>
                    <Text style={styles.headerBadgeText}>
                      {activeReminders.length > 9 ? "9+" : String(activeReminders.length)}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
              <Pressable
                onPress={openSettings}
                style={styles.settingsButton}
                accessibilityRole="button"
                accessibilityLabel="Settings"
              >
                <Ionicons
                  name={screen === "settings" ? "settings" : "settings-outline"}
                  size={22}
                  color={screen === "settings" ? colors.accentTextStrong : colors.text}
                />
              </Pressable>
            </View>
          </View>
        </View>

        {screen === "calculator" && canSaveCalculatedProfile ? (
          <View style={styles.saveStickyBar}>
            <Pressable
              style={styles.saveStickyPrimaryButton}
              onPress={() => setSaveDialogVisible(true)}
            >
              <Text style={styles.primaryButtonText}>Save</Text>
            </Pressable>
            <Pressable
              style={styles.saveStickySecondaryButton}
              onPress={ignoreCurrentCalculationSavePrompt}
            >
              <Text style={styles.secondaryButtonText}>Ignore</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.screenBody}>
        {screen === "home" ? (
          <View style={styles.pageContent}>
            <View style={styles.dashboardGrid}>
              <Pressable
                style={styles.dashboardCard}
                onPress={() => setScreen("calculator")}
              >
                <Text style={styles.dashboardIcon}>🧮</Text>
                <Text style={styles.dashboardTitle}>Loan calculator</Text>
                <Text style={styles.dashboardHint}>Open loan calculator</Text>
              </Pressable>
              <Pressable style={styles.dashboardCard} onPress={() => setScreen("basic")}>
                <Text style={styles.dashboardIcon}>🔢</Text>
                <Text style={styles.dashboardTitle}>Calculator</Text>
                <Text style={styles.dashboardHint}>Basic calculator</Text>
              </Pressable>
              <Pressable style={styles.dashboardCard} onPress={() => setScreen("saved")}>
                <Text style={styles.dashboardIcon}>📄</Text>
                <Text style={styles.dashboardTitle}>My Saved Loans</Text>
                <Text style={styles.dashboardHint}>
                  {savedProfiles.length} profile{savedProfiles.length === 1 ? "" : "s"}
                </Text>
              </Pressable>
              <Pressable style={styles.dashboardCard} onPress={openReminders}>
                <Text style={styles.dashboardIcon}>🔔</Text>
                <Text style={styles.dashboardTitle}>Repayment reminders</Text>
                <Text style={styles.dashboardHint}>
                  {activeReminders.length > 0
                    ? nextDueReminder
                      ? `${activeReminders.length} active · next ${formatDisplayDate(nextDueReminder.nextPaymentDate)}`
                      : `${activeReminders.length} active`
                    : "Track loans and get due-date alerts"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {screen === "calculator" ? (
          <ScrollView
            style={styles.screenBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <LoanForm initialValue={input} onSubmit={handleSubmit} />

            {result ? (
              <View>
                <View style={styles.minimumRepaymentCard}>
                  <Text style={styles.minimumRepaymentTitle}>
                    Minimum Monthly Repayment
                  </Text>
                  <Text style={styles.minimumRepaymentSubtitle}>
                    Principal + Interest
                  </Text>
                  <Text style={styles.minimumRepaymentValue}>
                    {formatCurrency(minimumMonthlyRepayment, input.currencyCode)}
                  </Text>
                  {input.lumpSum.enabled ? (
                    <Text style={styles.minimumRepaymentNote}>
                      Excludes the final lump sum of{" "}
                      {formatCurrency(input.lumpSum.amount, input.currencyCode)}
                    </Text>
                  ) : null}
                  {input.offsetSavings.enabled ? (
                    <Text style={styles.minimumRepaymentNote}>
                      Interest is calculated on the balance minus{" "}
                      {formatCurrency(input.offsetSavings.amount, input.currencyCode)}{" "}
                      offset
                    </Text>
                  ) : null}
                  {input.extraRepayment.enabled ? (
                    <View style={styles.monthlyBreakdownWrap}>
                      <View style={styles.monthlyBreakdownRow}>
                        <Text style={styles.monthlyBreakdownLabel}>
                          Extra Repayment (Monthly)
                        </Text>
                        <Text style={styles.monthlyBreakdownValue}>
                          {formatCurrency(extraMonthlyRepayment, input.currencyCode)}
                        </Text>
                      </View>
                      <View style={[styles.monthlyBreakdownRow, styles.monthlyBreakdownTotalRow]}>
                        <Text style={styles.monthlyBreakdownTotalLabel}>
                          Total Monthly Payment
                        </Text>
                        <Text style={styles.monthlyBreakdownTotalValue}>
                          {formatCurrency(totalMonthlyPayment, input.currencyCode)}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                <PieBreakdownChart
                  principal={result.activeSchedule.summary.totalPrincipalPaid}
                  interest={result.activeSchedule.summary.totalInterestPaid}
                  fees={result.activeSchedule.summary.totalFeesPaid}
                  extraRepayment={result.activeSchedule.summary.totalExtraPaid}
                  currencyCode={input.currencyCode}
                  loanLengthYears={input.loanLengthYears}
                />

                <BalanceComparisonChart
                  result={result}
                  repaymentFrequency={input.repaymentFrequency}
                  currencyCode={input.currencyCode}
                  loanLengthYears={input.loanLengthYears}
                />

                <AmortizationGrid
                  rows={result.activeSchedule.yearlyRows}
                  currencyCode={input.currencyCode}
                />
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {screen === "basic" ? <BasicCalculatorScreen /> : null}

        {screen === "settings" ? (
          <SwipeBackView onBack={() => setScreen(previousScreenRef.current)}>
            <SettingsScreen
              onBack={() => setScreen(previousScreenRef.current)}
              reminderNotificationsEnabled={reminderSettings.reminderNotificationsEnabled}
              defaultNotifyHour={reminderSettings.defaultNotifyHour}
              osPermissionStatus={osPermissionStatus}
              notificationsSupported={reminderNotificationsSupported}
              onToggleReminderNotifications={(enabled) => {
                handleMasterNotificationToggle(enabled).catch(() => {});
              }}
              onChangeNotifyHour={(hour) => {
                handleNotifyHourChange(hour).catch(() => {});
              }}
              onOpenPhoneSettings={() => {
                openPhoneNotificationSettings().catch(() => {});
              }}
            />
          </SwipeBackView>
        ) : null}

        {screen === "reminders" ? (
          <SwipeBackView onBack={() => setScreen(remindersReturnRef.current)}>
            <RemindersScreen
              reminders={reminders}
              showArchived={showArchivedReminders}
              onToggleArchived={() => setShowArchivedReminders((value) => !value)}
              notificationsAvailable={
                reminderNotificationsSupported &&
                reminderSettings.reminderNotificationsEnabled &&
                osPermissionStatus === "granted"
              }
              onBack={() => setScreen(remindersReturnRef.current)}
              onAdd={() => openReminderEditor(createEmptyReminder(), "reminders")}
              onOpen={openReminderDetail}
              onToggleNotifications={(reminder, enabled) => {
                toggleReminderNotifications(reminder, enabled).catch(() => {});
              }}
              onArchive={(reminder) => {
                archiveReminder(reminder).catch(() => {});
              }}
              onDelete={confirmDeleteReminder}
            />
          </SwipeBackView>
        ) : null}

        {screen === "reminder-edit" && editingReminder ? (
          <SwipeBackView onBack={() => setScreen(editorBackRef.current)}>
            <ReminderEditorScreen
              initialReminder={editingReminder}
              savedProfiles={savedProfiles}
              notificationsSupported={reminderNotificationsSupported}
              onBack={() => setScreen(editorBackRef.current)}
              onSave={(reminder) => {
                updateReminder(reminder)
                  .then(() => {
                    setEditingReminder(null);
                    setDetailReminderId(reminder.id);
                    setScreen("reminder-detail");
                  })
                  .catch(() => {});
              }}
              onRequestEnableNotifications={enableMasterNotifications}
            />
          </SwipeBackView>
        ) : null}

        {screen === "reminder-detail" && detailReminder ? (
          <SwipeBackView onBack={() => setScreen("reminders")}>
            <ReminderDetailScreen
            reminder={detailReminder}
            linkedProfile={
              savedProfiles.find((item) => item.id === detailReminder.linkedProfileId) ??
              null
            }
            notificationsSupported={reminderNotificationsSupported}
            onBack={() => setScreen("reminders")}
            onEdit={() => openReminderEditor(detailReminder, "reminder-detail")}
            onToggleNotifications={(enabled) => {
              toggleReminderNotifications(detailReminder, enabled).catch(() => {});
            }}
            onExtraPayment={(amount) => {
              updateReminder(applyExtraPayment(detailReminder, amount)).catch(() => {});
            }}
            onUndoLast={() => {
              updateReminder(undoLastPayment(detailReminder)).catch(() => {});
            }}
            onArchive={() => {
              archiveReminder(detailReminder).catch(() => {});
            }}
            onUnarchive={() => {
              updateReminder(setReminderStatus(detailReminder, "active")).catch(() => {});
            }}
            onDelete={() => confirmDeleteReminder(detailReminder)}
            onRefreshFromProfile={() => {
              const profile = savedProfiles.find(
                (item) => item.id === detailReminder.linkedProfileId
              );
              if (!profile) {
                Alert.alert("Profile missing", "The linked saved loan is no longer available.");
                return;
              }
              updateReminder(refreshTermsFromProfile(detailReminder, profile)).catch(
                () => {}
              );
            }}
          />
          </SwipeBackView>
        ) : null}

        {screen === "saved" ? (
          <View style={styles.pageContent}>
            <FlatList
              data={savedProfiles}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.savedListWrap}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No saved loan profiles yet.</Text>
              }
              renderItem={({ item, index }) => (
                <Pressable
                  style={styles.savedCard}
                  onPress={() => openProfile(item)}
                  onLongPress={() =>
                    confirmDeleteProfile(item)
                  }
                >
                  <Text style={styles.savedCardTitle}>{item.name}</Text>
                  <Text style={styles.savedCardMeta}>
                    {item.input.currencyCode} {item.input.amountBorrowed.toLocaleString()} |{" "}
                    {item.input.loanLengthYears} years
                  </Text>
                  <View style={styles.savedActionRow}>
                  <Pressable
  style={styles.secondaryButtonSmall}
  onPress={() => {
    moveProfile(item.id, "up").catch(() => {});
  }}
  disabled={index === 0}
>
  <Text style={styles.secondaryButtonSmallText}>↑</Text>
</Pressable>

<Pressable
  style={styles.secondaryButtonSmall}
  onPress={() => {
    moveProfile(item.id, "down").catch(() => {});
  }}
  disabled={index === savedProfiles.length - 1}
>
  <Text style={styles.secondaryButtonSmallText}>↓</Text>
</Pressable>
                    <Pressable
                      style={styles.secondaryButtonSmall}
                      onPress={() => {
                        openRenameDialog(item);
                      }}
                    >
                      <Text style={styles.secondaryButtonSmallText}>Rename</Text>
                    </Pressable>

                    <Pressable
                      style={styles.secondaryButtonSmall}
                      onPress={() => {
                        openReminderFromProfile(item);
                      }}
                    >
                      <Text style={styles.secondaryButtonSmallText}>Remind</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteButtonSmall}
                      onPress={() => {
                        confirmDeleteProfile(item);
                      }}
                    >
                      <Text style={styles.deleteButtonSmallText}>Delete</Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {snackbarVisible ? (
          <View style={styles.snackbarWrap}>
            <Text style={styles.snackbarText}>{snackbarText}</Text>
          </View>
        ) : null}
        </View>

        {!overlayScreen ? (
          <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            {NAV_TABS.map((tab) => {
              const active = screen === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  style={[styles.bottomNavButton, active && styles.bottomNavButtonActive]}
                  onPress={() => setScreen(tab.id)}
                  accessibilityRole="button"
                  accessibilityLabel={tab.label}
                >
                  <Ionicons
                    name={active ? tab.iconActive : tab.icon}
                    size={20}
                    color={active ? colors.accentTextStrong : colors.textSecondary}
                  />
                  <Text
                    style={[styles.bottomNavText, active && styles.bottomNavTextActive]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Modal
          visible={renameDialogVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRenameDialogVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Rename Profile</Text>
              <TextInput
                style={styles.saveProfileInput}
                value={renameProfileName}
                onChangeText={setRenameProfileName}
                placeholder="Profile name"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.topActionRow}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    saveRenamedProfile().catch(() => {});
                  }}
                >
                  <Text style={styles.primaryButtonText}>Save Name</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setRenameDialogVisible(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={saveDialogVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSaveDialogVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Save Loan Profile</Text>
              <TextInput
                style={styles.saveProfileInput}
                value={profileName}
                onChangeText={setProfileName}
                placeholder="Profile name"
                placeholderTextColor={colors.textMuted}
              />
              <View style={styles.topActionRow}>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    saveCurrentProfile(false).catch(() => {});
                  }}
                >
                  <Text style={styles.primaryButtonText}>
                    {selectedProfileId ? "Save Profile" : "Save"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => {
                    setSelectedProfileId(null);
                    saveCurrentProfile(true).catch(() => {});
                  }}
                >
                  <Text style={styles.secondaryButtonText}>Save As New</Text>
                </Pressable>
              </View>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setSaveDialogVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal visible={isCalculating} transparent animationType="fade">
          <View style={styles.calculatingBackdrop}>
            <View style={styles.calculatingCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.calculatingText}>Calculating your loan...</Text>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.page,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.page,
    },
    screenBody: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 24,
    },
    pageContent: {
      flex: 1,
      padding: 16,
    },
    stickyHeader: {
      marginHorizontal: 0,
      marginTop: 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      backgroundColor: colors.header,
      borderBottomWidth: 1,
      borderBottomColor: colors.headerBorder,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    headerBadge: {
      position: "absolute",
      top: 4,
      right: 2,
      minWidth: 16,
      height: 16,
      paddingHorizontal: 4,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    headerBadgeText: {
      color: colors.textInverse,
      fontSize: 9,
      fontWeight: "800",
    },
    saveStickyBar: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.headerBorder,
      backgroundColor: colors.saveBarBg,
      flexDirection: "row",
      gap: 8,
    },
    saveStickyPrimaryButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    saveStickySecondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      backgroundColor: colors.card,
    },
    bottomNav: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: colors.borderStrong,
      backgroundColor: colors.header,
      paddingHorizontal: 10,
      paddingTop: 8,
      gap: 6,
    },
    bottomNavButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      backgroundColor: colors.navButtonBg,
      gap: 2,
    },
    bottomNavButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    bottomNavText: {
      color: colors.textSecondary,
      fontWeight: "700",
      fontSize: 10,
    },
    bottomNavTextActive: {
      color: colors.accentTextStrong,
    },
    brandRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
    },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 8,
      marginLeft: 10,
    },
    heading: {
      flexShrink: 1,
      fontSize: 17,
      fontWeight: "800",
      color: colors.text,
    },
    dashboardCard: {
      width: "48%",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      borderRadius: 14,
      padding: 16,
      marginBottom: 10,
    },
    dashboardGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    dashboardIcon: {
      fontSize: 30,
      color: colors.accentTextStrong,
      fontWeight: "900",
    },
    dashboardTitle: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    dashboardHint: {
      marginTop: 4,
      color: colors.textMuted,
      fontWeight: "600",
    },
    minimumRepaymentCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      marginBottom: 12,
    },
    minimumRepaymentTitle: {
      color: colors.accentText,
      fontWeight: "800",
      fontSize: 18,
    },
    minimumRepaymentSubtitle: {
      color: colors.textMuted,
      marginTop: 2,
      fontWeight: "600",
    },
    minimumRepaymentValue: {
      marginTop: 8,
      color: colors.text,
      fontWeight: "800",
      fontSize: 28,
    },
    minimumRepaymentNote: {
      marginTop: 8,
      color: colors.textMuted,
      fontWeight: "600",
      fontSize: 12,
      lineHeight: 16,
    },
    monthlyBreakdownWrap: {
      marginTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      gap: 8,
    },
    monthlyBreakdownRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    monthlyBreakdownLabel: {
      color: colors.textSecondary,
      fontWeight: "600",
    },
    monthlyBreakdownValue: {
      color: colors.text,
      fontWeight: "700",
    },
    monthlyBreakdownTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
    },
    monthlyBreakdownTotalLabel: {
      color: colors.text,
      fontWeight: "800",
    },
    monthlyBreakdownTotalValue: {
      color: colors.text,
      fontWeight: "800",
    },
    topActionRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 12,
    },
    primaryButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontWeight: "700",
    },
    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      backgroundColor: colors.card,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontWeight: "700",
    },
    saveProfileInput: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.inputBg,
      color: colors.text,
      marginBottom: 10,
    },
    savedListWrap: {
      paddingBottom: 24,
    },
    emptyText: {
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 24,
      fontWeight: "600",
    },
    savedCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
    },
    savedCardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "800",
    },
    savedCardMeta: {
      color: colors.textMuted,
      marginTop: 4,
      marginBottom: 10,
    },
    savedActionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 8,
    },
    secondaryButtonSmall: {
      borderWidth: 1,
      borderColor: colors.borderStrong,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.inputBg,
    },
    secondaryButtonSmallText: {
      color: colors.textSecondary,
      fontWeight: "700",
      fontSize: 12,
    },
    deleteButtonSmall: {
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: colors.dangerBg,
    },
    deleteButtonSmallText: {
      color: colors.danger,
      fontWeight: "700",
      fontSize: 12,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.modalBackdrop,
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    modalCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
      marginBottom: 10,
    },
    cancelButton: {
      marginTop: 6,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontWeight: "700",
    },
    calculatingBackdrop: {
      flex: 1,
      backgroundColor: colors.calculatingBackdrop,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    calculatingCard: {
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 16,
      alignItems: "center",
      minWidth: 220,
    },
    calculatingText: {
      marginTop: 10,
      color: colors.text,
      fontWeight: "700",
    },
    snackbarWrap: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 16,
      backgroundColor: colors.snackbarBg,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      alignItems: "center",
    },
    snackbarText: {
      color: colors.textInverse,
      fontWeight: "700",
    },
  });
