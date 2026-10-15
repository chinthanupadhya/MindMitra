import React from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import CaseButton from '../components/CaseButton';
import PaperCard from '../components/PaperCard';
import { colors, fonts, spacing } from '../theme';

interface Props {
  onStart: () => void;
  setCount: number;
}

export default function HomeScreen({ onStart, setCount }: Props) {
  const router = useRouter();

  const handleBackPress = () => {
    Alert.alert(
      'Leave game?',
      'Do you want to return to the games list?',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ],
      { cancelable: true }
    );
  };
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
            <Text style={styles.backBtnText}>⬅️</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.eyebrow}>A SPOT-THE-DIFFERENCE CASE FILE</Text>
        <Text style={styles.title}>Missing Objects</Text>

        <PaperCard style={styles.card}>
          <Text style={styles.step}>1. Study the original photo of a scene.</Text>
          <Text style={styles.step}>2. A tampered photo is missing a few items.</Text>
          <Text style={styles.step}>
            3. Tap an exhibit below, then tap where it belongs. Watch out --
            some exhibits are decoys from other cases.
          </Text>
        </PaperCard>

        <CaseButton label="Open a New Case" onPress={onStart} style={styles.button} />
        <Text style={styles.footnote}>
          {setCount} case file{setCount === 1 ? '' : 's'} loaded -- a new one is drawn at random each round.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.redPen,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 52,
    color: colors.ink,
    marginBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
  step: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  button: {
    alignSelf: 'flex-start',
  },
  footnote: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#EFE6D3',
  },
  backBtnText: {
    fontSize: 20,
  },
});
