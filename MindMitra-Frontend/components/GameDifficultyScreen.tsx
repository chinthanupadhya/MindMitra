import React from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import colors from "../theme/colors";
import GameScreenHeader from "./GameScreenHeader";

export interface DifficultyOption {
  key: "easy" | "medium" | "hard";
  label: string;   // already localized by the caller
  subtitle: string;
}

interface GameDifficultyScreenProps {
  title: string;
  subtitle?: string;
  options: DifficultyOption[];
  onSelect: (key: "easy" | "medium" | "hard") => void;
  extra?: { label: string; subtitle: string; onPress: () => void }[];
  after?: React.ReactNode;
}

/**
 * Shared, theme-consistent difficulty picker used by Match 2, Meet & Greet,
 * and Monument Memory. Labels are passed in already translated so the page
 * works in every supported language.
 */
const GameDifficultyScreen: React.FC<GameDifficultyScreenProps> = ({
  title,
  subtitle,
  options,
  onSelect,
  extra = [],
  after = null,
}) => {
  const router = useRouter();

  const badgeFor: Record<string, string> = {
    easy: colors.successSoft,
    medium: colors.warningSoft,
    hard: colors.errorContainer,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <GameScreenHeader
        title={title}
        subtitle={subtitle}
        onBackPress={() => router.back()}
      />
      <View style={styles.container}>
        {options.map((opt) => {
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.option, { backgroundColor: badgeFor[opt.key] }]}
              onPress={() => onSelect(opt.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Text style={styles.optionSub}>{opt.subtitle}</Text>
            </TouchableOpacity>
          );
        })}

        {extra.map((x) => (
          <TouchableOpacity
            key={x.label}
            style={[styles.option, styles.extraOption]}
            onPress={x.onPress}
            activeOpacity={0.8}
          >
            <Text style={styles.optionLabel}>{x.label}</Text>
            <Text style={styles.optionSub}>{x.subtitle}</Text>
          </TouchableOpacity>
        ))}

        {after}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  option: {
    width: "100%",
    minHeight: 96,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.outlineVariant,
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    marginVertical: 14,
  },
  extraOption: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLightDim,
  },
  optionLabel: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  optionSub: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 6,
  },
});

export default GameDifficultyScreen;