import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth } from "../src/context/AuthContext";
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

interface PatientOnboardingProps {
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
}

type Mode = "signup" | "login";

const PatientOnboarding: React.FC<PatientOnboardingProps> = ({
  onNavigate,
  onBack,
}) => {
  const { accountType, signIn, signUpCaregiver, signUpPatient } = useAuth();

  const [step, setStep] = useState<"role" | "auth" | "checkEmail">("role");
  const [role, setRole] = useState<"Patient" | "Caregiver">("Patient");
  const [mode, setMode] = useState<Mode>("signup");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [languageCode, setLanguageCode] = useState("en");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Codes must match rows already seeded in the `languages` table —
  // preferred_language is a foreign key, so an unmatched value (like a raw
  // display label) fails the insert silently otherwise.
  const languages = [
    { code: "en", label: "English" },
    { code: "hi", label: "हिन्दी" },
    { code: "as", label: "অসমীয়া" },
    { code: "brx", label: "Bodo" },
    { code: "kha", label: "Khasi" },
    { code: "mni", label: "Manipuri" },
    { code: "lus", label: "Mizo" },
  ];

  // Once sign-in/sign-up succeeds, AuthContext resolves which account type
  // this user actually is (by checking caregivers/patients tables) — we
  // navigate off that, not off the role button the person happened to tap,
  // since that's the authoritative source of truth.
  useEffect(() => {
    if (accountType === "caregiver") {
      onNavigate("caregiverHome");
    } else if (accountType === "patient") {
      onNavigate("home");
    }
  }, [accountType]);

  const handleRoleContinue = () => {
    setErrorMessage(null);
    setStep("auth");
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Please enter your email and password.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setErrorMessage("Please tell us what to call you.");
      return;
    }

    setSubmitting(true);

    if (mode === "login") {
      // Pass the role the user selected on this screen so a patient can only
      // log in with a patient account and a caregiver with a caregiver
      // account. A mismatch is rejected instead of silently opening the
      // other dashboard.
      const result = await signIn(
        email.trim(),
        password,
        role === "Caregiver" ? "caregiver" : "patient"
      );
      setSubmitting(false);
      if (result.error) {
        setErrorMessage(result.error);
      }
      // Successful login navigation is handled by the useEffect above once
      // AuthContext resolves the account type.
      return;
    }

    const result =
      role === "Caregiver"
        ? await signUpCaregiver(email.trim(), password, name.trim())
        : await signUpPatient(email.trim(), password, name.trim(), languageCode);

    setSubmitting(false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    if (result.needsEmailConfirmation) {
      setStep("checkEmail");
      return;
    }
    // No confirmation needed — navigation is handled by the useEffect above
    // once AuthContext resolves the account type.
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={step === "auth" || step === "checkEmail" ? () => setStep("role") : onBack}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Image
              source={require("../assets/mindmitra-logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.appName}>MindMitra</Text>

          <Text style={styles.tagline}>
            Your companion for cognitive health
          </Text>
        </View>

        {step === "role" && (
          <>
            <View style={styles.welcomeCard}>
              <View style={styles.mascotCircle}>
                <Text style={styles.mascot}>🤝</Text>
              </View>

              <View style={styles.welcomeTextContainer}>
                <Text style={styles.welcomeTitle}>Namaste! 👋</Text>
                <Text style={styles.welcomeSubtitle}>
                  Let's get to know you a little better.
                </Text>
              </View>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>I am a...</Text>

              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === "Patient" && styles.roleCardSelected,
                  ]}
                  onPress={() => setRole("Patient")}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Select Patient"
                >
                  <View style={styles.roleIconContainer}>
                    <Text style={styles.roleIcon}>👤</Text>
                  </View>
                  <Text
                    style={[
                      styles.roleTitle,
                      role === "Patient" && styles.roleTitleSelected,
                    ]}
                  >
                    Patient
                  </Text>
                  <Text style={styles.roleDescription}>
                    I want support for my health and daily wellbeing.
                  </Text>
                  {role === "Patient" && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedTick}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    role === "Caregiver" && styles.roleCardSelected,
                  ]}
                  onPress={() => setRole("Caregiver")}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Select Caregiver"
                >
                  <View style={styles.roleIconContainer}>
                    <Text style={styles.roleIcon}>🤝</Text>
                  </View>
                  <Text
                    style={[
                      styles.roleTitle,
                      role === "Caregiver" && styles.roleTitleSelected,
                    ]}
                  >
                    Caregiver
                  </Text>
                  <Text style={styles.roleDescription}>
                    I help care for someone and want to stay connected.
                  </Text>
                  {role === "Caregiver" && (
                    <View style={styles.selectedIndicator}>
                      <Text style={styles.selectedTick}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleRoleContinue}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Text style={styles.continueArrow}>→</Text>
            </TouchableOpacity>
          </>
        )}

        {step === "auth" && (
          <>
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, mode === "signup" && styles.modeTabSelected]}
                onPress={() => setMode("signup")}
                accessibilityRole="button"
                accessibilityLabel="Sign up"
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "signup" && styles.modeTabTextSelected,
                  ]}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, mode === "login" && styles.modeTabSelected]}
                onPress={() => setMode("login")}
                accessibilityRole="button"
                accessibilityLabel="Log in"
              >
                <Text
                  style={[
                    styles.modeTabText,
                    mode === "login" && styles.modeTabTextSelected,
                  ]}
                >
                  Log In
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              {mode === "signup" && (
                <>
                  <Text style={styles.label}>What should we call you?</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your name"
                    placeholderTextColor={colors.textSecondary}
                    value={name}
                    onChangeText={setName}
                    accessibilityLabel="Enter your name"
                  />
                </>
              )}

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                accessibilityLabel="Enter your email"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                accessibilityLabel="Enter your password"
              />

              {mode === "signup" && role === "Patient" && (
                <>
                  <Text style={styles.label}>Choose your language</Text>
                  <Text style={styles.helperText}>
                    Select the language you are most comfortable with.
                  </Text>
                  <View style={styles.languageContainer}>
                    {languages.map((item) => {
                      const selected = languageCode === item.code;
                      return (
                        <TouchableOpacity
                          key={item.code}
                          style={[
                            styles.languageButton,
                            selected && styles.languageButtonSelected,
                          ]}
                          onPress={() => setLanguageCode(item.code)}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                          accessibilityLabel={`Select ${item.label}`}
                        >
                          <Text
                            style={[
                              styles.languageText,
                              selected && styles.languageTextSelected,
                            ]}
                          >
                            {item.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {errorMessage && (
                <Text style={styles.errorText}>{errorMessage}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={mode === "signup" ? "Create account" : "Log in"}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <Text style={styles.continueButtonText}>
                    {mode === "signup" ? "Create Account" : "Log In"}
                  </Text>
                  <Text style={styles.continueArrow}>→</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}
        {step === "checkEmail" && (
          <View style={styles.checkEmailCard}>
            <View style={styles.mascotCircle}>
              <Text style={styles.mascot}>📩</Text>
            </View>
            <Text style={[styles.welcomeTitle, { marginTop: 12 }]}>Check your email</Text>
            <Text style={[styles.welcomeSubtitle, { textAlign: "center", marginTop: 8 }]}>
              We've sent a confirmation link to {email.trim()}. Tap the link, then come
              back here and log in.
            </Text>
            <TouchableOpacity
              style={[styles.continueButton, { marginTop: 24 }]}
              onPress={() => {
                setStep("auth");
                setMode("login");
                setPassword("");
                setErrorMessage(null);
              }}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Go to log in"
            >
              <Text style={styles.continueButtonText}>Go to Log In</Text>
              <Text style={styles.continueArrow}>→</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  topBar: {
    paddingTop: 28,
    marginBottom: 8,
  },

  backButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },

  backArrow: {
    fontSize: 32,
    fontWeight: "600",
    color: colors.text,
  },

  header: {
    alignItems: "center",
    marginBottom: 30,
  },

  logoCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#21072E",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  logo: {
    width: 90,
    height: 90,
  },

  appName: {
    fontSize: 27,
    fontWeight: "700",
    color: colors.text,
    marginTop: 12,
  },

  tagline: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },

  welcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    marginBottom: 28,
  },

  checkEmailCard: {
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderRadius: 22,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },

  mascotCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
  },

  mascot: {
    fontSize: 32,
  },

  welcomeTextContainer: {
    flex: 1,
  },

  welcomeTitle: {
    fontSize: 23,
    fontWeight: "700",
    color: colors.text,
  },

  welcomeSubtitle: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.textSecondary,
    marginTop: 4,
  },

  form: {
    marginBottom: 28,
  },

  label: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 9,
    marginTop: 8,
  },

  helperText: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: 14,
  },

  input: {
    minHeight: 60,
    borderRadius: 16,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    paddingHorizontal: 18,
    fontSize: 18,
    color: colors.text,
    marginBottom: 22,
  },

  languageContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 22,
  },

  languageButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    justifyContent: "center",
  },

  languageButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  languageText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },

  languageTextSelected: {
    color: colors.onPrimary,
  },

  roleContainer: {
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
  },

  roleCard: {
    flex: 1,
    minHeight: 205,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 20,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.surfaceHigh,
    position: "relative",
  },

  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },

  roleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceLow,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 13,
  },

  roleIcon: {
    fontSize: 27,
  },

  roleTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 7,
  },

  roleTitleSelected: {
    color: colors.primary,
  },

  roleDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },

  selectedIndicator: {
    position: "absolute",
    top: 13,
    right: 13,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  selectedTick: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.onPrimary,
  },

  modeTabs: {
    flexDirection: "row",
    backgroundColor: colors.surfaceLow,
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },

  modeTab: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  modeTabSelected: {
    backgroundColor: colors.surfaceLowest,
  },

  modeTabText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  modeTabTextSelected: {
    color: colors.primary,
  },

  errorText: {
    fontSize: 15,
    color: "#BA1A1A",
    marginBottom: 12,
  },

  continueButton: {
    minHeight: 68,
    borderRadius: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  continueButtonDisabled: {
    opacity: 0.7,
  },

  continueButtonText: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.onPrimary,
  },

  continueArrow: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.onPrimary,
  },
});

export default PatientOnboarding;
