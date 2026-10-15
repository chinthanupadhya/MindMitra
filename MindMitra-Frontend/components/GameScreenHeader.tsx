import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import colors from "../theme/colors";

interface GameScreenHeaderProps {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  rightContent?: React.ReactNode;
}

/**
 * Shared themed header for the memory games so they match the rest of the
 * app (colors + GreetingHeader-style back button) instead of each having
 * their own raw beige styling.
 */
const GameScreenHeader: React.FC<GameScreenHeaderProps> = ({
  title,
  subtitle,
  onBackPress,
  rightContent,
}) => {
  return (
    <View style={styles.container}>
      {onBackPress && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBackPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
      )}

      <View style={styles.titleContainer}>
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightContent}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },

  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  backArrow: {
    fontSize: 28,
    lineHeight: 34,
    color: colors.primary,
    fontWeight: "700",
  },

  titleContainer: {
    flex: 1,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 3,
  },
});

export default GameScreenHeader;