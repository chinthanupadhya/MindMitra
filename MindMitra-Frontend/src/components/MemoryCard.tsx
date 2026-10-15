import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View, Image } from 'react-native';

interface MemoryCardProps {
  symbol: any;
  isFlipped: boolean;
  isMatched: boolean;
  onPress: () => void;
  cardSize: number;
}

export default function MemoryCard({ symbol, isFlipped, isMatched, onPress, cardSize }: MemoryCardProps) {
  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { width: cardSize, height: cardSize },
        isFlipped || isMatched ? styles.cardFlipped : styles.cardBack
      ]} 
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isFlipped || isMatched}
    >
      <View style={styles.cardContent}>
        {(isFlipped || isMatched) ? (
          <Image 
            source={symbol} 
            style={{ width: cardSize * 0.8, height: cardSize * 0.8 }} 
            resizeMode="contain" 
          />
        ) : (
          <Text style={[styles.questionMark, { fontSize: cardSize * 0.5 }]}>?</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: 5,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardBack: {
    backgroundColor: '#007AFF',
  },
  cardFlipped: {
    backgroundColor: '#fff',
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    textAlign: 'center',
  },
  questionMark: {
    textAlign: 'center',
    color: '#fff',
    fontWeight: 'bold',
  }
});
