import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import ObjectTray from '../components/ObjectTray';
import PlacedMarker from '../components/PlacedMarker';
import { PlacedMarker as PlacedMarkerType, PuzzleSet, TrayItem } from '../data';
import { buildTray } from '../data';
import { useMeasuredWidth } from '../utils';
import { colors, fonts, spacing } from '../theme';

interface Props {
  set: PuzzleSet;
  allSets: PuzzleSet[];
  onComplete: (result: { wrongAttempts: number; timeMs: number }) => void;
}

const HIT_RADIUS_FRACTION = 0.11;

export default function InvestigateScreen({ set, allSets, onComplete }: Props) {
  const [tray] = useState<TrayItem[]>(() => buildTray(set, allSets));
  const [placed, setPlaced] = useState<PlacedMarkerType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [wrongId, setWrongId] = useState<string | null>(null);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [onSceneLayout, sceneWidth] = useMeasuredWidth();
  const sceneHeight = sceneWidth / set.aspectRatio;
  const startTime = useRef(Date.now());
  const wrongTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalMissing = set.missingObjects.length;
  const remainingTray = useMemo(
    () => tray.filter((item) => !placed.some((p) => p.objectId === item.id)),
    [tray, placed]
  );

  useEffect(() => {
    return () => {
      if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (placed.length === totalMissing && totalMissing > 0) {
      const t = setTimeout(() => {
        onComplete({ wrongAttempts, timeMs: Date.now() - startTime.current });
      }, 700);
      return () => clearTimeout(t);
    }
  }, [placed.length, totalMissing, onComplete, wrongAttempts]);

  const flashWrong = (id: string) => {
    setWrongId(id);
    setWrongAttempts((n) => n + 1);
    if (wrongTimeout.current) clearTimeout(wrongTimeout.current);
    wrongTimeout.current = setTimeout(() => setWrongId(null), 450);
  };

  const handleSelect = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  };

  const handleScenePress = (evt: { nativeEvent: { locationX: number; locationY: number } }) => {
    if (!selectedId || sceneWidth === 0) return;
    const selectedItem = remainingTray.find((item) => item.id === selectedId);
    if (!selectedItem) return;

    if (selectedItem.kind === 'missing') {
      const targetX = selectedItem.x * sceneWidth;
      const targetY = selectedItem.y * sceneHeight;
      const { locationX, locationY } = evt.nativeEvent;
      const dist = Math.hypot(locationX - targetX, locationY - targetY);
      const radius = HIT_RADIUS_FRACTION * Math.min(sceneWidth, sceneHeight);

      if (dist <= radius) {
        setPlaced((prev) => [
          ...prev,
          {
            objectId: selectedItem.id,
            x: selectedItem.x,
            y: selectedItem.y,
            image: selectedItem.image,
            label: selectedItem.label,
          },
        ]);
        setSelectedId(null);
        return;
      }
    }

    flashWrong(selectedId);
    setSelectedId(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>EXHIBIT B -- TODAY'S PHOTO</Text>
        <Text style={styles.progress}>
          {placed.length} / {totalMissing} found
        </Text>
      </View>
      <Text style={styles.title}>{set.name}</Text>

      <View style={styles.sceneWrap}>
        <View onLayout={onSceneLayout} style={styles.sceneTouchable}>
          {sceneWidth > 0 && (
            <Pressable onPress={handleScenePress} style={{ width: sceneWidth, height: sceneHeight }}>
              <Image
                source={set.alteredImage}
                style={{ width: sceneWidth, height: sceneHeight }}
                resizeMode="contain"
              />
              {placed.map((p) => (
                <PlacedMarker
                  key={p.objectId}
                  marker={p}
                  containerWidth={sceneWidth}
                  containerHeight={sceneHeight}
                  imageAspectRatio={set.aspectRatio}
                />
              ))}
            </Pressable>
          )}
        </View>
        {selectedId && <Text style={styles.hint}>Tap the spot in the photo where that item belongs.</Text>}
      </View>

      <ObjectTray items={remainingTray} selectedId={selectedId} wrongId={wrongId} onSelect={handleSelect} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.redPen,
  },
  progress: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.sage,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  sceneWrap: {
    paddingHorizontal: spacing.lg,
  },
  sceneTouchable: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.paperShadow,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.gold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
