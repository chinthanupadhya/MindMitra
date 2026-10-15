import React, { useEffect, useRef, useState } from "react";

import {
  Alert,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

import GreetingHeader from "../components/GreetingHeader";
import { useAuth } from "../src/context/AuthContext";
import { useTranslation } from "../src/i18n/useTranslation";
import colors from "../theme/colors";

const VOICE_API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

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

interface TalkToMitraScreenProps {
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
}

interface MessageProps {
  text: string;
  isMitra?: boolean;
}

const ChatMessage: React.FC<MessageProps> = ({ text, isMitra = false }) => {
  return (
    <View style={[styles.messageRow, !isMitra && styles.userMessageRow]}>
      {isMitra && (
        <View style={styles.mitraAvatar}>
          <Image
            source={require("../assets/mitra.png")}
            style={styles.mitraAvatarImage}
            resizeMode="contain"
          />
        </View>
      )}

      <View
        style={[
          styles.messageBubble,
          isMitra ? styles.mitraBubble : styles.userBubble,
        ]}
      >
        <Text style={[styles.messageText, !isMitra && styles.userMessageText]}>
          {text}
        </Text>
      </View>
    </View>
  );
};

const TalkToMitraScreen: React.FC<TalkToMitraScreenProps> = ({
  onNavigate,
  onBack,
}) => {
  const { patient } = useAuth();
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [proccessing, setProcessing] = useState(false);
  const [voiceStatusText, setVoiceStatusText] = useState<string | null>(null);

  // expo-audio recorder + player (Phase 1: record + send to STT; TTS reply).
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const replyPlayer = useAudioPlayer(null);
  const chatScrollRef = useRef<ScrollView | null>(null);

  // Real message state instead of static hardcoded bubbles. Every message the
  // patient sends is answered by Mitra via the cloud /voice/help endpoint,
  // which replies in the patient's preferred language (or auto-detects).
  const [messages, setMessages] = useState<MessageProps[]>([
    { isMitra: true, text: "Namaste! I'm Mitra. How are you feeling today?" },
  ]);

  // Request mic permission + allow recording/playback once on mount.
  useEffect(() => {
    (async () => {
      try {
        await AudioModule.requestRecordingPermissionsAsync();
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      } catch (e) {
        /* permissions may be implicitly granted on some platforms */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadAudioToStt = async (
    uri: string
  ): Promise<{ text: string; language: string } | null> => {
    try {
      // Convert audio to base64 to avoid React Native Android FormData bugs
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const language = patient?.preferred_language ?? 'en';

      const res = await fetch(`${VOICE_API_URL}/voice/stt`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true' 
        },
        body: JSON.stringify({
          audio_base64: base64Audio,
          language: language,
          content_type: 'audio/m4a'
        }),
      });

      if (!res.ok) {
        // Surface the backend's explicit message (e.g. transcription failed,
        // or "couldn't hear clearly") — never send a placeholder to Mitra.
        console.warn('STT HTTP error', res.status, await res.text().catch(() => ''));
        return null;
      }

      const data = await res.json();
      const text = (data as { text?: string }).text?.trim();
      const detected = (data as { language?: string }).language ?? 'en';
      if (text && text.length > 0) {
        // Log the transcript so the "did it match what I said" test is visible.
        console.log('TRANSCRIBED:', JSON.stringify(text), 'lang:', detected);
        return { text, language: detected };
      }
      console.warn('STT returned empty text', data);
      return null;
    } catch (e) {
      console.warn('STT upload failed', e);
      return null;
    }
  };

  const startRecording = async () => {
    if (proccessing) return;
    setVoiceStatusText(null);
    try {
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (e) {
      Alert.alert("Couldn't start recording", "Microphone access was not granted.");
    }
  };

  const stopRecordingAndSend = async () => {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) {
        setVoiceStatusText("No recording captured. Try again.");
        return;
      }

      setProcessing(true);
      setVoiceStatusText("Listening…");
      const stt = await uploadAudioToStt(uri);
      if (!stt) {
        // Show an explicit transcription-failure message. NEVER fall back to
        // sending a fixed placeholder message to the assistant as if it were
        // the user's real input.
        setVoiceStatusText("Sorry, I couldn't hear that clearly, please try again.");
        setProcessing(false);
        return;
      }
      const { text: transcribed, language: spokenLang } = stt;

      setVoiceStatusText(null);
      // Append the user's bubble BEFORE the network call so it always appears,
      // then fetch Mitra's reply. The DETECTED spoken language travels with it
      // so Mitra replies in the language the user actually spoke.
      await handleSendQuery(transcribed, spokenLang);
      setProcessing(false);
    } catch (e) {
      setProcessing(false);
      setVoiceStatusText("Something went wrong with voice recording.");
    }
  };

  const handleVoicePress = () => {
    if (recorderState.isRecording) {
      stopRecordingAndSend();
    } else {
      startRecording();
    }
  };

  const sendToMitra = async (query: string, language?: string) => {
    if (!query.trim()) return;

    // The reply must be in the language the user spoke: prefer the detected
    // STT language, falling back to the app's configured language.
    const replyLang = language ?? patient?.preferred_language ?? "en";
    setSending(true);
    try {
      const response = await fetch(`${VOICE_API_URL}/voice/help`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
        body: JSON.stringify({
          game_id: "",
          user_query: query.trim(),
          language: replyLang,
        }),
      });
      const data = await response.json();
      const reply = (data as { spoken_response?: string }).spoken_response;
      if (reply) {
        setMessages((prev) => [...prev, { isMitra: true, text: reply }]);
        // Try to speak the reply back using the TTS endpoint (same language).
        try {
          const ttsRes = await fetch(`${VOICE_API_URL}/voice/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
            body: JSON.stringify({ user_query: reply, language: replyLang }),
          });
          const ttsData = await ttsRes.json();
          const b64 = (ttsData as { audio_base64?: string }).audio_base64;
          if (b64) {
            const dataUri = `data:audio/mpeg;base64,${b64}`;
            replyPlayer.replace(dataUri);
            replyPlayer.play();
          }
        } catch (e) {
          /* audio playback is best-effort; the written reply is shown anyway */
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { isMitra: true, text: "I couldn't reach the assistant right now. Please try again." },
        ]);
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { isMitra: true, text: "I'm having trouble connecting. Please try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    if (!message.trim()) return;
    handleSendQuery(message);
  };

  // Fallback for "suggestion chip" taps.
  const handleQuickAsk = (q: string) => {
    handleSendQuery(q);
  };

  // Append the user's bubble, then fetch/render Mitra's reply. Used by both
  // the text input and the voice input so a user message NEVER disappears.
  const handleSendQuery = async (query: string, language?: string) => {
    if (!query.trim()) return;
    setMessages((prev) => [...prev, { text: query.trim() }]);
    setMessage("");
    await sendToMitra(query, language);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="height" enabled>
      <GreetingHeader name={patient?.name ?? "Elder"} showBackButton onBackPress={onBack} />

      {/* Title */}

      <View style={styles.titleSection}>
        <View style={styles.titleContent}>
          <Text style={styles.pageTitle}>Talk to Mitra</Text>

          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />

            <Text style={styles.onlineText}>Mitra is here to listen</Text>
          </View>
        </View>

        <View style={styles.mitraHeaderAvatar}>
          <Image
            source={require("../assets/mitra.png")}
            style={styles.headerAvatarImage}
            resizeMode="contain"
            accessibilityLabel="Mitra, the MindMitra red panda"
          />
        </View>
      </View>

      <ScrollView
        ref={chatScrollRef}
        style={styles.chatContainer}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={(w, h) => {
          // Auto-scroll to the newest message whenever the content grows
          // (new messages arrive), so the user always sees the latest reply.
          chatScrollRef.current?.scrollToEnd?.({ animated: true });
        }}
      >
        <View style={styles.dateDivider}>
          <View style={styles.dividerLine} />

          <Text style={styles.dateText}>TODAY</Text>

          <View style={styles.dividerLine} />
        </View>

        {messages.map((m, idx) => (
          <ChatMessage key={idx} isMitra={m.isMitra} text={m.text} />
        ))}

        {/* Suggested actions */}

        <View style={styles.suggestionsSection}>
          <Text style={styles.suggestionsTitle}>You can ask Mitra about:</Text>

          <View style={styles.suggestions}>
            <TouchableOpacity
              style={styles.suggestionChip}
              activeOpacity={0.8}
              onPress={() => onNavigate("myday")}
            >
              <Text style={styles.chipText}>My day</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.suggestionChip}
              activeOpacity={0.8}
              onPress={() => onNavigate("myday")}
            >
              <Text style={styles.chipText}>My reminders</Text>
            </TouchableOpacity>

<TouchableOpacity
          style={styles.suggestionChip}
          activeOpacity={0.8}
          onPress={() => handleQuickAsk("Talk with me")}
        >
          <Text style={styles.chipText}>Talk with me</Text>
        </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Voice interaction */}

      <View style={styles.voiceSection}>
        <Text style={styles.voiceHint}>
          {recorderState.isRecording
            ? "Listening… tap again when you're done"
            : "Or simply speak with Mitra"}
        </Text>

        <TouchableOpacity
          style={[
            styles.micButton,
            recorderState.isRecording && styles.micButtonRecording,
            proccessing && styles.micButtonDisabled,
          ]}
          onPress={handleVoicePress}
          activeOpacity={0.8}
          disabled={proccessing}
          accessibilityLabel="Speak to Mitra"
        >
          {proccessing ? (
            <Text style={styles.micIcon}>…</Text>
          ) : (
            <Text style={[styles.micIcon, recorderState.isRecording && styles.micIconRecording]}>
              {recorderState.isRecording ? "⏹" : "🎤"}
            </Text>
          )}
        </TouchableOpacity>

        {voiceStatusText ? (
          <Text style={styles.voiceStatusText}>{voiceStatusText}</Text>
        ) : null}
      </View>

      {/* Text input */}

      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type your message..."
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!message.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            activeOpacity={0.8}
            accessibilityLabel="Send message"
          >
            <Text style={styles.sendIcon}>{sending ? "…" : "↑"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Header */

  titleSection: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  titleContent: {
    flex: 1,
  },

  pageTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
  },

  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  onlineDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginRight: 8,
  },

  onlineText: {
    fontSize: 16,
    color: colors.textSecondary,
  },

  mitraHeaderAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 14,
    overflow: "hidden",
  },

  headerAvatarImage: {
    width: 68,
    height: 68,
  },

  /* Chat */

  chatContainer: {
    flex: 1,
  },

  chatContent: {
    paddingHorizontal: 22,
    paddingBottom: 24,
  },

  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceHigh,
  },

  dateText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.textSecondary,
    marginHorizontal: 14,
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 18,
  },

  userMessageRow: {
    justifyContent: "flex-end",
  },

  mitraAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    overflow: "hidden",
  },

  mitraAvatarImage: {
    width: 44,
    height: 44,
  },

  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 19,
    paddingVertical: 15,
    borderRadius: 22,
  },

  mitraBubble: {
    backgroundColor: colors.surfaceLowest,
    borderWidth: 1,
    borderColor: colors.surfaceHigh,
    borderBottomLeftRadius: 6,
  },

  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 6,
  },

  messageText: {
    fontSize: 18,
    lineHeight: 27,
    color: colors.text,
  },

  userMessageText: {
    color: colors.onPrimary,
  },

  /* Suggestions */

  suggestionsSection: {
    marginTop: 12,
    marginLeft: 56,
  },

  suggestionsTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.textSecondary,
    marginBottom: 13,
  },

  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  suggestionChip: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    justifyContent: "center",
  },

  chipText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.primary,
  },

  /* Voice interaction */

  voiceSection: {
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 18,
  },

  voiceHint: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 12,
  },

  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },

  micButtonRecording: {
    borderWidth: 3,
    borderColor: colors.error,
    shadowColor: colors.error,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  micButtonDisabled: {
    opacity: 0.6,
  },

  micIcon: {
    fontSize: 34,
  },

  micIconRecording: {
    color: colors.white,
  },

  voiceStatusText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },

  /* Text input */

  inputSection: {
    backgroundColor: colors.surfaceLowest,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceHigh,
  },

  inputContainer: {
    minHeight: 66,
    borderRadius: 33,
    backgroundColor: colors.surfaceLow,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 20,
    paddingRight: 7,
  },

  input: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    maxHeight: 110,
    paddingVertical: 12,
  },

  sendButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  sendButtonDisabled: {
    opacity: 0.45,
  },

  sendIcon: {
    color: colors.onPrimary,
    fontSize: 28,
    fontWeight: "700",
  },
});

export default TalkToMitraScreen;
