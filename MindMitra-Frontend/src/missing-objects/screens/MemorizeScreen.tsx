import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import CaseButton from '../components/CaseButton';
import PaperCard from '../components/PaperCard';
import { PuzzleSet } from '../data';
import { useMeasuredWidth } from '../utils';
import { colors, fonts, spacing } from '../theme';

interface Props {
  set: PuzzleSet;
  onReady: () => void;
}

export default function MemorizeScreen({ set, onReady }: Props) {
  const [onLayout, width] = useMeasuredWidth();
  const height = width / set.aspectRatio;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>EXHIBIT A -- ORIGINAL PHOTO</Text>
        <Text style={styles.title}>{set.name}</Text>
        <Text style={styles.subtitle}>Study the scene closely. Every item shown here belongs.</Text>

        <PaperCard style={styles.imageCard}>
          <View onLayout={onLayout}>
            {width > 0 && (
              <Image
                source={set.originalImage}
                style={{ width, height, borderRadius: 8 }}
                resizeMode="contain"
              />
            )}
          </View>
        </PaperCard>

        <CaseButton label="I've Studied It -- Show Today's Photo" onPress={onReady} style={styles.button} />
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
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.redPen,
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: spacing.lg,
  },
  imageCard: {
    marginBottom: spacing.xl,
  },
  button: {
    alignSelf: 'center',
  },
});
