import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import BottomNav from "../components/BottomNav";
import FloatingMitra from "../components/FloatingMitra";
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
  | "caregiverHome";

interface ScreenProps {
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
}
interface AppointmentCardProps {
  doctor: string;
  specialty: string;
  date: string;
  time: string;
  type?: string;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  doctor,
  specialty,
  date,
  time,
  type = "Upcoming",
}) => {
  return (
    <View style={styles.appointmentCard}>
      <View style={styles.appointmentHeader}>
        <View style={styles.doctorIcon}>
          <Text style={styles.doctorEmoji}>👨‍⚕️</Text>
        </View>

        <View style={styles.appointmentInfo}>
          <Text style={styles.doctorName}>{doctor}</Text>
          <Text style={styles.specialty}>{specialty}</Text>
        </View>
      </View>

      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{type}</Text>
      </View>

      <View style={styles.appointmentDivider} />

      <View style={styles.dateTimeRow}>
        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>📅 DATE</Text>
          <Text style={styles.detailValue}>{date}</Text>
        </View>

        <View style={styles.detailBlock}>
          <Text style={styles.detailLabel}>🕐 TIME</Text>
          <Text style={styles.detailValue}>{time}</Text>
        </View>
      </View>
    </View>
  );
};

const BookingScreen: React.FC<ScreenProps> = ({ onNavigate, onBack }) => {
  const { patient } = useAuth();
  const { t } = useTranslation();
  const [appointments, setAppointments] = useState<
    { id: string; doctor_name: string; specialty: string | null; appointment_date: string; appointment_time: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAppointments() {
      if (!patient?.id) {
        setLoading(false);
        return;
      }
      const todayKey = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("appointments")
        .select("id, doctor_name, specialty, appointment_date, appointment_time")
        .eq("patient_id", patient.id)
        .eq("status", "scheduled")
        .gte("appointment_date", todayKey)
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true });

      if (data) setAppointments(data);
      setLoading(false);
    }
    loadAppointments();
  }, [patient?.id]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <View style={styles.screen}>
      <GreetingHeader name={patient?.name ?? "Elder"} showBackButton onBackPress={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Page Title */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>{t("appointments")}</Text>

          <Text style={styles.pageSubtitle}>
            Your upcoming doctor visits, all in one place.
          </Text>
        </View>

        {/* Book New Appointment */}
        <TouchableOpacity
          style={styles.bookButton}
          onPress={() => onNavigate("bookappointment")}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Book a new appointment"
        >
          <View style={styles.bookIconContainer}>
            <Text style={styles.bookIcon}>+</Text>
          </View>

          <View style={styles.bookTextContainer}>
            <Text style={styles.bookTitle}>Book an Appointment</Text>

            <Text style={styles.bookSubtitle}>
              Schedule a visit with your doctor
            </Text>
          </View>

          <Text style={styles.bookArrow}>→</Text>
        </TouchableOpacity>

        {/* Upcoming */}
        <View style={styles.section}>
          <SectionHeader title="Upcoming Appointments" />

          {loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : appointments.length === 0 ? (
            <Text style={styles.emptyText}>
              No appointments scheduled. Tap "Book an Appointment" above to add one.
            </Text>
          ) : (
            appointments.map((appt, idx) => (
              <React.Fragment key={appt.id}>
                <AppointmentCard
                  doctor={appt.doctor_name}
                  specialty={appt.specialty ?? ""}
                  date={formatDate(appt.appointment_date)}
                  time={formatTime(appt.appointment_time)}
                />
                {idx < appointments.length - 1 && <View style={styles.cardSpacing} />}
              </React.Fragment>
            ))
          )}
        </View>

        {/* Helpful reminder */}
        <View style={styles.reminderCard}>
          <View style={styles.reminderIconContainer}>
            <Text style={styles.reminderIcon}>💡</Text>
          </View>

          <View style={styles.reminderContent}>
            <Text style={styles.reminderTitle}>A little reminder</Text>

            <Text style={styles.reminderText}>
              We'll remind you before your appointment, so you don't have to
              worry.
            </Text>
          </View>
        </View>
      </ScrollView>

      <BottomNav
        activeTab="Booking"
        onHomePress={() => onNavigate("home")}
        onGameStatsPress={() => onNavigate("journey")}
        onBookingPress={() => onNavigate("booking")}
        onCirclePress={() => onNavigate("circle")}
        onProfilePress={() => onNavigate("profile")}
      />
      <FloatingMitra onNavigate={onNavigate} />
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
    paddingHorizontal: 22,
    paddingBottom: 40,
  },

  /* Page Header */

  titleSection: {
    marginTop: 18,
    marginBottom: 28,
  },

  pageTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
  },

  pageSubtitle: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.textSecondary,
    marginTop: 8,
  },

  /* Book Appointment */

  bookButton: {
    minHeight: 118,
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },

  bookIconContainer: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },

  bookIcon: {
    fontSize: 40,
    fontWeight: "400",
    color: colors.primary,
  },

  bookTextContainer: {
    flex: 1,
  },

  bookTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.onPrimary,
    lineHeight: 27,
  },

  bookSubtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.onPrimary,
    opacity: 0.9,
    marginTop: 5,
  },

  bookArrow: {
    fontSize: 32,
    color: colors.onPrimary,
    fontWeight: "700",
    marginLeft: 8,
  },

  /* Upcoming */

  section: {
    marginTop: 36,
  },

  appointmentCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },

  appointmentHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  doctorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  doctorEmoji: {
    fontSize: 31,
  },

  appointmentInfo: {
    flex: 1,
  },

  doctorName: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 26,
  },

  specialty: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 4,
  },

  statusBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.successSoft,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    marginTop: 16,
  },

  statusText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },

  appointmentDivider: {
    height: 1,
    backgroundColor: colors.surfaceHigh,
    marginVertical: 18,
  },

  dateTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  detailBlock: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 7,
  },

  detailValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.text,
  },

  detailsButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primary,
  },

  arrow: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.primary,
  },

  cardSpacing: {
    height: 18,
  },

  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: 24,
  },

  /* Reminder */

  reminderCard: {
    flexDirection: "row",
    backgroundColor: colors.secondaryLight,
    borderRadius: 22,
    padding: 20,
    marginTop: 32,
    alignItems: "flex-start",
  },

  reminderIconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  reminderIcon: {
    fontSize: 28,
  },

  reminderContent: {
    flex: 1,
  },

  reminderTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
  },

  reminderText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    marginTop: 6,
  },
});

export default BookingScreen;
