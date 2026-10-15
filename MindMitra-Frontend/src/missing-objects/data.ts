import type { ImageSourcePropType } from 'react-native';

export type ImageSource = ImageSourcePropType;

export interface MissingObject {
  id: string;
  label: string;
  image: ImageSource;
  x: number;
  y: number;
}

export interface PuzzleSet {
  id: string;
  name: string;
  originalImage: ImageSource;
  alteredImage: ImageSource;
  aspectRatio: number;
  missingObjects: MissingObject[];
  decoyCount: number;
}

export type TrayItem =
  | ({ kind: 'missing' } & MissingObject)
  | ({ kind: 'decoy'; sourceSetId: string } & MissingObject);

export interface PlacedMarker {
  objectId: string;
  x: number;
  y: number;
  image: ImageSource;
  label: string;
}

import classroomOriginal from '@/assets/puzzles/classroom/original.png';
import classroomAltered from '@/assets/puzzles/classroom/altered.png';
import classroomFrog from '@/assets/puzzles/classroom/objects/frog.png';
import classroomPenstand from '@/assets/puzzles/classroom/objects/penstand.png';
import classroomBookstack from '@/assets/puzzles/classroom/objects/bookstack.png';

import kitchenOriginal from '@/assets/puzzles/kitchen/original.png';
import kitchenAltered from '@/assets/puzzles/kitchen/altered.png';
import kitchenMilk from '@/assets/puzzles/kitchen/objects/milk.png';
import kitchenPan from '@/assets/puzzles/kitchen/objects/pan.png';
import kitchenPot from '@/assets/puzzles/kitchen/objects/pot.png';

import oceanOriginal from '@/assets/puzzles/ocean/original.png';
import oceanAltered from '@/assets/puzzles/ocean/altered.png';
import oceanCrab from '@/assets/puzzles/ocean/objects/crab.png';
import oceanWhale from '@/assets/puzzles/ocean/objects/whale.png';
import oceanOctopus from '@/assets/puzzles/ocean/objects/octopus.png';

import parkOriginal from '@/assets/puzzles/park/original.png';
import parkAltered from '@/assets/puzzles/park/altered.png';
import parkStreetlamp from '@/assets/puzzles/park/objects/streetlamp.png';
import parkFrisbee from '@/assets/puzzles/park/objects/frisbee.png';

import shopOriginal from '@/assets/puzzles/shop/original.png';
import shopAltered from '@/assets/puzzles/shop/altered.png';
import shopCat from '@/assets/puzzles/shop/objects/cat.png';
import shopDuck from '@/assets/puzzles/shop/objects/duck.png';
import shopParrot from '@/assets/puzzles/shop/objects/parrot.png';

export const PUZZLE_SETS: PuzzleSet[] = [
  {
    id: 'classroom',
    name: 'The Classroom',
    originalImage: classroomOriginal,
    alteredImage: classroomAltered,
    aspectRatio: 1,
    decoyCount: 3,
    missingObjects: [
      { id: 'frog', label: 'Frog', image: classroomFrog, x: 0.334, y: 0.353 },
      { id: 'penstand', label: 'Pen Stand', image: classroomPenstand, x: 0.932, y: 0.473 },
      { id: 'bookstack', label: 'Book stack', image: classroomBookstack, x: 0.166, y: 0.794 },
    ],
  },
  {
    id: 'kitchen',
    name: 'The Kitchen Counter',
    originalImage: kitchenOriginal,
    alteredImage: kitchenAltered,
    aspectRatio: 0.7091503267973857,
    decoyCount: 3,
    missingObjects: [
      { id: 'milk', label: 'Milk', image: kitchenMilk, x: 0.723, y: 0.693 },
      { id: 'pan', label: 'Pan', image: kitchenPan, x: 0.184, y: 0.45 },
      { id: 'pot', label: 'Pot', image: kitchenPot, x: 0.855, y: 0.324 },
    ],
  },
  {
    id: 'ocean',
    name: 'The Ocean',
    originalImage: oceanOriginal,
    alteredImage: oceanAltered,
    aspectRatio: 0.9783616692426584,
    decoyCount: 3,
    missingObjects: [
      { id: 'crab', label: 'Crab', image: oceanCrab, x: 0.49, y: 0.867 },
      { id: 'whale', label: 'Whale', image: oceanWhale, x: 0.352, y: 0.154 },
      { id: 'octopus', label: 'Octopus', image: oceanOctopus, x: 0.873, y: 0.834 },
    ],
  },
  {
    id: 'park',
    name: 'The Park Path',
    originalImage: parkOriginal,
    alteredImage: parkAltered,
    aspectRatio: 1.3333333333333333,
    decoyCount: 2,
    missingObjects: [
      { id: 'streetlamp', label: 'Street Lamp', image: parkStreetlamp, x: 0.3125, y: 0.8 },
      { id: 'frisbee', label: 'Frisbee', image: parkFrisbee, x: 0.65, y: 0.9 },
    ],
  },
  {
    id: 'shop',
    name: 'Shop',
    originalImage: shopOriginal,
    alteredImage: shopAltered,
    aspectRatio: 0.7476744186046511,
    decoyCount: 3,
    missingObjects: [
      { id: 'cat', label: 'Cat', image: shopCat, x: 0.816, y: 0.624 },
      { id: 'duck', label: 'Duck', image: shopDuck, x: 0.052, y: 0.685 },
      { id: 'parrot', label: 'Parrot', image: shopParrot, x: 0.16, y: 0.109 },
    ],
  },
];

export function pickRandomPuzzleSet(sets: PuzzleSet[], excludeId?: string): PuzzleSet {
  const pool = excludeId && sets.length > 1 ? sets.filter((set) => set.id !== excludeId) : sets;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildTray(set: PuzzleSet, allSets: PuzzleSet[]): TrayItem[] {
  const missing: TrayItem[] = set.missingObjects.map((item) => ({ kind: 'missing', ...item }));

  const decoyPool: TrayItem[] = allSets
    .filter((gameSet) => gameSet.id !== set.id)
    .flatMap((gameSet) =>
      gameSet.missingObjects.map((item) => ({
        kind: 'decoy' as const,
        sourceSetId: gameSet.id,
        ...item,
        id: `${gameSet.id}:${item.id}`,
      }))
    );

  const decoyCount = Math.min(set.decoyCount, decoyPool.length);
  const decoys = shuffle(decoyPool).slice(0, decoyCount);

  return shuffle([...missing, ...decoys]);
}
