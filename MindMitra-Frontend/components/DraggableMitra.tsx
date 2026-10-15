import React, { useRef } from "react";
import {
  Animated,
  Image,
  PanResponder,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import colors from "../theme/colors";

const MITRA_SIZE = 68;
const STORAGE_KEY = "@mindmitra_panda_position";

interface DraggableMitraProps {
  onPress?: () => void;
}

/**
 * A freely draggable Mitra (red panda) overlay. The user can drag Mitra around
 * the screen; the position is persisted so it stays where they left it. Tapping
 * (without dragging) triggers onPress.
 */
const DraggableMitra: React.FC<DraggableMitraProps> = ({ onPress }) => {
  const { width: winW, height: winH } = useWindowDimensions();

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const movedRef = useRef(false);

  // Restore last position on mount.
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const { x, y } = JSON.parse(raw);
          pan.setValue({ x, y });
        }
      } catch (e) {
        /* ignore */
      }
    })();
  }, [pan]);

  const maxX = Math.max(0, winW - MITRA_SIZE);
  const maxY = Math.max(0, winH - MITRA_SIZE - 120); // keep above bottom nav

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        movedRef.current = false;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6) {
          movedRef.current = true;
        }
        let nextX = gestureState.dx;
        let nextY = gestureState.dy;
        // Constrain within the window while dragging.
        if (nextX < 0) nextX = 0;
        if (nextY < 0) nextY = 0;
        if (nextX > maxX) nextX = maxX;
        if (nextY > maxY) nextY = maxY;
        pan.setValue({ x: nextX, y: nextY });
      },
      onPanResponderRelease: () => {
        const { x, y } = pan as unknown as { x: { __getValue: () => number }; y: { __getValue: () => number } };
        const finalX = Math.min(Math.max(x.__getValue(), 0), maxX);
        const finalY = Math.min(Math.max(y.__getValue(), 0), maxY);
        pan.setValue({ x: finalX, y: finalY });
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ x: finalX, y: finalY })).catch(() => {});
        // Treat as a tap only if the user didn't actually drag it.
        if (!movedRef.current) {
          onPress?.();
        }
      },
    })
  ).current;

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlay]}
      pointerEvents="box-none"
    >
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.draggable,
          {
            transform: [{ translateX: pan.x }, { translateY: pan.y }],
          },
        ]}
      >
        <TouchableWithoutFeedback onPress={() => onPress?.()}>
          <View style={styles.imageWrap}>
            <Image
              source={require("../assets/mitra.png")}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel="Mitra, the MindMitra red panda"
            />
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    zIndex: 50,
  },
  draggable: {
    position: "absolute",
    left: 0,
    top: 0,
    width: MITRA_SIZE,
    height: MITRA_SIZE,
  },
  imageWrap: {
    width: MITRA_SIZE,
    height: MITRA_SIZE,
    borderRadius: MITRA_SIZE / 2,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  image: {
    width: MITRA_SIZE - 12,
    height: MITRA_SIZE - 12,
  },
});

export default DraggableMitra;
