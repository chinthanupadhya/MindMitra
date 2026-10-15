import { useRouter, useFocusEffect } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import GreetingHeader from "../components/GreetingHeader";
import SectionHeader from "../components/SectionHeader";
import colors from "../theme/colors";
import { inferenceEngine } from "../src/lib/ai/inference";
import { syncService } from "../src/lib/syncService";
import { getAllRoundsForUser, upsertPatientLocal } from "../src/db/local";
import { supabase } from "../src/lib/supabaseClient";
import { useAuth } from "../src/context/AuthContext";
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
  | "caregiverHome"
  | "gamepack";
interface GamePackGamesScreenProps {
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
}
interface GamePackEntry {
  id: string;
  name: string;
  description: string;
  accent: string;
  icon: string;
  route: string;
}
const GAME_PACK_ENTRIES: GamePackEntry[] = [
  {
    id: 'c2325c82-87aa-47fc-9b08-569b5d135694',
    name: "Match 2",
    description: "Find and match the correct pairs.",
    accent: "#34C759",
    icon: "🃏",
    route: "/match2",
  },
  {
    id: '2aeaf7c0-cd7d-4095-8518-53b23fdf6223',
    name: "Meet & Greet",
    description: "Identify friends, people, and details.",
    accent: "#FF9500",
    icon: "🧑‍🤝‍🧑",
    route: "/meet-and-greet",
  },
  {
    id: 'f6832a47-78fc-49d5-81cc-c2b1418f9d08',
    name: "Sequence Memory",
    description: "Watch the pattern and repeat it back.",
    accent: "#007AFF",
    icon: "🔢",
    route: "/sequence",
  },
  {
    id: '65adbc99-6e1f-4e60-aa86-afbde105fd16',
    name: "Monument Memory",
    description: "Match famous landmarks and memories.",
    accent: "#5856D6",
    icon: "🏛️",
    route: "/monuments",
  },
  {
    id: '9eaaafd6-9272-4bc6-89f1-44c6829b56f7',
    name: "Triple Stack",
    description: "Build and track layers of memory.",
    accent: "#FF3B30",
    icon: "🧩",
    route: "/triple-stack",
  },
  {
    id: '8b3a79a3-c25a-4430-a821-3566bad38ce7',
    name: "Sort & Match",
    description: "Organize cards and detect the right matches.",
    accent: "#8E8E93",
    icon: "📦",
    route: "/sort-and-match",
  },
  {
    id: 'f23f9c95-c873-4c2b-8cda-ff86ad72906c',
    name: "Missing Objects",
    description: "Spot what is missing from the scene.",
    accent: "#B0402A",
    icon: "🔍",
    route: "/missing-objects",
  },
];
const GamePackGamesScreen: React.FC<GamePackGamesScreenProps> = ({
  onNavigate,
  onBack,
}) => {
  const router = useRouter();
  const { patient } = useAuth();
  const [recommendedGame, setRecommendedGame] = React.useState<GamePackEntry | null>(null);
  const [recommendedDifficulty, setRecommendedDifficulty] = React.useState<any>(null);
  const [recLoading, setRecLoading] = React.useState(false);

  // Helper to map AI float/dict to a preset for games with difficulty selectors
  const getDifficultyPreset = (gameId: string, diffValue: any) => {
    if (!diffValue) return 'medium';

    if (gameId === 'c2325c82-87aa-47fc-9b08-569b5d135694') { // Match 2
       if (diffValue >= 15) return 'hard';
       if (diffValue >= 10) return 'medium';
       return 'easy';
    }
    if (gameId === '2aeaf7c0-cd7d-4095-8518-53b23fdf6223') { // Meet & Greet
       if (diffValue?.people >= 7) return 'hard';
       if (diffValue?.people >= 5) return 'medium';
       return 'easy';
    }
    if (gameId === '65adbc99-6e1f-4e60-aa86-afbde105fd16') { // Monument Memory
       if (diffValue?.locations >= 7) return 'hard';
       if (diffValue?.locations >= 5) return 'medium';
       return 'easy';
    }
    return 'medium';
  };

  const handleAIRoute = () => {
    if (!recommendedGame) return;

    const id = recommendedGame.id;
    const route = recommendedGame.route;
    const diff = recommendedDifficulty;

    // Match 2: the AI's exact pair count auto-selects the level — no menu
    // re-entry. Preset values use the preset route; anything in between uses
    // the custom pairs route (`/match2/custom?pairs=N`).
    if (id === 'c2325c82-87aa-47fc-9b08-569b5d135694') {
      const pairs = typeof diff === 'number' ? Math.round(diff) : 6;
      if (pairs === 6) router.push(`/match2/easy?src=ai` as never);
      else if (pairs === 10) router.push(`/match2/medium?src=ai` as never);
      else if (pairs === 15) router.push(`/match2/hard?src=ai` as never);
      else {
        const clamped = Math.min(18, Math.max(1, pairs));
        router.push(`/match2/custom?pairs=${clamped}&src=ai` as never);
      }
      return;
    }

    // Meet & Greet / Monuments: present the closest preset so the user never
    // re-picks a level.
    if (id === '2aeaf7c0-cd7d-4095-8518-53b23fdf6223' || id === '65adbc99-6e1f-4e60-aa86-afbde105fd16') {
      const preset = getDifficultyPreset(id, diff);
      router.push(`${route}/${preset}?src=ai` as never);
      return;
    }

    // Triple Stack: AI card_count -> easy (8 kinds) / medium (12 kinds).
    if (id === '9eaaafd6-9272-4bc6-89f1-44c6829b56f7') {
      const d = typeof diff === 'number' && diff >= 12 ? 'medium' : 'easy';
      router.push(`/triple-stack?diff=${d}&src=ai` as never);
      return;
    }

    // Everything else: open the game; ?src=ai marks the round as
    // ai_recommended when it's recorded.
    router.push(`${route}?src=ai` as never);
  };

  useFocusEffect(
    React.useCallback(() => {
      async function loadRecommendation() {
        if (!patient?.id) return;
        setRecLoading(true);

        // Cache the patient row locally (screening_assigned_level) so inference
        // works offline without Supabase. Only happens when online.
        if (patient.screening_assigned_level != null) {
          upsertPatientLocal({
            id: patient.id,
            name: patient.name ?? '',
            preferred_language: patient.preferred_language ?? null,
            screening_assigned_level: patient.screening_assigned_level,
          }).catch(() => {});
        }

        // Flush pending rounds so the latest game is visible.
        await syncService.flush();

        // Find the user's most recently played game id.
        // Try Supabase first; fall back to local SQLite on ANY error (offline).
        let lastGameId: string | undefined;
        try {
          const { data: recent, error } = await supabase
            .from('rounds')
            .select('game_id')
            .eq('user_id', patient.id)
            .order('timestamp', { ascending: false })
            .limit(1);
          if (!error && recent && recent.length > 0) {
            lastGameId = recent[0].game_id;
          }
        } catch {
          // network offline — fall through to local SQLite below
        }

        // Offline / Supabase empty: read from local SQLite rounds (canonical source).
        if (!lastGameId) {
          const logs = await getAllRoundsForUser(patient.id).catch(() => []);
          const mine = logs.sort((a, b) =>
            String(b.timestamp ?? '').localeCompare(String(a.timestamp ?? ''))
          );
          if (mine.length > 0) lastGameId = String(mine[0].game_id);
        }

        if (lastGameId) {
          try {
            const rec = await inferenceEngine.getGameRecommendation(patient.id, lastGameId);
            if (rec && rec.recommended_game_uuid) {
              const game = GAME_PACK_ENTRIES.find(g => g.id === rec.recommended_game_uuid);
              if (game) {
                setRecommendedGame(game);
                setRecommendedDifficulty(rec.recommended_difficulty_value);
              }
            }
          } catch (e) {
            console.warn('[GamePack] recommendation fetch failed:', e);
          }
        }
        setRecLoading(false);
      }
      loadRecommendation();
    }, [patient?.id])
  );
  return (
    <View style={styles.screen}>
      <GreetingHeader name={patient?.name ?? "Elder"} showBackButton onBackPress={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>GamePack</Text>
          <Text style={styles.pageSubtitle}>
            Gentle brain games for memory and focus.
          </Text>
        </View>
        <View style={styles.heroCard}>
          <View style={styles.heroIconContainer}>
            <Text style={styles.heroIcon}>🧠</Text>
          </View>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Memory Activity Hub</Text>
            <Text style={styles.heroText}>
              Your selected GamePack activities are ready to play from here.
            </Text>
          </View>
        </View>

        {recLoading ? (
          <View style={styles.section}>
            <SectionHeader title="Recommended for you" />
            <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
          </View>
        ) : recommendedGame ? (
          <View style={styles.section}>
            <SectionHeader title="Recommended for you" />
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleAIRoute}
              style={styles.gameCard}
            >
              <View style={[styles.gameBadge, { backgroundColor: recommendedGame.accent }]}>
                <Text style={styles.gameBadgeIcon}>{recommendedGame.icon}</Text>
              </View>
              <View style={styles.gameContent}>
                <Text style={styles.gameName}>{recommendedGame.name}</Text>
                <Text style={styles.gameDescription}>
                  Personalized based on your recent performance.
                </Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Available games" />
          {GAME_PACK_ENTRIES.map((game) => (
            <TouchableOpacity
              key={game.name}
              activeOpacity={0.9}
              onPress={() => router.push(game.route as never)}
              style={styles.gameCard}
            >
              <View
                style={[styles.gameBadge, { backgroundColor: game.accent }]}
              >
                <Text style={styles.gameBadgeIcon}>{game.icon}</Text>
              </View>
              <View style={styles.gameContent}>
                <Text style={styles.gameName}>{game.name}</Text>
                <Text style={styles.gameDescription}>{game.description}</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  titleSection: {
    marginTop: 18,
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
  },
  pageSubtitle: {
    fontSize: 18,
    lineHeight: 26,
    color: colors.textSecondary,
    marginTop: 8,
  },
  heroCard: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 18,
    alignItems: "center",
    marginBottom: 24,
  },
  heroIconContainer: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  heroIcon: {
    fontSize: 30,
  },
  heroContent: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.onPrimary,
  },
  heroText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.primaryLight,
    marginTop: 6,
  },
  section: {
    marginTop: 8,
  },
  gameCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceLowest,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 14,
    marginBottom: 12,
  },
  gameBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  gameBadgeText: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 18,
  },

  gameBadgeIcon: {
    fontSize: 26,
    lineHeight: 30,
  },
  gameContent: {
    flex: 1,
  },
  gameName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  gameDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 4,
  },
  arrow: {
    fontSize: 34,
    color: colors.primary,
    marginLeft: 8,
  },
});
export default GamePackGamesScreen;
