import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radii } from '../theme';

interface Props {
  style?: ViewStyle;
}

export default function PaperCard({ children, style }: PropsWithChildren<Props>) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.pin} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.paperShadow,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  pin: {
    position: 'absolute',
    top: -8,
    left: '50%',
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.redPen,
    borderWidth: 2,
    borderColor: '#7A2A1C',
    zIndex: 2,
  },
});
