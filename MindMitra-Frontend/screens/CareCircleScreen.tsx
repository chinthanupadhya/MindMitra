import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
  | "home" | "booking" | "circle" | "myday" | "journey"
  | "mitra" | "bookappointment" | "onboarding" | "profile" | "caregiverHome";

interface ScreenProps {
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
}

interface CircleMemberData {
  linkId: string;
  name: string;
  relationship: string;
  phone: string | null;
  isPrimary: boolean;
  status: string;
}

const CircleMember: React.FC<{ member: CircleMemberData; onRemove: () => void }> = ({ member, onRemove }) => {
  const { t } = useTranslation();
  const handleCall = () => {
    if (!member.phone) {
      Alert.alert("No phone number", `${member.name} doesn't have a phone number saved yet.`);
      return;
    }
    Linking.openURL(`tel:${member.phone}`);
  };

  return (
    <TouchableOpacity
      style={styles.memberCard}
      activeOpacity={0.8}
      onLongPress={() =>
        Alert.alert("Remove from Circle?", `Remove ${member.name} from your Care Circle?`, [
          { text: "Cancel", style: "cancel" },
          { text: "Remove", style: "destructive", onPress: onRemove },
        ])
      }
    >
      <View style={styles.memberAvatar}>
        <Text style={styles.memberIcon}>{member.isPrimary ? "⭐" : "👤"}</Text>
      </View>
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberRelation}>{member.relationship || "Caregiver"}</Text>
      </View>
      <TouchableOpacity style={styles.callBadge} onPress={handleCall}>
        <Text style={styles.callBadgeText}>{t("call")}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const CareCircleScreen: React.FC<ScreenProps> = ({ onNavigate, onBack }) => {
  const { patient } = useAuth();
  const { t } = useTranslation();

  const [members, setMembers] = useState<CircleMemberData[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCircle = async () => {
    if (!patient?.id) { setLoading(false); return; }
    const { data } = await supabase
      .from("patient_caregivers")
      .select("id, relationship, is_primary, status, caregivers(name, phone)")
      .eq("patient_id", patient.id);

    if (data) {
      setMembers(
        data.map((row: any) => ({
          linkId: row.id,
          name: row.caregivers?.name ?? "Unknown",
          relationship: row.relationship ?? "",
          phone: row.caregivers?.phone ?? null,
          isPrimary: row.is_primary,
          status: row.status ?? "accepted",
        }))
      );
    }
    setLoading(false);
  };

  const handleInviteResponse = async (linkId: string, accept: boolean) => {
    if (accept) {
      await supabase.from("patient_caregivers").update({ status: "accepted" }).eq("id", linkId);
    } else {
      await supabase.from("patient_caregivers").delete().eq("id", linkId);
    }
    loadCircle();
  };

  useEffect(() => { loadCircle(); }, [patient?.id]);

  const handleAddMember = async () => {
    setErrorMessage(null);
    if (!patient?.id) { setErrorMessage("Couldn't find your patient profile."); return; }
    if (!email.trim()) { setErrorMessage("Please enter their email address."); return; }

    setSubmitting(true);
    const { data: found, error: lookupError } = await supabase.rpc("find_caregiver_by_email", {
      p_email: email.trim(),
    });

    if (lookupError) {
      setSubmitting(false);
      setErrorMessage(`Couldn't look that up: ${lookupError.message}`);
      return;
    }
    if (!found || found.length === 0) {
      setSubmitting(false);
      setErrorMessage("No caregiver account found with that email. Ask them to sign up in the app first.");
      return;
    }

    const caregiverFound = found[0];

    const { error: insertError } = await supabase.from("patient_caregivers").insert({
      patient_id: patient.id,
      caregiver_id: caregiverFound.id,
      relationship: relationship.trim() || null,
      is_primary: members.length === 0,
      status: "accepted",
    });
    if (!insertError) {
      // Notify the caregiver? For now, direct-add is accepted immediately.
    }

    setSubmitting(false);

    if (insertError) {
      setErrorMessage(
        insertError.code === "23505"
          ? `${caregiverFound.name} is already in your Care Circle.`
          : insertError.message
      );
      return;
    }

    setEmail(""); setRelationship(""); setShowAddForm(false);
    loadCircle();
  };

  const handleRemoveMember = async (linkId: string) => {
    await supabase.from("patient_caregivers").delete().eq("id", linkId);
    loadCircle();
  };

  return (
    <View style={styles.screen}>
      <GreetingHeader name={patient?.name ?? "Elder"} showBackButton onBackPress={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>{t("my_care_circle")}</Text>
          <Text style={styles.pageSubtitle}>{t("support_people_text")}</Text>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="My Circle"
            actionText={showAddForm ? "Cancel" : "+ Add"}
            onActionPress={() => setShowAddForm((v) => !v)}
          />

          {showAddForm && (
            <View style={styles.addForm}>
              <Text style={styles.formLabel}>{t("caregivers_email")}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="them@example.com"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text style={styles.formLabel}>{t("optional_relationship")}</Text>
              <TextInput
                style={styles.input}
                value={relationship}
                onChangeText={setRelationship}
                placeholder="e.g. Daughter, Son, Nurse"
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={styles.hintText}>{t("need_caregiver_account")}</Text>
              {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
              <TouchableOpacity
                style={[styles.saveButton, submitting && styles.saveButtonDisabled]}
                onPress={handleAddMember}
                disabled={submitting}
                activeOpacity={0.85}
              >
                {submitting ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveButtonText}>{t("add_to_circle")}</Text>}
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
          ) : (
            <>
              {/* Pending invitations a caregiver sent — the patient must
                  accept or reject before the connection becomes active. */}
              {members.filter((m) => m.status === "pending").length > 0 && (
                <>
                  <Text style={styles.pendingTitle}>Pending Invitations</Text>
                  {members
                    .filter((m) => m.status === "pending")
                    .map((m, idx) => (
                      <React.Fragment key={m.linkId}>
                        <View style={styles.pendingCard}>
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberIcon}>👤</Text>
                          </View>
                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName}>{m.name}</Text>
                            <Text style={styles.memberRelation}>
                              {m.relationship || "Caregiver"} · wants to join your circle
                            </Text>
                            <View style={styles.pendingActions}>
                              <TouchableOpacity
                                style={[styles.acceptBtn, { marginRight: 10 }]}
                                onPress={() => handleInviteResponse(m.linkId, true)}
                              >
                                <Text style={styles.acceptText}>Accept</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.rejectBtn}
                                onPress={() => handleInviteResponse(m.linkId, false)}
                              >
                                <Text style={styles.rejectText}>Reject</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                        {idx < members.filter((x) => x.status === "pending").length - 1 && (
                          <View style={styles.memberSpacing} />
                        )}
                      </React.Fragment>
                    ))}
                  <View style={styles.memberSpacing} />
                </>
              )}

              {members.filter((m) => m.status !== "pending").length === 0 ? (
                <Text style={styles.emptyText}>
                  {members.length === 0 ? t("no_one_in_circle_yet") : "No members yet."}
                </Text>
              ) : (
                members
                  .filter((m) => m.status !== "pending")
                  .map((m, idx) => (
                    <React.Fragment key={m.linkId}>
                      <CircleMember member={m} onRemove={() => handleRemoveMember(m.linkId)} />
                      {idx < members.length - 1 && <View style={styles.memberSpacing} />}
                    </React.Fragment>
                  ))
              )}
            </>
          )}
        </View>

        <View style={styles.reassuranceCard}>
          <View style={styles.reassuranceIconContainer}><Text style={styles.reassuranceEmoji}>🌿</Text></View>
          <View style={styles.reassuranceContent}>
            <Text style={styles.reassuranceTitle}>{t("not_alone")}</Text>
            <Text style={styles.reassuranceText}>
              {t("reassurance_text")}
            </Text>
          </View>
        </View>
      </ScrollView>

      <BottomNav
        activeTab="Circle"
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
  section: { marginTop: 16 },
  addForm: {
    backgroundColor: colors.surfaceLowest, borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: colors.surfaceHigh, marginBottom: 20,
  },
  formLabel: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 8, marginTop: 6 },
  input: {
    minHeight: 52, borderRadius: 12, backgroundColor: colors.surfaceLow,
    borderWidth: 1, borderColor: colors.surfaceHigh, paddingHorizontal: 14, fontSize: 16, color: colors.text,
  },
  hintText: { fontSize: 13, color: colors.textSecondary, marginTop: 10 },
  errorText: { fontSize: 14, color: "#BA1A1A", marginTop: 10 },
  saveButton: {
    minHeight: 54, borderRadius: 14, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center", marginTop: 16,
  },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: colors.onPrimary, fontSize: 16, fontWeight: "700" },
  emptyText: { fontSize: 16, color: colors.textSecondary, textAlign: "center", paddingVertical: 24 },
  memberCard: {
    minHeight: 104, backgroundColor: colors.surfaceLowest, borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderColor: colors.surfaceHigh,
  },
  memberAvatar: {
    width: 66, height: 66, borderRadius: 33, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginRight: 16,
  },
  memberIcon: { fontSize: 28 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 20, fontWeight: "700", color: colors.text },
  memberRelation: { fontSize: 16, lineHeight: 22, color: colors.textSecondary, marginTop: 5 },
  callBadge: { backgroundColor: colors.successSoft, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  callBadgeText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  memberSpacing: { height: 14 },

  pendingTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 12,
  },

  pendingCard: {
    minHeight: 104,
    backgroundColor: colors.warningSoft,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E8C97A",
  },

  pendingActions: {
    flexDirection: "row",
    marginTop: 10,
  },

  acceptBtn: {
    minHeight: 38,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
  },
  acceptText: { color: colors.onPrimary, fontSize: 15, fontWeight: "700" },

  rejectBtn: {
    minHeight: 38,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: colors.errorContainer,
    justifyContent: "center",
  },
  rejectText: { color: colors.error, fontSize: 15, fontWeight: "700" },
  reassuranceCard: {
    flexDirection: "row", backgroundColor: colors.secondaryLight, borderRadius: 22,
    padding: 20, marginTop: 34, alignItems: "flex-start",
  },
  reassuranceIconContainer: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: colors.surfaceLowest,
    alignItems: "center", justifyContent: "center", marginRight: 15,
  },
  reassuranceEmoji: { fontSize: 30 },
  reassuranceContent: { flex: 1 },
  reassuranceTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
  reassuranceText: { fontSize: 16, lineHeight: 24, color: colors.textSecondary, marginTop: 6 },
});

export default CareCircleScreen;
