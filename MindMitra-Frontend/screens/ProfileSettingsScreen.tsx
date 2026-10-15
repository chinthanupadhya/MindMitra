import React, { useState } from "react";

import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

import BottomNav from "../components/BottomNav";
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

type EditField = "name" | "phone" | "emergency" | "address" | "language" | null;

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "as", label: "অসমীয়া" },
  { code: "brx", label: "Bodo" },
  { code: "kha", label: "Khasi" },
  { code: "mni", label: "Manipuri" },
  { code: "lus", label: "Mizo" },
];

interface SettingRowProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}

const SettingRow: React.FC<SettingRowProps> = ({ icon, title, subtitle, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.settingIconContainer}>
        <Text style={styles.settingIcon}>{icon}</Text>
      </View>

      <View style={styles.settingTextContainer}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle ? <Text style={styles.settingSubtitle}>{subtitle}</Text> : null}
      </View>

      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
};

const ProfileSettingsScreen: React.FC<ScreenProps> = ({ onNavigate, onBack }) => {
  const { accountType, caregiver, patient, signOut, refreshProfile } = useAuth();
  const { t } = useTranslation();

  const name = accountType === "caregiver" ? caregiver?.name : patient?.name;
  const phone = accountType === "caregiver" ? caregiver?.phone : patient?.phone;
  const address = accountType === "caregiver" ? (caregiver?.address ?? null) : (patient?.address ?? null);
  const photoUri = accountType === "patient" ? patient?.profile_photo : undefined;
  const roleLabel = accountType === "caregiver" ? "Caregiver" : "Patient";
  const emergencyContact = patient?.emergency_contact;
  const languageCode =
    (accountType === "caregiver" ? caregiver?.preferred_language : patient?.preferred_language) ??
    "en";

  const [editing, setEditing] = useState<EditField>(null);
  const [draftValue, setDraftValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const startEdit = (field: EditField, currentValue: string) => {
    setEditing(field);
    setDraftValue(currentValue);
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraftValue("");
  };

  const saveField = async (field: Exclude<EditField, null>, column: string, value: string) => {
    const table = accountType === "caregiver" ? "caregivers" : "patients";
    const id = accountType === "caregiver" ? caregiver?.id : patient?.id;
    if (!id) return;

    // The column name and target table both vary at runtime (patient vs
    // caregiver editing different fields), which Supabase's generated types
    // can't express as a single static shape — hence the narrow cast here,
    // scoped to just this one call rather than loosening types elsewhere.
    const payload: Record<string, string | null> = { [column]: value || null };

    setSaving(true);
    const { error } = await supabase
      .from(table)
      .update(payload as never)
      .eq("id", id);
    setSaving(false);

    if (error) {
      Alert.alert("Couldn't save", error.message);
      return;
    }

    // AuthContext's cached patient/caregiver was stale until this refresh —
    // this is what makes e.g. the SOS button see a newly-saved emergency
    // contact immediately, instead of only after the next full login.
    await refreshProfile();

    setEditing(null);
    setDraftValue("");
    Alert.alert("Saved", "Your information has been updated.");
  };

  const handleLogOut = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: () => signOut() },
    ]);
  };

  // Open the system photo picker, upload the chosen file to Supabase Storage
  // ("avatars" bucket), then save the public URL to the patient's row. Uses
  // v57 expo-image-picker + expo-file-system, uploading an ArrayBuffer because
  // Blob/File/FormData don't work with supabase-js on React Native.
  const handleUploadPhoto = async () => {
    if (uploading) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "MindMitra needs access to your photos to set a profile picture.");
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
    const uri = asset.uri;
    if (!uri) return;

    setUploading(true);
    try {
      const file = new File(uri);
      const bytes = new Uint8Array(await file.arrayBuffer());

      const ext = (asset.fileName ?? '').includes('.') ? asset.fileName!.split('.').pop()!.toLowerCase() : 'jpg';
      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) ? ext : 'jpg';
      const path = `${accountType === "caregiver" ? caregiver?.id : patient?.id}/avatar-${Date.now()}.${safeExt}`;

      // Upload as a public URL
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: true,
        });
      if (uploadError) {
        Alert.alert("Couldn't upload photo", uploadError.message);
        return;
      }

      const { data: publicInfo } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = publicInfo.publicUrl;

      const table = accountType === "caregiver" ? "caregivers" : "patients";
      const id = accountType === "caregiver" ? caregiver?.id : patient?.id;
      if (!id) return;

      const { error: dbError } = await supabase
        .from(table)
        .update({ profile_photo: publicUrl } as never)
        .eq("id", id);
      if (dbError) {
        Alert.alert("Couldn't save photo", dbError.message);
        return;
      }

      await refreshProfile();
      Alert.alert("Profile Photo Updated", "Your new profile picture has been saved.");
    } catch (e) {
      Alert.alert("Photo Upload Failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const openAddressInMaps = () => {
    if (!address) return;
    Linking.openURL(
      `https://maps.google.com/maps?q=${encodeURIComponent(address)}`
    );
  };

  const renderEditBox = (
    field: Exclude<EditField, null>,
    column: string,
    placeholder: string,
    keyboardType?: "default" | "phone-pad"
  ) => (
    <View style={styles.editBox}>
      <TextInput
        style={styles.editInput}
        value={draftValue}
        onChangeText={setDraftValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType={keyboardType ?? "default"}
        autoFocus
      />
      <View style={styles.editButtonsRow}>
        <TouchableOpacity style={styles.editCancelButton} onPress={cancelEdit}>
          <Text style={styles.editCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.editSaveButton, saving && styles.editSaveButtonDisabled]}
          onPress={() => saveField(field, column, draftValue.trim())}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Text style={styles.editSaveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <GreetingHeader name={name ?? "Elder"} showBackButton onBackPress={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>{t("my_profile")}</Text>
          <Text style={styles.pageSubtitle}>
            Manage your personal information and settings.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.photoContainer}
            onPress={handleUploadPhoto}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Change profile picture"
          >
            <View style={styles.profilePlaceholder}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.profilePhoto} />
              ) : (
                <Text style={styles.profileEmoji}>👤</Text>
              )}
            </View>
            <View style={styles.cameraButton}>
              {uploading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={styles.cameraIcon}>📷</Text>
              )}
            </View>
          </TouchableOpacity>

          <Text style={styles.profileName}>{name ?? "Elder"}</Text>
          <Text style={styles.profileRole}>{roleLabel}</Text>

          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => startEdit("name", name ?? "")}
            activeOpacity={0.8}
          >
            <Text style={styles.editProfileText}>Edit Name</Text>
          </TouchableOpacity>

          {editing === "name" && renderEditBox("name", "name", "Your name")}
        </View>

        <Text style={styles.sectionTitle}>Personal Information</Text>

        <View style={styles.settingsCard}>
          <SettingRow
            icon="📞"
            title="Contact Information"
            subtitle={phone ?? "Not added yet — tap to add"}
            onPress={() => startEdit("phone", phone ?? "")}
          />
          {editing === "phone" && renderEditBox("phone", "phone", "Phone number", "phone-pad")}

          <View style={styles.divider} />

          <SettingRow
            icon="📍"
            title="Address"
            subtitle={address && address.trim() ? address : "Not added yet — tap to add"}
            onPress={() => startEdit("address", address ?? "")}
          />
          {editing === "address" && renderEditBox("address", "address", "Your address")}

          {!!address && address.trim().length > 0 && (
            <TouchableOpacity
              style={styles.mapButton}
              onPress={openAddressInMaps}
              activeOpacity={0.8}
            >
              <Text style={styles.mapButtonText}>🗺️  View on Map</Text>
            </TouchableOpacity>
          )}
        </View>

        {accountType === "patient" && (
          <>
            <Text style={styles.sectionTitle}>Care & Safety</Text>
            <View style={styles.settingsCard}>
              <SettingRow
                icon="👥"
                title="Emergency Contact"
                subtitle={emergencyContact ?? "Not set — SOS won't work without this"}
                onPress={() => startEdit("emergency", emergencyContact ?? "")}
              />
              {editing === "emergency" &&
                renderEditBox("emergency", "emergency_contact", "Phone number to call", "phone-pad")}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Preferences</Text>

        <View style={styles.settingsCard}>
          <SettingRow
            icon="🌐"
            title="Language"
            subtitle={LANGUAGES.find((l) => l.code === languageCode)?.label ?? languageCode}
            onPress={() => setEditing(editing === "language" ? null : "language")}
          />

          {editing === "language" && (
            <View style={styles.languageBox}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  style={[
                    styles.languageOption,
                    languageCode === l.code && styles.languageOptionSelected,
                  ]}
                  onPress={() => saveField("language", "preferred_language", l.code)}
                >
                  <Text
                    style={[
                      styles.languageOptionText,
                      languageCode === l.code && styles.languageOptionTextSelected,
                    ]}
                  >
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => onNavigate("home")}
          activeOpacity={0.8}
        >
          <Text style={styles.homeButtonText}>Go to Home</Text>
          <Text style={styles.homeArrow}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogOut}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <View style={styles.brandingSection}>
          <View style={styles.logoCircle}>
            <Image
              source={require("../assets/mindmitra-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTagline}>Your caring companion</Text>
        </View>
      </ScrollView>

      <BottomNav
        activeTab="Profile"
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
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  titleSection: { marginTop: 10, marginBottom: 22 },
  pageTitle: { fontSize: 32, fontWeight: "700", color: colors.text },
  pageSubtitle: { fontSize: 17, lineHeight: 24, color: colors.textSecondary, marginTop: 6 },

  profileCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    marginBottom: 30,
  },
  photoContainer: { width: 112, height: 112, borderRadius: 56, marginBottom: 14 },
  profilePlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profileEmoji: { fontSize: 55 },
  profilePhoto: { width: "100%", height: "100%" },
  cameraButton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.surfaceLowest,
  },
  cameraIcon: { fontSize: 19 },
  profileName: { fontSize: 25, fontWeight: "700", color: colors.text },
  profileRole: { fontSize: 16, color: colors.textSecondary, marginTop: 4 },
  editProfileButton: {
    minHeight: 50,
    paddingHorizontal: 26,
    borderRadius: 25,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  editProfileText: { fontSize: 16, fontWeight: "700", color: colors.primary },

  editBox: {
    width: "100%",
    marginTop: 16,
    backgroundColor: colors.surfaceLow,
    borderRadius: 16,
    padding: 14,
  },
  editInput: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.text,
  },
  editButtonsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  editCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  editCancelText: { fontSize: 15, fontWeight: "600", color: colors.text },
  editSaveButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  editSaveButtonDisabled: { opacity: 0.7 },
  editSaveText: { fontSize: 15, fontWeight: "700", color: colors.onPrimary },

  languageBox: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 16,
    paddingTop: 4,
  },
  languageOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceLow,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },
  languageOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  languageOptionText: { fontSize: 14, fontWeight: "600", color: colors.text },
  languageOptionTextSelected: { color: colors.onPrimary },

  sectionTitle: { fontSize: 20, fontWeight: "700", color: colors.text, marginBottom: 12, marginTop: 6 },
  settingsCard: {
    backgroundColor: colors.surfaceLowest,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    marginBottom: 28,
    overflow: "hidden",
  },
  settingRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  settingIcon: { fontSize: 24 },
  settingTextContainer: { flex: 1 },
  settingTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  settingSubtitle: { fontSize: 14, lineHeight: 19, color: colors.textSecondary, marginTop: 3 },
  chevron: { fontSize: 32, color: colors.textSecondary, marginLeft: 8 },
  divider: { height: 1, backgroundColor: colors.surfaceHigh, marginLeft: 82 },

  mapButton: {
    minHeight: 52,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  mapButtonText: { fontSize: 16, fontWeight: "700", color: colors.primary },

  homeButton: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  homeButtonText: { color: colors.onPrimary, fontSize: 19, fontWeight: "700" },
  homeArrow: { color: colors.onPrimary, fontSize: 30, fontWeight: "700" },

  logoutButton: {
    minHeight: 60,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#BA1A1A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  logoutButtonText: { color: "#BA1A1A", fontSize: 18, fontWeight: "700" },

  brandingSection: { alignItems: "center", marginTop: 30, marginBottom: 24 },
  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#21072E",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logo: { width: 90, height: 90 },
  brandTagline: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 10,
  },
});

export default ProfileSettingsScreen;
