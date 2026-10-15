import React, { useState, useEffect, useRef } from 'react';
import { Alert, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

import GameScreenHeader from '../../../components/GameScreenHeader';
import { useAuth } from '../../context/AuthContext';
import colors from '../../../theme/colors';
import { useTranslation } from '../../i18n/useTranslation';
import { supabase } from '../../lib/supabaseClient';
import { syncService } from '../../lib/syncService';

// Must match the real `games` row for Sequence (game_type = 'sequence_match').
const SEQUENCE_GAME_ID = 'f6832a47-78fc-49d5-81cc-c2b1418f9d08';

type GameState = 'intro' | 'showing_sequence' | 'waiting_for_input' | 'game_over';

export default function SequenceGameScreen() {
  const router = useRouter();
  const { src } = useLocalSearchParams();
  const { patient } = useAuth();
  const { t } = useTranslation();

  const isAi = src === 'ai';

  const [gameState, setGameState] = useState<GameState>('intro');
  const [sequence, setSequence] = useState<number[]>([]);
  const [userStep, setUserStep] = useState(0);
  const [activeSquare, setActiveSquare] = useState<number | null>(null);
  const [wrongSquare, setWrongSquare] = useState<number | null>(null);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(1);
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);

  // Using refs to prevent stale state issues in timeouts
  const sequenceRef = useRef<number[]>([]);
  const userStepRef = useRef(0);
  const gameStateRef = useRef<GameState>('intro');
  // Need a ref to track if we're unmounted to prevent state updates on unmounted component
  const mountedRef = useRef(true);

  useEffect(() => {
    sequenceRef.current = sequence;
    userStepRef.current = userStep;
    gameStateRef.current = gameState;
  }, [sequence, userStep, gameState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const startGame = () => {
    const startSeq = [Math.floor(Math.random() * 9)];
    setSequence(startSeq);
    sequenceRef.current = startSeq;
    setLevel(1);
    setWrongSquare(null);
    setRoundStartTime(Date.now());
    startShowingSequence(startSeq);
  };

  const startShowingSequence = (currentSeq: number[]) => {
    setGameState('showing_sequence');
    setUserStep(0);
    userStepRef.current = 0;
    
    let i = 0;
    
    // Initial delay before showing
    setTimeout(() => {
      const showNext = () => {
        if (!mountedRef.current) return;
        if (gameStateRef.current !== 'showing_sequence') return; // Cancel if state changed (e.g. unmount)
        
        if (i < currentSeq.length) {
          setActiveSquare(currentSeq[i]);
          
          setTimeout(() => {
            if (!mountedRef.current) return;
            setActiveSquare(null);
            i++;
            setTimeout(showNext, 200); // Wait 200ms before showing next square
          }, 400); // Show square for 400ms
        } else {
          setGameState('waiting_for_input');
        }
      };
      
      showNext();
    }, 800);
  };

  const handleSquarePress = (index: number) => {
    if (gameState !== 'waiting_for_input') return;

    const currentSeq = sequenceRef.current;
    const currentStep = userStepRef.current;

    if (index === currentSeq[currentStep]) {
      // Correct!
      setActiveSquare(index);
      setTimeout(() => {
        if (mountedRef.current) setActiveSquare(null);
      }, 200);
      
      const nextStep = currentStep + 1;
      setUserStep(nextStep);
      
      if (nextStep === currentSeq.length) {
        // Level passed!
        setGameState('showing_sequence'); // temporarily disable input
        setTimeout(() => {
          if (!mountedRef.current) return;
          const newSeq = [...currentSeq, Math.floor(Math.random() * 9)];
          setSequence(newSeq);
          setLevel(level + 1);
          startShowingSequence(newSeq);
        }, 800);
      }
    } else {
      // Wrong!
      setWrongSquare(index);
      setGameState('game_over');
      if (level > highScore) {
        setHighScore(level);
      }
      saveRoundResult();
    }
  };

  const saveRoundResult = async () => {
    if (!patient?.id) return; // no logged-in patient session — nothing to attribute this to

    const levelsCompleted = Math.max(level - 1, 0);
    const totalAttempted = level;
    const timeTaken = roundStartTime ? (Date.now() - roundStartTime) / 1000 : null;

    syncService.saveRound({
      user_id: patient.id,
      game_id: SEQUENCE_GAME_ID,
      difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
      difficulty_value: level,
      time_taken_sec: timeTaken ?? 0,
      expected_time_sec: 45 + 6 * level,
      total_attempts: totalAttempted,
      correct_count: levelsCompleted,
      error_count: 1,
      error_types: ['wrong_square'],
      completed: true,
      accuracy: totalAttempted > 0 ? levelsCompleted / totalAttempted : 0,
    });
  };

  const renderGrid = () => {
    const squares = [];
    for (let i = 0; i < 9; i++) {
      let squareStyle: any[] = [styles.square];
      
      if (activeSquare === i) {
        squareStyle.push(styles.squareActive);
      } else if (wrongSquare === i) {
        squareStyle.push(styles.squareWrong);
      }

      squares.push(
        <TouchableOpacity
          key={i}
          style={squareStyle}
          activeOpacity={0.7}
          onPress={() => handleSquarePress(i)}
          disabled={gameState !== 'waiting_for_input'}
        />
      );
    }
    return <View style={styles.grid}>{squares}</View>;
  };

  const saveQuitRound = async () => {
    if (!patient?.id || gameState === 'intro') return;

    const levelsCompleted = Math.max(level - 1, 0);
    const totalAttempted = level;
    const timeTaken = roundStartTime ? (Date.now() - roundStartTime) / 1000 : 0;

    await syncService.saveRound({
      user_id: patient.id,
      game_id: SEQUENCE_GAME_ID,
      difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
      difficulty_value: level,
      time_taken_sec: timeTaken,
      expected_time_sec: 45 + 6 * level,
      total_attempts: totalAttempted,
      correct_count: levelsCompleted,
      error_count: 1,
      error_types: ['wrong_square'],
      completed: false,
      accuracy: totalAttempted > 0 ? levelsCompleted / totalAttempted : 0,
    });
  };

  const handleBackPress = () => {
    Alert.alert(
      'Give up?',
      'Do you want to quit and return to the home screen?',
      [
        { text: 'Continue playing', style: 'cancel' },
        { text: 'Give up', style: 'destructive', onPress: () => { saveQuitRound(); router.back(); } },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      {gameState === 'intro' && (
        <View style={styles.centerContainer}>
          <GameScreenHeader
            title="Sequence Memory"
            subtitle="Memorize the pattern."
            onBackPress={handleBackPress}
          />
          <TouchableOpacity style={styles.button} onPress={startGame}>
            <Text style={styles.buttonText}>Start Game</Text>
          </TouchableOpacity>
        </View>
      )}

      {(gameState === 'showing_sequence' || gameState === 'waiting_for_input') && (
        <View style={styles.gameContainer}>
          <GameScreenHeader
            title="Sequence Memory"
            onBackPress={handleBackPress}
            rightContent={
              <Text style={styles.headerLevel}>{t("level")}: {level}</Text>
            }
          />
          <Text style={styles.statusText}>
            {gameState === 'showing_sequence' ? 'Watch the sequence...' : t("your_turn") + '!'}
          </Text>
          {renderGrid()}
        </View>
      )}

      {gameState === 'game_over' && (
        <View style={styles.centerContainer}>
          <Text style={styles.gameOverTitle}>Game Over</Text>
          <Text style={styles.scoreText}>Level Reached: {level}</Text>
          <Text style={styles.scoreText}>High Score: {highScore}</Text>
          {renderGrid()}
          <TouchableOpacity style={[styles.button, { marginTop: 40 }]} onPress={startGame}>
            <Text style={styles.buttonText}>{t("play_again")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => router.back()}>
            <Text style={[styles.buttonText, { color: 'white' }]}>{t("home")}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const screenWidth = Dimensions.get('window').width;
const gridSize = Math.min(screenWidth - 40, 400); // max 400px
const squareSize = (gridSize - 20) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2b87d1', // Human benchmark style blue
  },
  headerLevel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instruction: {
    fontSize: 24,
    color: 'white',
    marginBottom: 50,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 30,
  },
  grid: {
    width: gridSize,
    height: gridSize,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'space-between',
  },
  square: {
    width: squareSize,
    height: squareSize,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    marginBottom: 10,
  },
  squareActive: {
    backgroundColor: 'white',
  },
  squareWrong: {
    backgroundColor: '#FF3B30', // Red for wrong
  },
  gameOverTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  scoreText: {
    fontSize: 28,
    color: 'white',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#FFD700', // Gold/yellow button
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 15,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: 'bold',
  },
});
