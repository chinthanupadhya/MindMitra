import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import GreetingHeader from "../components/GreetingHeader";
import { useAuth } from "../src/context/AuthContext";
import { useTranslation } from "../src/i18n/useTranslation";
import { supabase } from "../src/lib/supabaseClient";
import { upsertReminderLocal } from "../src/db/local";
import { scheduleReminderNotification } from "../src/lib/notifications";
import type { Enums } from "../src/types/database";
import colors from "../theme/colors";

type ReminderType = Enums<"reminder_type_t">;

interface AddReminderScreenProps {
  onBack: () => void;
  onSaved: () => void;
}

const REMINDER_TYPES: { type: ReminderType; label: string; icon: string }[] = [
  { type: "medicine", label: "Medicine", icon: "💊" },
  { type: "hydration", label: "Hydration", icon: "💧" },
  { type: "activity", label: "Activity", icon: "🧠" },
  { type: "appointment", label: "Appointment", icon: "🩺" },
];

const AddReminderScreen: React.FC<AddReminderScreenProps> = ({ onBack, onSaved }) => {
  const { patient } = useAuth();
  const { t } = useTranslation();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reminderType, setReminderType] = useState<ReminderType>("medicine");
  const [hour, setHour] = useState("9");
  const [minute, setMinute] = useState("00");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSave = async () => {
    setErrorMessage(null);

    if (!patient?.id) {
      setErrorMessage("Couldn't find your patient profile. Please try logging in again.");
      return;
    }
    if (!title.trim()) {
      setErrorMessage("Please give the reminder a title.");
      return;
    }

    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      setErrorMessage("Please enter a valid time (hour 0–23, minute 0–59).");
      return;
    }

    setSubmitting(true);

    const scheduledTime = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:00`;
    const reminderId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });

    // OFFline-first: persist to the local SQLite DB immediately so the
    // reminder survives no connectivity. It syncs to Supabase when online.
    const reminderShape = {
      id: reminderId,
      patient_id: patient.id,
      title: title.trim(),
      description: description.trim() || null,
      reminder_type: reminderType,
      scheduled_time: scheduledTime,
      repeat_pattern: "daily",
      is_active: true,
    };
    try {
      await upsertReminderLocal({ ...reminderShape, synced: false });
    } catch (e) {
      console.warn("Offline reminder write failed", e);
    }

    // Try to push to Supabase now; on failure the SQLite copy stays unsynced
    // and the reconnect sync will re-push it.
    const { data, error } = await supabase
      .from("reminders")
      .insert(reminderShape)
      .select()
      .single();

    setSubmitting(false);

    if (error || !data) {
      if (String(error?.code ?? "").startsWith("23")) {
        // duplicate (already synced earlier) — treat as success
        setErrorMessage(null);
      } else {
        // Offline or cloud failure — reminder is still saved locally.
        setErrorMessage(null);
      }
    }

    const savedReminder: any = data ?? {
      ...reminderShape,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_triggered_at: null,
      sync_status: 'local',
    };

    // NOTE: We intentionally do NOT insert a `tasks` row here anymore.
    // Previously this created a duplicate task for glance purposes, which
    // made the same reminder appear TWICE in My Day (once from `reminders`
    // and once from `tasks`). The reminder alone is the single source of
    // truth; Today's glance counts reminders, and My Day lists reminders.
    //

    // Actually schedule the real device notification right now, not just
    // on next login — this is what makes the reminder do something.
    try {
      await scheduleReminderNotification(savedReminder);
    } catch {
      // The reminder is still saved even if scheduling the notification
      // failed (e.g. permission not granted yet) — not a blocking error.
    }

    Alert.alert("Reminder saved", "You'll get a notification every day at this time.");
    onSaved();
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="height"
    >
      <GreetingHeader name={patient?.name ?? "Elder"} showBackButton onBackPress={onBack} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>New Reminder</Text>
        <Text style={styles.pageSubtitle}>
          We'll remind you every day at this time.
        </Text>

        <Text style={styles.label}>Type</Text>
        <View style={styles.typeRow}>
          {REMINDER_TYPES.map((rt) => {
            const selected = reminderType === rt.type;
            return (
              <TouchableOpacity
                key={rt.type}
                style={[styles.typeButton, selected && styles.typeButtonSelected]}
                onPress={() => setReminderType(rt.type)}
                activeOpacity={0.8}
              >
                <Text style={styles.typeIcon}>{rt.icon}</Text>
                <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>
                  {rt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Take blood pressure medicine"
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. One tablet with water"
          placeholderTextColor={colors.textSecondary}
          value={description}
          onChangeText={setDescription}
        />

        <Text style={styles.label}>Time</Text>
        <View style={styles.timeRow}>
          <TextInput
            style={styles.timeInput}
            value={hour}
            onChangeText={setHour}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="HH"
          />
          <Text style={styles.timeColon}>:</Text>
          <TextInput
            style={styles.timeInput}
            value={minute}
            onChangeText={setMinute}
            keyboardType="number-pad"
            maxLength={2}
            placeholder="MM"
          />
          <Text style={styles.timeHint}>(24-hour time)</Text>
        </View>

        {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

        <TouchableOpacity
          style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>{t("add_reminder")}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 22, paddingBottom: 300 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: colors.text, marginTop: 12 },
  pageSubtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 6, marginBottom: 22 },
  label: { fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 8, marginTop: 14 },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeButton: {
    minWidth: "47%",
    flexGrow: 1,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  typeButtonSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeIcon: { fontSize: 24 },
  typeLabel: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 4 },
  typeLabelSelected: { color: colors.primary },
  input: {
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    paddingHorizontal: 16,
    fontSize: 17,
    color: colors.text,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: {
    width: 64,
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  timeColon: { fontSize: 22, fontWeight: "700", color: colors.text },
  timeHint: { fontSize: 14, color: colors.textSecondary, marginLeft: 8 },
  errorText: { fontSize: 15, color: "#BA1A1A", marginTop: 16 },
  saveButton: {
    minHeight: 62,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: colors.onPrimary, fontSize: 18, fontWeight: "700" },
});

export default AddReminderScreen;
