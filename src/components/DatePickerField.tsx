import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerChangeEvent,
} from "@react-native-community/datetimepicker";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { formatDisplayDate, formatLocalDate, isValidIsoDate, parseIsoDate } from "../utils/dateIso";

interface DatePickerFieldProps {
  value: string | null;
  onChange: (iso: string) => void;
  placeholder?: string;
  minimumDate?: Date;
}

const toDate = (iso: string | null): Date => {
  if (iso && isValidIsoDate(iso)) {
    return parseIsoDate(iso);
  }
  return new Date();
};

export const DatePickerField = ({
  value,
  onChange,
  placeholder = "Select date",
  minimumDate,
}: DatePickerFieldProps) => {
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(toDate(value));
  const styles = useMemo(() => createStyles(), []);

  const openPicker = () => {
    setDraft(toDate(value));
    setOpen(true);
  };

  const applyDate = (date: Date) => {
    onChange(formatLocalDate(date));
    setOpen(false);
  };

  const onValueChange = (_event: DateTimePickerChangeEvent, date: Date) => {
    if (Platform.OS === "android") {
      onChange(formatLocalDate(date));
      setOpen(false);
      return;
    }
    setDraft(date);
  };

  const onDismiss = () => {
    setOpen(false);
  };

  return (
    <View>
      <Pressable
        onPress={openPicker}
        style={[
          styles.field,
          {
            borderColor: colors.borderStrong,
            backgroundColor: colors.inputBg,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={value ? formatDisplayDate(value) : placeholder}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.accentTextStrong} />
        <Text
          style={[
            styles.fieldText,
            { color: value ? colors.text : colors.textMuted },
          ]}
        >
          {value ? formatDisplayDate(value) : placeholder}
        </Text>
      </Pressable>

      {open && Platform.OS === "android" ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="calendar"
          onValueChange={onValueChange}
          onDismiss={onDismiss}
          minimumDate={minimumDate}
        />
      ) : null}

      {open && Platform.OS !== "android" ? (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
            <Pressable
              style={[
                styles.sheet,
                { backgroundColor: colors.card, borderColor: colors.cardBorder },
              ]}
              onPress={() => {}}
            >
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose date</Text>
              <DateTimePicker
                value={draft}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onValueChange={onValueChange}
                onDismiss={onDismiss}
                minimumDate={minimumDate}
                {...(Platform.OS === "ios" ? { themeVariant: isDark ? "dark" : "light" } : {})}
                style={styles.iosPicker}
              />
              <View style={styles.sheetActions}>
                <Pressable
                  onPress={() => setOpen(false)}
                  style={[styles.sheetButton, { borderColor: colors.borderStrong }]}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => applyDate(draft)}
                  style={[styles.sheetButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={{ color: colors.textInverse, fontWeight: "700" }}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
};

const createStyles = () =>
  StyleSheet.create({
    field: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    fieldText: {
      fontSize: 15,
      fontWeight: "600",
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(17,24,39,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      padding: 16,
      paddingBottom: 24,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "800",
      marginBottom: 8,
    },
    iosPicker: {
      alignSelf: "stretch",
    },
    sheetActions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    sheetButton: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
  });
