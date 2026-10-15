import React from "react";

import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";

import colors from "../theme/colors";
import { useTranslation } from "../src/i18n/useTranslation";

export type NavTab = "Home" | "GameStats" | "Booking" | "Circle" | "Profile";

interface BottomNavProps {
  activeTab?: NavTab;
  onHomePress?: () => void;
  onGameStatsPress?: () => void;
  onBookingPress?: () => void;
  onCirclePress?: () => void;
  onProfilePress?: () => void;
}

const TABS: { label: NavTab; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "Home", icon: "home-outline" },
  { label: "GameStats", icon: "trophy-outline" },
  { label: "Booking", icon: "calendar-outline" },
  { label: "Circle", icon: "people-circle-outline" },
  { label: "Profile", icon: "person-circle-outline" },
];

const BottomNav: React.FC<BottomNavProps> = ({
  activeTab = "Home",
  onHomePress,
  onGameStatsPress,
  onBookingPress,
  onCirclePress,
  onProfilePress,
}) => {
  const { t } = useTranslation();

  const labels: Record<NavTab, string> = {
    Home: t("home"),
    GameStats: t("game_stats"),
    Booking: t("booking"),
    Circle: t("circle"),
    Profile: t("profile"),
  };

  const onPressFor: Record<NavTab, (() => void) | undefined> = {
    Home: onHomePress,
    GameStats: onGameStatsPress,
    Booking: onBookingPress,
    Circle: onCirclePress,
    Profile: onProfilePress,
  };

  return (
    <View style={styles.bottomNav}>
      {TABS.map((tab) => {
        const active = activeTab === tab.label;
        return (
          <Pressable
            key={tab.label}
            onPress={onPressFor[tab.label]}
            style={[styles.navItem, active && styles.navActive]}
            accessibilityRole="button"
            accessibilityLabel={`Go to ${tab.label}`}
          >
            <Ionicons
              name={tab.icon}
              size={25}
              color={active ? colors.onPrimary : colors.text}
            />
            <Text
              style={[styles.navLabel, active && styles.navLabelActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {labels[tab.label]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    minHeight: 82,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  navItem: {
    flex: 1,
    minHeight: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  navActive: {
    backgroundColor: colors.primary,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  navLabelActive: {
    color: colors.onPrimary,
  },
});

export default BottomNav;