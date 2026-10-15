import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import colors from "../theme/colors";

type Props = {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
};

export default function FloatingMitra({
  externalOpen = false,
  onExternalOpenChange,
}: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (externalOpen) setOpen(true);
  }, [externalOpen]);
  const close = () => {
    setOpen(false);
    onExternalOpenChange?.(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Mitra assistant"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
      >
        <Image
          source={require("../assets/mitra.jpg")}
          style={styles.fabImage}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Image
                source={require("../assets/mitra.jpg")}
                style={styles.sheetImage}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Hi! I'm Mitra 👋</Text>
                <Text style={styles.sheetSub}>
                  I'm here to help you care for Anita.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Close Mitra"
                onPress={close}
                style={styles.close}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.question}>What would you like to check?</Text>
            <Pressable style={styles.action} onPress={close}>
              <Text style={styles.actionText}>Give me a quick summary</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={close}>
              <Text style={styles.actionText}>Explain today's alerts</Text>
            </Pressable>
            <Pressable style={styles.action} onPress={close}>
              <Text style={styles.actionText}>Check reminders</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    bottom: 92,
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabImage: { width: 58, height: 58, borderRadius: 29 },
  pressed: { opacity: 0.75 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  },
  sheetImage: { width: 72, height: 72, borderRadius: 36 },
  sheetTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  sheetSub: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.textSecondary,
    marginTop: 3,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: { fontSize: 30, color: colors.text },
  question: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 12,
  },
  action: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 10,
  },
  actionText: { fontSize: 17, fontWeight: "700", color: colors.primary },
});
