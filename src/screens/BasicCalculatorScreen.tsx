import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  loadBasicCalcHistory,
  MAX_BASIC_CALC_HISTORY,
  saveBasicCalcHistory,
} from "../storage/localState";
import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";
import { type ThemeColors } from "../theme/tokens";
import { type BasicCalcHistoryEntry } from "../types/basicCalculator";
import {
  applyCalcKey,
  chainText,
  createInitialCalcState,
  groupCalcText,
  recallCalcValue,
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

/** Older lines fade like ink on a receipt, but never past legible. */
const tapeOpacity = (index: number): number => Math.max(0.4, 1 - index * 0.2);

/** Grouped for reading, with a true minus sign for the operator. */
const showCalcText = (text: string): string =>
  groupCalcText(text).replace(/ - /g, " − ");

const persistHistory = (entries: BasicCalcHistoryEntry[]) => {
  saveBasicCalcHistory(entries).catch(() => {});
};

export const BasicCalculatorScreen = () => {
  const { colors } = useTheme();
  const t = useTranslation();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [calc, setCalc] = useState<CalcState>(createInitialCalcState);
  const [history, setHistory] = useState<BasicCalcHistoryEntry[]>([]);
  // History stretches the tape over the keypad to show more of it at once.
  const [historyOpen, setHistoryOpen] = useState(false);
  // Only a line added while watching slides in; the stored tape just appears.
  const [freshEntryId, setFreshEntryId] = useState<string | null>(null);

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
      setFreshEntryId(entry.id);
      setHistory((current) => {
        const updated = [entry, ...current].slice(0, MAX_BASIC_CALC_HISTORY);
        persistHistory(updated);
        return updated;
      });
    }
  };

  const recallEntry = (entry: BasicCalcHistoryEntry) => {
    setCalc((current) => recallCalcValue(current, entry.result));
    setHistoryOpen(false);
  };

  const deleteEntry = (id: string) => {
    setHistory((current) => {
      const updated = current.filter((entry) => entry.id !== id);
      persistHistory(updated);
      return updated;
    });
  };

  const confirmDeleteEntry = (entry: BasicCalcHistoryEntry) => {
    Alert.alert(
      t("basicCalc.removeLineTitle"),
      `${showCalcText(entry.expression)} = ${showCalcText(entry.result)}`,
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.remove"),
          style: "destructive",
          onPress: () => deleteEntry(entry.id),
        },
      ]
    );
  };

  // The tape is the only copy of up to 50 sums, so clearing it asks first.
  const confirmClearHistory = () => {
    Alert.alert(t("basicCalc.clearTitle"), t("basicCalc.clearBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("basicCalc.clearAll"),
        style: "destructive",
        onPress: () => {
          setHistory([]);
          persistHistory([]);
        },
      },
    ]);
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

  const chain = showCalcText(chainText(calc));

  return (
    <View style={styles.screen}>
      <View style={styles.displayCard}>
        <View style={styles.displayTopRow}>
          <Pressable
            onPress={() => setHistoryOpen((open) => !open)}
            style={styles.historyToggle}
            accessibilityRole="button"
            accessibilityLabel={
              historyOpen ? t("basicCalc.hideHistory") : t("basicCalc.showHistory")
            }
          >
            <Ionicons
              name={historyOpen ? "keypad-outline" : "time-outline"}
              size={22}
              color={colors.accentTextStrong}
            />
            <Text style={styles.historyToggleText}>
              {historyOpen ? t("basicCalc.keypad") : t("basicCalc.history")}
            </Text>
          </Pressable>
          {historyOpen && history.length > 0 ? (
            <Pressable
              onPress={confirmClearHistory}
              hitSlop={8}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel={t("basicCalc.clearAll")}
            >
              <Ionicons name="trash-outline" size={15} color={colors.danger} />
              <Text style={styles.clearText}>{t("basicCalc.clearAll")}</Text>
            </Pressable>
          ) : null}
        </View>

        {historyOpen && history.length === 0 ? (
          <Text style={styles.emptyHistory}>{t("basicCalc.emptyHistory")}</Text>
        ) : null}

        {/*
          Inverted, so the newest line sits just above the live sum and the
          tape grows upwards like paper feeding out of an adding machine.
        */}
        <FlatList
          style={styles.tape}
          data={history}
          inverted
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={item.id === freshEntryId ? FadeInDown.duration(220) : undefined}
              style={{ opacity: historyOpen ? 1 : tapeOpacity(index) }}
            >
              <Pressable
                onPress={() => recallEntry(item)}
                onLongPress={() => confirmDeleteEntry(item)}
                style={({ pressed }) => [
                  styles.tapeLine,
                  pressed && { backgroundColor: colors.inputBg },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${showCalcText(item.expression)} = ${showCalcText(item.result)}`}
                accessibilityHint={t("basicCalc.useResultHint")}
                accessibilityActions={[
                  { name: "delete", label: t("basicCalc.deleteHistoryItem") },
                ]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === "delete") {
                    confirmDeleteEntry(item);
                  }
                }}
              >
                <Text style={styles.tapeExpression} numberOfLines={2}>
                  {showCalcText(item.expression)}
                </Text>
                <Text style={styles.tapeResult} numberOfLines={1}>
                  = {showCalcText(item.result)}
                </Text>
              </Pressable>
            </Animated.View>
          )}
        />

        {historyOpen ? null : (
          <View style={[styles.live, history.length > 0 && styles.liveUnderTape]}>
            <Text style={styles.chain} numberOfLines={1} ellipsizeMode="head">
              {chain}
            </Text>
            <Text
              style={[styles.display, calc.error && styles.displayError]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.4}
            >
              {showCalcText(calc.display)}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.keypad, historyOpen && styles.keypadHidden]}>
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
                  accessibilityLabel={item.key === "⌫" ? t("basicCalc.backspace") : item.label}
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
      marginBottom: 4,
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
    clearButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 4,
    },
    clearText: {
      color: colors.danger,
      fontWeight: "700",
      fontSize: 13,
    },
    emptyHistory: {
      color: colors.textMuted,
      fontWeight: "600",
      textAlign: "center",
      marginTop: 32,
    },
    tape: {
      flex: 1,
    },
    tapeLine: {
      alignItems: "flex-end",
      paddingVertical: 6,
      paddingHorizontal: 8,
      marginHorizontal: -8,
      borderRadius: 10,
    },
    tapeExpression: {
      color: colors.textMuted,
      fontWeight: "600",
      fontSize: 14,
      textAlign: "right",
    },
    tapeResult: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 18,
      marginTop: 1,
    },
    live: {
      alignItems: "flex-end",
    },
    // Where the tape ends and the sum still being worked on begins.
    liveUnderTape: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderStrong,
      paddingTop: 8,
      marginTop: 4,
    },
    chain: {
      color: colors.textMuted,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 2,
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
    keypad: {
      flex: 1.15,
      gap: 8,
      paddingBottom: 4,
      minHeight: 280,
    },
    // Kept mounted while History has the room, so returning is instant.
    keypadHidden: {
      display: "none",
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
