import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View, type ImageSourcePropType } from 'react-native';
import GameScreenHeader from '../../../components/GameScreenHeader';
import { generateMonumentQuestions, Monument, useMonuments } from '../../constants/monumentData';
import { useAuth } from '../../context/AuthContext';
import colors from '../../../theme/colors';
import { useTranslation } from '../../i18n/useTranslation';
import { supabase } from '../../lib/supabaseClient';
import { syncService } from '../../lib/syncService';

// Must match the real `games` row for Monuments (game_type = 'match_pairs').
const MONUMENTS_GAME_ID = '65adbc99-6e1f-4e60-aa86-afbde105fd16';

type Phase = 'learning' | 'quiz' | 'finished';

const renderMedia = (
  source: string | ImageSourcePropType | undefined,
  style: any,
  fallback?: React.ReactNode,
) => {
  if (!source) return fallback ?? null;

  if (typeof source === 'string') {
    if (source.startsWith('file://') || source.startsWith('http')) {
      return <Image source={{ uri: source }} style={style} />;
    }

    return fallback ?? <Text style={styles.optionLabel}>{source}</Text>;
  }

  return <Image source={source} style={style} />;
};

export default function MonumentGameScreen() {
  const { difficulty, src } = useLocalSearchParams();
  const router = useRouter();
  const { monuments, loading } = useMonuments();
  const { patient } = useAuth();
  const { t } = useTranslation();

  const isAi = src === 'ai';

  const [phase, setPhase] = useState<Phase>('learning');
  const [selectedMonuments, setSelectedMonuments] = useState<Monument[]>([]);
  const [learningIndex, setLearningIndex] = useState(0);
  
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState<number>(0);
  
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  useEffect(() => {
    if (!loading) {
      startGame();
    }
  }, [difficulty, loading]);

  const startGame = () => {
    let numMons = 3;
    let numQs = 5;
    if (difficulty === 'medium') { numMons = 5; numQs = 7; }
    if (difficulty === 'hard') { numMons = 7; numQs = 10; }

    const shuffled = [...monuments].sort(() => Math.random() - 0.5);
    const mons = shuffled.slice(0, numMons);
    
    setSelectedMonuments(mons);
    setQuestions(generateMonumentQuestions(mons, monuments, numQs));
    setPhase('learning');
    setLearningIndex(0);
    setCurrentQuestionIndex(0);
    setScore(0);
    setMistakes(0);
    setTimeTaken(0);
    setStartTime(null);
    setFeedback(null);
  };

  const handleNextLearning = () => {
    if (learningIndex < selectedMonuments.length - 1) {
      setLearningIndex(learningIndex + 1);
    } else {
      setPhase('quiz');
      setStartTime(Date.now());
    }
  };

  const handleAnswer = (selectedId: string) => {
    if (feedback !== null) return; 

    const isCorrect = selectedId === questions[currentQuestionIndex].correctOptionId;
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) {
      setScore(score + 1);
    } else {
      setMistakes(mistakes + 1);
    }

    setTimeout(() => {
      setFeedback(null);
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        setPhase('finished');
        const finalTimeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
        setTimeTaken(finalTimeTaken);
        saveRoundResult(finalTimeTaken, isCorrect ? score + 1 : score, isCorrect ? mistakes : mistakes + 1);
      }
    }, 1500);
  };

  const saveRoundResult = async (finalTimeTaken: number, finalScore: number, finalMistakes: number) => {
    if (!patient?.id) return;

    const totalQuestions = questions.length;
    const difficultyValue = 
      difficulty === 'easy' ? { locations: 3, questions: 5 } : 
      difficulty === 'medium' ? { locations: 5, questions: 7 } : 
      difficulty === 'hard' ? { locations: 7, questions: 10 } : { locations: 5, questions: 7 };

    await syncService.saveRound({
      user_id: patient.id,
      game_id: MONUMENTS_GAME_ID,
      difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
      difficulty_value: difficultyValue,
      time_taken_sec: finalTimeTaken,
      expected_time_sec: 45 + 5 * (difficultyValue.locations ?? 3) + 3 * (difficultyValue.questions ?? 5),
      total_attempts: totalQuestions,
      correct_count: finalScore,
      error_count: finalMistakes,
      error_types: finalMistakes > 0 ? ['wrong_answer'] : [],
      completed: true,
      accuracy: totalQuestions > 0 ? finalScore / totalQuestions : 0,
    });
  };

  if (loading || selectedMonuments.length === 0) return null;

  const saveQuitRound = async () => {
    if (!patient?.id) return;
    if (phase === 'learning' && score === 0 && mistakes === 0) return;

    const answered = score + mistakes;
    const difficultyValue =
      difficulty === 'easy' ? { locations: 3, questions: 5 } :
      difficulty === 'medium' ? { locations: 5, questions: 7 } :
      difficulty === 'hard' ? { locations: 7, questions: 10 } : { locations: 5, questions: 7 };

    await syncService.saveRound({
      user_id: patient.id,
      game_id: MONUMENTS_GAME_ID,
      difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
      difficulty_value: difficultyValue,
      time_taken_sec: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
      expected_time_sec: 45 + 5 * (difficultyValue.locations ?? 3) + 3 * (difficultyValue.questions ?? 5),
      total_attempts: answered > 0 ? answered : 1,
      correct_count: score,
      error_count: mistakes,
      error_types: mistakes > 0 ? ['wrong_answer'] : [],
      completed: false,
      accuracy: answered > 0 ? score / answered : 0,
    });
  };

  const handleBackPress = () => {
    Alert.alert(
      'Give up?',
      'Do you want to quit and return to the difficulty screen?',
      [
        { text: 'Continue playing', style: 'cancel' },
        { text: 'Give up', style: 'destructive', onPress: () => { saveQuitRound(); router.back(); } },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {phase === 'learning' && (
        <View style={styles.learningContainer}>
          <GameScreenHeader
            title="Monument Tour"
            subtitle="Learn about these famous places."
            onBackPress={handleBackPress}
          />
          <View style={styles.card}>
            {renderMedia(
              selectedMonuments[learningIndex].image,
              { width: 150, height: 150, borderRadius: 15, marginBottom: 20 },
              <Text style={styles.imagePlaceholder}>{typeof selectedMonuments[learningIndex].image === 'string' ? selectedMonuments[learningIndex].image : ''}</Text>
            )}
            <Text style={styles.name}>{selectedMonuments[learningIndex].name}</Text>
            
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Location:</Text>
              <Text style={styles.infoValue}>{selectedMonuments[learningIndex].location}</Text>
              
              <Text style={[styles.infoLabel, {marginTop: 10}]}>Fact:</Text>
              <Text style={[styles.infoValue, {fontSize: 20}]}>{selectedMonuments[learningIndex].significance}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleNextLearning}>
            <Text style={styles.buttonText}>
              {learningIndex < selectedMonuments.length - 1 ? 'Next Monument' : 'Start Quiz'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.progressText}>Monument {learningIndex + 1} of {selectedMonuments.length}</Text>
        </View>
      )}

      {phase === 'quiz' && (
        <ScrollView contentContainerStyle={styles.quizContainer}>
          <GameScreenHeader
            title="Monument Tour"
            subtitle={`Question ${currentQuestionIndex + 1} of ${questions.length}`}
            onBackPress={handleBackPress}
          />
          {questions[currentQuestionIndex].questionImage && renderMedia(
            questions[currentQuestionIndex].questionImage,
            { width: 100, height: 100, borderRadius: 10, marginTop: 20, marginBottom: -10 },
            <Text style={styles.questionImage}>{typeof questions[currentQuestionIndex].questionImage === 'string' ? questions[currentQuestionIndex].questionImage : ''}</Text>
          )}
          <Text style={styles.question}>{questions[currentQuestionIndex].questionText}</Text>
          
          <View style={styles.optionsGrid}>
            {questions[currentQuestionIndex].options.map((opt: any, index: number) => (
              <TouchableOpacity 
                key={`${opt.id}-${index}`} 
                style={[
                  styles.optionButton,
                  feedback === 'correct' && opt.id === questions[currentQuestionIndex].correctOptionId ? styles.optionCorrect : null,
                  feedback === 'incorrect' && opt.id !== questions[currentQuestionIndex].correctOptionId ? styles.optionIncorrect : null,
                ]}
                onPress={() => handleAnswer(opt.id)}
                disabled={feedback !== null}
              >
                {opt.image ? (
                  renderMedia(
                    opt.image,
                    { width: 80, height: 80, borderRadius: 10 },
                    <Text style={styles.optionImage}>{opt.label ?? (typeof opt.image === 'string' ? opt.image : '')}</Text>
                  )
                ) : (
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {feedback && (
            <Text style={[styles.feedbackText, { color: feedback === 'correct' ? '#34C759' : '#FF3B30' }]}>
              {feedback === 'correct' ? t("correct") : t("incorrect")}
            </Text>
          )}
        </ScrollView>
      )}

      {phase === 'finished' && (
        <View style={styles.finishedContainer}>
          <Text style={styles.phaseTitle}>Tour Complete</Text>
          <Text style={styles.scoreText}>You scored {score} out of {questions.length}</Text>
          <Text style={styles.metricText}>Mistakes: {mistakes}</Text>
          <Text style={styles.metricText}>{t("time_taken")}: {timeTaken}s</Text>
          
          <TouchableOpacity style={styles.button} onPress={startGame}>
            <Text style={styles.buttonText}>{t("play_again")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Back to Difficulties</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  learningContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  instruction: {
    fontSize: 20,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    width: '90%',
    marginBottom: 40,
  },
  imagePlaceholder: {
    fontSize: 100,
    marginBottom: 20,
  },
  name: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#FFF0F5',
    padding: 15,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 20,
    color: '#555',
  },
  infoValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FF1493',
    marginTop: 5,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 15,
    width: '90%',
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 60,
  },
  secondaryButton: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonText: {
    fontSize: 20,
    color: colors.onPrimary,
    fontWeight: 'bold',
  },
  progressText: {
    fontSize: 18,
    color: '#888',
    marginTop: 10,
  },
  quizContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  questionImage: {
    fontSize: 80,
    marginTop: 20,
    marginBottom: -10,
  },
  question: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  optionButton: {
    backgroundColor: 'white',
    padding: 20,
    margin: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    minWidth: 120,
    minHeight: 120,
  },
  optionCorrect: {
    backgroundColor: '#D4EDDA',
    borderColor: '#28A745',
    borderWidth: 3,
  },
  optionIncorrect: {
    backgroundColor: '#F8D7DA',
    borderColor: '#DC3545',
    borderWidth: 3,
  },
  optionImage: {
    fontSize: 60,
  },
  optionLabel: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  feedbackText: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 30,
  },
  finishedContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 28,
    color: '#555',
    marginBottom: 10,
  },
  metricText: {
    fontSize: 22,
    color: '#666',
    marginBottom: 10,
  },
  phaseHeader: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 10,
  },
});
