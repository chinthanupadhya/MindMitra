import React from "react";

import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../src/context/AuthContext";
import { useTranslation } from "../src/i18n/useTranslation";
import colors from "../theme/colors";

interface GreetingHeaderProps {
  name?: string;
  imageUri?: string;

  showBackButton?: boolean;
  onBackPress?: () => void;

  onProfilePress?: () => void;
}

const GreetingHeader: React.FC<GreetingHeaderProps> = ({
  name = "Elder",
  imageUri,
  showBackButton = false,
  onBackPress,
  onProfilePress,
}) => {
  const { patient } = useAuth();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const handleSOS = () => {
    const contact = patient?.emergency_contact;
    if (!contact) {
      Alert.alert(
        "No Emergency Contact Set",
        "There's no emergency contact on file yet. Please add one from your profile so SOS can call someone right away."
      );
      return;
    }

    Alert.alert(
      "Call Emergency Contact?",
      `This will call ${contact}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call Now",
          style: "destructive",
          onPress: () => Linking.openURL(`tel:${contact}`),
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.leftSection}>
        {showBackButton ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.avatar}
            onPress={onProfilePress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>👤</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.greetingButton}
          onPress={onProfilePress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Open profile settings"
        >
          <Text
            style={styles.greeting}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {t("greeting_prefix")} {name}
          </Text>

          {!showBackButton && (
            <Text style={styles.profileHint} numberOfLines={1} ellipsizeMode="tail">
              {t("view_profile")}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.sosButton}
        onPress={handleSOS}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Emergency SOS"
      >
        <Text style={styles.sosText}>{t("sos")}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },

  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarText: {
    fontSize: 28,
  },

  greetingButton: {
    flex: 1,
    justifyContent: "center",
  },

  greeting: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: colors.primary,
  },

  profileHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },

  sosButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#D93636",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  sosText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  backButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  backArrow: {
    fontSize: 36,
    lineHeight: 42,
    color: colors.primary,
    fontWeight: "700",
  },
});

export default GreetingHeader;
