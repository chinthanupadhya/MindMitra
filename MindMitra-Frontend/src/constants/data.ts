import type { ImageSourcePropType } from 'react-native';

export interface Trait {
  value: string;
  type: 'hobby' | 'like' | 'dislike';
}

export interface Character {
  id: string;
  name: string;
  image: string | ImageSourcePropType;
  traits: Trait[];
  profession: string;
  favoriteColor: string;
}

export interface GameCharacter extends Character {
  displayTrait: Trait;
}

export const DEFAULT_CHARACTERS: Character[] = [
  { 
    id: '1', name: 'Alice', image: '👱‍♀️', profession: 'Teacher', favoriteColor: 'Blue',
    traits: [
      { value: 'reading books', type: 'hobby' },
      { value: 'sweet tea', type: 'like' },
      { value: 'loud music', type: 'dislike' }
    ]
  },
  { 
    id: '2', name: 'Bob', image: '👨‍🦰', profession: 'Chef', favoriteColor: 'Red',
    traits: [
      { value: 'spicy food', type: 'like' },
      { value: 'cooking shows', type: 'hobby' },
      { value: 'fast food', type: 'dislike' }
    ]
  },
  { 
    id: '3', name: 'Charlie', image: '👴', profession: 'Accountant', favoriteColor: 'Green',
    traits: [
      { value: 'loud noises', type: 'dislike' },
      { value: 'gardening', type: 'hobby' },
      { value: 'classical music', type: 'like' }
    ]
  },
  { 
    id: '4', name: 'Diana', image: '👩‍🦳', profession: 'Florist', favoriteColor: 'Yellow',
    traits: [
      { value: 'gardening', type: 'hobby' },
      { value: 'sunny days', type: 'like' },
      { value: 'insects', type: 'dislike' }
    ]
  },
  { 
    id: '5', name: 'Eve', image: '👩‍🦱', profession: 'Lifeguard', favoriteColor: 'Teal',
    traits: [
      { value: 'swimming', type: 'hobby' },
      { value: 'the beach', type: 'like' },
      { value: 'winter', type: 'dislike' }
    ]
  },
  { 
    id: '6', name: 'Frank', image: '👨‍🦲', profession: 'Pilot', favoriteColor: 'White',
    traits: [
      { value: 'cold weather', type: 'dislike' },
      { value: 'traveling', type: 'hobby' },
      { value: 'airplanes', type: 'like' }
    ]
  },
  { 
    id: '7', name: 'Grace', image: '👵', profession: 'Baker', favoriteColor: 'Pink',
    traits: [
      { value: 'baking cakes', type: 'hobby' },
      { value: 'sweet treats', type: 'like' },
      { value: 'burnt toast', type: 'dislike' }
    ]
  },
  { 
    id: '8', name: 'Harry', image: '👱‍♂️', profession: 'Mechanic', favoriteColor: 'Black',
    traits: [
      { value: 'classic rock music', type: 'like' },
      { value: 'fixing cars', type: 'hobby' },
      { value: 'traffic jams', type: 'dislike' }
    ]
  },
  { 
    id: '9', name: 'Ivy', image: '👩‍🦰', profession: 'Artist', favoriteColor: 'Purple',
    traits: [
      { value: 'waking up early', type: 'dislike' },
      { value: 'painting', type: 'hobby' },
      { value: 'museums', type: 'like' }
    ]
  },
  { 
    id: '10', name: 'Jack', image: '🧔', profession: 'Software Engineer', favoriteColor: 'Orange',
    traits: [
      { value: 'playing chess', type: 'hobby' },
      { value: 'puzzles', type: 'like' },
      { value: 'losing games', type: 'dislike' }
    ]
  },
  { 
    id: '11', name: 'Mary Kom', image: require('../../assets/meet_greet/mary_kom.png'), profession: 'Boxer', favoriteColor: 'Red',
    traits: [
      { value: 'Boxing', type: 'hobby' },
      { value: 'Noodles', type: 'like' },
      { value: 'Losing', type: 'dislike' }
    ]
  },
];

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const useCharacters = () => {
  const [characters, setCharacters] = useState<Character[]>(DEFAULT_CHARACTERS);
  const [customCharacters, setCustomCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomCharacters();
  }, []);

  const loadCustomCharacters = async () => {
    try {
      const data = await AsyncStorage.getItem('custom_characters');
      if (data) {
        const parsed = JSON.parse(data);
        setCustomCharacters(parsed);
        setCharacters([...DEFAULT_CHARACTERS, ...parsed]);
      } else {
        setCharacters([...DEFAULT_CHARACTERS]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addCustomCharacter = async (char: Character) => {
    const updated = [...customCharacters, char];
    setCustomCharacters(updated);
    setCharacters([...DEFAULT_CHARACTERS, ...updated]);
    await AsyncStorage.setItem('custom_characters', JSON.stringify(updated));
  };

  const updateCustomCharacter = async (char: Character) => {
    const updated = customCharacters.map(c => c.id === char.id ? char : c);
    setCustomCharacters(updated);
    setCharacters([...DEFAULT_CHARACTERS, ...updated]);
    await AsyncStorage.setItem('custom_characters', JSON.stringify(updated));
  };

  const deleteCustomCharacter = async (id: string) => {
    const updated = customCharacters.filter(c => c.id !== id);
    setCustomCharacters(updated);
    setCharacters([...DEFAULT_CHARACTERS, ...updated]);
    await AsyncStorage.setItem('custom_characters', JSON.stringify(updated));
  };

  return { characters, customCharacters, loading, addCustomCharacter, updateCustomCharacter, deleteCustomCharacter, loadCustomCharacters };
};

export interface QuizOption {
  id: string;
  label?: string; // Text to display (Name, True/False)
  image?: string | ImageSourcePropType; // Emoji or bundled image
}

export interface Question {
  questionText: string;
  questionImage?: string | ImageSourcePropType; // Emoji or bundled image in the question prompt (if applicable)
  correctOptionId: string;
  options: QuizOption[];
}

export const generateQuestions = (selectedCharacters: GameCharacter[], allCharacters: Character[], numQuestions: number, difficulty: string) => {
  const questions: Question[] = [];
  const unmetCharacters = allCharacters.filter(c => !selectedCharacters.find(sc => sc.id === c.id));
  
  const usedSignatures = new Set<string>();

  let attempts = 0;
  while (questions.length < numQuestions && attempts < 1000) {
    attempts++;
    const qTypes = difficulty === 'hard' ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
    const qType = qTypes[Math.floor(Math.random() * qTypes.length)];
    
    // Pick target
    const targetChar = selectedCharacters[Math.floor(Math.random() * selectedCharacters.length)];
    const signature = `${qType}-${targetChar.id}`;
    
    if (usedSignatures.has(signature)) continue;

    let q: Question | null = null;
    
    const getWrongChars = (excludeId: string, count: number) => {
      return selectedCharacters.filter(c => c.id !== excludeId).sort(() => Math.random() - 0.5).slice(0, count);
    };

    if (qType === 0) {
      // Trait based
      let qt = '';
      if (targetChar.displayTrait.type === 'hobby') qt = `Who enjoys ${targetChar.displayTrait.value}?`;
      else if (targetChar.displayTrait.type === 'like') qt = `Who likes ${targetChar.displayTrait.value}?`;
      else qt = `Who dislikes ${targetChar.displayTrait.value}?`;

      const wrongs = getWrongChars(targetChar.id, 3);
      const opts = [targetChar, ...wrongs].sort(() => Math.random() - 0.5);
      
      q = {
        questionText: qt,
        correctOptionId: targetChar.id,
        options: opts.map(c => ({ id: c.id, image: c.image }))
      };
    } 
    else if (qType === 1) {
      // Identify Name
      const wrongs = getWrongChars(targetChar.id, 3);
      const opts = [targetChar, ...wrongs].sort(() => Math.random() - 0.5);
      q = {
        questionText: `Identify ${targetChar.name}`,
        correctOptionId: targetChar.id,
        options: opts.map(c => ({ id: c.id, image: c.image }))
      };
    }
    else if (qType === 2) {
      // Negation
      if (unmetCharacters.length === 0) continue;
      const unmet = unmetCharacters[Math.floor(Math.random() * unmetCharacters.length)];
      const sig2 = `2-${unmet.id}`;
      if (usedSignatures.has(sig2)) continue;

      const wrongs = selectedCharacters.sort(() => Math.random() - 0.5).slice(0, 3);
      const opts = [unmet, ...wrongs].sort(() => Math.random() - 0.5);

      q = {
        questionText: `Which of the following characters have you not met?`,
        correctOptionId: unmet.id,
        options: opts.map(c => ({ id: c.id, image: c.image }))
      };
      usedSignatures.add(sig2);
    }
    else if (qType === 3) {
      // Name to Face
      const wrongs = getWrongChars(targetChar.id, 3);
      const opts = [targetChar, ...wrongs].sort(() => Math.random() - 0.5);
      
      q = {
        questionText: `What is this person's name?`,
        questionImage: targetChar.image,
        correctOptionId: targetChar.id,
        options: opts.map(c => ({ id: c.id, label: c.name }))
      };
    }
    else if (qType === 4) {
      // True/False
      const isTrue = Math.random() > 0.5;
      let statementTrait = targetChar.displayTrait.value;
      let verb = targetChar.displayTrait.type === 'hobby' ? 'enjoys' : targetChar.displayTrait.type === 'like' ? 'likes' : 'dislikes';

      if (!isTrue) {
        // Pick a random display trait from ANOTHER selected character
        const otherChar = selectedCharacters.find(c => c.id !== targetChar.id);
        statementTrait = otherChar ? otherChar.displayTrait.value : 'eating rocks';
        verb = otherChar ? (otherChar.displayTrait.type === 'hobby' ? 'enjoys' : otherChar.displayTrait.type === 'like' ? 'likes' : 'dislikes') : 'likes';
      }
      
      q = {
        questionText: `True or False: This person ${verb} ${statementTrait}.`,
        questionImage: targetChar.image,
        correctOptionId: isTrue ? 'true' : 'false',
        options: [
          { id: 'true', label: 'True' },
          { id: 'false', label: 'False' }
        ]
      };
    }
    else if (qType === 5) {
      // Profession
      const wrongs = getWrongChars(targetChar.id, 3);
      const opts = [targetChar, ...wrongs].sort(() => Math.random() - 0.5);
      
      q = {
        questionText: `Who works as a ${targetChar.profession}?`,
        correctOptionId: targetChar.id,
        options: opts.map(c => ({ id: c.id, image: c.image }))
      };
    }
    else if (qType === 6) {
      // Favorite Color
      const wrongs = getWrongChars(targetChar.id, 3);
      const opts = [targetChar, ...wrongs].sort(() => Math.random() - 0.5);
      
      q = {
        questionText: `Whose favorite color is ${targetChar.favoriteColor}?`,
        correctOptionId: targetChar.id,
        options: opts.map(c => ({ id: c.id, image: c.image }))
      };
    }

    if (q && qType !== 2) {
      usedSignatures.add(signature);
    }
    if (q) {
      questions.push(q);
    }
  }
  
  return questions;
};
