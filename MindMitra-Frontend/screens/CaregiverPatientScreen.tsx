import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import colors from "../theme/colors";

type ScreenName =
  | "caregiverHome"
  | "patients"
  | "circle"
  | "appointments"
  | "alerts"
  | "settings";

type Props = {
  onNavigate?: (screen: ScreenName) => void;
  onBack?: () => void;
};

export default function CaregiverPatientScreen({ onNavigate = () => {}, onBack }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Patient Profile</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>AS</Text>
          </View>
          <Text style={styles.name}>Anita Sharma</Text>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>Doing well today</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <ActionCard icon="calendar-outline" label="Appointments" onPress={() => onNavigate("appointments")} />
          <ActionCard icon="notifications-outline" label="Alerts" onPress={() => onNavigate("alerts")} />
          <ActionCard icon="people-outline" label="Care Circle" onPress={() => onNavigate("circle")} />
        </View>

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityCard}>
          <Text style={styles.activityText}>Morning medication taken · 8:00 AM</Text>
        </View>
        <View style={styles.activityCard}>
          <Text style={styles.activityText}>Afternoon relaxation session · 4:00 PM</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.72 }]} onPress={onPress}>
      <Ionicons name={icon} size={26} color={colors.primary} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceHigh,
  },
  backBtn: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  content: { padding: 20 },
  profileCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 24,
    alignItems: "center",
    marginBottom: 8,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#E8E0F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  initials: { fontSize: 28, fontWeight: "800", color: colors.primary },
  name: { fontSize: 26, fontWeight: "800", color: colors.text },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
    gap: 7,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  statusText: { fontSize: 15, fontWeight: "700", color: colors.primary },
  sectionTitle: { fontSize: 21, fontWeight: "800", color: colors.text, marginTop: 24, marginBottom: 12 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  actionCard: {
    width: "47%",
    minHeight: 90,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  activityCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 16,
    marginBottom: 10,
  },
  activityText: { fontSize: 16, color: colors.textSecondary },
});
