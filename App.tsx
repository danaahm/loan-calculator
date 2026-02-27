import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AmortizationGrid } from "./src/components/AmortizationGrid";
import { BalanceComparisonChart } from "./src/components/BalanceComparisonChart";
import { LoanForm } from "./src/components/LoanForm";
import { PieBreakdownChart } from "./src/components/PieBreakdownChart";
import {
  loadLoanInput,
  loadSavedLoanProfiles,
  saveLoanInput,
  saveSavedLoanProfiles,
} from "./src/storage/localState";
import {
  type LoanCalculationResult,
  type LoanInput,
  type RepaymentFrequency,
  type SavedLoanProfile,
} from "./src/types/loan";
import { calculateLoan, normalizeInput } from "./src/utils/loanMath";
import { formatCurrency } from "./src/utils/format";

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
  const [screen, setScreen] = useState<"home" | "calculator" | "saved">("home");
  const [input, setInput] = useState<LoanInput>(DEFAULT_INPUT);
  const [result, setResult] = useState<LoanCalculationResult | null>(null);
  const [savedProfiles, setSavedProfiles] = useState<SavedLoanProfile[]>([]);
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
  const [loadingState, setLoadingState] = useState(true);
  const snackbarTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const ignoreCurrentCalculationSavePrompt = () => {
    setLastSavedHash(lastCalculatedHash);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const [savedInput, loadedProfiles] = await Promise.all([
        loadLoanInput(),
        loadSavedLoanProfiles(),
      ]);
      const initial = normalizeInput(savedInput ?? DEFAULT_INPUT);
      const initialHash = JSON.stringify(initial);
      setInput(initial);
      setResult(calculateLoan(initial));
      setLastCalculatedHash(initialHash);
      setLastSavedHash(initialHash);
      setSavedProfiles(loadedProfiles);
      setLoadingState(false);
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
    setSnackbarVisible(true);
    if (snackbarTimeoutRef.current) {
      clearTimeout(snackbarTimeoutRef.current);
    }
    snackbarTimeoutRef.current = setTimeout(() => {
      setSnackbarVisible(false);
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (snackbarTimeoutRef.current) {
        clearTimeout(snackbarTimeoutRef.current);
      }
    };
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
      Alert.alert("Updated", "Loan profile updated.");
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
    Alert.alert("Saved", "Loan profile saved.");
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

  if (loadingState) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.stickyHeader}>
          <View style={styles.brandRow}>
            <Image source={require("./assets/loan-calculator.png")} style={styles.logo} />
            <Text style={styles.heading}>Simple Loan Calculator</Text>
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

        {screen === "home" ? (
          <View style={styles.pageContent}>
            <View style={styles.dashboardGrid}>
              <Pressable
                style={styles.dashboardCard}
                onPress={() => setScreen("calculator")}
              >
                <Text style={styles.dashboardIcon}>🧮</Text>
                <Text style={styles.dashboardTitle}>Calculate</Text>
                <Text style={styles.dashboardHint}>Open loan calculator</Text>
              </Pressable>
              <Pressable style={styles.dashboardCard} onPress={() => setScreen("saved")}>
                <Text style={styles.dashboardIcon}>📄</Text>
                <Text style={styles.dashboardTitle}>My Saved Loans</Text>
                <Text style={styles.dashboardHint}>
                  {savedProfiles.length} profile{savedProfiles.length === 1 ? "" : "s"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {screen === "calculator" ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
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
                </View>

                <PieBreakdownChart
                  principal={result.activeSchedule.summary.totalPrincipalPaid}
                  interest={result.activeSchedule.summary.totalInterestPaid}
                  fees={result.activeSchedule.summary.totalFeesPaid}
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

        <View style={styles.bottomNav}>
          <Pressable
            style={[styles.bottomNavButton, screen === "home" && styles.bottomNavButtonActive]}
            onPress={() => setScreen("home")}
          >
            <Text
              style={[styles.bottomNavText, screen === "home" && styles.bottomNavTextActive]}
            >
              Home
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.bottomNavButton,
              screen === "calculator" && styles.bottomNavButtonActive,
            ]}
            onPress={() => setScreen("calculator")}
          >
            <Text
              style={[
                styles.bottomNavText,
                screen === "calculator" && styles.bottomNavTextActive,
              ]}
            >
              Calculator
            </Text>
          </Pressable>
          <Pressable
            style={[styles.bottomNavButton, screen === "saved" && styles.bottomNavButtonActive]}
            onPress={() => setScreen("saved")}
          >
            <Text
              style={[styles.bottomNavText, screen === "saved" && styles.bottomNavTextActive]}
            >
              Saved Loans
            </Text>
          </Pressable>
        </View>

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
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.calculatingText}>Calculating your loan...</Text>
            </View>
          </View>
        </Modal>

        {snackbarVisible ? (
          <View style={styles.snackbarWrap}>
            <Text style={styles.snackbarText}>Your loan calculation is ready</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </GestureHandlerRootView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
  },
  pageContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 96,
  },
  stickyHeader: {
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  saveStickyBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    gap: 8,
  },
  saveStickyPrimaryButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  saveStickySecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 8,
  },
  bottomNavButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
  },
  bottomNavButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  bottomNavText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 12,
  },
  bottomNavTextActive: {
    color: "#1d4ed8",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginLeft: 10,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  dashboardCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dbeafe",
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
    color: "#1d4ed8",
    fontWeight: "900",
  },
  dashboardTitle: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  dashboardHint: {
    marginTop: 4,
    color: "#4b5563",
    fontWeight: "600",
  },
  minimumRepaymentCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    padding: 14,
    marginBottom: 12,
  },
  minimumRepaymentTitle: {
    color: "#1e3a8a",
    fontWeight: "800",
    fontSize: 18,
  },
  minimumRepaymentSubtitle: {
    color: "#4b5563",
    marginTop: 2,
    fontWeight: "600",
  },
  minimumRepaymentValue: {
    marginTop: 8,
    color: "#111827",
    fontWeight: "800",
    fontSize: 28,
  },
  topActionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: {
    color: "#374151",
    fontWeight: "700",
  },
  saveProfileCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
    padding: 14,
    marginBottom: 12,
  },
  saveProfileTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e3a8a",
    marginBottom: 8,
  },
  saveProfileInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
    marginBottom: 10,
  },
  savedListWrap: {
    paddingBottom: 120,
  },
  emptyText: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 24,
    fontWeight: "600",
  },
  savedCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    marginBottom: 10,
  },
  savedCardTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  savedCardMeta: {
    color: "#4b5563",
    marginTop: 4,
    marginBottom: 10,
  },
  savedActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  secondaryButtonSmall: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f9fafb",
  },
  secondaryButtonSmallText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 12,
  },
  deleteButtonSmall: {
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#fef2f2",
  },
  deleteButtonSmallText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  cancelButton: {
    marginTop: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  cancelButtonText: {
    color: "#374151",
    fontWeight: "700",
  },
  calculatingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.28)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  calculatingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
    minWidth: 220,
  },
  calculatingText: {
    marginTop: 10,
    color: "#111827",
    fontWeight: "700",
  },
  snackbarWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 86,
    backgroundColor: "rgba(17,24,39,0.9)",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  snackbarText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
