import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../theme/colors";

interface QuickActionCardProps {
  title: string;
  icon: string;
  variant?: "green" | "terracotta" | "neutral";
  onPress?: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  icon,
  variant = "neutral",
  onPress,
}) => {
  const getIconBackground = () => {
    switch (variant) {
      case "green":
        return colors.primaryLight;

      case "terracotta":
        return colors.secondaryLight;

      default:
        return colors.surfaceContainer;
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: getIconBackground() },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 120,
    backgroundColor: colors.surfaceLowest,
    borderRadius: 16,
    padding: 18,
    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,
    borderColor: colors.surfaceHigh,
  },

  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  icon: {
    fontSize: 24,
  },

  title: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
});

export default QuickActionCard;