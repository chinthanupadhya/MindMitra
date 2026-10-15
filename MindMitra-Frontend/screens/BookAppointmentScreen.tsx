import React, { useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import FloatingMitra from "../components/FloatingMitra";
import GreetingHeader from "../components/GreetingHeader";
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

interface DoctorAvailability {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_minutes: number;
    consultation_types: string[];
}

interface Doctor {
  id: string;
  name: string;
  specialty: string | null;
  icon: string | null;
  availability?: DoctorAvailability[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Build time slots (30-min steps by default) from a start/end "HH:MM" window.
function buildSlots(
  startTime: string,
  endTime: string,
  stepMinutes: number
): { label: string; hour: number; minute: number }[] {
  const slots: { label: string; hour: number; minute: number }[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let total = sh * 60 + sm;
  const endTotal = eh * 60 + em;
  while (total + stepMinutes <= endTotal) {
    const hour = Math.floor(total / 60);
    const minute = total % 60;
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    slots.push({
      label: `${displayHour}:${minute.toString().padStart(2, "0")} ${period}`,
      hour,
      minute,
    });
    total += stepMinutes;
  }
  return slots;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
    .getDate()
    .toString()
    .padStart(2, "0")}`;
}

const BookAppointmentScreen: React.FC<ScreenProps> = ({ onNavigate, onBack }) => {
  const { patient } = useAuth();
  const { t } = useTranslation();

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // Selected doctor's availability row for the chosen weekday.
  const [availability, setAvailability] = useState<DoctorAvailability[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<{ label: string; hour: number; minute: number }[]>([]);

  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [consultationType, setConsultationType] = useState<"in_person" | "video_call">(
    "in_person"
  );

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(today));
  const [selectedSlot, setSelectedSlot] = useState<{ label: string; hour: number; minute: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);

  // "Add new doctor" (parity with the caregiver dashboard).
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState("");
  const [newDoctorIcon, setNewDoctorIcon] = useState("👨‍⚕️");
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [addDoctorError, setAddDoctorError] = useState<string | null>(null);

  const reloadDoctors = async () => {
    const { data, error } = await supabase
      .from("doctors")
      .select("id, name, specialty, icon");
    if (!error) {
      const rows = (data ?? []) as unknown as { id: string; name: string; specialty: string | null; icon: string | null }[];
      setDoctors(rows.map((r) => ({ ...r, availability: [] })));
      if (rows.length > 0) setSelectedDoctor(rows[0].name);
    }
  };

  const handleAddDoctor = async () => {
    setAddDoctorError(null);
    if (!newDoctorName.trim()) { setAddDoctorError("Enter the doctor's name."); return; }
    setAddingDoctor(true);
    const { error } = await supabase.from("doctors").insert({
      name: newDoctorName.trim(),
      specialty: newDoctorSpecialty.trim() || null,
      icon: newDoctorIcon,
    });
    setAddingDoctor(false);
    if (error) { setAddDoctorError(error.message); return; }
    setNewDoctorName(""); setNewDoctorSpecialty(""); setShowAddDoctor(false);
    await reloadDoctors();
  };

  // Load doctors and their availability from the DB (Item 5).
  useEffect(() => {
    async function loadDoctors() {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, name, specialty, icon, doctor_availability(*)");
      if (error) {
        Alert.alert("Couldn't load doctors", error.message);
        setLoadingDoctors(false);
        return;
      }
      const rows = (data ?? []) as unknown as Doctor[];
      setDoctors(rows);
      if (rows.length > 0) {
        setSelectedDoctor(rows[0].name);
      }
      setLoadingDoctors(false);
    }
    loadDoctors();
  }, []);

  // Recompute the time window + booked slots whenever doctor, date, or
  // availability changes.
  useEffect(() => {
    const doctor = doctors.find((d) => d.name === selectedDoctor);
    const dow = new Date(selectedDateKey + "T00:00:00").getDay();
    const avail = (doctor?.availability ?? []).find((a) => a.day_of_week === dow);

    if (doctor && avail) {
      setAvailability([avail]);
      const types = avail.consultation_types ?? ["in_person", "video_call"];
      if (!types.includes(consultationType)) {
        setConsultationType(types[0] === "video_call" ? "video_call" : "in_person");
      }
      setTimeSlots(buildSlots(avail.start_time, avail.end_time, avail.slot_minutes || 30));

      // Fetch already-booked slots for this doctor + date to disable them.
      supabase
        .from("appointments")
        .select("appointment_time")
        .eq("doctor_name", selectedDoctor)
        .eq("appointment_date", selectedDateKey)
        .eq("status", "scheduled")
        .then(({ data }) => {
          const booked = (data ?? []).map((r) => (r.appointment_time ?? "").slice(0, 5));
          setBookedSlots(booked);
        });
    } else {
      // No availability row for this doctor/day — default to 9:00 AM - 8:00 PM
      // so the patient can always pick a time slot.
      setAvailability([{
        id: "default",
        day_of_week: dow,
        start_time: "09:00",
        end_time: "20:00",
        slot_minutes: 30,
        consultation_types: ["in_person", "video_call"],
      }]);
      setTimeSlots(buildSlots("09:00", "20:00", 30));
      supabase
        .from("appointments")
        .select("appointment_time")
        .eq("doctor_name", selectedDoctor)
        .eq("appointment_date", selectedDateKey)
        .eq("status", "scheduled")
        .then(({ data }) => {
          setBookedSlots((data ?? []).map((r) => (r.appointment_time ?? "").slice(0, 5)));
        });
    }
  }, [selectedDoctor, selectedDateKey, doctors, consultationType]);

  const calendarDays = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(viewYear, viewMonth, d));
    return days;
  }, [viewMonth, viewYear]);

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const selectedDoctorData = doctors.find((d) => d.name === selectedDoctor);

  const selectedDateLabel = useMemo(() => {
    const [y, m, d] = selectedDateKey.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
  }, [selectedDateKey]);

  const handleConfirm = async () => {
    if (!patient?.id) {
      Alert.alert("Error", "Couldn't find your patient profile.");
      return;
    }
    if (!selectedSlot) {
      Alert.alert("Choose a time", "Please pick an appointment time first.");
      return;
    }

    setSubmitting(true);

    const timeString = `${selectedSlot.hour.toString().padStart(2, "0")}:${selectedSlot.minute
      .toString()
      .padStart(2, "0")}:00`;

    const { error } = await supabase.from("appointments").insert({
      patient_id: patient.id,
      doctor_name: selectedDoctor,
      specialty: selectedDoctorData?.specialty ?? null,
      appointment_date: selectedDateKey,
      appointment_time: timeString,
      consultation_type: consultationType,
      status: "scheduled",
    });

    setSubmitting(false);

    if (error) {
      Alert.alert("Couldn't book appointment", error.message);
      return;
    }

    Alert.alert(
      "Appointment Confirmed! 🎉",
      `Your appointment with ${selectedDoctor} is booked for ${selectedDateLabel} at ${selectedSlot.label}.`,
      [{ text: "OK", onPress: () => onNavigate("booking") }]
    );
  };

  return (
    <View style={styles.screen}>
      <GreetingHeader name={patient?.name ?? "Elder"} showBackButton onBackPress={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>{t("book_appointment")}</Text>
          <Text style={styles.pageSubtitle}>Choose a doctor and a convenient time.</Text>
        </View>

        <Text style={styles.sectionTitle}>Choose a Doctor</Text>
        {loadingDoctors ? (
          <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} />
        ) : (
          <View style={styles.doctorList}>
            {doctors.map((doctor) => {
              const isSelected = selectedDoctor === doctor.name;
              return (
                <TouchableOpacity
                  key={doctor.id}
                  style={[styles.doctorCard, isSelected && styles.doctorCardSelected]}
                  onPress={() => setSelectedDoctor(doctor.name)}
                  activeOpacity={0.8}
                >
                  <View style={styles.doctorIcon}>
                    <Text style={styles.doctorEmoji}>{doctor.icon ?? "👨‍⚕️"}</Text>
                  </View>
                  <View style={styles.doctorInfo}>
                    <Text style={styles.doctorName}>{doctor.name}</Text>
                    <Text style={styles.doctorSpecialty}>{doctor.specialty}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedCircle}>
                      <Text style={styles.tick}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Add new doctor (parity with caregiver dashboard) */}
        <TouchableOpacity
          style={[styles.toggleAddDoctor, showAddDoctor && { backgroundColor: colors.surfaceLow }]}
          onPress={() => setShowAddDoctor(!showAddDoctor)}
          activeOpacity={0.8}
        >
          <Text style={styles.toggleAddDoctorText}>
            {showAddDoctor ? "− Cancel add doctor" : "+ Add new doctor"}
          </Text>
        </TouchableOpacity>
        {showAddDoctor && (
          <View style={styles.addDoctorCard}>
            <Text style={styles.sectionTitle}>New doctor</Text>
            <TextInput
              style={styles.input}
              placeholder="Doctor's name"
              placeholderTextColor={colors.textSecondary}
              value={newDoctorName}
              onChangeText={setNewDoctorName}
            />
            <View style={{ height: 10 }} />
            <TextInput
              style={styles.input}
              placeholder="Specialty (e.g. Cardiologist)"
              placeholderTextColor={colors.textSecondary}
              value={newDoctorSpecialty}
              onChangeText={setNewDoctorSpecialty}
            />
            {addDoctorError && <Text style={styles.errorText}>{addDoctorError}</Text>}
            <TouchableOpacity
              style={[styles.confirmButton, addingDoctor && styles.confirmButtonDisabled]}
              onPress={handleAddDoctor}
              disabled={addingDoctor}
            >
              {addingDoctor ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.confirmButtonText}>Save Doctor</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Real calendar */}
        <Text style={styles.sectionTitle}>Choose a Date</Text>
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={goToPreviousMonth} style={styles.calendarNavButton}>
              <Text style={styles.calendarNavText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.calendarMonthLabel}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.calendarNavButton}>
              <Text style={styles.calendarNavText}>›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((w, i) => (
              <Text key={i} style={styles.weekdayLabel}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map((day, idx) => {
              if (!day) return <View key={idx} style={styles.calendarCell} />;

              const dateKey = toDateKey(day);
              const isPast = day < today;
              const isSelected = dateKey === selectedDateKey;

              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.calendarCell}
                  disabled={isPast}
                  onPress={() => setSelectedDateKey(dateKey)}
                >
                  <View
                    style={[
                      styles.calendarDayCircle,
                      isSelected && styles.calendarDaySelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        isPast && styles.calendarDayTextDisabled,
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Scrollable time picker from the doctor's availability window */}
        <Text style={styles.sectionTitle}>Choose a Time</Text>
        <Text style={styles.helperText}>
          {timeSlots.length > 0
            ? `Available slots for ${selectedDoctor} on this day`
            : "This doctor is not available on the selected day"}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.timeScroll}
          contentContainerStyle={styles.timeScrollContent}
        >
          {timeSlots.map((slot) => {
            const isSelected =
              selectedSlot !== null &&
              selectedSlot.hour === slot.hour &&
              selectedSlot.minute === slot.minute;
            const isBooked = bookedSlots.includes(
              `${slot.hour.toString().padStart(2, "0")}:${slot.minute
                .toString()
                .padStart(2, "0")}`
            );
            return (
              <TouchableOpacity
                key={slot.label}
                disabled={isBooked}
                style={[
                  styles.timeChip,
                  isSelected && styles.timeChipSelected,
                  isBooked && styles.timeChipDisabled,
                ]}
                onPress={() => setSelectedSlot(slot)}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    isSelected && styles.timeChipTextSelected,
                    isBooked && styles.timeChipTextDisabled,
                  ]}
                >
                  {slot.label}
                </Text>
              </TouchableOpacity>
            );
          })}
          {timeSlots.length === 0 && !loadingDoctors && (
            <Text style={styles.noSlotsText}>No slots available.</Text>
          )}
        </ScrollView>

        <Text style={styles.sectionTitle}>Consultation Type</Text>
        <View style={styles.consultationContainer}>
          {(availability[0]?.consultation_types ?? ["in_person", "video_call"]).includes(
            "in_person"
          ) && (
            <TouchableOpacity
              style={[
                styles.consultationButton,
                consultationType === "in_person" && styles.consultationSelected,
              ]}
              onPress={() => setConsultationType("in_person")}
            >
              <Text style={styles.consultationIcon}>🏥</Text>
              <Text
                style={[
                  styles.consultationText,
                  consultationType === "in_person" && styles.consultationTextSelected,
                ]}
              >
                In Person
              </Text>
            </TouchableOpacity>
          )}

          {(availability[0]?.consultation_types ?? ["in_person", "video_call"]).includes(
            "video_call"
          ) && (
            <TouchableOpacity
              style={[
                styles.consultationButton,
                consultationType === "video_call" && styles.consultationSelected,
              ]}
              onPress={() => setConsultationType("video_call")}
            >
              <Text style={styles.consultationIcon}>📹</Text>
              <Text
                style={[
                  styles.consultationText,
                  consultationType === "video_call" && styles.consultationTextSelected,
                ]}
              >
                Video Call
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Appointment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Doctor</Text>
            <Text style={styles.summaryValue}>{selectedDoctor}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Date</Text>
            <Text style={styles.summaryValue}>{selectedDateLabel}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Time</Text>
            <Text style={styles.summaryValue}>{selectedSlot?.label ?? "—"}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Type</Text>
            <Text style={styles.summaryValue}>
              {consultationType === "in_person" ? "In Person" : "Video Call"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            (submitting || !selectedSlot) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          activeOpacity={0.85}
          disabled={submitting || !selectedSlot}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Text style={styles.confirmButtonText}>{t("confirm_appointment")}</Text>
              <Text style={styles.confirmArrow}>→</Text>
            </>
          )}
        </TouchableOpacity>
        <FloatingMitra onNavigate={onNavigate} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  titleSection: { marginTop: 10, marginBottom: 28 },
  pageTitle: { fontSize: 32, fontWeight: "700", color: colors.text },
  pageSubtitle: { fontSize: 17, lineHeight: 24, color: colors.textSecondary, marginTop: 6 },
  sectionTitle: { fontSize: 21, fontWeight: "700", color: colors.text, marginBottom: 14, marginTop: 10 },
  helperText: { fontSize: 14, color: colors.textSecondary, marginTop: -8, marginBottom: 14 },

  toggleAddDoctor: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginTop: 6 },
  toggleAddDoctorText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  addDoctorCard: { backgroundColor: colors.surfaceLowest, borderRadius: 20, borderWidth: 1, borderColor: colors.outlineVariant, padding: 16, marginTop: 10, marginBottom: 20 },
  input: {
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.text,
  },
  errorText: { fontSize: 15, color: "#BA1A1A", marginTop: 8 },

  doctorList: { gap: 12, marginBottom: 28 },
  doctorCard: {
    minHeight: 88,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
  },
  doctorCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  doctorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  doctorEmoji: { fontSize: 28 },
  doctorInfo: { flex: 1 },
  doctorName: { fontSize: 18, fontWeight: "700", color: colors.text },
  doctorSpecialty: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },
  selectedCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tick: { color: colors.onPrimary, fontSize: 17, fontWeight: "700" },

  calendarCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    marginBottom: 26,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  calendarNavButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarNavText: { fontSize: 22, fontWeight: "700", color: colors.primary },
  calendarMonthLabel: { fontSize: 18, fontWeight: "700", color: colors.text },
  weekdayRow: { flexDirection: "row", marginBottom: 6 },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDaySelected: { backgroundColor: colors.primary },
  calendarDayText: { fontSize: 15, fontWeight: "600", color: colors.text },
  calendarDayTextDisabled: { color: colors.surfaceHigh },
  calendarDayTextSelected: { color: colors.onPrimary, fontWeight: "700" },

  timeScroll: { marginBottom: 28 },
  timeScrollContent: { gap: 10, paddingRight: 10 },
  timeChip: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    justifyContent: "center",
    alignItems: "center",
  },
  timeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeChipText: { fontSize: 16, fontWeight: "600", color: colors.text },
  timeChipTextSelected: { color: colors.onPrimary },

  timeChipDisabled: { opacity: 0.35 },
  timeChipTextDisabled: { color: colors.textSecondary },

  noSlotsText: { fontSize: 15, color: colors.textSecondary, paddingVertical: 12 },

  consultationContainer: { flexDirection: "row", gap: 14, marginBottom: 30 },
  consultationButton: {
    flex: 1,
    minHeight: 110,
    borderRadius: 20,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  consultationSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  consultationIcon: { fontSize: 32, marginBottom: 8 },
  consultationText: { fontSize: 16, fontWeight: "700", color: colors.text },
  consultationTextSelected: { color: colors.primary },

  summaryCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    marginBottom: 28,
  },
  summaryTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9 },
  summaryLabel: { fontSize: 16, color: colors.textSecondary },
  summaryValue: { fontSize: 16, fontWeight: "700", color: colors.text, maxWidth: "58%", textAlign: "right" },

  confirmButton: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmButtonText: { fontSize: 19, fontWeight: "700", color: colors.onPrimary },
  confirmArrow: { fontSize: 30, fontWeight: "700", color: colors.onPrimary },
});

export default BookAppointmentScreen;
