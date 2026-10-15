import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';
import { PlacedMarker as PlacedMarkerType } from '../data';

interface Props {
  marker: PlacedMarkerType;
  containerWidth: number;
  containerHeight: number;
  imageAspectRatio: number;
}

export default function PlacedMarker({ marker, containerWidth, containerHeight, imageAspectRatio }: Props) {
  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  let displayImageWidth = containerWidth;
  let displayImageHeight = containerHeight;
  const containerAspectRatio = containerWidth / containerHeight;

  if (containerAspectRatio > imageAspectRatio) {
    displayImageHeight = containerHeight;
    displayImageWidth = containerHeight * imageAspectRatio;
  } else if (containerAspectRatio < imageAspectRatio) {
    displayImageWidth = containerWidth;
    displayImageHeight = containerWidth / imageAspectRatio;
  }

  const size = Math.min(displayImageWidth, displayImageHeight) * 0.22;
  const imageOffsetX = (containerWidth - displayImageWidth) / 2;
  const imageOffsetY = (containerHeight - displayImageHeight) / 2;
  const left = imageOffsetX + marker.x * displayImageWidth - size / 2;
  const top = imageOffsetY + marker.y * displayImageHeight - size / 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          left,
          top,
          width: size,
          height: size,
          transform: [{ scale }],
        },
      ]}
    >
      <Image source={marker.image} style={styles.image} resizeMode="contain" />
      <Animated.View style={styles.stamp}>
        <Text style={styles.stampText}>FOUND</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  stamp: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: colors.sage,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    transform: [{ rotate: '-6deg' }],
  },
  stampText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.cardBg,
    letterSpacing: 0.5,
  },
});
