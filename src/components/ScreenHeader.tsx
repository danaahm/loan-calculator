import { type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTranslation } from "../i18n/LocaleProvider";
import { useTheme } from "../theme/ThemeProvider";

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** Buttons at the end of the row, such as "add". */
  actions?: ReactNode;
  /** Spacing around the row, which differs with each screen's own padding. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Back, title and actions on a single row. They used to stack as a "Back" link
 * over the title, which cost a line of every sub-page for one word. The word
 * is kept for screen readers.
 */
export const ScreenHeader = ({ title, onBack, actions, style }: ScreenHeaderProps) => {
  const { colors } = useTheme();
  const t = useTranslation();

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={t("common.back")}
      >
        <Ionicons name="chevron-back" size={26} color={colors.accentTextStrong} />
      </Pressable>
      <Text
        style={[styles.title, { color: colors.text }]}
        numberOfLines={2}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    // Pulls the chevron's glyph, not its tap area, onto the page's edge.
    marginLeft: -10,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
