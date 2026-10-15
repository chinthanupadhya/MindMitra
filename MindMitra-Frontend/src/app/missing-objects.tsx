import React, { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts as useSpecialElite, SpecialElite_400Regular } from '@expo-google-fonts/special-elite';
import {
  useFonts as useDMSans,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

import { PUZZLE_SETS, PuzzleSet, pickRandomPuzzleSet } from '@/missing-objects/data';
import HomeScreen from '@/missing-objects/screens/HomeScreen';
import MemorizeScreen from '@/missing-objects/screens/MemorizeScreen';
import InvestigateScreen from '@/missing-objects/screens/InvestigateScreen';
import CaseClosedScreen from '@/missing-objects/screens/CaseClosedScreen';
import { colors } from '@/missing-objects/theme';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { syncService } from '@/lib/syncService';

// Must match the real `games` row for Missing Objects (game_type = 'missing_object').
const MISSING_OBJECTS_GAME_ID = 'f23f9c95-c873-4c2b-8cda-ff86ad72906c';

type Screen = 'home' | 'memorize' | 'investigate' | 'closed';

interface RoundResult {
  wrongAttempts: number;
  timeMs: number;
}

export default function MissingObjectsScreen() {
  const { src } = useLocalSearchParams();
  const [eliteLoaded] = useSpecialElite({ SpecialElite_400Regular });
  const [dmSansLoaded] = useDMSans({ DMSans_500Medium, DMSans_700Bold });

  const isAi = src === 'ai';

  const [screen, setScreen] = useState<Screen>('home');
  const [currentSet, setCurrentSet] = useState<PuzzleSet | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const { patient } = useAuth();

  const startNewRound = useCallback(() => {
    const next = pickRandomPuzzleSet(PUZZLE_SETS, currentSet?.id);
    setCurrentSet(next);
    setResult(null);
    setScreen('memorize');
  }, [currentSet]);

  const goToInvestigate = useCallback(() => setScreen('investigate'), []);

  const handleComplete = useCallback((res: RoundResult) => {
    setResult(res);
    setScreen('closed');

    if (patient?.id && currentSet) {
      const correctCount = currentSet.missingObjects.length;
      const errorCount = res.wrongAttempts;
      syncService.saveRound({
        user_id: patient.id,
        game_id: MISSING_OBJECTS_GAME_ID,
        difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
        difficulty_value: correctCount,
        time_taken_sec: res.timeMs / 1000,
        expected_time_sec: 30 + 10 * correctCount,
        total_attempts: correctCount + errorCount,
        correct_count: correctCount,
        error_count: errorCount,
        error_types: errorCount > 0 ? ['wrong_placement'] : [],
        completed: true,
        accuracy: correctCount + errorCount > 0 ? correctCount / (correctCount + errorCount) : 1,
      });
    }
  }, [patient?.id, currentSet]);

  const goHome = useCallback(() => setScreen('home'), []);

  if (!eliteLoaded || !dmSansLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        {screen === 'home' && <HomeScreen onStart={startNewRound} setCount={PUZZLE_SETS.length} />}
        {screen === 'memorize' && currentSet && (
          <MemorizeScreen set={currentSet} onReady={goToInvestigate} />
        )}
        {screen === 'investigate' && currentSet && (
          <InvestigateScreen set={currentSet} allSets={PUZZLE_SETS} onComplete={handleComplete} />
        )}
        {screen === 'closed' && currentSet && result && (
          <CaseClosedScreen
            set={currentSet}
            wrongAttempts={result.wrongAttempts}
            timeMs={result.timeMs}
            onPlayAgain={startNewRound}
            onHome={goHome}
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
  },
});
