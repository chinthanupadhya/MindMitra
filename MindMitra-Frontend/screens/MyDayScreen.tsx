import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
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
import { cancelReminderNotification } from "../src/lib/notifications";
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
  | "gamepack"
  | "addreminder";

interface ScreenProps {
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
}

type ActivityType = "medicine" | "hydration" | "activity" | "appointment";

interface DayItemData {
  id: string;
  reminderId?: string; // present only for reminder-sourced items, used for delete
  minutesFromMidnight: number;
  time: string;
  title: string;
  subtitle: string;
  type: ActivityType;
  completed: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

const ICONS: Record<ActivityType, string> = {
  medicine: "💊",
  hydration: "💧",
  activity: "🧠",
  appointment: "🩺",
};

function formatTime(time: string | null): { label: string; minutes: number } {
  if (!time) return { label: "", minutes: 0 };
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? "0", 10);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return {
    label: `${displayHour}:${m.toString().padStart(2, "0")} ${period}`,
    minutes: h * 60 + m,
  };
}

const DayItem: React.FC<{ item: DayItemData }> = ({ item }) => {
  return (
    <TouchableOpacity
      style={[styles.dayItem, item.completed && styles.completedItem]}
      activeOpacity={0.8}
      onPress={item.onPress}
      onLongPress={item.onLongPress}
    >
      <View style={styles.timeContainer}>
        <Text style={styles.time}>{item.time}</Text>
      </View>

      <View
        style={[
          styles.iconContainer,
          item.completed && styles.completedIconContainer,
        ]}
      >
        <Text style={styles.itemIcon}>{ICONS[item.type]}</Text>
      </View>

      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, item.completed && styles.completedText]}>
          {item.title}
        </Text>
        {!!item.subtitle && (
          <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
        )}
      </View>

      {item.completed ? (
        <View style={styles.completedBadge}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      ) : (
        <Text style={styles.arrow}>›</Text>
      )}
    </TouchableOpacity>
  );
};

const MyDayScreen: React.FC<ScreenProps> = ({ onNavigate, onBack }) => {
  const { patient } = useAuth();
  const { t } = useTranslation();
  const [items, setItems] = useState<DayItemData[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const dateLabel = useMemo(
    () =>
      today.toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    [today]
  );

  useEffect(() => {
    if (!patient?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadDay() {
      const startOfToday = `${todayIso}T00:00:00`;

      const [remindersResult, tasksResult, acknowledgedResult] = await Promise.all([
        supabase
          .from("reminders")
          .select("id, title, description, reminder_type, scheduled_time")
          .eq("patient_id", patient!.id)
          .eq("is_active", true),
        supabase
          .from("tasks")
          .select("id, title, description, category, scheduled_time, status")
          .eq("patient_id", patient!.id)
          .eq("due_date", todayIso),
        supabase
          .from("notifications")
          .select("source_id")
          .eq("patient_id", patient!.id)
          .eq("source_type", "reminder")
          .eq("status", "acknowledged")
          .gte("created_at", startOfToday),
      ]);

      if (cancelled) return;

      const acknowledgedIds = new Set(
        (acknowledgedResult.data ?? []).map((n) => n.source_id)
      );

      const reminderItems: DayItemData[] = (remindersResult.data ?? []).map((r) => {
        const { label, minutes } = formatTime(r.scheduled_time);
        return {
          id: `reminder-${r.id}`,
          reminderId: r.id,
          minutesFromMidnight: minutes,
          time: label,
          title: r.title,
          subtitle: r.description ?? "",
          type: r.reminder_type as ActivityType,
          completed: acknowledgedIds.has(r.id),
          onLongPress: () => handleDeleteReminder(r.id, r.title),
        };
      });

      // Tasks whose title matches an active reminder title are legacy
      // duplicates (a reminder + a mirror task from an older build). Skip
      // them so the same reminder never shows twice in the day list.
      const reminderTitles = new Set(
        (remindersResult.data ?? []).map((r) => r.title.toLowerCase().trim())
      );

      const taskItems: DayItemData[] = (tasksResult.data ?? [])
        .filter((t) => !reminderTitles.has(t.title.toLowerCase().trim()))
        .map((t) => {
        const { label, minutes } = formatTime(t.scheduled_time);
        return {
          id: `task-${t.id}`,
          minutesFromMidnight: minutes,
          time: label || "Anytime",
          title: t.title,
          subtitle: t.description ?? "",
          type: "activity",
          completed: t.status === "completed",
          onPress:
            t.category === "memory_game" || t.title.toLowerCase().includes("memory")
              ? () => onNavigate("gamepack")
              : undefined,
        };
      });

      const combined = [...reminderItems, ...taskItems].sort(
        (a, b) => a.minutesFromMidnight - b.minutesFromMidnight
      );

      if (!cancelled) {
        setItems(combined);
        setLoading(false);
      }
    }

    async function handleDeleteReminder(reminderId: string, title: string) {
      Alert.alert("Delete reminder?", `Remove "${title}" from your reminders?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await supabase.from("reminders").delete().eq("id", reminderId);
            await cancelReminderNotification(reminderId);
            loadDay();
          },
        },
      ]);
    }

    loadDay();

    return () => {
      cancelled = true;
    };
  }, [patient?.id, todayIso]);

  const morningItems = items.filter((i) => i.minutesFromMidnight < 12 * 60);
  const afternoonItems = items.filter((i) => i.minutesFromMidnight >= 12 * 60);
  const completedCount = items.filter((i) => i.completed).length;
  const progressPct = items.length > 0 ? (completedCount / items.length) * 100 : 0;

  return (
    <View style={styles.screen}>
      <GreetingHeader name={patient?.name ?? "Elder"} showBackButton onBackPress={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>{t("my_day")}</Text>
          <Text style={styles.pageSubtitle}>
            {t("everything_you_need")}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.addReminderButton}
          onPress={() => onNavigate("addreminder")}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add a new reminder"
        >
          <Text style={styles.addReminderIcon}>+</Text>
          <Text style={styles.addReminderText}>{t("add_reminder")}</Text>
        </TouchableOpacity>

        <View style={styles.dateCard}>
          <View>
            <Text style={styles.todayLabel}>{t("today_label")}</Text>
            <Text style={styles.dateText}>{dateLabel}</Text>
          </View>
          <View style={styles.calendarIcon}>
            <Text style={styles.calendarEmoji}>📅</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={colors.primary} />
        ) : (
          <>
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>{t("todays_progress")}</Text>
                <Text style={styles.progressCount}>
                  {completedCount} {t("completed_of")} {items.length}
                </Text>
              </View>
              <View style={styles.progressBackground}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
            </View>

            {morningItems.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title={t("morning")} />
                <Text style={styles.hintText}>{t("hold_to_delete")}</Text>
                {morningItems.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <DayItem item={item} />
                    {idx < morningItems.length - 1 && <View style={styles.itemSpacing} />}
                  </React.Fragment>
                ))}
              </View>
            )}

            {afternoonItems.length > 0 && (
              <View style={styles.section}>
                <SectionHeader title={t("afternoon")} />
                {afternoonItems.map((item, idx) => (
                  <React.Fragment key={item.id}>
                    <DayItem item={item} />
                    {idx < afternoonItems.length - 1 && <View style={styles.itemSpacing} />}
                  </React.Fragment>
                ))}
              </View>
            )}

            {items.length === 0 && (
              <View style={styles.section}>
                <Text style={styles.emptyText}>
                  {t("nothing_scheduled")}
                </Text>
              </View>
            )}
          </>
        )}

        <View style={styles.reminderCard}>
          <View style={styles.reminderIconContainer}>
            <Text style={styles.reminderIcon}>🌿</Text>
          </View>
          <View style={styles.reminderContent}>
            <Text style={styles.reminderTitle}>{t("take_your_time")}</Text>
            <Text style={styles.reminderText}>
              {t("no_rush_text")}
            </Text>
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

  addReminderButton: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  addReminderIcon: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary,
    marginRight: 8,
  },

  addReminderText: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.primary,
  },

  hintText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: -8,
    marginBottom: 12,
  },

  dateCard: {
    minHeight: 108,
    backgroundColor: colors.primary,
    borderRadius: 22,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  todayLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.primaryLight,
  },

  dateText: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.onPrimary,
    marginTop: 7,
  },

  calendarIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  calendarEmoji: {
    fontSize: 30,
  },

  progressSection: {
    marginTop: 30,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  progressTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
  },

  progressCount: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  progressBackground: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 7,
    backgroundColor: colors.primary,
  },

  section: {
    marginTop: 36,
  },

  emptyText: {
    fontSize: 17,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: 20,
  },

  dayItem: {
    minHeight: 112,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },

  completedItem: {
    opacity: 0.8,
  },

  timeContainer: {
    width: 72,
  },

  time: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  completedIconContainer: {
    backgroundColor: colors.successSoft,
  },

  itemIcon: {
    fontSize: 28,
  },

  itemContent: {
    flex: 1,
  },

  itemTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 25,
  },

  completedText: {
    textDecorationLine: "line-through",
  },

  itemSubtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 5,
  },

  completedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  checkmark: {
    color: colors.onPrimary,
    fontSize: 20,
    fontWeight: "700",
  },

  arrow: {
    fontSize: 34,
    color: colors.primary,
    marginLeft: 8,
  },

  itemSpacing: {
    height: 14,
  },

  reminderCard: {
    flexDirection: "row",
    backgroundColor: colors.secondaryLight,
    borderRadius: 22,
    padding: 20,
    marginTop: 36,
    alignItems: "flex-start",
  },

  reminderIconContainer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  reminderIcon: {
    fontSize: 30,
  },

  reminderContent: {
    flex: 1,
  },

  reminderTitle: {
    fontSize: 20,
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

export default MyDayScreen;
