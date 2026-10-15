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
import { inferenceEngine } from "../src/lib/ai/inference";
import { reportRenderer } from "../src/lib/reportRenderer";
import { getAllRoundsForUser, upsertPatientLocal } from "../src/db/local";
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

interface ProgressCardProps {
  icon: string;
  value: string;
  label: string;
}

const ProgressCard: React.FC<ProgressCardProps> = ({ icon, value, label }) => {
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressIconContainer}>
        <Text style={styles.progressIcon}>{icon}</Text>
      </View>
      <Text style={styles.progressValue}>{value}</Text>
      <Text style={styles.progressLabel}>{label}</Text>
    </View>
  );
};

interface TimelineItemProps {
  date: string;
  title: string;
  description: string;
  icon: string;
  isLast?: boolean;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ date, title, description, icon, isLast = false }) => {
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLeft}>
        <View style={styles.timelineIcon}>
          <Text style={styles.timelineEmoji}>{icon}</Text>
        </View>
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineDate}>{date}</Text>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineDescription}>{description}</Text>
      </View>
    </View>
  );
};

interface RoundRow {
  timestamp: string;
  completed: boolean;
  accuracy: number | null;
  correct_count: number;
  error_count: number;
  games: { name: string } | null;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function relativeDayLabel(iso: string): string {
  const roundDate = new Date(iso);
  roundDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - roundDate.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} Days Ago`;
  return roundDate.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

const MyJourneyScreen: React.FC<ScreenProps> = ({ onNavigate, onBack }) => {
  const { patient } = useAuth();
  const { t } = useTranslation();

  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [loading, setLoading] = useState(true);

  // AI report generation state.
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportMessage, setReportMessage] = useState<string | null>(null);

  const generateReport = async () => {
    if (!patient?.id) return;
    setReportLoading(true);
    setReportMessage(null);
    setReportText(null);
    try {
      const language = patient?.preferred_language ?? "en";
      const result = await inferenceEngine.generateReport(patient.id, patient.name ?? "the elder", language);
      if (!result) {
        setReportMessage(
          "A report needs at least 5 completed rounds. Keep playing and check back soon."
        );
      } else if ((result as { status?: string }).status === "gathering_data") {
        setReportMessage(
          "A report needs at least 5 completed rounds. Keep playing and check back soon."
        );
      } else {
        // Spec §7: the AI returns template IDs + slots; the frontend renders
        // the (translated) templates locally.
        setReportText(reportRenderer.renderReport(result as never, language));
      }
    } catch (e) {
      setReportMessage("Couldn't generate the report right now. Please try again.");
    } finally {
      setReportLoading(false);
    }
  };

  useEffect(() => {
    async function loadRounds() {
      if (!patient?.id) {
        setLoading(false);
        return;
      }

      // Cache the patient row locally so inference can read screening_assigned_level
      // even when offline (no Supabase). Fire-and-forget.
      if (patient.screening_assigned_level != null) {
        upsertPatientLocal({
          id: patient.id,
          name: patient.name ?? '',
          preferred_language: patient.preferred_language ?? null,
          screening_assigned_level: patient.screening_assigned_level,
        }).catch(() => {});
      }

      // Last 90 days is plenty to compute streaks, weekly activity, and a
      // recent-activity timeline without pulling someone's entire history.
      const since = new Date();
      since.setDate(since.getDate() - 90);

      // 1) Online: query Supabase rounds (with the game name joined).
      try {
        const { data, error } = await supabase
          .from("rounds")
          .select("timestamp, completed, accuracy, correct_count, error_count, games(name)")
          .eq("user_id", patient.id)
          .gte("timestamp", since.toISOString())
          .order("timestamp", { ascending: false });

        if (!error && data && data.length > 0) {
          setRounds(data as unknown as RoundRow[]);
          setLoading(false);
          return;
        }
      } catch {
        // network offline — fall through to local SQLite below
      }

      // 2) Offline / no cloud data: fall back to the local SQLite rounds (canonical
      //    db/local) so the patient's game statistics reflect locally-played games.
      const logs = await getAllRoundsForUser(patient.id);
      const asRows = logs
        .map((r) => ({
          timestamp: String(r.timestamp ?? new Date().toISOString()),
          completed: r.completed === true,
          accuracy: typeof r.accuracy === "number" ? r.accuracy : null,
          correct_count: r.correct_count,
          error_count: r.error_count,
          games: { name: r.game_id },
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        .slice(0, 200);

      setRounds(asRows as unknown as RoundRow[]);
      setLoading(false);
    }
    loadRounds();
  }, [patient?.id]);

  const completedRounds = rounds.filter((r) => r.completed);

  // Total activities = completed rounds in the loaded window.
  const activitiesCount = completedRounds.length;

  // Average accuracy across completed rounds that recorded one.
  const roundsWithAccuracy = completedRounds.filter((r) => r.accuracy !== null);
  const averageAccuracy =
    roundsWithAccuracy.length > 0
      ? Math.round(
          (roundsWithAccuracy.reduce((sum, r) => sum + (r.accuracy ?? 0), 0) /
            roundsWithAccuracy.length) *
            100
        )
      : null;

  // Day streak: consecutive days (counting back from today) with at least
  // one completed round.
  const activeDayKeys = new Set(
    completedRounds.map((r) => new Date(r.timestamp).toDateString())
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (activeDayKeys.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // This week (Sun-Sat) — which of the last 7 days had activity.
  const weekActiveFlags: boolean[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    weekActiveFlags.push(activeDayKeys.has(d.toDateString()));
  }
  const daysActiveThisWeek = weekActiveFlags.filter(Boolean).length;
  const weekPercent = Math.round((daysActiveThisWeek / 7) * 100);

  const recentActivity = completedRounds.slice(0, 5);

  return (
    <View style={styles.screen}>
      <GreetingHeader name={patient?.name ?? "Elder"} showBackButton onBackPress={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>{t("my_journey")}</Text>
          <Text style={styles.pageSubtitle}>
            Every little step is part of your progress.
          </Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIconContainer}>
            <Text style={styles.heroIcon}>🌱</Text>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>
              {activitiesCount > 0 ? "You're doing wonderfully!" : "Let's get started"}
            </Text>
            <Text style={styles.heroText}>
              {activitiesCount > 0
                ? "Keep taking small steps every day. They all add up."
                : "Play a memory game to start building your journey here."}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Your Progress" />

          {loading ? (
            <ActivityIndicator style={{ marginTop: 10 }} color={colors.primary} />
          ) : (
            <View style={styles.progressRow}>
              <ProgressCard icon="🧠" value={String(activitiesCount)} label="Activities" />
              <View style={styles.cardSpacer} />
              <ProgressCard icon="🔥" value={String(streak)} label="Day Streak" />
              <View style={styles.cardSpacer} />
              <ProgressCard
                icon="⭐"
                value={averageAccuracy !== null ? `${averageAccuracy}%` : "—"}
                label="Accuracy"
              />
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="This Week" />

          <View style={styles.weekCard}>
            <View style={styles.weekHeader}>
              <View>
                <Text style={styles.weekTitle}>Weekly Activity</Text>
                <Text style={styles.weekSubtitle}>{daysActiveThisWeek} of 7 days completed</Text>
              </View>
              <Text style={styles.weekPercentage}>{weekPercent}%</Text>
            </View>

            <View style={styles.progressBackground}>
              <View style={[styles.progressFill, { width: `${weekPercent}%` }]} />
            </View>

            <View style={styles.dayLabels}>
              {DAY_LETTERS.map((letter, i) => (
                <Text
                  key={i}
                  style={[styles.dayLabel, weekActiveFlags[i] && styles.dayLabelActive]}
                >
                  {letter}
                </Text>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Recent Activity" />

          {loading ? (
            <ActivityIndicator style={{ marginTop: 10 }} color={colors.primary} />
          ) : recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>
              No activity yet. Completed games will show up here.
            </Text>
          ) : (
            <View style={styles.timelineCard}>
              {recentActivity.map((r, idx) => {
                const accuracyPct = r.accuracy !== null ? Math.round(r.accuracy * 100) : null;
                return (
                  <TimelineItem
                    key={idx}
                    date={relativeDayLabel(r.timestamp)}
                    title={`${r.games?.name ?? "Memory Game"} Completed`}
                    description={
                      accuracyPct !== null
                        ? `${r.correct_count} correct, ${r.error_count} missed — ${accuracyPct}% accuracy.`
                        : `${r.correct_count} correct, ${r.error_count} missed.`
                    }
                    icon="🧠"
                    isLast={idx === recentActivity.length - 1}
                  />
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="AI Progress Report" />

          <TouchableOpacity
            style={[styles.viewProgressButton, reportLoading && { opacity: 0.7 }]}
            onPress={generateReport}
            activeOpacity={0.85}
            disabled={reportLoading}
          >
            {reportLoading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <Text style={styles.viewProgressText}>
                  {reportText ? "Regenerate Report" : "Generate Report"}
                </Text>
                <Text style={styles.arrow}>→</Text>
              </>
            )}
          </TouchableOpacity>

          {reportMessage && (
            <Text style={styles.reportMessage}>{reportMessage}</Text>
          )}

          {reportText && (
            <View style={styles.reportCard}>
              <Text style={styles.reportText}>{reportText}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.viewProgressButton}
          onPress={() => onNavigate("gamepack" as ScreenName)}
          activeOpacity={0.85}
        >
          <Text style={styles.viewProgressText}>Play a Memory Game</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNav
        activeTab="GameStats"
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
  screen: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 22, paddingBottom: 40 },
  titleSection: { marginTop: 18, marginBottom: 28 },
  pageTitle: { fontSize: 32, fontWeight: "700", color: colors.text },
  pageSubtitle: { fontSize: 18, lineHeight: 26, color: colors.textSecondary, marginTop: 8 },

  heroCard: {
    minHeight: 122,
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  heroIcon: { fontSize: 34 },
  heroContent: { flex: 1 },
  heroTitle: { fontSize: 21, fontWeight: "700", color: colors.onPrimary },
  heroText: { fontSize: 16, lineHeight: 23, color: colors.onPrimary, opacity: 0.9, marginTop: 6 },

  section: { marginTop: 38 },
  progressRow: { flexDirection: "row" },
  progressCard: {
    flex: 1,
    minHeight: 160,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  cardSpacer: { width: 10 },
  progressIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  progressIcon: { fontSize: 27 },
  progressValue: { fontSize: 27, fontWeight: "700", color: colors.primary },
  progressLabel: { fontSize: 14, lineHeight: 19, color: colors.textSecondary, marginTop: 6, textAlign: "center" },

  emptyText: { fontSize: 16, color: colors.textSecondary, textAlign: "center", paddingVertical: 20 },

  weekCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  weekHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  weekTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  weekSubtitle: { fontSize: 16, color: colors.textSecondary, marginTop: 5 },
  weekPercentage: { fontSize: 28, fontWeight: "700", color: colors.primary },
  progressBackground: {
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
    marginTop: 22,
  },
  progressFill: { height: "100%", borderRadius: 7, backgroundColor: colors.primary },
  dayLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  dayLabel: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
  dayLabelActive: { color: colors.primary },

  timelineCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  timelineItem: { flexDirection: "row" },
  timelineLeft: { width: 60, alignItems: "center" },
  timelineIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineEmoji: { fontSize: 23, color: colors.primary, fontWeight: "700" },
  timelineLine: { width: 2, flex: 1, minHeight: 64, backgroundColor: colors.surfaceHigh },
  timelineContent: { flex: 1, paddingBottom: 30 },
  timelineDate: { fontSize: 14, fontWeight: "700", color: colors.primary, marginBottom: 5 },
  timelineTitle: { fontSize: 19, lineHeight: 25, fontWeight: "700", color: colors.text },
  timelineDescription: { fontSize: 16, lineHeight: 23, color: colors.textSecondary, marginTop: 5 },

  viewProgressButton: {
    minHeight: 66,
    borderRadius: 20,
    backgroundColor: colors.primary,
    marginTop: 36,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewProgressText: { fontSize: 19, fontWeight: "700", color: colors.onPrimary },
  arrow: { fontSize: 30, fontWeight: "700", color: colors.onPrimary },

  reportMessage: { fontSize: 16, lineHeight: 23, color: colors.textSecondary, marginTop: 16 },
  reportCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    padding: 20,
    marginTop: 16,
  },
  reportText: { fontSize: 17, lineHeight: 26, color: colors.text },
});

export default MyJourneyScreen;
