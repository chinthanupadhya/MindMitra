import React, { useState } from "react";

import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import colors from "../theme/colors";

type ScreenName =
  | "home"
  | "booking"
  | "circle"
  | "myday"
  | "journey"
  | "mitra"
  | "bookappointment"
  | "onboarding"
  | "profile"
  | "caregiverHome";

interface FloatingMitraProps {
  // Optional: some callers (e.g. CaregiverHome's internal sub-screens) don't
  // have a meaningful place to send these navigation targets, so this is a
  // no-op if omitted rather than a required prop every caller must satisfy.
  onNavigate?: (screen: ScreenName) => void;
  // Optional controlled-open support: when provided, the menu's open state
  // is driven externally (e.g. a caregiver's own "Ask Mitra" button) instead
  // of only the floating button toggling it internally.
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

const FloatingMitra: React.FC<FloatingMitraProps> = ({
  onNavigate,
  externalOpen,
  onExternalOpenChange,
}) => {
  const [internalVisible, setInternalVisible] = useState(false);
  const isControlled = externalOpen !== undefined;
  const menuVisible = isControlled ? externalOpen : internalVisible;

  const setMenuVisible = (visible: boolean) => {
    if (isControlled) {
      onExternalOpenChange?.(visible);
    } else {
      setInternalVisible(visible);
    }
  };

  const handleNavigate = (screen: ScreenName) => {
    setMenuVisible(false);
    onNavigate?.(screen);
  };

  return (
    <>
      {/* Floating Mitra Button */}

      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setMenuVisible(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Open Mitra assistant"
      >
        <Image
          source={require("../assets/mitra.png")}
          style={styles.mitraImage}
          resizeMode="contain"
        />
      </TouchableOpacity>

      {/* Mitra Assistant Menu */}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayPress}
            activeOpacity={1}
            onPress={() => setMenuVisible(false)}
          />

          <View style={styles.menuContainer}>
            {/* Header */}

            <View style={styles.menuHeader}>
              <View style={styles.headerMascot}>
                <Image
                  source={require("../assets/mitra.png")}
                  style={styles.headerMascotImage}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.headerText}>
                <Text style={styles.menuTitle}>Hi, I'm Mitra!</Text>

                <Text style={styles.menuSubtitle}>
                  How can I help you today?
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setMenuVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close Mitra menu"
              >
                <Text style={styles.closeText}>×</Text>
              </TouchableOpacity>
            </View>

            {/* Main Action */}

            <TouchableOpacity
              style={styles.primaryAction}
              onPress={() => handleNavigate("mitra")}
              activeOpacity={0.85}
            >
              <View style={styles.primaryIcon}>
                <Text style={styles.actionEmoji}>🎤</Text>
              </View>

              <View style={styles.actionTextContainer}>
                <Text style={styles.primaryActionTitle}>Talk to Mitra</Text>

                <Text style={styles.actionSubtitle}>
                  Speak or type your message
                </Text>
              </View>

              <Text style={styles.arrow}>→</Text>
            </TouchableOpacity>

            {/* Quick Actions */}

            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => handleNavigate("myday")}
                activeOpacity={0.8}
              >
                <Text style={styles.quickIcon}>📅</Text>
                <Text style={styles.quickText}>My Day</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => handleNavigate("booking")}
                activeOpacity={0.8}
              >
                <Text style={styles.quickIcon}>🩺</Text>
                <Text style={styles.quickText}>Appointments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => handleNavigate("journey")}
                activeOpacity={0.8}
              >
                <Text style={styles.quickIcon}>🏆</Text>
                <Text style={styles.quickText}>Game Stats</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    right: 18,
    bottom: 92,

    width: 76,
    height: 76,
    borderRadius: 38,

    backgroundColor: colors.surfaceLowest,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 3,
    borderColor: colors.primary,

    elevation: 8,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,

    zIndex: 100,
  },

  mitraImage: {
    width: 68,
    height: 68,
  },

  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  overlayPress: StyleSheet.absoluteFill,

  menuContainer: {
    backgroundColor: colors.surfaceLowest,

    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,

    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 34,
  },

  menuHeader: {
    flexDirection: "row",
    alignItems: "center",

    marginBottom: 22,
  },

  headerMascot: {
    width: 76,
    height: 76,

    borderRadius: 38,

    backgroundColor: colors.primaryLight,

    alignItems: "center",
    justifyContent: "center",

    overflow: "hidden",
    marginRight: 14,
  },

  headerMascotImage: {
    width: 70,
    height: 70,
  },

  headerText: {
    flex: 1,
  },

  menuTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },

  menuSubtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 3,
  },

  closeButton: {
    width: 48,
    height: 48,

    borderRadius: 24,

    backgroundColor: colors.surfaceLow,

    alignItems: "center",
    justifyContent: "center",
  },

  closeText: {
    fontSize: 30,
    lineHeight: 32,
    color: colors.text,
  },

  primaryAction: {
    minHeight: 92,

    backgroundColor: colors.primaryLight,

    borderRadius: 22,

    paddingHorizontal: 16,

    flexDirection: "row",
    alignItems: "center",

    marginBottom: 16,
  },

  primaryIcon: {
    width: 58,
    height: 58,

    borderRadius: 29,

    backgroundColor: colors.primary,

    alignItems: "center",
    justifyContent: "center",

    marginRight: 14,
  },

  actionEmoji: {
    fontSize: 27,
  },

  actionTextContainer: {
    flex: 1,
  },

  primaryActionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },

  actionSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 3,
  },

  arrow: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primary,
  },

  quickActions: {
    flexDirection: "row",
    gap: 10,
  },

  quickAction: {
    flex: 1,
    minHeight: 112,

    backgroundColor: colors.surfaceLow,

    borderRadius: 20,

    alignItems: "center",
    justifyContent: "center",

    paddingHorizontal: 6,
  },

  quickIcon: {
    fontSize: 28,
    marginBottom: 8,
  },

  quickText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    color: colors.text,

    textAlign: "center",
  },
});

export default FloatingMitra;
