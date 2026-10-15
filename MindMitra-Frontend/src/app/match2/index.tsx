import { View, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import GameDifficultyScreen from '../../../components/GameDifficultyScreen';
import { useTranslation } from '../../i18n/useTranslation';
import colors from '../../../theme/colors';

export default function Match2DifficultyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [customPairs, setCustomPairs] = useState('18');

  const handleSelect = (difficulty: "easy" | "medium" | "hard") => {
    router.push(`/match2/${difficulty}`);
  };

  const handleCustom = () => {
    let p = parseInt(customPairs) || 18;
    if (p > 18) p = 18;
    if (p < 1) p = 1;
    router.push(`/match2/custom?pairs=${p}`);
  };

  return (
    <GameDifficultyScreen
      title={t("difficulty")}
      subtitle="Match 2"
      onSelect={handleSelect}
      options={[
        { key: "easy", label: t("easy"), subtitle: "6 Pairs (12 Cards)" },
        { key: "medium", label: t("medium"), subtitle: "10 Pairs (20 Cards)" },
        { key: "hard", label: t("hard"), subtitle: "15 Pairs (30 Cards)" },
      ]}
      after={
        <View style={styles.customBox}>
          <Text style={styles.customTitle}>Custom Mode</Text>
          <View style={styles.customInputRow}>
            <TextInput
              style={styles.input}
              value={customPairs}
              onChangeText={setCustomPairs}
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.customHint}> Pairs (Max 18)</Text>
          </View>
          <TouchableOpacity style={styles.customButton} onPress={handleCustom}>
            <Text style={styles.customButtonText}>Play Custom</Text>
          </TouchableOpacity>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  customBox: {
    alignSelf: "stretch",
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.primaryLightDim,
    borderRadius: 20,
    padding: 18,
    marginTop: 10,
  },
  customTitle: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 12 },
  customInputRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", marginBottom: 12 },
  input: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.primary,
    fontSize: 24,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    width: 64,
    textAlign: "center",
  },
  customHint: { fontSize: 17, color: colors.text, marginLeft: 8 },
  customButton: {
    alignSelf: "center",
    minHeight: 52,
    paddingHorizontal: 30,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  customButtonText: { fontSize: 18, fontWeight: "700", color: colors.onPrimary },
});