import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { type SavedLoanProfile } from "../types/loan";
import { buildSavedProfileCardSummary } from "../utils/profileSummary";

interface LoanStartChooserProps {
  savedProfiles: SavedLoanProfile[];
  onCreateNew: () => void;
  onSelectProfile: (profile: SavedLoanProfile) => void;
}

export const LoanStartChooser = ({
  savedProfiles,
  onCreateNew,
  onSelectProfile,
}: LoanStartChooserProps) => {
  const { colors } = useTheme();
  const [listOpen, setListOpen] = useState(false);
  const hasProfiles = savedProfiles.length > 0;

  return (
    <ScrollView
      style={[styles.page, { backgroundColor: colors.page }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Start a loan</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>
        Begin from scratch, or pick up a loan you already saved.
      </Text>

      <Pressable
        style={[styles.option, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        onPress={onCreateNew}
      >
        <Ionicons name="add-circle-outline" size={26} color={colors.accentTextStrong} />
        <View style={styles.optionText}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>Create new loan</Text>
          <Text style={[styles.optionHint, { color: colors.textMuted }]}>
            Start with an empty form.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>

      <Pressable
        style={[
          styles.option,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
          !hasProfiles && styles.optionDisabled,
        ]}
        disabled={!hasProfiles}
        onPress={() => setListOpen((prev) => !prev)}
      >
        <Ionicons name="document-text-outline" size={26} color={colors.accentTextStrong} />
        <View style={styles.optionText}>
          <Text style={[styles.optionTitle, { color: colors.text }]}>Select existing loan</Text>
          <Text style={[styles.optionHint, { color: colors.textMuted }]}>
            {hasProfiles
              ? `Prefill from one of your ${savedProfiles.length} saved loan${
                  savedProfiles.length === 1 ? "" : "s"
                }.`
              : "No saved loans yet."}
          </Text>
        </View>
        {hasProfiles ? (
          <Ionicons
            name={listOpen ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textMuted}
          />
        ) : null}
      </Pressable>

      {listOpen && hasProfiles
        ? savedProfiles.map((profile) => {
            const summary = buildSavedProfileCardSummary(profile);
            return (
              <Pressable
                key={profile.id}
                style={[
                  styles.profileRow,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => onSelectProfile(profile)}
              >
                <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                  {profile.name}
                </Text>
                <Text style={[styles.profileMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {summary.headline}
                </Text>
              </Pressable>
            );
          })
        : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: "800",
  },
  subheading: {
    marginTop: 4,
    marginBottom: 14,
    fontWeight: "600",
  },
  option: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionDisabled: {
    opacity: 0.55,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  optionHint: {
    marginTop: 2,
    fontWeight: "600",
  },
  profileRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  profileName: {
    fontSize: 15,
    fontWeight: "800",
  },
  profileMeta: {
    marginTop: 2,
    fontWeight: "600",
    fontSize: 12,
  },
});
