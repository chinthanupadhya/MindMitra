import type { ImageSourcePropType } from 'react-native';

export interface Monument {
  id: string;
  name: string;
  location: string;
  significance: string;
  image: string | ImageSourcePropType;
}

export const MONUMENTS: Monument[] = [
  {
    id: '1',
    name: 'Taj Mahal',
    location: 'Agra, Uttar Pradesh',
    significance: 'A symbol of eternal love built by Shah Jahan.',
    image: '🕌'
  },
  {
    id: '2',
    name: 'Red Fort',
    location: 'Delhi',
    significance: 'The main residence of the Mughal Emperors for nearly 200 years.',
    image: '🏰'
  },
  {
    id: '3',
    name: 'Hawa Mahal',
    location: 'Jaipur, Rajasthan',
    significance: 'Built with 953 windows so royal ladies could observe street festivals.',
    image: '🏯'
  },
  {
    id: '4',
    name: 'Qutub Minar',
    location: 'Delhi',
    significance: 'A UNESCO World Heritage site and the tallest brick minaret in the world.',
    image: '🗼'
  },
  {
    id: '5',
    name: 'Gateway of India',
    location: 'Mumbai, Maharashtra',
    significance: 'Erected to commemorate the landing of King George V in 1911.',
    image: '⛩️'
  },
  {
    id: '6',
    name: 'Lotus Temple',
    location: 'Delhi',
    significance: 'A Baháʼí House of Worship famous for its flowerlike shape.',
    image: '🪷'
  },
  {
    id: '7',
    name: 'Golden Temple',
    location: 'Amritsar, Punjab',
    significance: 'The holiest shrine in Sikhism, covered in pure gold.',
    image: '🕍'
  },
  {
    id: '8',
    name: 'Charminar',
    location: 'Hyderabad, Telangana',
    significance: 'Built in 1591 to celebrate the end of a deadly plague.',
    image: '🕌'
  },
  {
    id: '9',
    name: 'India Gate',
    location: 'Delhi',
    significance: 'A war memorial dedicated to the soldiers of the British Indian Army.',
    image: '🏛️'
  },
  {
    id: '10',
    name: 'Meenakshi Temple',
    location: 'Madurai, Tamil Nadu',
    significance: 'A historic Hindu temple covered with thousands of colorful stone figures.',
    image: '🛕'
  },
  {
    id: '11',
    name: 'Ellora Caves',
    location: 'Ellora, Maharashtra',
    significance: 'A UNESCO World Heritage site with ancient rock-cut temples.',
    image: require('../../assets/monuments_images/ellora_caves.png')
  }
];

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const useMonuments = () => {
  const [monuments, setMonuments] = useState<Monument[]>(MONUMENTS);
  const [customMonuments, setCustomMonuments] = useState<Monument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomMonuments();
  }, []);

  const loadCustomMonuments = async () => {
    try {
      const data = await AsyncStorage.getItem('custom_monuments');
      if (data) {
        const parsed = JSON.parse(data);
        setCustomMonuments(parsed);
        setMonuments([...MONUMENTS, ...parsed]);
      } else {
        setMonuments([...MONUMENTS]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addCustomMonument = async (monument: Monument) => {
    const updated = [...customMonuments, monument];
    setCustomMonuments(updated);
    setMonuments([...MONUMENTS, ...updated]);
    await AsyncStorage.setItem('custom_monuments', JSON.stringify(updated));
  };

  const updateCustomMonument = async (monument: Monument) => {
    const updated = customMonuments.map(m => m.id === monument.id ? monument : m);
    setCustomMonuments(updated);
    setMonuments([...MONUMENTS, ...updated]);
    await AsyncStorage.setItem('custom_monuments', JSON.stringify(updated));
  };

  const deleteCustomMonument = async (id: string) => {
    const updated = customMonuments.filter(m => m.id !== id);
    setCustomMonuments(updated);
    setMonuments([...MONUMENTS, ...updated]);
    await AsyncStorage.setItem('custom_monuments', JSON.stringify(updated));
  };

  return { monuments, customMonuments, loading, addCustomMonument, updateCustomMonument, deleteCustomMonument, loadCustomMonuments };
};

export interface QuizOption {
  id: string;
  label?: string;
  image?: string | ImageSourcePropType;
}

export interface Question {
  questionText: string;
  questionImage?: string | ImageSourcePropType;
  correctOptionId: string;
  options: QuizOption[];
}

export const generateMonumentQuestions = (selectedMonuments: Monument[], allMonuments: Monument[], numQuestions: number) => {
  const questions: Question[] = [];
  const usedSignatures = new Set<string>();

  let attempts = 0;
  while (questions.length < numQuestions && attempts < 1000) {
    attempts++;
    // Types: 0: Location, 1: Significance, 2: Identify Image, 3: True/False Location
    const qTypes = [0, 1, 2, 3];
    const qType = qTypes[Math.floor(Math.random() * qTypes.length)];
    
    const target = selectedMonuments[Math.floor(Math.random() * selectedMonuments.length)];
    const signature = `${qType}-${target.id}`;
    
    if (usedSignatures.has(signature)) continue;

    let q: Question | null = null;
    
    const getWrongMonuments = (excludeId: string, count: number) => {
      return selectedMonuments.filter(m => m.id !== excludeId).sort(() => Math.random() - 0.5).slice(0, count);
    };

    if (qType === 0) {
      // Ask for location
      const wrongs = getWrongMonuments(target.id, 3);
      const opts = [target, ...wrongs].sort(() => Math.random() - 0.5);
      
      q = {
        questionText: `Which monument is located in ${target.location}?`,
        correctOptionId: target.id,
        options: opts.map(m => ({ id: m.id, image: m.image }))
      };
    } 
    else if (qType === 1) {
      // Ask for significance
      const wrongs = getWrongMonuments(target.id, 3);
      const opts = [target, ...wrongs].sort(() => Math.random() - 0.5);
      q = {
        questionText: target.significance.replace('.', '?'),
        correctOptionId: target.id,
        options: opts.map(m => ({ id: m.id, image: m.image }))
      };
    }
    else if (qType === 2) {
      // Identify Image
      const wrongs = getWrongMonuments(target.id, 3);
      const opts = [target, ...wrongs].sort(() => Math.random() - 0.5);
      
      q = {
        questionText: `Which of these is the ${target.name}?`,
        correctOptionId: target.id,
        options: opts.map(m => ({ id: m.id, image: m.image }))
      };
    }
    else if (qType === 3) {
      // True/False Location
      const isTrue = Math.random() > 0.5;
      let statementLocation = target.location;

      if (!isTrue) {
        const other = selectedMonuments.find(m => m.id !== target.id);
        statementLocation = other ? other.location : 'a different city';
      }
      
      q = {
        questionText: `True or False: The ${target.name} is located in ${statementLocation}.`,
        questionImage: target.image,
        correctOptionId: isTrue ? 'true' : 'false',
        options: [
          { id: 'true', label: 'True' },
          { id: 'false', label: 'False' }
        ]
      };
    }

    if (q) {
      usedSignatures.add(signature);
      questions.push(q);
    }
  }
  
  return questions;
};
