import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TrayItem } from '../data';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  items: TrayItem[];
  selectedId: string | null;
  wrongId: string | null;
  onSelect: (id: string) => void;
}

export default function ObjectTray({ items, selectedId, wrongId, onSelect }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>EXHIBITS -- TAP ONE, THEN TAP ITS SPOT ABOVE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          const isWrong = item.id === wrongId;
          return (
            <Pressable
              key={item.id}
              onPress={() => onSelect(item.id)}
              style={[styles.tile, isSelected && styles.tileSelected, isWrong && styles.tileWrong]}
            >
              <Image source={item.image} style={styles.thumb} resizeMode="contain" />
              <Text numberOfLines={1} style={styles.tileLabel}>{item.label}</Text>
            </Pressable>
          );
        })}
        {items.length === 0 && <Text style={styles.empty}>All exhibits placed.</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.sm,
  },
  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.inkMuted,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  row: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tile: {
    width: 88,
    height: 104,
    backgroundColor: colors.cardBg,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.paperShadow,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
    marginRight: spacing.sm,
  },
  tileSelected: {
    borderColor: colors.gold,
    backgroundColor: '#FFF6DE',
    transform: [{ translateY: -4 }],
  },
  tileWrong: {
    borderColor: colors.redPen,
    backgroundColor: '#FBE6E1',
  },
  thumb: {
    width: 56,
    height: 56,
  },
  tileLabel: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.ink,
    marginTop: spacing.xs,
    maxWidth: 80,
    textAlign: 'center',
  },
  empty: {
    fontFamily: fonts.body,
    color: colors.inkMuted,
    paddingVertical: spacing.md,
  },
});
