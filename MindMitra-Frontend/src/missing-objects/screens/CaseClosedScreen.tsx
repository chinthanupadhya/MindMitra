import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import CaseButton from '../components/CaseButton';
import PaperCard from '../components/PaperCard';
import { PuzzleSet } from '../data';
import { colors, fonts, spacing } from '../theme';
import { useTranslation } from '../../i18n/useTranslation';

interface Props {
  set: PuzzleSet;
  wrongAttempts: number;
  timeMs: number;
  onPlayAgain: () => void;
  onHome: () => void;
}

function formatTime(ms: number) {
  const totalSeconds = Math.round(ms / 1000);
  return `${totalSeconds} second${totalSeconds === 1 ? '' : 's'}`;
}

function rating(wrongAttempts: number) {
  if (wrongAttempts === 0) return 'Flawless deduction.';
  if (wrongAttempts <= 2) return 'Sharp-eyed work.';
  if (wrongAttempts <= 5) return 'Case cracked, a little messy.';
  return 'You got there in the end.';
}

export default function CaseClosedScreen({ set, wrongAttempts, timeMs, onPlayAgain, onHome }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.stampOuter}>CASE CLOSED</Text>
        <Text style={styles.subtitle}>{set.name}</Text>

        <PaperCard style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.statLabel}>{t("time_taken")}</Text>
            <Text style={styles.statValue}>{formatTime(timeMs)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.statLabel}>Mistakes</Text>
            <Text style={styles.statValue}>{wrongAttempts}</Text>
          </View>
          <Text style={styles.verdict}>{rating(wrongAttempts)}</Text>
        </PaperCard>

        <CaseButton label={t("play_again")} onPress={onPlayAgain} style={styles.button} />
        <CaseButton label={t("home")} onPress={onHome} variant="secondary" style={styles.button} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  stampOuter: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.redPen,
    textAlign: 'center',
    letterSpacing: 2,
    transform: [{ rotate: '-4deg' }],
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.xl,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
  },
  verdict: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.sage,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  button: {
    marginBottom: spacing.md,
    alignSelf: 'center',
  },
});
