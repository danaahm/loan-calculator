import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  loadBasicCalcHistory,
  MAX_BASIC_CALC_HISTORY,
  saveBasicCalcHistory,
} from "../storage/localState";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import { type BasicCalcHistoryEntry } from "../types/basicCalculator";
import {
  applyCalcKey,
  createInitialCalcState,
  type CalcKey,
  type CalcState,
} from "../utils/basicCalc";

const KEYPAD: { key: CalcKey; label: string }[][] = [
  [
    { key: "C", label: "C" },
    { key: "⌫", label: "⌫" },
    { key: "%", label: "%" },
    { key: "÷", label: "÷" },
  ],
  [
    { key: "7", label: "7" },
    { key: "8", label: "8" },
    { key: "9", label: "9" },
    { key: "×", label: "×" },
  ],
  [
    { key: "4", label: "4" },
    { key: "5", label: "5" },
    { key: "6", label: "6" },
    { key: "-", label: "−" },
  ],
  [
    { key: "1", label: "1" },
    { key: "2", label: "2" },
    { key: "3", label: "3" },
    { key: "+", label: "+" },
  ],
  [
    { key: "±", label: "±" },
    { key: "0", label: "0" },
    { key: ".", label: "." },
    { key: "=", label: "=" },
  ],
];

type KeyKind = "number" | "op" | "fn" | "equals";

const keyKind = (key: CalcKey): KeyKind => {
  if (key === "=") {
    return "equals";
  }
  if (key === "+" || key === "-" || key === "×" || key === "÷") {
    return "op";
  }
  if (key === "C" || key === "⌫" || key === "%" || key === "±") {
    return "fn";
  }
  return "number";
};

const persistHistory = (entries: BasicCalcHistoryEntry[]) => {
  saveBasicCalcHistory(entries).catch(() => {});
};

export const BasicCalculatorScreen = () => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [calc, setCalc] = useState<CalcState>(createInitialCalcState);
  const [history, setHistory] = useState<BasicCalcHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    loadBasicCalcHistory()
      .then(setHistory)
      .catch(() => {});
  }, []);

  const handleKey = (key: CalcKey) => {
    const next = applyCalcKey(calc, key);
    setCalc(next);
    if (key === "=" && next.justEvaluated && next.lastExpression && !next.error) {
      const entry: BasicCalcHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        expression: next.lastExpression,
        result: next.display,
        createdAt: new Date().toISOString(),
      };
      setHistory((current) => {
        const updated = [entry, ...current].slice(0, MAX_BASIC_CALC_HISTORY);
        persistHistory(updated);
        return updated;
      });
    }
  };

  const recallEntry = (entry: BasicCalcHistoryEntry) => {
    setCalc({
      ...createInitialCalcState(),
      display: entry.result,
      expression: entry.expression,
      justEvaluated: true,
    });
    setHistoryOpen(false);
  };

  const deleteEntry = (id: string) => {
    setHistory((current) => {
      const updated = current.filter((entry) => entry.id !== id);
      persistHistory(updated);
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    persistHistory([]);
  };

  const keyColors = (kind: KeyKind) => {
    switch (kind) {
      case "equals":
        return { backgroundColor: colors.keyEqualsBg, color: colors.keyEqualsText };
      case "op":
        return { backgroundColor: colors.keyOpBg, color: colors.keyOpText };
      case "fn":
        return { backgroundColor: colors.keyFnBg, color: colors.keyFnText };
      default:
        return { backgroundColor: colors.keyNumberBg, color: colors.keyNumberText };
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.displayCard}>
        <View style={styles.displayTopRow}>
          <Pressable
            onPress={() => setHistoryOpen((open) => !open)}
            style={styles.historyToggle}
            accessibilityRole="button"
            accessibilityLabel={historyOpen ? "Hide history" : "Show history"}
          >
            <Ionicons
              name={historyOpen ? "keypad-outline" : "time-outline"}
              size={22}
              color={colors.accentTextStrong}
            />
            <Text style={styles.historyToggleText}>
              {historyOpen ? "Keypad" : "History"}
            </Text>
          </Pressable>
          {historyOpen && history.length > 0 ? (
            <Pressable onPress={clearHistory} accessibilityRole="button">
              <Text style={styles.clearAllText}>Clear all</Text>
            </Pressable>
          ) : null}
        </View>

        {historyOpen ? (
          <FlatList
            style={styles.historyList}
            data={history}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.emptyHistory}>No calculations yet.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.historyRow}>
                <Pressable style={styles.historyCopy} onPress={() => recallEntry(item)}>
                  <Text style={styles.historyExpression}>{item.expression}</Text>
                  <Text style={styles.historyResult}>= {item.result}</Text>
                </Pressable>
                <Pressable
                  onPress={() => deleteEntry(item.id)}
                  style={styles.historyDelete}
                  accessibilityRole="button"
                  accessibilityLabel="Delete history item"
                >
                  <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
                </Pressable>
              </View>
            )}
          />
        ) : (
          <View style={styles.displayValues}>
            <Text style={styles.expression} numberOfLines={1}>
              {calc.expression}
            </Text>
            <Text
              style={[styles.display, calc.error && styles.displayError]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.4}
            >
              {calc.display}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.keypad}>
        {KEYPAD.map((row) => (
          <View key={row.map((item) => item.key).join("-")} style={styles.keyRow}>
            {row.map((item) => {
              const kind = keyKind(item.key);
              const palette = keyColors(kind);
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handleKey(item.key)}
                  style={({ pressed }) => [
                    styles.key,
                    { backgroundColor: palette.backgroundColor, opacity: pressed ? 0.72 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={item.key === "⌫" ? "Backspace" : item.label}
                >
                  {item.key === "⌫" ? (
                    <Ionicons name="backspace-outline" size={26} color={palette.color} />
                  ) : (
                    <Text style={[styles.keyLabel, { color: palette.color }]}>{item.label}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.page,
      paddingHorizontal: 12,
      paddingTop: 8,
      paddingBottom: 8,
    },
    displayCard: {
      flex: 1,
      backgroundColor: colors.calcDisplayBg,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 16,
      marginBottom: 10,
      minHeight: 140,
    },
    displayTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    historyToggle: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 4,
      paddingRight: 8,
    },
    historyToggleText: {
      color: colors.accentTextStrong,
      fontWeight: "700",
      fontSize: 13,
    },
    clearAllText: {
      color: colors.danger,
      fontWeight: "700",
      fontSize: 13,
    },
    displayValues: {
      flex: 1,
      justifyContent: "flex-end",
      alignItems: "flex-end",
    },
    expression: {
      color: colors.textMuted,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 6,
      width: "100%",
      textAlign: "right",
      minHeight: 24,
    },
    display: {
      color: colors.text,
      fontSize: 56,
      fontWeight: "300",
      width: "100%",
      textAlign: "right",
    },
    displayError: {
      color: colors.errorText,
      fontSize: 40,
    },
    historyList: {
      flex: 1,
    },
    emptyHistory: {
      color: colors.textMuted,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 32,
    },
    historyRow: {
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
    },
    historyCopy: {
      flex: 1,
      alignItems: "flex-end",
      paddingRight: 8,
    },
    historyExpression: {
      color: colors.textMuted,
      fontWeight: "600",
      fontSize: 14,
    },
    historyResult: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 22,
      marginTop: 2,
    },
    historyDelete: {
      padding: 4,
    },
    keypad: {
      flex: 1.15,
      gap: 8,
      paddingBottom: 4,
      minHeight: 280,
    },
    keyRow: {
      flex: 1,
      flexDirection: "row",
      gap: 8,
    },
    key: {
      flex: 1,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    keyLabel: {
      fontSize: 26,
      fontWeight: "500",
    },
  });
