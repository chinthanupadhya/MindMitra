import React, { useEffect, useState } from "react";

import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import BottomNav from "../components/BottomNav";
import GreetingHeader from "../components/GreetingHeader";
import SectionHeader from "../components/SectionHeader";
import { useAuth } from "../src/context/AuthContext";
import { useTranslation } from "../src/i18n/useTranslation";
import { supabase } from "../src/lib/supabaseClient";
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
  | "caregiverHome"
  | "gamepack";

interface PatientHomeProps {
  onNavigate: (screen: ScreenName) => void;
}

const PatientHome: React.FC<PatientHomeProps> = ({ onNavigate }) => {
  const [isListening, setIsListening] = useState(false);
  const { patient } = useAuth();
  const { t } = useTranslation();

  const [activitiesCount, setActivitiesCount] = useState(0);
  const [remindersCount, setRemindersCount] = useState(0);
  const [appointmentsCount, setAppointmentsCount] = useState(0);

  useEffect(() => {
    if (!patient?.id) return;

    let cancelled = false;

    async function loadTodaySummary() {
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      const [tasksResult, remindersResult, appointmentsResult] = await Promise.all([
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patient!.id)
          .eq("status", "pending")
          .eq("due_date", today),
        supabase
          .from("reminders")
          .select("id, reminder_type", { count: "exact" })
          .eq("patient_id", patient!.id)
          .eq("is_active", true),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", patient!.id)
          .eq("status", "scheduled")
          .eq("appointment_date", today),
      ]);

      if (cancelled) return;

      setActivitiesCount(tasksResult.count ?? 0);

      const reminderRows = remindersResult.data ?? [];
      setRemindersCount(
        reminderRows.filter((r) => r.reminder_type !== "appointment").length
      );

      // Appointments come from the appointments table (real bookings), not
      // from counting appointment-type reminders — that double-counted before.
      setAppointmentsCount(appointmentsResult.count ?? 0);
    }

    loadTodaySummary();

    return () => {
      cancelled = true;
    };
  }, [patient?.id]);

  const handleMicPress = () => {
    onNavigate("mitra");
  };

  return (
    <View style={styles.screen}>
      <GreetingHeader
        name={patient?.name ?? "Elder"}
        imageUri={patient?.profile_photo ?? undefined}
        onProfilePress={() => onNavigate("profile")}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome */}

        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>{t("good_morning")} 👋</Text>

          <Text style={styles.welcomeSubtext}>
            Here's your day at a glance.
          </Text>
        </View>

        {/* Mitra Hero Card */}

        <TouchableOpacity
          style={styles.mitraCard}
          onPress={() => onNavigate("mitra")}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Talk to Mitra"
        >
          <View style={styles.mitraContent}>
            <View style={styles.mitraTextContainer}>
              <View style={styles.mitraNameRow}>
                <Text style={styles.mitraSmallTitle}>YOUR COMPANION</Text>
              </View>

              <Text style={styles.mitraTitle}>Hi, I'm Mitra!</Text>

              <Text style={styles.mitraMessage}>
                {isListening
                  ? "I'm listening. Tell me how I can help you."
                  : "I'm here to help."}
              </Text>

              <View style={styles.talkButton}>
                <Text style={styles.talkButtonText}>{t("talk_to_mitra")}</Text>
                <Text style={styles.talkArrow}>→</Text>
              </View>
            </View>

            <View style={styles.mascotContainer}>
              <Image
                source={require("../assets/mitra.png")}
                style={styles.mascotImage}
                resizeMode="contain"
                accessibilityLabel="Mitra, the MindMitra red panda companion"
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Quick Actions */}

        <View style={styles.section}>
          <SectionHeader title="What would you like to do?" />

          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.gridCard}
              onPress={() => onNavigate("gamepack")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Memory Activity"
            >
              <View style={styles.gridIconCircle}>
                <Text style={styles.gridIcon}>🧠</Text>
              </View>

              <Text style={styles.gridTitle}>{t("memory_activity")}</Text>

              <Text style={styles.gridSubtitle}>{t("brain_games")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridCard}
              onPress={() => onNavigate("myday")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="My Day"
            >
              <View style={styles.gridIconCircle}>
                <Text style={styles.gridIcon}>📅</Text>
              </View>

              <Text style={styles.gridTitle}>{t("my_day")}</Text>

              <Text style={styles.gridSubtitle}>{t("see_todays_plan")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridCard}
              onPress={() => onNavigate("booking")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Appointments"
            >
              <View style={styles.gridIconCircle}>
                <Text style={styles.gridIcon}>🩺</Text>
              </View>

              <Text style={styles.gridTitle}>{t("my_appointments")}</Text>

              <Text style={styles.gridSubtitle}>{t("view_or_book")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.gridCard}
              onPress={() => onNavigate("circle")}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Family Circle"
            >
              <View style={styles.gridIconCircle}>
                <Text style={styles.gridIcon}>👨‍👩‍👧</Text>
              </View>

              <Text style={styles.gridTitle}>{t("family_circle")}</Text>

              <Text style={styles.gridSubtitle}>{t("stay_connected")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Summary */}

        <View style={styles.section}>
          <SectionHeader title={t("todays_glance")} />

          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{activitiesCount}</Text>
              <Text style={styles.summaryLabel}>{t("activities")}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{remindersCount}</Text>
              <Text style={styles.summaryLabel}>Reminder{remindersCount !== 1 ? "s" : ""}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{appointmentsCount}</Text>
              <Text style={styles.summaryLabel}>Appointment{appointmentsCount !== 1 ? "s" : ""}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <BottomNav
        activeTab="Home"
        onHomePress={() => onNavigate("home")}
        onGameStatsPress={() => onNavigate("journey")}
        onBookingPress={() => onNavigate("booking")}
        onCirclePress={() => onNavigate("circle")}
        onProfilePress={() => onNavigate("profile")}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scrollView: {
    flex: 1,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  /* Welcome */

  welcomeSection: {
    marginTop: 18,
    marginBottom: 20,
  },

  welcomeText: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
  },

  welcomeSubtext: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.textSecondary,
    marginTop: 6,
  },

  /* Mitra */

  mitraCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: 28,
    overflow: "hidden",
    minHeight: 235,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },

  mitraContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 22,
    paddingVertical: 20,
  },

  mitraTextContainer: {
    flex: 1,
    zIndex: 2,
    paddingRight: 4,
  },

  mitraNameRow: {
    marginBottom: 7,
  },

  mitraSmallTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.primary,
  },

  mitraTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
  },

  mitraMessage: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: 8,
    maxWidth: 190,
  },

  talkButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginTop: 16,
  },

  talkButtonText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "700",
  },

  talkArrow: {
    color: colors.onPrimary,
    fontSize: 22,
    fontWeight: "700",
    marginLeft: 8,
    marginTop: -1,
  },

  mascotContainer: {
    width: 180,
    height: 220,
    justifyContent: "flex-end",
    alignItems: "center",
    marginLeft: -30,
    marginRight: -8,
  },

  mascotImage: {
    width: 190,
    height: 220,
  },

  /* Voice */

  micSection: {
    marginTop: 20,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    paddingVertical: 22,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  micTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  micTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },

  micSubtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: 4,
  },

  micStatus: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 8,
  },

  micButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: colors.primaryLight,
  },

  micButtonListening: {
    backgroundColor: colors.secondary,
  },

  micIcon: {
    fontSize: 40,
  },

  /* Quick Actions */

  section: {
    marginTop: 34,
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
    marginTop: 4,
  },

  gridCard: {
    width: "47%",
    minHeight: 190,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    padding: 18,
    justifyContent: "space-between",
  },

  gridIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  gridIcon: {
    fontSize: 30,
  },

  gridTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "700",
    color: colors.text,
    marginTop: 14,
  },

  gridSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    marginTop: 6,
  },

  /* Summary */

  summaryCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    minHeight: 120,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 4,
  },

  summaryNumber: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.primary,
  },

  summaryLabel: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },

  divider: {
    width: 1,
    height: 54,
    backgroundColor: colors.surfaceHigh,
  },
});

export default PatientHome;
