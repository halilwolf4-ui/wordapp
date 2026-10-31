import { describe, it, expect } from 'vitest';
import {
  checkSnakeAnswer,
  matchSingleTurkishMeaning,
  getSerpentinePointAtTime,
  SnakeQueueManager
} from './snakeGameService';
import { DEFAULT_SNAKE_CONFIG } from './snakeGameConfig';
import { Word } from '../types';

describe('snakeGameService - Advanced Verb Stem & Queue Rules', () => {
  it('matchSingleTurkishMeaning matches verbs with stem and root tolerance', () => {
    // Exact stem: genişle vs genişlemek
    expect(matchSingleTurkishMeaning('genişle', 'genişlemek')).toBe(true);
    // Causative variation: genişletmek vs genişlemek (shared root genişle >= 4)
    expect(matchSingleTurkishMeaning('genişletmek', 'genişlemek')).toBe(true);
    // Accent tolerance + verb stem
    expect(matchSingleTurkishMeaning('genisle', 'genişlemek')).toBe(true);
    // Kutlamak vs kutla
    expect(matchSingleTurkishMeaning('kutla', 'kutlamak')).toBe(true);
    // Negative test: unrelated words
    expect(matchSingleTurkishMeaning('elma', 'armut')).toBe(false);
  });

  it('checkSnakeAnswer supports full multi-meaning, synonyms and verb tolerance', () => {
    const word: Word = {
      id: 1,
      en: 'expand',
      tr: 'genişlemek, büyümek',
      examples: [],
      categories: ['oxford3000_b1']
    };

    // User writing 'genişle' should be accepted
    expect(checkSnakeAnswer('genişle', word).isCorrect).toBe(true);
    // User writing 'genişletmek' should be accepted
    expect(checkSnakeAnswer('genişletmek', word).isCorrect).toBe(true);
    // User writing 'büyümek' should be accepted
    expect(checkSnakeAnswer('büyümek', word).isCorrect).toBe(true);
    expect(checkSnakeAnswer('buyu', word).isCorrect).toBe(true);
  });

  it('SnakeQueueManager never repeats words in a game and provides unique questions', () => {
    const words: Word[] = [
      { id: 1, en: 'word1', tr: 'kelime1', examples: [], categories: ['oxford3000_b1'] },
      { id: 2, en: 'word2', tr: 'kelime2', examples: [], categories: ['oxford3000_b1'] },
      { id: 3, en: 'word3', tr: 'kelime3', examples: [], categories: ['oxford3000_b1'] },
      { id: 4, en: 'word4', tr: 'kelime4', examples: [], categories: ['oxford3000_b1'] },
      { id: 5, en: 'word5', tr: 'kelime5', examples: [], categories: ['oxford3000_b1'] },
      { id: 6, en: 'word6', tr: 'kelime6', examples: [], categories: ['oxford3000_b1'] },
      { id: 7, en: 'word7', tr: 'kelime7', examples: [], categories: ['oxford3000_b1'] },
      { id: 8, en: 'word8', tr: 'kelime8', examples: [], categories: ['oxford3000_b1'] }
    ];

    const manager = new SnakeQueueManager(words, new Map(), DEFAULT_SNAKE_CONFIG);

    const askedIds = new Set<number>();
    for (let i = 0; i < words.length; i++) {
      const w = manager.getNextWord();
      expect(askedIds.has(w.id)).toBe(false);
      askedIds.add(w.id);
      expect(manager.getAskedCount(w.id)).toBe(1);
      // Weak enqueue returns false (never re-asked)
      expect(manager.enqueueWeakWord(w)).toBe(false);
    }
  });

  it('getSerpentinePointAtTime handles distance > 60 without disappearing', () => {
    // When distance = 90 (surplus 30s), head is at top right waiting zone
    const pt90 = getSerpentinePointAtTime(90, DEFAULT_SNAKE_CONFIG);
    expect(pt90.x).toBeGreaterThanOrEqual(360);
    expect(pt90.x).toBeLessThanOrEqual(440);
    expect(pt90.y).toBe(20);
    expect(pt90.angle).toBe(180);
  });
});
