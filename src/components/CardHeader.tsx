import { Pressable, StyleSheet, Text, View } from "react-native";

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const CardHeader = ({
  title,
  subtitle,
  collapsed,
  onToggleCollapse,
}: CardHeaderProps) => {
  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Text style={styles.title}>{title}</Text>
        {onToggleCollapse ? (
          <Pressable onPress={onToggleCollapse} style={styles.toggleButton}>
            <Text style={styles.toggleText}>{collapsed ? "+" : "-"}</Text>
          </Pressable>
        ) : null}
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#eff6ff",
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleButton: {
    borderWidth: 1,
    borderColor: "#bfdbfe",
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dbeafe",
  },
  toggleText: {
    color: "#1d4ed8",
    fontWeight: "800",
    fontSize: 20,
    lineHeight: 22,
  },
  subtitle: {
    marginTop: 2,
    color: "#374151",
    fontWeight: "600",
  },
});
