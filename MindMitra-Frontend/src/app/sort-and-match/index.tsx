import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Dimensions, Animated, Easing
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import GameScreenHeader from '../../../components/GameScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { syncService } from '../../lib/syncService';

// Must match the real `games` row for Sort and Match (game_type = 'match_pairs').
const SORT_AND_MATCH_GAME_ID = '8b3a79a3-c25a-4430-a821-3566bad38ce7';

// ============================================================================
// TYPES & DATA
// ============================================================================

type CategoryId = "food" | "clothing" | "utensils" | "nature";
type Screen = "home" | "play" | "summary" | "progress";
type TextScale = "normal" | "large" | "xlarge";

interface GameObject {
  id: string;
  emoji: string;
  name: string;
  category: CategoryId;
}

interface CategoryDef {
  id: CategoryId;
  label: string;
  emoji: string;
  color: string;
  colorSoft: string;
  colorDeep: string;
}

interface Settings {
  speech: boolean;
  sound: boolean;
  textScale: TextScale;
  highContrast: boolean;
  sessionLength: number;
}

interface CategoryTally {
  correct: number;
  total: number;
}

interface SessionRecord {
  date: string;
  sorted: number;
  correct: number;
  total: number;
  categoryStats: Record<CategoryId, CategoryTally>;
}

const CATEGORIES: CategoryDef[] = [
  { id: "food", label: "Food", emoji: "🍽️", color: "#D9723F", colorSoft: "#F3DACB", colorDeep: "#A8552A" },
  { id: "clothing", label: "Clothing", emoji: "👕", color: "#4C8577", colorSoft: "#D6E6E1", colorDeep: "#2F5C51" },
  { id: "utensils", label: "Utensils", emoji: "🥄", color: "#C99A3E", colorSoft: "#F1E3C4", colorDeep: "#96712A" },
  { id: "nature", label: "Nature", emoji: "🌳", color: "#6E9A52", colorSoft: "#DCE8CE", colorDeep: "#4C7035" },
];

const OBJECTS: GameObject[] = [
  { id: "apple", emoji: "🍎", name: "Apple", category: "food" },
  { id: "banana", emoji: "🍌", name: "Banana", category: "food" },
  { id: "bread", emoji: "🍞", name: "Bread", category: "food" },
  { id: "cheese", emoji: "🧀", name: "Cheese", category: "food" },
  { id: "shirt", emoji: "👕", name: "Shirt", category: "clothing" },
  { id: "pants", emoji: "👖", name: "Pants", category: "clothing" },
  { id: "socks", emoji: "🧦", name: "Socks", category: "clothing" },
  { id: "fork", emoji: "🍴", name: "Fork", category: "utensils" },
  { id: "spoon", emoji: "🥄", name: "Spoon", category: "utensils" },
  { id: "knife", emoji: "🔪", name: "Knife", category: "utensils" },
  { id: "tree", emoji: "🌳", name: "Tree", category: "nature" },
  { id: "flower", emoji: "🌸", name: "Flower", category: "nature" },
  { id: "sun", emoji: "☀️", name: "Sun", category: "nature" },
];

const UI_STRINGS: Record<string, string> = {
  appTitle: "Sort & Match", appSubtitle: "Objects appear one at a time. Place each one in the bucket where it belongs.",
  start: "Start", progress: "Progress", settingsTitle: "Settings", tapToHear: "Tap to hear it again",
  sessionOf: "of", sortedToday: "objects sorted today", doneForNow: "Done for now",
  speakNames: "Speak object names aloud", soundEffects: "Sound effects", highContrast: "High contrast mode",
  textSize: "Text size", objectsPerSession: "Objects per session", normal: "Normal", large: "Large", xlarge: "Extra large",
  progressIntro: "Matching everyday objects to categories draws on semantic memory.",
  noSessionsYet: "No sessions yet.", lastSessions: "Session history", clearHistory: "Clear progress history",
  categoryAccuracy: "category accuracy",
};

// The core gameplay-loop strings (what the player sees while actually
// playing, not the settings/history screens) are translated for real
// through the app's central dictionary — everything else above falls
// back to English, since translating an entire settings screen for one
// game is a much larger effort than the core play loop.
import { translate } from '../../i18n/translations';
let currentLanguageCode: string | null | undefined = 'en';
export function setSortMatchLanguage(code: string | null | undefined) {
  currentLanguageCode = code;
}
const CENTRAL_KEY_MAP: Record<string, Parameters<typeof translate>[1]> = {
  sortInto: 'sort_into',
  correctAnswerPrefix: 'correct_answer_prefix',
  great: 'well_done',
  yourTurn: 'your_turn',
  playAgain: 'play_again',
  back: 'back',
};

const t = (key: string): string => {
  const centralKey = CENTRAL_KEY_MAP[key];
  if (centralKey) return translate(currentLanguageCode, centralKey);
  return UI_STRINGS[key] || key;
};

const DEFAULT_SETTINGS: Settings = {
  speech: true,
  sound: true,
  textScale: "large",
  highContrast: false,
  sessionLength: 10,
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildSessionQueue(length: number): GameObject[] {
  let pool = [...OBJECTS];
  while(pool.length < length) {
    pool = [...pool, ...OBJECTS];
  }
  return shuffle(pool).slice(0, length);
}

function emptyTally(): Record<CategoryId, CategoryTally> {
  return {
    food: { correct: 0, total: 0 },
    clothing: { correct: 0, total: 0 },
    utensils: { correct: 0, total: 0 },
    nature: { correct: 0, total: 0 },
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SortingGameScreen() {
  const router = useRouter();
  const { src } = useLocalSearchParams();
  const { patient } = useAuth();
  setSortMatchLanguage(patient?.preferred_language);

  const isAi = src === 'ai';
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<SessionRecord[]>([]);

  const [queue, setQueue] = useState<GameObject[]>([]);
  const [index, setIndex] = useState(0);
  const [feedback, setFeedback] = useState<"none" | "correct" | "incorrect">("none");
  const [revealCategory, setRevealCategory] = useState<CategoryId | null>(null);
  const [glowBucket, setGlowBucket] = useState<CategoryId | null>(null);
  const [message, setMessage] = useState<string>("");
  const [locked, setLocked] = useState(false);

  const tallyRef = useRef<Record<CategoryId, CategoryTally>>(emptyTally());
  const correctRef = useRef(0);
  const totalRef = useRef(0);
  const sessionStartRef = useRef<number | null>(null);

  const scaleMultiplier = settings.textScale === "xlarge" ? 1.25 : settings.textScale === "large" ? 1.1 : 1;
  const s = (size: number) => size * scaleMultiplier;

  const startSession = () => {
    tallyRef.current = emptyTally();
    correctRef.current = 0;
    totalRef.current = 0;
    sessionStartRef.current = Date.now();
    setQueue(buildSessionQueue(settings.sessionLength));
    setIndex(0);
    setFeedback("none");
    setRevealCategory(null);
    setMessage("");
    setLocked(false);
    setScreen("play");
  };

  const advance = useCallback(() => {
    setFeedback("none");
    setRevealCategory(null);
    setMessage("");
    setLocked(false);
    if (index + 1 >= queue.length) {
      const record: SessionRecord = {
        date: new Date().toISOString(),
        sorted: queue.length,
        correct: correctRef.current,
        total: totalRef.current,
        categoryStats: tallyRef.current,
      };
      setHistory([...history, record]);
      setScreen("summary");

      if (patient?.id) {
        syncService.saveRound({
          user_id: patient.id,
          game_id: SORT_AND_MATCH_GAME_ID,
          difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
          difficulty_value: { categories: CATEGORIES.length, objects: totalRef.current },
          time_taken_sec: sessionStartRef.current ? (Date.now() - sessionStartRef.current) / 1000 : 0,
          expected_time_sec: 45 + 4 * CATEGORIES.length + 2.5 * totalRef.current,
          total_attempts: totalRef.current,
          correct_count: correctRef.current,
          error_count: totalRef.current - correctRef.current,
          error_types: totalRef.current - correctRef.current > 0 ? ['wrong_bucket'] : [],
          completed: true,
          accuracy: totalRef.current > 0 ? correctRef.current / totalRef.current : 1,
        });
      }
    } else {
      setIndex((i) => i + 1);
    }
  }, [index, queue.length, history]);

  const quitSession = () => {
    const correct = correctRef.current;
    const total = totalRef.current;
    if (total > 0 && patient?.id) {
      syncService.saveRound({
        user_id: patient.id,
        game_id: SORT_AND_MATCH_GAME_ID,
        difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
        difficulty_value: { categories: CATEGORIES.length, objects: total },
        time_taken_sec: sessionStartRef.current ? (Date.now() - sessionStartRef.current) / 1000 : 0,
        expected_time_sec: 45 + 4 * CATEGORIES.length + 2.5 * total,
        total_attempts: total,
        correct_count: correct,
        error_count: total - correct,
        error_types: total - correct > 0 ? ['wrong_bucket'] : [],
        completed: false,
        accuracy: total > 0 ? correct / total : 1,
      });
    }
    setScreen("home");
  };

  const handleBucketTap = (catId: CategoryId) => {
    const current = queue[index];
    if (!current || locked) return;
    const isCorrect = catId === current.category;
    totalRef.current += 1;
    const tally = tallyRef.current[current.category];
    tally.total += 1;
    setLocked(true);

    if (isCorrect) {
      tally.correct += 1;
      correctRef.current += 1;
      setFeedback("correct");
      setGlowBucket(catId);
      setMessage(t("great"));
      
      setTimeout(() => {
        setGlowBucket(null);
      }, 900);
      setTimeout(advance, 1100);
    } else {
      setFeedback("incorrect");
      setRevealCategory(current.category);
      setMessage(`${t("correctAnswerPrefix")} ${CATEGORIES.find(c => c.id === current.category)?.label}`);
      
      setTimeout(advance, 1800);
    }
  };

  const current = queue[index];

  const bgColor = settings.highContrast ? '#FFFFFF' : '#FAF6EE';
  const textColor = settings.highContrast ? '#000000' : '#3A3129';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }}>
        
        {screen === "home" && (
          <View style={styles.centerContainer}>
            <GameScreenHeader
              title={t("appTitle")}
              subtitle={t("appSubtitle")}
              onBackPress={() => router.back()}
            />
            <Text style={{ fontSize: 56, marginBottom: 10 }}>🧺</Text>
            <Text style={{ fontSize: s(34), fontWeight: 'bold', color: textColor }}>{t("appTitle")}</Text>
            <Text style={{ fontSize: s(17), color: '#6B5F52', textAlign: 'center', marginVertical: 20 }}>{t("appSubtitle")}</Text>
            
            <TouchableOpacity style={styles.startBtn} onPress={startSession}>
              <Text style={{ color: 'white', fontSize: s(22), fontWeight: 'bold' }}>▶️ {t("start")}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.outlineBtn} onPress={() => setScreen("progress")}>
              <Text style={{ fontSize: s(15), fontWeight: 'bold', color: textColor }}>📊 {t("progress")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "play" && current && (
          <View style={styles.centerContainer}>
            <GameScreenHeader
              title={t("appTitle")}
              subtitle={`${index + 1} ${t("sessionOf")} ${queue.length}`}
              onBackPress={quitSession}
            />

            <View style={[styles.card, { borderColor: feedback === 'correct' ? '#4C8577' : feedback === 'incorrect' ? '#C99A3E' : '#EFE6D3' }]}>
              <Text style={{ fontSize: 80 }}>{current.emoji}</Text>
              <Text style={{ fontSize: s(28), fontWeight: 'bold', marginTop: 10, color: textColor }}>{current.name}</Text>
              {message !== "" && (
                <View style={[styles.msgBadge, { backgroundColor: feedback === 'correct' ? '#4C8577' : '#C99A3E' }]}>
                  <Text style={{ color: 'white', fontSize: s(15), fontWeight: 'bold' }}>{message}</Text>
                </View>
              )}
            </View>

            <View style={styles.bucketsGrid}>
              {CATEGORIES.map((cat) => {
                const isRevealed = revealCategory === cat.id;
                const isGlowing = glowBucket === cat.id;
                return (
                  <TouchableOpacity 
                    key={cat.id} 
                    style={[
                      styles.bucket, 
                      { backgroundColor: cat.colorSoft },
                      isRevealed && { borderWidth: 3, borderColor: '#4C8577' },
                      isGlowing && { borderWidth: 3, borderColor: cat.color }
                    ]}
                    onPress={() => handleBucketTap(cat.id)}
                    disabled={locked}
                  >
                    <Text style={{ fontSize: 36 }}>{cat.emoji}</Text>
                    <Text style={{ fontSize: s(17), fontWeight: 'bold', color: cat.colorDeep }}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {screen === "summary" && (
          <View style={styles.centerContainer}>
            <Text style={{ fontSize: 64 }}>🌟</Text>
            <Text style={{ fontSize: s(28), fontWeight: 'bold', color: textColor, marginVertical: 10 }}>{t("great")}</Text>
            <Text style={{ fontSize: s(17), color: '#6B5F52', marginBottom: 30 }}>{queue.length} {t("sortedToday")}</Text>
            
            <TouchableOpacity style={styles.startBtn} onPress={startSession}>
              <Text style={{ color: 'white', fontSize: s(18), fontWeight: 'bold' }}>{t("playAgain")}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.outlineBtn, { marginTop: 15 }]} onPress={() => setScreen("home")}>
              <Text style={{ fontSize: s(16), fontWeight: 'bold', color: textColor }}>{t("doneForNow")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {screen === "progress" && (
          <View>
            <GameScreenHeader
              title={t("progress")}
              onBackPress={() => setScreen("home")}
            />
            
            <Text style={{ color: '#6B5F52', fontSize: s(14), marginBottom: 20 }}>{t("progressIntro")}</Text>

            {history.length === 0 ? (
              <View style={{ padding: 40, alignItems: 'center', borderColor: '#D9CBAE', borderWidth: 1, borderStyle: 'dashed', borderRadius: 18 }}>
                <Text style={{ color: '#6B5F52' }}>{t("noSessionsYet")}</Text>
              </View>
            ) : (
              <View>
                <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>Recent Sessions</Text>
                {history.map((h, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 15, backgroundColor: 'white', borderRadius: 12, marginBottom: 10 }}>
                    <Text>{new Date(h.date).toLocaleDateString()}</Text>
                    <Text style={{ fontWeight: 'bold' }}>{h.correct}/{h.total} Correct</Text>
                  </View>
                ))}
                
                <TouchableOpacity style={{ marginTop: 20, alignItems: 'center' }} onPress={() => setHistory([])}>
                  <Text style={{ color: '#A8552A', fontWeight: 'bold' }}>🔄 {t("clearHistory")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  homeHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  playHeader: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#EFE6D3',
    alignItems: 'center',
    justifyContent: 'center'
  },
  startBtn: {
    backgroundColor: '#4C8577',
    paddingVertical: 20,
    paddingHorizontal: 48,
    borderRadius: 50,
    marginBottom: 20
  },
  outlineBtn: {
    borderWidth: 2,
    borderColor: '#D9CBAE',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 50
  },
  card: {
    width: '100%',
    minHeight: 220,
    backgroundColor: 'white',
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    position: 'relative'
  },
  msgBadge: {
    position: 'absolute',
    bottom: -15,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 50
  },
  bucketsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  bucket: {
    width: '48%',
    minHeight: 108,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'transparent'
  }
});
