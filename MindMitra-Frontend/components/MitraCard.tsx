import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import colors from "../theme/colors";

interface MitraCardProps {
  message?: string;
  imageUri?: string;
  onPress?: () => void;
}

const MitraCard: React.FC<MitraCardProps> = ({
  message = "Hello! How can I help you today?",
  imageUri,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Talk to Mitra"
    >
      {/* Mascot */}
      <View style={styles.mascotContainer}>
        <Image
          source={imageUri ? { uri: imageUri } : require("../assets/mitra.png")}
          style={styles.mascotImage}
          resizeMode="contain"
        />
      </View>

      {/* Speech Bubble */}
      <View style={styles.content}>
        <Text style={styles.mitraName}>Mitra</Text>

        <Text style={styles.message}>
          {message}
        </Text>

        <View style={styles.tapHint}>
          <Text style={styles.tapHintText}>Tap to talk →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 130,
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },

  mascotContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceLowest,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  mascotImage: {
    width: 82,
    height: 82,
  },

  content: {
    flex: 1,
    justifyContent: "center",
  },

  mitraName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 4,
  },

  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },

  tapHint: {
    marginTop: 10,
  },

  tapHintText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
  },
});

export default MitraCard;