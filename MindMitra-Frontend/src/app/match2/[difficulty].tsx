import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import GameScreenHeader from '../../../components/GameScreenHeader';
import MemoryCard from '../../components/MemoryCard';
import { useAuth } from '../../context/AuthContext';
import colors from '../../../theme/colors';
import { syncService } from '../../lib/syncService';

const IMAGES = [
  require('../../../assets/Match 2/Bag.png'),
  require('../../../assets/Match 2/Bell.png'),
  require('../../../assets/Match 2/BookStack.png'),
  require('../../../assets/Match 2/Butterfly.png'),
  require('../../../assets/Match 2/Clock.png'),
  require('../../../assets/Match 2/CoffeeCup.png'),
  require('../../../assets/Match 2/Cookies.png'),
  require('../../../assets/Match 2/Duck.png'),
  require('../../../assets/Match 2/Flower.png'),
  require('../../../assets/Match 2/GameDesigns.png'),
  require('../../../assets/Match 2/Glass.png'),
  require('../../../assets/Match 2/InkPen.png'),
  require('../../../assets/Match 2/Key.png'),
  require('../../../assets/Match 2/Sun.png'),
  require('../../../assets/Match 2/Telephone.png'),
  require('../../../assets/Match 2/ToothBrush.png'),
  require('../../../assets/Match 2/Tree.png'),
  require('../../../assets/Match 2/Umbrella.png'),
];

interface Card {
  id: string;
  symbol: any;
  isFlipped: boolean;
  isMatched: boolean;
}

export default function Match2GameScreen() {
  const { difficulty, pairs: customPairsParam, src } = useLocalSearchParams();
  const router = useRouter();
  const { patient } = useAuth();

  const isAi = src === 'ai';

  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isWon, setIsWon] = useState(false);
  const [numColumns, setNumColumns] = useState(3);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeTaken, setTimeTaken] = useState<number>(0);
  const [attempts, setAttempts] = useState<number>(0);
  const [wrongPairAttempts, setWrongPairAttempts] = useState<number>(0);
  const [pairCount, setPairCount] = useState<number>(0);

  useEffect(() => {
    initializeGame();
  }, [difficulty, customPairsParam]);

  const initializeGame = () => {
    let numPairs = 6; // easy (12 cards)
    if (difficulty === 'medium') numPairs = 10;
    else if (difficulty === 'hard') numPairs = 15;
    else if (difficulty === 'custom') {
      numPairs = parseInt(customPairsParam as string) || 18;
      if (numPairs > 18) numPairs = 18;
      if (numPairs < 1) numPairs = 1;
    }

    // Determine grid layout dynamically
    const totalCards = numPairs * 2;
    let cols = 3;
    if (totalCards > 30) cols = 6;
    else if (totalCards > 20) cols = 5;
    else if (totalCards > 12) cols = 4;
    
    setNumColumns(cols);

    // Shuffle and select images
    const shuffledImages = [...IMAGES].sort(() => Math.random() - 0.5).slice(0, numPairs);
    
    // Duplicate for pairs
    const pairs = [...shuffledImages, ...shuffledImages];
    
    // Shuffle cards
    const shuffledCards = pairs.sort(() => Math.random() - 0.5).map((symbol, index) => ({
      id: `${index}-${symbol}`,
      symbol,
      isFlipped: false,
      isMatched: false,
    }));

    setCards(shuffledCards);
    setFlippedIndices([]);
    setIsWon(false);
    setStartTime(Date.now());
    setTimeTaken(0);
    setAttempts(0);
    setWrongPairAttempts(0);
    setPairCount(numPairs);
  };

  const handleCardPress = (index: number) => {
    // Prevent pressing if 2 cards are already flipped, or if it's already flipped/matched
    if (flippedIndices.length >= 2 || cards[index].isFlipped || cards[index].isMatched) {
      return;
    }

    setAttempts(prev => prev + 1);
    const newFlippedIndices = [...flippedIndices, index];
    setFlippedIndices(newFlippedIndices);

    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);

    if (newFlippedIndices.length === 2) {
      const [firstIndex, secondIndex] = newFlippedIndices;
      if (newCards[firstIndex].symbol === newCards[secondIndex].symbol) {
        // Match found
        setTimeout(() => {
          setCards(prevCards => {
            const updatedCards = [...prevCards];
            updatedCards[firstIndex].isMatched = true;
            updatedCards[secondIndex].isMatched = true;
            
            // Check win condition
            if (updatedCards.every(c => c.isMatched)) {
              setIsWon(true);
              if (startTime) {
                const finalTimeTaken = Math.floor((Date.now() - startTime) / 1000);
                setTimeTaken(finalTimeTaken);
                saveRoundResult(finalTimeTaken);
              }
            }
            return updatedCards;
          });
          setFlippedIndices([]);
        }, 500);
      } else {
        // No match
        setWrongPairAttempts(prev => prev + 1);
        setTimeout(() => {
          setCards(prevCards => {
            const updatedCards = [...prevCards];
            updatedCards[firstIndex].isFlipped = false;
            updatedCards[secondIndex].isFlipped = false;
            return updatedCards;
          });
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  // MATCH_2_GAME_ID must match a real row in the `games` table (game_type =
  // 'match_pairs'). Writes one row per completed game to `rounds` — this is
  // the table the AI difficulty/progress models read from, so a round with
  // no write here means the AI side has nothing to learn from this play.
  const MATCH_2_GAME_ID = 'c2325c82-87aa-47fc-9b08-569b5d135694';

  const saveRoundResult = async (finalTimeTaken: number) => {
    if (!patient?.id) return; // no logged-in patient session — nothing to attribute this to

    const totalPairAttempts = pairCount + wrongPairAttempts;
    const accuracy = totalPairAttempts > 0 ? pairCount / totalPairAttempts : 1;

    const difficultyValue = pairCount;

    await syncService.saveRound({
      user_id: patient.id,
      game_id: MATCH_2_GAME_ID,
      difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
      difficulty_value: difficultyValue,
      time_taken_sec: finalTimeTaken,
      expected_time_sec: 30 + 5 * pairCount, // 6 pairs=60s, 10=80s, 15=105s
      total_attempts: totalPairAttempts,
      correct_count: pairCount,
      error_count: wrongPairAttempts,
      error_types: wrongPairAttempts > 0 ? ['wrong_pair'] : [],
      completed: true,
      accuracy
    });
  };

  const saveQuitRound = async () => {
    if (!patient?.id || pairCount === 0) return;

    const matchedSoFar = cards.filter(c => c.isMatched).length / 2;
    const totalPairAttempts = pairCount + wrongPairAttempts;

    await syncService.saveRound({
      user_id: patient.id,
      game_id: MATCH_2_GAME_ID,
      difficulty_source: isAi ? 'ai_recommended' : 'user_selected_preset',
      difficulty_value: pairCount,
      time_taken_sec: startTime ? Math.floor((Date.now() - startTime) / 1000) : 0,
      expected_time_sec: 30 + 5 * pairCount,
      total_attempts: totalPairAttempts,
      correct_count: matchedSoFar,
      error_count: wrongPairAttempts,
      error_types: wrongPairAttempts > 0 ? ['wrong_pair'] : [],
      completed: false,
      accuracy: totalPairAttempts > 0 ? matchedSoFar / totalPairAttempts : 0,
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

  const screenWidth = Dimensions.get('window').width;
  // Dynamic card size based on columns, minus margins
  const cardSize = Math.floor(screenWidth / numColumns) - 16; 

  return (
    <SafeAreaView style={styles.container}>
      {isWon ? (
        <View style={styles.winContainer}>
          <Text style={styles.winText}>Great Job!</Text>
          <Text style={styles.timeText}>Time taken: {timeTaken} seconds</Text>
          <Text style={styles.timeText}>Total attempts: {attempts}</Text>
          <TouchableOpacity style={styles.button} onPress={initializeGame}>
            <Text style={styles.buttonText}>Play Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={() => router.back()}>
            <Text style={styles.buttonText}>Back to Difficulties</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.gameContainer}>
          <GameScreenHeader
            title="Match 2"
            subtitle="Match the pairs to clear the board"
            onBackPress={handleBackPress}
          />
          <FlatList
            key={numColumns} // Force re-render if columns change
            data={cards}
            numColumns={numColumns}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item, index }) => (
              <MemoryCard
                symbol={item.symbol}
                isFlipped={item.isFlipped}
                isMatched={item.isMatched}
                onPress={() => handleCardPress(index)}
                cardSize={cardSize}
              />
            )}
          />
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
  gameContainer: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  winContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  winText: {
    fontSize: 44,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 20,
  },
  timeText: {
    fontSize: 24,
    color: '#555',
    marginBottom: 40,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 15,
    marginVertical: 10,
    width: '100%',
    alignItems: 'center',
    minHeight: 64,
  },
  secondaryButton: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonText: {
    fontSize: 22,
    color: colors.onPrimary,
    fontWeight: 'bold',
  },
});
