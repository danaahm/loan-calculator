import { StyleSheet, Text, View } from "react-native";

interface CardHeaderProps {
  title: string;
  subtitle?: string;
}

export const CardHeader = ({ title, subtitle }: CardHeaderProps) => {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
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
    fontSize: 17,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  subtitle: {
    marginTop: 2,
    color: "#374151",
    fontWeight: "600",
  },
});
