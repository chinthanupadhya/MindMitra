import React, { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Image, Pressable, SafeAreaView, ScrollView,
  StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import colors from "../theme/colors";
import { useAuth } from "../src/context/AuthContext";
import { supabase } from "../src/lib/supabaseClient";
import { inferenceEngine } from "../src/lib/ai/inference";
import { reportRenderer } from "../src/lib/reportRenderer";
import { getPatientsLocal, getAllRoundsForUser } from "../src/db/local";
import GameAccuracyChart from "../components/GameAccuracyChart";

export type ScreenName =
  | "caregiverHome"
  | "patients"
  | "alerts"
  | "settings"
  | "appointments"
  | "circle"
  | "patientProfile";

type Props = {
  onNavigate?: (screen: string) => void;
  onBack?: () => void;
  caregiverName?: string;
};

type Patient = {
  id: string; name: string; relation: string; age: number | null;
  status: string; lastActivity: string; initials: string; preferredLanguage: string | null;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const navMap: Record<string, ScreenName> = {
  Home: "caregiverHome", Patients: "patients", Appointments: "appointments", Circle: "circle", Settings: "settings",
};

const homeActions = [
  { icon: "calendar-outline" as const, title: "Appointments", subtitle: "View upcoming visits", screen: "appointments" as ScreenName },
  { icon: "notifications-outline" as const, title: "Reminders", subtitle: "Manage reminders", screen: "alerts" as ScreenName },
  { icon: "people-outline" as const, title: "Care Circle", subtitle: "Stay connected", screen: "circle" as ScreenName },
];

export default function CaregiverHome({ onBack, caregiverName }: Props) {
  const { caregiver } = useAuth();
  const displayName = caregiver?.name ?? caregiverName ?? "Caregiver";
  const [screen, setScreen] = useState<ScreenName>("caregiverHome");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);

  useEffect(() => {
    async function loadPatients() {
      if (!caregiver?.id) {
        setPatientsLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("patient_caregivers")
        .select("relationship, status, patients(id, name, date_of_birth, updated_at, preferred_language)")
        .eq("caregiver_id", caregiver.id)
        .eq("status", "accepted");

      if (data) {
        const real: Patient[] = data
          .filter((row: any) => row.patients)
          .map((row: any) => ({
            id: row.patients.id,
            name: row.patients.name,
            relation: row.relationship || "Caregiver",
            age: ageFromDob(row.patients.date_of_birth),
            status: "Linked patient",
            lastActivity: relativeTime(row.patients.updated_at),
            initials: getInitials(row.patients.name),
            preferredLanguage: row.patients.preferred_language ?? null,
          }));
        setPatients(real);
        setSelectedPatient(real[0] ?? null);
      } else if (error) {
        // Offline: fall back to the SQLite patients cache (filled by the
        // last successful pullSupabaseToLocal).
        try {
          const cached = await getPatientsLocal();
          if (cached.length > 0) {
            const real: Patient[] = cached.map((p) => ({
              id: p.id,
              name: p.name,
              relation: "Caregiver",
              age: null,
              status: "Linked patient",
              lastActivity: "cached offline",
              initials: getInitials(p.name),
              preferredLanguage: p.preferred_language ?? null,
            }));
            setPatients(real);
            setSelectedPatient(real[0] ?? null);
          }
        } catch (e) {
          /* ignore */
        }
      }
      setPatientsLoading(false);
    }
    loadPatients();
  }, [caregiver?.id]);

  const navigate = (next: ScreenName) => setScreen(next);
  const openPatient = (patient: Patient) => { setSelectedPatient(patient); setScopedPatientId(patient.id); setScreen("patientProfile"); };
  const back = () => setScreen("caregiverHome");
  // When a specific patient is opened, scope the appointments list to just
  // them so it doesn't show every linked patient's appointments.
  const [scopedPatientId, setScopedPatientId] = useState<string | null>(null);

  // Live "Today at a Glance" + needs-attention + next appointment for the
  // selected patient (wired to the DB — no more hardcoded numbers).
  const [glance, setGlance] = useState({ activities: 0, reminders: 0, appointments: 0 });
  const [attention, setAttention] = useState<{ title: string; text: string } | null>(null);
  const [upcoming, setUpcoming] = useState<{ doctor: string; when: string; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSelectedGlance() {
      if (!selectedPatient) { setGlance({ activities: 0, reminders: 0, appointments: 0 }); return; }
      const today = new Date().toISOString().slice(0, 10);

      const [tasksRes, remRes, apptRes] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("patient_id", selectedPatient.id).eq("status", "pending").eq("due_date", today),
        supabase.from("reminders").select("id", { count: "exact", head: true }).eq("patient_id", selectedPatient.id).eq("is_active", true),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", selectedPatient.id).eq("status", "scheduled").gte("appointment_date", today),
      ]);

      // Next upcoming appointment (first scheduled one).
      const { data: appt } = await supabase
        .from("appointments")
        .select("doctor_name, specialty, appointment_date, appointment_time")
        .eq("patient_id", selectedPatient.id)
        .eq("status", "scheduled")
        .gte("appointment_date", today)
        .order("appointment_date", { ascending: true })
        .limit(1);

      // First pending reminder (for the Needs Attention card).
      const { data: rem } = await supabase
        .from("reminders")
        .select("title, description, scheduled_time")
        .eq("patient_id", selectedPatient.id)
        .eq("is_active", true)
        .order("scheduled_time", { ascending: true })
        .limit(1);

      if (cancelled) return;
      setGlance({
        activities: tasksRes.count ?? 0,
        reminders: remRes.count ?? 0,
        appointments: apptRes.count ?? 0,
      });
      setAttention(rem && rem.length > 0 ? { title: rem[0].title, text: rem[0].description ?? "Reminder needs checking." } : null);
      setUpcoming(appt && appt.length > 0 ? {
        doctor: appt[0].doctor_name,
        when: `${(appt[0].appointment_date ?? "").slice(5).replace("-", "/")} · ${(appt[0].appointment_time ?? "").slice(0, 5)}`,
        text: appt[0].specialty ?? "Routine visit",
      } : null);
    }
    loadSelectedGlance();
    return () => { cancelled = true; };
  }, [selectedPatient?.id]);

  if (screen === "patients") return <PatientsScreen patients={patients} onNavigate={navigate} onBack={back} onPatient={openPatient} />;
  if (screen === "patientProfile" && selectedPatient) return <PatientProfile patient={selectedPatient} onNavigate={navigate} onBack={() => setScreen("patients")} onOpenAppointments={() => { setScopedPatientId(selectedPatient.id); setScreen("appointments"); }} onOpenAlerts={() => setScreen("alerts")} />;
  if (screen === "alerts") return <AlertsScreen patients={patients} onNavigate={navigate} onBack={back} />;
  if (screen === "appointments") return <AppointmentsScreen patients={patients} onNavigate={navigate} onBack={back} scopePatientId={scopedPatientId} />;
  if (screen === "circle") return <CircleScreen onNavigate={navigate} onBack={back} />;
  if (screen === "settings") return <SettingsScreen onNavigate={navigate} onBack={back} />;

  // caregiverHome
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.app}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {onBack ? (
              <Pressable accessibilityRole="button" onPress={onBack} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={28} color={colors.text} />
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => navigate("settings")} style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={23} color={colors.primary} />
                </View>
              </Pressable>
            )}
          </View>
          <Pressable onPress={() => navigate("alerts")} style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={29} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.greeting}>Good morning, {displayName}</Text>
          <Text style={styles.title}>Caring for</Text>

          <View style={styles.patientCard}>
            {patientsLoading ? (
              <Text style={styles.patientSub}>Loading your patients…</Text>
            ) : selectedPatient ? (
              <>
                <View style={styles.patientTop}>
                  <View style={styles.patientPhoto}>
                    <Text style={styles.initials}>{selectedPatient.initials}</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>{selectedPatient.status}</Text>
                  </View>
                </View>
                <Text style={styles.patientName}>{selectedPatient.name}</Text>
                <Text style={styles.patientSub}>Profile updated {selectedPatient.lastActivity}</Text>
                <Pressable
                  style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}
                  onPress={() => navigate("patients")}
                >
                  <Text style={styles.outlineText}>View patient</Text>
                  <Ionicons name="arrow-forward" size={22} color={colors.primary} />
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.patientName}>No patients linked yet</Text>
                <Text style={styles.patientSub}>
                  Ask a patient to add you from their Care Circle screen using your email.
                </Text>
              </>
            )}
          </View>

          <Text style={styles.sectionTitle}>Today at a Glance</Text>
          <View style={styles.glanceRow}>
            <Glance value={String(glance.activities)} label="Activities" />
            <Glance value={String(glance.reminders)} label="Reminders" />
            <Glance value={String(glance.appointments)} label="Appointments" />
          </View>

          <Text style={styles.sectionTitle}>Needs Attention</Text>
          {attention ? (
            <Pressable
              onPress={() => navigate("alerts")}
              style={({ pressed }) => [styles.attentionCard, pressed && styles.pressed]}
            >
              <View style={styles.attentionIcon}>
                <Ionicons name="notifications-outline" size={27} color={colors.warning} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{attention.title}</Text>
                <Text style={styles.cardSub}>{attention.text}</Text>
              </View>
              <Ionicons name="chevron-forward" size={25} color={colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={styles.attentionCard}>
              <View style={styles.attentionIcon}>
                <Ionicons name="checkmark-done-outline" size={27} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>All caught up</Text>
                <Text style={styles.cardSub}>No reminders need attention right now.</Text>
              </View>
            </View>
          )}

          <Text style={styles.sectionTitle}>Upcoming Appointment</Text>
          {upcoming ? (
            <View style={styles.appointmentCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar-outline" size={27} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{upcoming.doctor}</Text>
                <Text style={styles.cardSub}>{upcoming.when}</Text>
                <Text style={styles.cardSub}>{upcoming.text}</Text>
              </View>
            </View>
          ) : (
            <Text style={styles.cardSub}>No upcoming appointments scheduled.</Text>
          )}
          <Pressable style={styles.primaryButton} onPress={() => navigate("appointments")}>
            <Text style={styles.primaryText}>View Appointments</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            {homeActions.map((item) => (
              <Pressable
                key={item.title}
                onPress={() => navigate(item.screen)}
                style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name={item.icon} size={28} color={colors.primary} />
                </View>
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.actionSub}>{item.subtitle}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.mitraCard}>
            <Image source={require("../assets/mitra.jpg")} style={styles.mitraImage} />
            <View style={styles.flex}>
              <Text style={styles.mitraTitle}>Hi! I'm Mitra 👋</Text>
              {aiReport ? (
                <Text style={styles.mitraText}>{aiReport}</Text>
              ) : (
                <Text style={styles.mitraText}>
                  {selectedPatient 
                    ? `${selectedPatient.name} is doing well today. Would you like a quick AI summary?` 
                    : "I can generate a progress summary once a patient is linked."}
                </Text>
              )}
              {/* Generate for a linked patient; when a report already exists,
                  the same button becomes "Regenerate Report" so caregivers can
                  refresh the currently selected patient's AI summary. */}
              {selectedPatient && (
                <Pressable 
                  onPress={async () => {
                    setGeneratingReport(true);
                    try {
                      // Fetch the AI report using the inference engine, then
                      // render the (translated) templates locally (spec §7).
                      const lang = selectedPatient.preferredLanguage ?? "en";
                      const reportData = await inferenceEngine.generateReport(selectedPatient.id, selectedPatient.name, lang);
                      if (reportData && (reportData as any).opening_id) {
                         const paragraph = reportRenderer.renderReport(reportData, lang);
                         setAiReport(paragraph);
                      } else if ((reportData as any)?.status === 'gathering_data') {
                         setAiReport("Not enough data yet. Please complete at least 5 games.");
                      } else {
                         setAiReport("Failed to generate report. Please try again.");
                      }
                    } catch (e) {
                      setAiReport("An error occurred while generating the report.");
                    }
                    setGeneratingReport(false);
                  }} 
                  style={styles.askButton}
                  disabled={generatingReport}
                >
                  {generatingReport ? (
                    <ActivityIndicator color={colors.onPrimary} size="small" />
                  ) : (
                    <Text style={styles.askText}>{aiReport ? "Regenerate Report" : "Generate AI Summary"}</Text>
                  )}
                </Pressable>
              )}
            </View>
          </View>
          <View style={{ height: 110 }} />
        </ScrollView>

        <View style={styles.bottomNav}>
          <NavItem icon="home-outline" label="Home" active onPress={() => navigate("caregiverHome")} />
          <NavItem icon="people-outline" label="Patients" onPress={() => navigate("patients")} />
          <NavItem icon="calendar-outline" label="Appointments" onPress={() => navigate("appointments")} />
          <NavItem icon="people-circle-outline" label="Circle" onPress={() => navigate("circle")} />
          <NavItem icon="settings-outline" label="Settings" onPress={() => navigate("settings")} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Shared shell ──────────────────────────────────────────────────────────────

function ScreenShell({ title, subtitle, onBack, children, onNavigate, current }: {
  title: string; subtitle?: string; onBack: () => void;
  children: React.ReactNode; onNavigate: (s: ScreenName) => void; current?: string;
}) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.app}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={27} color={colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
          </View>
          <Pressable onPress={() => onNavigate("alerts")} style={styles.headerButton}>
            <Ionicons name="notifications-outline" size={28} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.pageTitle}>{title}</Text>
          {children}
          <View style={{ height: 110 }} />
        </ScrollView>
        <BottomNav current={current ?? title} onNavigate={onNavigate} />
      </View>
    </SafeAreaView>
  );
}

function BottomNav({ current, onNavigate }: { current: string; onNavigate: (s: ScreenName) => void }) {
  const items = [
    ["home-outline", "Home"], ["people-outline", "Patients"],
    ["calendar-outline", "Appointments"], ["people-circle-outline", "Circle"],
    ["settings-outline", "Settings"],
  ] as const;
  return (
    <View style={styles.bottomNav}>
      {items.map(([icon, label]) => (
        <Pressable key={label} onPress={() => onNavigate(navMap[label])}
          style={[styles.navItem, current === label && styles.navActive]}>
          <Ionicons name={icon} size={24} color={current === label ? colors.onPrimary : colors.text} />
          <Text style={[styles.navLabel, current === label && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Patients ──────────────────────────────────────────────────────────────────

function PatientsScreen({ patients, onNavigate, onBack, onPatient }: {
  patients: Patient[]; onNavigate: (s: ScreenName) => void; onBack: () => void; onPatient: (p: Patient) => void;
}) {
  const [taskCount, setTaskCount] = useState(0);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (patients.length === 0) return;
    const ids = patients.map((p) => p.id);
    const today = new Date().toISOString().slice(0, 10);
    (async () => {
      const [t, r] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).in("patient_id", ids).eq("status", "pending").eq("due_date", today),
        supabase.from("reminders").select("id", { count: "exact", head: true }).in("patient_id", ids).eq("is_active", true),
      ]);
      setTaskCount(t.count ?? 0);
      setAlertCount(r.count ?? 0);
    })();
  }, [patients.length]);

  return (
    <ScreenShell title="Patients" subtitle="People you care for" onBack={onBack} onNavigate={onNavigate} current="Patients">
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={22} color={colors.textSecondary} />
        <TextInput placeholder="Search patients" placeholderTextColor={colors.textSecondary} style={styles.searchInput} />
      </View>
      <Text style={styles.helper}>
        {patients.length} {patients.length === 1 ? "person" : "people"} in your care circle
      </Text>
      {patients.length === 0 && (
        <Text style={styles.cardSub}>
          No patients linked yet. Ask a patient to add you from their Care Circle screen using your email.
        </Text>
      )}
      {patients.map(p => (
        <Pressable key={p.id} onPress={() => onPatient(p)} style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}>
          <View style={styles.bigAvatar}><Text style={styles.initials}>{p.initials}</Text></View>
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <Text style={styles.cardSub}>{p.relation}{p.age ? ` · ${p.age} years` : ""}</Text>
            <View style={styles.row}>
              <View style={[styles.statusDot, { backgroundColor: p.status === "Needs attention" ? colors.warning : colors.primary }]} />
              <Text style={styles.statusText}>{p.status}</Text>
            </View>
            <Text style={styles.cardSub}>Profile updated {p.lastActivity}</Text>
          </View>
          <Ionicons name="chevron-forward" size={25} color={colors.textSecondary} />
        </Pressable>
      ))}
      <Text style={styles.sectionTitle}>Care overview</Text>
      <View style={styles.glanceRow}>
        <Glance value={String(patients.length)} label="Patients" />
        <Glance value={String(taskCount)} label="Tasks today" />
        <Glance value={String(alertCount)} label="Active alerts" />
      </View>
    </ScreenShell>
  );
}

// ── Patient Profile ───────────────────────────────────────────────────────────

function PatientProfile({ patient, onNavigate, onBack, onOpenAppointments, onOpenAlerts }: {
  patient: Patient; onNavigate: (s: ScreenName) => void; onBack: () => void;
  onOpenAppointments: () => void; onOpenAlerts: () => void;
}) {
  const [todayReminders, setTodayReminders] = useState(0);
  const [upcomingAppointments, setUpcomingAppointments] = useState(0);
  const [loadingGlance, setLoadingGlance] = useState(true);

  // Per-patient game stats (issue #3) — loaded from the rounds table.
  const [gameStats, setGameStats] = useState<{ gameName: string; rounds: number; bestAccuracy: number }[]>([]);
  const [totalRounds, setTotalRounds] = useState(0);
  const [avgAccuracy, setAvgAccuracy] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  // Per-game accuracy per round (oldest first) for the interactive chart.
  const [chartSeries, setChartSeries] = useState<{ gameName: string; points: number[] }[]>([]);
  // Per-patient AI report regeneration (from the profile).
  const [patientReport, setPatientReport] = useState<string | null>(null);
  const [patientReportLoading, setPatientReportLoading] = useState(false);

  useEffect(() => {
    async function loadGlance() {
      const todayKey = new Date().toISOString().slice(0, 10);
      const [remindersResult, appointmentsResult] = await Promise.all([
        supabase.from("reminders").select("id", { count: "exact", head: true }).eq("patient_id", patient.id).eq("is_active", true),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("patient_id", patient.id).eq("status", "scheduled").gte("appointment_date", todayKey),
      ]);
      setTodayReminders(remindersResult.count ?? 0);
      setUpcomingAppointments(appointmentsResult.count ?? 0);
      setLoadingGlance(false);
    }
    async function loadGameStats() {
      // Compute stats (rounds count, avg accuracy, per-game breakdown, and
      // per-game series for the chart) from a uniform rows shape. Shared by
      // the online (Supabase) and offline (local JSON log) paths.
      const computeStats = (rows: any[]) => {
        setTotalRounds(rows.length);

        const valid = rows.filter((r: any) => typeof r.accuracy === "number" && r.accuracy >= 0 && r.accuracy <= 1);
        setAvgAccuracy(valid.length > 0 ? Math.round((valid.reduce((s: number, r: any) => s + r.accuracy, 0) / valid.length) * 100) : 0);

        const byGame: Record<string, { total: number; best: number }> = {};
        for (const r of rows) {
          const gid = r.game_id ?? "unknown";
          const acc = (typeof r.accuracy === "number") ? r.accuracy : 0;
          const entry = byGame[gid] ?? { total: 0, best: 0 };
          entry.total += 1;
          if (acc > entry.best) entry.best = acc;
          byGame[gid] = entry;
        }
        const missingObjects: Record<string, string> = {
          "c2325c82-87aa-47fc-9b08-569b5d135694": "Match 2",
          "f6832a47-78fc-49d5-81cc-c2b1418f9d08": "Sequence",
          "2aeaf7c0-cd7d-4095-8518-53b23fdf6223": "Meet & Greet",
          "65adbc99-6e1f-4e60-aa86-afbde105fd16": "Monuments",
          "8b3a79a3-c25a-4430-a821-3566bad38ce7": "Sort & Match",
          "9eaaafd6-9272-4bc6-89f1-44c6829b56f7": "Triple Stack",
          "f23f9c95-c873-4c2b-8cda-ff86ad72906c": "Missing Objects",
        };
        setGameStats(
          Object.entries(byGame).map(([gid, v]) => ({
            gameName: missingObjects[gid] ?? gid,
            rounds: v.total,
            bestAccuracy: Math.round(v.best * 100),
          }))
        );

        const seriesByGame: Record<string, number[]> = {};
        for (const r of rows) {
          const gid = r.game_id ?? "unknown";
          if (typeof r.accuracy !== "number" || !isFinite(r.accuracy)) continue;
          (seriesByGame[gid] ??= []).push(Math.round(Math.max(0, Math.min(1, r.accuracy)) * 100));
        }
        setChartSeries(
          Object.entries(seriesByGame).map(([gid, pts]) => ({
            gameName: missingObjects[gid] ?? gid,
            points: pts.slice(-10),
          }))
        );
      };

      // 1) Online first: query Supabase rounds.
      const { data, error } = await supabase
        .from("rounds")
        .select("game_id, accuracy, error_count")
        .eq("user_id", patient.id)
        .order("timestamp", { ascending: true });

      const rows = data ?? [];
      if (!error && rows.length > 0) {
        computeStats(rows);
      } else {
        // 2) Offline / no data from Supabase — read the canonical local SQLite
        //    rounds (db/local) for this patient.
        const logs = await getAllRoundsForUser(patient.id).catch(() => []);
        const patientLogs = logs.filter((r) => r.user_id === patient.id);
        computeStats(patientLogs);
      }
      setLoadingStats(false);
    }
    loadGlance();
    loadGameStats();
  }, [patient.id]);

  const handlePatientReport = async () => {
    setPatientReportLoading(true);
    try {
      const lang = patient.preferredLanguage ?? "en";
      const reportData = await inferenceEngine.generateReport(patient.id, patient.name, lang);
      if (reportData && (reportData as any).opening_id) {
        setPatientReport(reportRenderer.renderReport(reportData, lang));
      } else if ((reportData as any)?.status === "gathering_data") {
        setPatientReport("Not enough data yet. Please complete at least 5 games.");
      } else {
        setPatientReport("Failed to generate report. Please try again.");
      }
    } catch (e) {
      setPatientReport("An error occurred while generating the report.");
    }
    setPatientReportLoading(false);
  };

  return (
    <ScreenShell title={patient.name} subtitle="Patient profile" onBack={onBack} onNavigate={onNavigate} current="Patients">
      <View style={styles.profileHero}>
        <View style={styles.profileAvatar}><Text style={styles.profileInitials}>{patient.initials}</Text></View>
        <Text style={styles.profileName}>{patient.name}</Text>
        <Text style={styles.cardSub}>{patient.relation}{patient.age ? ` · ${patient.age} years` : ""}</Text>
        <View style={styles.goodPill}>
          <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
          <Text style={styles.statusText}>{patient.status}</Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Today</Text>
      {loadingGlance ? (
        <ActivityIndicator style={{ marginBottom: 16 }} color={colors.primary} />
      ) : (
        <View style={styles.glanceRow}>
          <Glance value={String(todayReminders)} label="Active reminders" />
          <Glance value={String(upcomingAppointments)} label="Upcoming visits" />
        </View>
      )}

      <Text style={styles.sectionTitle}>Game Stats</Text>
      {loadingStats ? (
        <ActivityIndicator style={{ marginBottom: 16 }} color={colors.primary} />
      ) : totalRounds === 0 ? (
        <Text style={styles.cardSub}>No games played yet.</Text>
      ) : (
        <View style={styles.glanceRow}>
          <Glance value={String(totalRounds)} label="Rounds" />
          <Glance value={`${avgAccuracy}%`} label="Avg accuracy" />
        </View>
      )}
      {!loadingStats && totalRounds > 0 && (
        <GameAccuracyChart series={chartSeries} height={230} />
      )}

      <Text style={styles.sectionTitle}>AI Progress Report</Text>
      {patientReport && <Text style={styles.cardSub}>{patientReport}</Text>}
      <Pressable
        style={styles.primaryButton}
        onPress={handlePatientReport}
        disabled={patientReportLoading}
      >
        {patientReportLoading ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Ionicons name="sparkles-outline" size={20} color={colors.onPrimary} />
            <Text style={styles.primaryText}>{patientReport ? "Regenerate Report" : "Generate Report"}</Text>
          </>
        )}
      </Pressable>

      <Text style={styles.sectionTitle}>Care sections</Text>
      <ProfileAction icon="calendar-outline" title="Appointments" text="Upcoming doctor visits and follow-ups" onPress={onOpenAppointments} />
      <ProfileAction icon="notifications-outline" title="Reminders & alerts" text="Medication and care reminders" onPress={onOpenAlerts} />
    </ScreenShell>
  );
}

function ProfileAction({ icon, title, text, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; text: string; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}>
      <View style={styles.actionIcon}><Ionicons name={icon} size={27} color={colors.primary} /></View>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={23} color={colors.textSecondary} />
    </Pressable>
  );
}

// ── Alerts ────────────────────────────────────────────────────────────────────

type AlertItem = {
  id: string;
  type: "reminder" | "appointment";
  title: string;
  text: string;
  time: string;
  level: "warning" | "good" | "info";
  done: boolean;
  patientName: string;
};

function AlertsScreen({ patients, onNavigate, onBack }: {
  patients: Patient[]; onNavigate: (s: ScreenName) => void; onBack: () => void;
}) {
  const [items, setItems] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-reminder form state
  const [showAdd, setShowAdd] = useState(false);
  const [selPatientId, setSelPatientId] = useState<string | null>(patients[0]?.id ?? null);
  const [type, setType] = useState<"medicine" | "hydration" | "activity">("medicine");
  const [title, setTitle] = useState("");
  const [timeText, setTimeText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scrollable time-slot chips (30-min steps, 9:00 AM – 8:00 PM).
  const TIME_SLOTS = [];
  for (let total = 9 * 60; total + 30 <= 20 * 60; total += 30) {
    const h = Math.floor(total / 60), m = total % 60;
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    const hh = h.toString().padStart(2, "0"), mm = m.toString().padStart(2, "0");
    TIME_SLOTS.push({ key: `${hh}:${mm}`, label: `${displayHour}:${mm} ${period}` });
  }

  const loadAlerts = async () => {
    if (patients.length === 0) { setLoading(false); return; }
    const ids = patients.map((p) => p.id);
    const today = new Date().toISOString().slice(0, 10);

    const [remRes, apptRes] = await Promise.all([
      supabase
        .from("reminders")
        .select("id, patient_id, title, description, scheduled_time, is_active")
        .in("patient_id", ids)
        .eq("is_active", true)
        .order("scheduled_time", { ascending: true }),
      supabase
        .from("appointments")
        .select("id, patient_id, doctor_name, appointment_date, appointment_time, status")
        .in("patient_id", ids)
        .eq("status", "scheduled")
        .gte("appointment_date", today)
        .order("appointment_date", { ascending: true }),
    ]);

    const nameOf = (pid: string) => patients.find((p) => p.id === pid)?.name ?? "Patient";

    const remItems: AlertItem[] = (remRes.data ?? []).map((r: any) => ({
      id: r.id,
      type: "reminder",
      title: r.title,
      text: r.description ?? "Reminder needs checking.",
      time: (r.scheduled_time ?? "").slice(0, 5),
      level: "warning",
      done: false,
      patientName: nameOf(r.patient_id),
    }));

    const apptItems: AlertItem[] = (apptRes.data ?? []).map((a: any) => ({
      id: a.id,
      type: "appointment",
      title: `Appointment: ${a.doctor_name}`,
      text: "Upcoming visit",
      time: `${(a.appointment_date ?? "").slice(5)} · ${(a.appointment_time ?? "").slice(0, 5)}`,
      level: "info",
      done: false,
      patientName: nameOf(a.patient_id),
    }));

    setItems([...remItems, ...apptItems]);
    setLoading(false);
  };

  useEffect(() => { loadAlerts(); }, [patients.length]);

  const markDone = async (item: AlertItem) => {
    if (item.type === "reminder") {
      await supabase.from("reminders").update({ is_active: false }).eq("id", item.id);
    }
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, done: true } : x)));
  };

  const handleAddReminder = async () => {
    setErrorMsg(null);
    if (!selPatientId) { setErrorMsg("Select a patient first."); return; }
    if (!title.trim()) { setErrorMsg("Give the reminder a title."); return; }
    const m = /^([01]?\d|2[0-3]):[0-5]\d$/.test(timeText.trim());
    if (!m) { setErrorMsg("Enter time as HH:MM (24-hour)."); return; }

    setSubmitting(true);
    const { error } = await supabase.from("reminders").insert({
      patient_id: selPatientId,
      title: title.trim(),
      reminder_type: type,
      scheduled_time: `${timeText.trim()}:00`,
      repeat_pattern: "daily",
      is_active: true,
    });
    setSubmitting(false);

    if (error) { setErrorMsg(error.message); return; }

    setTitle(""); setTimeText(""); setShowAdd(false);
    loadAlerts();
  };

  const pending = items.filter((i) => !i.done).length;

  const formatCareTime = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    const period = hh >= 12 ? "PM" : "AM";
    const displayHour = hh % 12 === 0 ? 12 : hh % 12;
    return `${displayHour}:${String(mm).padStart(2, "0")} ${period}`;
  };

  return (
    <ScreenShell title="Alerts & Reminders" subtitle={`${pending} need attention`} onBack={onBack} onNavigate={onNavigate}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : items.length === 0 ? (
        <Text style={styles.cardSub}>No active reminders or upcoming appointments for your patients.</Text>
      ) : (
        items.map((a) => (
          <Pressable key={a.id}
            onPress={() => markDone(a)}
            style={[styles.alertCard, a.done && styles.doneCard]}>
            <View style={styles.alertIcon}>
              <Ionicons
                name={a.level === "warning" ? "notifications-outline" : "calendar-outline"}
                size={25} color={a.level === "warning" ? colors.warning : colors.primary} />
            </View>
            <View style={styles.flex}>
              {/* For appointments: date · time sits BELOW the doctor's name.
                  For reminders: time stays right-aligned in the title row. */}
              {a.type === "appointment" ? (
                <>
                  <Text style={[styles.cardTitle, a.done && styles.strike]}>{a.title}</Text>
                  <Text style={styles.alertDate}>{a.time}</Text>
                </>
              ) : (
                <View style={styles.rowBetween}>
                  <Text style={[styles.cardTitle, a.done && styles.strike]}>{a.title}</Text>
                  <Text style={styles.time}>{a.time}</Text>
                </View>
              )}
              <Text style={styles.cardSub}>{a.text}</Text>
              <Text style={styles.cardSub}>Patient: {a.patientName}</Text>
              <Text style={styles.tapHint}>{a.done ? "Marked as done · tap to reopen" : "Tap to mark as done"}</Text>
            </View>
          </Pressable>
        ))
      )}

      {showAdd && (
        <View style={{ marginTop: 12, marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Patient</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {patients.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setSelPatientId(p.id)}
                style={[styles.smallButton, selPatientId === p.id && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.smallButtonText, selPatientId === p.id && { color: colors.onPrimary }]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Type</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {(["medicine", "hydration", "activity"] as const).map((tp) => (
              <Pressable
                key={tp}
                onPress={() => setType(tp)}
                style={[styles.smallButton, type === tp && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.smallButtonText, type === tp && { color: colors.onPrimary }]}>{tp}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput placeholder="Title" placeholderTextColor={colors.textSecondary} style={styles.searchInput} value={title} onChangeText={setTitle} />
          <View style={{ height: 10 }} />
          <Text style={styles.sectionTitle}>Pick a time</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 64 }}
            contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 8 }}
          >
            {TIME_SLOTS.map((slot) => {
              const sel = timeText === slot.key;
              return (
                <Pressable
                  key={slot.key}
                  onPress={() => setTimeText(slot.key)}
                  style={[styles.timeChip, sel && styles.timeChipSelected]}
                >
                  <Text style={[styles.timeChipText, sel && styles.timeChipTextSelected]}>{slot.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {timeText ? <Text style={styles.cardSub}>Selected: {formatCareTime(timeText)}</Text> : null}
          {errorMsg && <Text style={{ color: "#BA1A1A", marginTop: 10 }}>{errorMsg}</Text>}
        </View>
      )}

      <Pressable
        onPress={showAdd ? handleAddReminder : () => setShowAdd(true)}
        style={styles.primaryButton}
        disabled={submitting || (showAdd === false ? false : patients.length === 0)}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Ionicons name="add" size={22} color={colors.onPrimary} />
            <Text style={styles.primaryText}>{showAdd ? "Save Reminder" : "Add Reminder"}</Text>
          </>
        )}
      </Pressable>
    </ScreenShell>
  );
}

// ── Appointments ──────────────────────────────────────────────────────────────

function AppointmentsScreen({ patients, onNavigate, onBack, scopePatientId }: { patients: Patient[]; onNavigate: (s: ScreenName) => void; onBack: () => void; scopePatientId?: string | null }) {
  const [appointments, setAppointments] = useState<
    { id: string; doctor_name: string; specialty: string | null; appointment_date: string; appointment_time: string; patientName: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patients[0]?.id ?? null);
  // When arriving FROM a single patient's profile, scope the list to just
  // that patient (issue #1). When opened from the dashboard, this is null so
  // all the caregiver's linked patients are shown.
  const scopeId = scopePatientId ?? (selectedPatientId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Doctor + availability driven booking (mirrors the patient dashboard).
  const [doctors, setDoctors] = useState<{ id: string; name: string; specialty: string | null; icon: string | null }[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]); // "HH:MM"
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [dateText, setDateText] = useState("");
  const [loadingDoctors, setLoadingDoctors] = useState(false);

  // "Add doctor" form state + handler (issue #2).
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState("");
  const [newDoctorIcon, setNewDoctorIcon] = useState("👨‍⚕️");
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [addDoctorError, setAddDoctorError] = useState<string | null>(null);

  const reloadDoctors = async () => {
    const { data } = await supabase
      .from("doctors")
      .select("id, name, specialty, icon");
    setDoctors((data ?? []).map((r: any) => ({ id: r.id, name: r.name, specialty: r.specialty, icon: r.icon })));
    if (data && data.length > 0) setSelectedDoctorId((data[0] as any).id);
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

  // Calendar state.
  const calNow = new Date();
  const [calViewMonth, setCalViewMonth] = useState(calNow.getMonth());
  const [calViewYear, setCalViewYear] = useState(calNow.getFullYear());

  const calDays = () => {
    const first = new Date(calViewYear, calViewMonth, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(calViewYear, calViewMonth, d));
    return cells;
  };
  const calKey = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  const shiftCal = (delta: number) => {
    const m = calViewMonth + delta;
    if (m < 0) { setCalViewMonth(11); setCalViewYear((y) => y - 1); }
    else if (m > 11) { setCalViewMonth(0); setCalViewYear((y) => y + 1); }
    else setCalViewMonth(m);
  };

  // Build 30-min slot strings from "HH:MM" start/end.
  function buildSlotsWindow(startTime: string, endTime: string, step = 30): string[] {
    const out: string[] = [];
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    let total = sh * 60 + sm;
    const endTotal = eh * 60 + em;
    while (total + step <= endTotal) {
      const h = Math.floor(total / 60), m = total % 60;
      out.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      total += step;
    }
    return out;
  }

  // Load doctors once.
  useEffect(() => {
    async function loadDoctors() {
      setLoadingDoctors(true);
      const { data } = await supabase
        .from("doctors")
        .select("id, name, specialty, icon, doctor_availability(*)");
      const rows = (data ?? []) as unknown as {
        id: string; name: string; specialty: string | null; icon: string | null;
        doctor_availability?: { day_of_week: number; start_time: string; end_time: string; slot_minutes: number }[];
      }[];
      setDoctors(rows.map((r) => ({ id: r.id, name: r.name, specialty: r.specialty, icon: r.icon })));
      if (rows.length > 0) setSelectedDoctorId(rows[0].id);
      setLoadingDoctors(false);
    }
    loadDoctors();
  }, []);

  // When doctor/date changes, compute the available slot window + booked slots.
  useEffect(() => {
    if (!selectedDoctorId || !dateText) {
      setAvailableSlots([]);
      setBookedSlots([]);
      setSelectedSlot("");
      return;
    }
    void (async () => {
      // Look up availability for that weekday.
      const dow = new Date(dateText + "T00:00:00").getDay();
      const { data: avail } = await supabase
        .from("doctor_availability")
        .select("start_time, end_time, slot_minutes")
        .eq("doctor_id", selectedDoctorId)
        .eq("day_of_week", dow)
        .limit(1);
      if (!avail || avail.length === 0) {
        // No explicit availability configured — default to 9:00 AM - 8:00 PM
        // so the caregiver can always pick a time slot.
        const win = buildSlotsWindow("09:00", "20:00", 30);
        const { data: booked } = await supabase
          .from("appointments")
          .select("appointment_time")
          .eq("doctor_name", selectedDoctorName())
          .eq("appointment_date", dateText)
          .eq("status", "scheduled");
        setAvailableSlots(win);
        setBookedSlots((booked ?? []).map((b: any) => (b.appointment_time ?? "").slice(0, 5)));
        setSelectedSlot("");
        return;
      }
      const win = buildSlotsWindow(avail[0].start_time, avail[0].end_time, avail[0].slot_minutes || 30);

      // Already-booked slots for this doctor/date.
      const { data: booked } = await supabase
        .from("appointments")
        .select("appointment_time")
        .eq("doctor_name", selectedDoctorName())
        .eq("appointment_date", dateText)
        .eq("status", "scheduled");
      const bookedSet = (booked ?? []).map((b: any) => (b.appointment_time ?? "").slice(0, 5));

      setAvailableSlots(win);
      setBookedSlots(bookedSet);
      setSelectedSlot("");
    })();
  }, [selectedDoctorId, dateText]);

  function selectedDoctorName(): (string) {
    return doctors.find((d) => d.id === selectedDoctorId)?.name ?? "";
  }

  const loadAppointments = async () => {
    if (patients.length === 0) { setLoading(false); return; }
    const patientIds = patients.map((p) => p.id);
    const todayKey = new Date().toISOString().slice(0, 10);

    // When scoped to a specific patient (opened from their profile), show
    // ONLY that patient's appointments — not everyone else's.
    let query = supabase
      .from("appointments")
      .select("id, doctor_name, specialty, appointment_date, appointment_time, patient_id")
      .eq("status", "scheduled")
      .gte("appointment_date", todayKey)
      .order("appointment_date", { ascending: true });
    if (scopeId) {
      query = query.eq("patient_id", scopeId) as typeof query;
    } else {
      query = query.in("patient_id", patientIds) as typeof query;
    }

    const { data } = await query;

    if (data) {
      setAppointments(
        data.map((a: any) => ({
          ...a,
          patientName: patients.find((p) => p.id === a.patient_id)?.name ?? "Unknown",
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { loadAppointments(); }, [patients.length, scopeId]);

  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  };
  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour}:${m.toString().padStart(2, "0")} ${period}`;
  };

  const handleAdd = async () => {
    setErrorMsg(null);
    if (!selectedPatientId) { setErrorMsg("Select a patient first."); return; }
    if (!selectedDoctorId) { setErrorMsg("Select a doctor."); return; }
    if (!dateText) { setErrorMsg("Pick a date on the calendar."); return; }
    if (!selectedSlot) { setErrorMsg("Pick an available time slot."); return; }

    const docName = selectedDoctorName();
    const doc = doctors.find((d) => d.id === selectedDoctorId);

    setSubmitting(true);
    const { error } = await supabase.from("appointments").insert({
      patient_id: selectedPatientId,
      doctor_name: docName,
      specialty: doc?.specialty ?? null,
      appointment_date: dateText,
      appointment_time: `${selectedSlot}:00`,
      status: "scheduled",
    });
    setSubmitting(false);

    if (error) { setErrorMsg(error.message); return; }

    setDateText(""); setSelectedSlot(""); setSelectedDoctorId("");
    setShowAdd(false);
    loadAppointments();
  };

  const handleRemove = async (id: string) => {
    await supabase.from("appointments").update({ status: "cancelled" }).eq("id", id);
    loadAppointments();
  };

  return (
    <ScreenShell title="Appointments" subtitle="Upcoming visits" onBack={onBack} onNavigate={onNavigate} current="Appointments">
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : appointments.length === 0 ? (
        <Text style={styles.cardSub}>No upcoming appointments for any of your patients.</Text>
      ) : (
        appointments.map((a) => (
          <View key={a.id} style={styles.appointmentCard}>
            <View style={styles.iconCircle}><Ionicons name="calendar-outline" size={27} color={colors.primary} /></View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{a.doctor_name}</Text>
              <Text style={styles.cardSub}>{a.specialty ?? ""}</Text>
              <Text style={styles.appointmentDate}>{formatDate(a.appointment_date)} · {formatTime(a.appointment_time)}</Text>
              <Text style={styles.cardSub}>For: {a.patientName}</Text>
              <View style={styles.row}>
                <Pressable onPress={() => handleRemove(a.id)} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}

      {showAdd && (
        <View style={{ marginTop: 16, marginBottom: 8 }}>
          <Text style={styles.sectionTitle}>Patient</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {patients.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setSelectedPatientId(p.id)}
                style={[styles.smallButton, selectedPatientId === p.id && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.smallButtonText, selectedPatientId === p.id && { color: colors.onPrimary }]}>{p.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.sectionTitle}>Doctor</Text>
          {loadingDoctors ? (
            <ActivityIndicator style={{ marginVertical: 12 }} color={colors.primary} />
          ) : doctors.length === 0 ? (
            <Text style={styles.cardSub}>No doctors configured yet.</Text>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {doctors.map((d) => {
                const sel = selectedDoctorId === d.id;
                return (
                  <Pressable
                    key={d.id}
                    onPress={() => { setSelectedDoctorId(d.id); setSelectedSlot(""); }}
                    style={[styles.smallButton, sel && { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.smallButtonText, sel && { color: colors.onPrimary }]}>
                      {d.icon ?? ""} {d.name}{d.specialty ? ` · ${d.specialty}` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {/* Add doctor (issue #2) */}
          <Pressable style={styles.outlineButton} onPress={() => setShowAddDoctor(!showAddDoctor)}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={styles.outlineText}>{showAddDoctor ? "Cancel add doctor" : "Add new doctor"}</Text>
          </Pressable>
          {showAddDoctor && (
            <View style={styles.phoneEditCard}>
              <Text style={styles.sectionTitle}>New doctor</Text>
              <TextInput placeholder="Doctor's name" placeholderTextColor={colors.textSecondary} style={styles.searchInput} value={newDoctorName} onChangeText={setNewDoctorName} />
              <View style={{ height: 8 }} />
              <TextInput placeholder="Specialty (e.g. Cardiologist)" placeholderTextColor={colors.textSecondary} style={styles.searchInput} value={newDoctorSpecialty} onChangeText={setNewDoctorSpecialty} />
              <View style={{ height: 8 }} />
              <Pressable
                style={styles.primaryButton}
                onPress={handleAddDoctor}
                disabled={addingDoctor}
              >
                {addingDoctor ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>Save Doctor</Text>}
              </Pressable>
              {addDoctorError && <Text style={{ color: "#BA1A1A", marginTop: 8 }}>{addDoctorError}</Text>}
            </View>
          )}
          <Text style={styles.sectionTitle}>Pick a date</Text>
          <View style={styles.calendarHeader}>
            <Pressable onPress={() => shiftCal(-1)} style={styles.calArrow}><Ionicons name="chevron-back-outline" size={24} color={colors.primary} /></Pressable>
            <Text style={styles.calTitle}>
              {new Date(calViewYear, calViewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <Pressable onPress={() => shiftCal(1)} style={styles.calArrow}><Ionicons name="chevron-forward-outline" size={24} color={colors.primary} /></Pressable>
          </View>
          <View style={styles.calGrid}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <Text key={i} style={styles.calDow}>{d}</Text>
            ))}
            {calDays().map((d, i) => (
              d === null ? (
                <View key={i} style={styles.calDayBlank} />
              ) : (
                <Pressable
                  key={i}
                  onPress={() => { setDateText(calKey(d)); setSelectedSlot(""); }}
                  style={[styles.calDay, dateText === calKey(d) && styles.calDaySelected]}
                >
                  <Text style={[styles.calDayText, dateText === calKey(d) && styles.calDayTextSelected]}>{d.getDate()}</Text>
                </Pressable>
              )
            ))}
          </View>
          {dateText ? <Text style={styles.cardSub}>Selected: {formatDate(dateText)}</Text> : null}
          <View style={{ height: 10 }} />
          <Text style={styles.sectionTitle}>Pick a time</Text>
          {!selectedDoctorId || !dateText ? (
            <Text style={styles.cardSub}>Pick a doctor and a date to see available times.</Text>
          ) : availableSlots.length === 0 ? (
            <Text style={styles.cardSub}>This doctor is not available on the selected day.</Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ maxHeight: 64 }}
              contentContainerStyle={{ flexDirection: "row", gap: 8, paddingVertical: 8 }}
            >
              {availableSlots.map((slot) => {
                const booked = bookedSlots.includes(slot);
                const sel = selectedSlot === slot;
                return (
                  <Pressable
                    key={slot}
                    disabled={booked}
                    onPress={() => setSelectedSlot(slot)}
                    style={[styles.timeChip, sel && styles.timeChipSelected, booked && styles.timeChipDisabled]}
                  >
                    <Text style={[styles.timeChipText, sel && styles.timeChipTextSelected, booked && styles.timeChipTextDisabled]}>
                      {formatTime(`${slot}:00`)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
          {selectedSlot ? <Text style={styles.cardSub}>Selected time: {formatTime(`${selectedSlot}:00`)}</Text> : null}
          {errorMsg && <Text style={{ color: "#BA1A1A", marginTop: 10 }}>{errorMsg}</Text>}
        </View>
      )}

      <Pressable
        onPress={showAdd ? handleAdd : () => setShowAdd(true)}
        style={styles.primaryButton}
        disabled={submitting || (showAdd === false ? false : patients.length === 0)}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Ionicons name="add" size={22} color={colors.onPrimary} />
            <Text style={styles.primaryText}>{showAdd ? "Save Appointment" : "Add Appointment"}</Text>
          </>
        )}
      </Pressable>
    </ScreenShell>
  );
}

// ── Circle ────────────────────────────────────────────────────────────────────

function CircleScreen({ onNavigate, onBack }: { onNavigate: (s: ScreenName) => void; onBack: () => void }) {
  const { caregiver } = useAuth();

  const [members, setMembers] = useState<{ linkId: string; name: string; relationship: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCircle = async () => {
    if (!caregiver?.id) { setLoading(false); return; }
    const { data } = await supabase
      .from("patient_caregivers")
      .select("id, relationship, status, patients(name)")
      .eq("caregiver_id", caregiver.id);

    if (data) {
      setMembers(data.map((r: any) => ({ linkId: r.id, name: r.patients?.name ?? "Unknown", relationship: r.relationship ?? "Patient", status: r.status ?? "accepted" })));
    }
    setLoading(false);
  };

  useEffect(() => { loadCircle(); }, [caregiver?.id]);

  const handleSendInvite = async () => {
    setErrorMsg(null);
    if (!caregiver?.id) { setErrorMsg("Couldn't find your caregiver profile."); return; }
    if (!email.trim()) { setErrorMsg("Please enter the patient's email."); return; }

    setSubmitting(true);
    const { data: found, error: lookupError } = await supabase.rpc("find_patient_by_email", { p_email: email.trim() });

    if (lookupError) {
      setSubmitting(false);
      setErrorMsg(`Couldn't look that up: ${lookupError.message}`);
      return;
    }
    if (!found || found.length === 0) {
      setSubmitting(false);
      setErrorMsg("No patient account found with that email.");
      return;
    }

    const { error: insertError } = await supabase.from("patient_caregivers").insert({
      patient_id: found[0].id,
      caregiver_id: caregiver.id,
      status: "pending",
    });
    setSubmitting(false);

    if (insertError) {
      setErrorMsg(insertError.code === "23505" ? `${found[0].name} is already in your circle.` : insertError.message);
      return;
    }

    setEmail("");
    setShowInvite(false);
    loadCircle();
  };

  return (
    <ScreenShell title="Care Circle" subtitle="People helping with care" onBack={onBack} onNavigate={onNavigate} current="Circle">
      <View style={styles.circleHero}>
        <View style={styles.circleIcon}><Ionicons name="people-outline" size={34} color={colors.primary} /></View>
        <Text style={styles.heroTitle}>You're not caring alone</Text>
        <Text style={styles.cardSub}>Keep trusted family members updated and share important care tasks.</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.primary} />
      ) : members.length === 0 ? (
        <Text style={styles.cardSub}>No patients linked yet. Tap "Invite Someone" below.</Text>
      ) : (
        members.map((c) => (
          <View key={c.linkId} style={styles.listCard}>
            <View style={styles.smallAvatar}><Text style={styles.initials}>{getInitials(c.name)}</Text></View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{c.name}</Text>
              <Text style={styles.cardSub}>{c.relationship}</Text>
            </View>
            <View style={c.status === "pending" ? styles.pendingPill : styles.connectedPill}>
              <Text style={c.status === "pending" ? styles.pendingText : styles.statusText}>
                {c.status === "pending" ? "Pending" : "Connected"}
              </Text>
            </View>
          </View>
        ))
      )}

      {showInvite && (
        <View style={styles.searchBox}>
          <TextInput
            placeholder="Patient's email"
            placeholderTextColor={colors.textSecondary}
            style={styles.searchInput}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
      )}
      {errorMsg && <Text style={{ color: "#BA1A1A", marginBottom: 10 }}>{errorMsg}</Text>}

      <Pressable
        onPress={showInvite ? handleSendInvite : () => setShowInvite(true)}
        style={styles.primaryButton}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <>
            <Ionicons name="person-add-outline" size={22} color={colors.onPrimary} />
            <Text style={styles.primaryText}>{showInvite ? "Send Invite" : "Invite Someone"}</Text>
          </>
        )}
      </Pressable>
    </ScreenShell>
  );
}

// ── Settings ──────────────────────────────────────────────────────────────────

function SettingsScreen({ onNavigate, onBack }: { onNavigate: (s: ScreenName) => void; onBack: () => void }) {
  const { caregiver, signOut, refreshProfile } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [largeText, setLargeText] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState(caregiver?.phone ?? "");
  const [savingPhone, setSavingPhone] = useState(false);

  const savePhone = async () => {
    if (!caregiver?.id) return;
    setSavingPhone(true);
    const { error } = await supabase
      .from("caregivers")
      .update({ phone: phoneDraft.trim() || null })
      .eq("id", caregiver.id);
    setSavingPhone(false);
    if (error) {
      Alert.alert("Couldn't save phone number", error.message);
      return;
    }
    await refreshProfile();
    setEditingPhone(false);
    Alert.alert("Saved", "Your phone number has been updated.");
  };

  const changeProfilePhoto = async () => {
    if (uploadingPhoto) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission required", "MindMitra needs photo access to set your profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.uri) return;

      setUploadingPhoto(true);
      const file = new File(asset.uri);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const ext = (asset.fileName ?? '').includes('.') ? asset.fileName!.split('.').pop()!.toLowerCase() : 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
      const path = `${caregiver?.id}/avatar-${Date.now()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: asset.mimeType ?? 'image/jpeg', upsert: true });
      if (uploadError) {
        Alert.alert("Couldn't upload photo", uploadError.message);
        return;
      }
      const { data: publicInfo } = supabase.storage.from('avatars').getPublicUrl(path);

      if (caregiver?.id) {
        const { error: dbError } = await supabase.from("caregivers").update({ profile_photo: publicInfo.publicUrl }).eq("id", caregiver.id);
        if (!dbError) {
          await refreshProfile();
          Alert.alert("Profile Photo Updated", "Your profile photo has been saved.");
        }
      }
    } catch (e) {
      Alert.alert("Upload failed", "Couldn't update your profile photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <ScreenShell title="Settings" subtitle="Caregiver preferences" onBack={onBack} onNavigate={onNavigate}>
      <View style={styles.profileHero}>
        <Pressable onPress={changeProfilePhoto} style={styles.profilePhotoPressable}>
          <View style={[styles.profileAvatar, { overflow: "hidden" }]}>
            {caregiver?.profile_photo ? (
              <Image source={{ uri: caregiver.profile_photo }} style={{ width: 94, height: 94 }} resizeMode="cover" />
            ) : (
              <Ionicons name="person-outline" size={34} color={colors.primary} />
            )}
            {uploadingPhoto ? <ActivityIndicator color={colors.onPrimary} style={styles.photoSpinner} /> : null}
          </View>
          <Text style={styles.photoHint}>{uploadingPhoto ? "Uploading…" : "Tap to change photo"}</Text>
        </Pressable>
        <Text style={styles.profileName}>{caregiver?.name ?? "Caregiver"}</Text>
        <Text style={styles.cardSub}>{caregiver?.email ?? ""}</Text>
        {caregiver?.phone ? <Text style={styles.cardSub}>{caregiver.phone}</Text> : null}
      </View>
      <Text style={styles.sectionTitle}>Preferences</Text>
      <SettingRow icon="notifications-outline" title="Notifications" text="Alerts and important updates" value={notifications} setValue={setNotifications} />
      <SettingRow icon="alarm-outline" title="Reminder alerts" text="Medication and care reminders" value={reminders} setValue={setReminders} />
      <SettingRow icon="text-outline" title="Larger text" text="Make caregiver screens easier to read" value={largeText} setValue={setLargeText} />
      <Text style={styles.sectionTitle}>Account</Text>
      <ProfileAction icon="person-outline" title="Caregiver profile" text="Name, contact and preferences" onPress={() => Alert.alert("Caregiver profile", "Your caregiver profile is shown at the top. Use the phone field below to update your contact number.")} />
      {editingPhone ? (
        <View style={styles.phoneEditCard}>
          <Text style={styles.sectionTitle}>Phone number</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Phone number"
            placeholderTextColor={colors.textSecondary}
            value={phoneDraft}
            onChangeText={(t: string) => setPhoneDraft(t)}
            keyboardType="phone-pad"
          />
          <Pressable style={[styles.primaryButton, { marginTop: 8 }]} onPress={savePhone} disabled={savingPhone}>
            {savingPhone ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.primaryText}>Save phone</Text>}
          </Pressable>
          <Pressable style={styles.cancelButton} onPress={() => { setEditingPhone(false); setPhoneDraft(caregiver?.phone ?? ""); }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : (
        <ProfileAction icon="call-outline" title="Phone number" text={caregiver?.phone ? `${caregiver.phone} · tap to edit` : "Tap to add your phone number"} onPress={() => { setPhoneDraft(caregiver?.phone ?? ""); setEditingPhone(true); }} />
      )}
      <ProfileAction icon="shield-checkmark-outline" title="Privacy & safety" text="Manage data sharing and permissions" onPress={() => Alert.alert("Privacy & safety", "Your care data should only be shared with trusted people.")} />
      <ProfileAction icon="help-circle-outline" title="Help & support" text="Get help with MindMitra" onPress={() => Alert.alert("Help & support", "MindMitra support is ready to help.")} />
      <View style={styles.logoBlock}>
        <Image source={require("../assets/mindmitra-logo.png")} style={styles.logoImage} resizeMode="contain" />
      </View>
      <Pressable
        onPress={() =>
          Alert.alert("Log Out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            { text: "Log Out", style: "destructive", onPress: () => signOut() },
          ])
        }
        style={styles.outlineButton}
      >
        <Text style={styles.outlineText}>Sign Out</Text>
      </Pressable>
    </ScreenShell>
  );
}

function SettingRow({ icon, title, text, value, setValue }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; text: string; value: boolean; setValue: (v: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.actionIcon}><Ionicons name={icon} size={25} color={colors.primary} /></View>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{text}</Text>
      </View>
      <Switch value={value} onValueChange={setValue}
        trackColor={{ false: colors.surfaceHigh, true: colors.primaryLight }}
        thumbColor={value ? colors.primary : colors.textSecondary} />
    </View>
  );
}

// ── Shared small components ───────────────────────────────────────────────────

function Glance({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.glanceCard}>
      <Text style={styles.glanceValue}>{value}</Text>
      <Text style={styles.glanceLabel}>{label}</Text>
    </View>
  );
}

function NavItem({ icon, label, active, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.navItem, active && styles.navActive]}>
      <Ionicons name={icon} size={25} color={active ? colors.onPrimary : colors.text} />
      <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1, backgroundColor: colors.background },
  header: { height: 76, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.surfaceHigh, paddingHorizontal: 12 },
  headerButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  headerCenter: { alignItems: "center" },
  headerSide: { width: 52, alignItems: "flex-start" },
  logoImage: { width: 150, height: 52, resizeMode: "contain" },
  logoBlock: { alignItems: "center", marginTop: 14, marginBottom: 4 },
  headerSub: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  avatarRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderStyle: "dashed", borderColor: "#8EB5E8", alignItems: "center", justifyContent: "center" },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingBottom: 120 },
  pageTitle: { fontSize: 34, fontWeight: "800", color: colors.text, marginBottom: 18 },
  greeting: { fontSize: 21, color: colors.text, marginTop: 8 },
  title: { fontSize: 36, lineHeight: 42, fontWeight: "800", color: colors.text, marginTop: 8, marginBottom: 18 },
  sectionTitle: { fontSize: 23, fontWeight: "800", color: colors.text, marginTop: 25, marginBottom: 12 },
  helper: { fontSize: 16, color: colors.textSecondary, marginBottom: 12 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  pressed: { opacity: 0.72 },

  // Search
  searchBox: { height: 54, borderRadius: 17, borderWidth: 1, borderColor: colors.outlineVariant, backgroundColor: colors.surfaceLowest, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 17, color: colors.text, marginLeft: 10 },

  // Cards
  listCard: { backgroundColor: colors.surfaceLowest, borderRadius: 20, borderWidth: 1, borderColor: colors.outlineVariant, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 12 },
  patientCard: { backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.outlineVariant, borderRadius: 24, padding: 21, marginBottom: 6 },
  patientTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  patientPhoto: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#E8E0F3", alignItems: "center", justifyContent: "center" },
  patientName: { fontSize: 30, fontWeight: "800", color: colors.text, marginTop: 18 },
  patientSub: { fontSize: 17, color: colors.textSecondary, marginTop: 7 },
  attentionCard: { minHeight: 92, borderRadius: 20, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: "#E8C97A", padding: 15, flexDirection: "row", alignItems: "center", gap: 13 },
  attentionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceLowest, alignItems: "center", justifyContent: "center" },
  appointmentCard: { minHeight: 145, borderRadius: 20, backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.outlineVariant, padding: 17, flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 12 },
  appointmentDate: { fontSize: 17, fontWeight: "800", color: colors.primary, marginTop: 7 },
  noteCard: { backgroundColor: colors.surfaceLowest, borderRadius: 20, borderWidth: 1, borderColor: colors.outlineVariant, padding: 16, flexDirection: "row", gap: 13 },
  alertCard: { minHeight: 108, borderRadius: 20, backgroundColor: colors.warningLight, borderWidth: 1, borderColor: "#E8C97A", padding: 15, flexDirection: "row", alignItems: "flex-start", gap: 13, marginBottom: 11 },
  doneCard: { backgroundColor: colors.primaryLight, borderColor: colors.outlineVariant, opacity: 0.8 },
  alertIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceLowest },
  actionRow: { minHeight: 82, backgroundColor: colors.surfaceLowest, borderRadius: 20, borderWidth: 1, borderColor: colors.outlineVariant, padding: 14, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 10 },
  settingRow: { minHeight: 82, backgroundColor: colors.surfaceLowest, borderRadius: 20, borderWidth: 1, borderColor: colors.outlineVariant, padding: 13, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },

  // Avatars
  bigAvatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#E8E0F3", alignItems: "center", justifyContent: "center" },
  smallAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E8E0F3", alignItems: "center", justifyContent: "center" },
  initials: { fontSize: 19, fontWeight: "800", color: colors.primary },

  // Profile
  profileHero: { backgroundColor: colors.primaryLight, borderRadius: 24, padding: 22, alignItems: "center" },
  profileAvatar: { width: 94, height: 94, borderRadius: 47, backgroundColor: colors.surfaceLowest, alignItems: "center", justifyContent: "center" },
  profileInitials: { fontSize: 28, fontWeight: "800", color: colors.primary },
  profilePhotoPressable: { alignItems: "center" },
  photoHint: { color: colors.primary, fontSize: 13, fontWeight: "700", marginTop: 8 },
  photoSpinner: { position: "absolute", bottom: 6, right: 6 },
  profileName: { fontSize: 28, fontWeight: "800", color: colors.text, marginTop: 12 },
  goodPill: { backgroundColor: colors.surfaceLowest, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },

  // Status
  statusPill: { backgroundColor: colors.primaryLight, borderRadius: 22, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 7 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  statusText: { fontSize: 15, fontWeight: "700", color: colors.primary },
  connectedPill: { backgroundColor: colors.primaryLight, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7 },
  pendingPill: { backgroundColor: colors.warningSoft, borderRadius: 15, paddingHorizontal: 10, paddingVertical: 7 },
  pendingText: { fontSize: 14, fontWeight: "700", color: colors.warning },
  statRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, marginBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant, width: "100%" },

  // Glance
  glanceRow: { flexDirection: "row", gap: 10 },
  glanceCard: { flex: 1, minHeight: 100, borderRadius: 20, backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: "center", justifyContent: "center", padding: 10 },
  glanceValue: { fontSize: 30, fontWeight: "800", color: colors.primary },
  glanceLabel: { fontSize: 14, color: colors.textSecondary, marginTop: 3, textAlign: "center" },

  

  // Circle
  circleHero: { backgroundColor: colors.primaryLight, borderRadius: 23, padding: 20, alignItems: "center" },
  circleIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.surfaceLowest, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 23, fontWeight: "800", color: colors.text, marginTop: 10, textAlign: "center" },

  // Buttons
  primaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 14 },
  primaryText: { color: colors.onPrimary, fontSize: 17, fontWeight: "800" },
  outlineButton: { minHeight: 54, borderRadius: 15, borderWidth: 2, borderColor: colors.primary, marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  outlineText: { color: colors.primary, fontSize: 17, fontWeight: "800" },
  smallButton: { minHeight: 40, paddingHorizontal: 15, borderRadius: 12, backgroundColor: colors.primaryLight, justifyContent: "center", marginTop: 10 },
  smallButtonText: { fontSize: 15, fontWeight: "800", color: colors.primary },
  cancelButton: { minHeight: 40, paddingHorizontal: 15, borderRadius: 12, backgroundColor: colors.errorContainer, justifyContent: "center", marginTop: 10 },
  cancelText: { fontSize: 15, fontWeight: "800", color: colors.error },
  phoneEditCard: { backgroundColor: colors.surfaceLowest, borderRadius: 20, borderWidth: 1, borderColor: colors.outlineVariant, padding: 16, marginTop: 6 },

  // Calendar
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  calArrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  calTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calDow: { width: "14.2857%", textAlign: "center", fontWeight: "700", color: colors.textSecondary, fontSize: 13, paddingVertical: 4 },
  calDayBlank: { width: "14.2857%", aspectRatio: 1 },
  calDay: { width: "14.2857%", aspectRatio: 1, alignItems: "center", justifyContent: "center", margin: 2 },
  calDaySelected: { backgroundColor: colors.primary, borderRadius: 20 },
  calDayText: { color: colors.text, fontSize: 15 },
  calDayTextSelected: { color: colors.onPrimary, fontWeight: "800" },

  // Time-slot chips (scrollable)
  timeChip: { minWidth: 92, minHeight: 46, borderRadius: 14, backgroundColor: colors.surfaceLowest, borderWidth: 1, borderColor: colors.outlineVariant, alignItems: "center", justifyContent: "center" },
  timeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeChipDisabled: { opacity: 0.35 },
  timeChipText: { fontSize: 15, color: colors.text },
  timeChipTextSelected: { color: colors.onPrimary, fontWeight: "700" },
  timeChipTextDisabled: { color: colors.textSecondary },
  linkButton: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  linkText: { fontSize: 17, fontWeight: "800", color: colors.primary },
  askButton: { alignSelf: "flex-start", minHeight: 45, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.primary, justifyContent: "center", marginTop: 10 },
  askText: { color: colors.onPrimary, fontSize: 16, fontWeight: "800" },

  // Action grid (home)
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  actionCard: { width: "48%", minHeight: 145, backgroundColor: colors.surfaceLowest, borderRadius: 20, borderWidth: 1, borderColor: colors.outlineVariant, padding: 15 },
  actionIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  actionTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  actionSub: { fontSize: 14, lineHeight: 19, color: colors.textSecondary, marginTop: 3 },

  // Icons
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  iconCircleSmall: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 8 },

  // Mitra card
  mitraCard: { marginTop: 24, backgroundColor: colors.primaryLight, borderRadius: 23, padding: 16, flexDirection: "row", gap: 12, alignItems: "center" },
  mitraImage: { width: 105, height: 125, borderRadius: 18 },
  mitraTitle: { fontSize: 20, fontWeight: "800", color: colors.primary },
  mitraText: { fontSize: 16, lineHeight: 22, color: colors.text, marginTop: 4 },

  // Text
  cardTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  cardSub: { fontSize: 15, lineHeight: 21, color: colors.textSecondary, marginTop: 3 },
  time: { fontSize: 13, color: colors.textSecondary, alignItems: "flex-end", flexShrink: 1, marginLeft: 6, textAlign: "right" },
  alertDate: { fontSize: 14, fontWeight: "600", color: colors.primary, marginTop: 4 },
  tapHint: { fontSize: 13, color: colors.primary, fontWeight: "700", marginTop: 5 },
  strike: { textDecorationLine: "line-through" },

  // Nav
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 86, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingHorizontal: 8, paddingVertical: 7, flexDirection: "row", justifyContent: "space-around" },
  navItem: { flex: 1, minHeight: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", gap: 2 },
  navActive: { backgroundColor: colors.primary },
  navLabel: { fontSize: 13, fontWeight: "700", color: colors.text },
  navLabelActive: { color: colors.onPrimary },
});
