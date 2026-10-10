import { describe, it, expect } from 'vitest';
import {
  cleanEnglishWord,
  getLocalFallbackHints,
  getWordHints,
  getMaxAllowedHints,
  LOCAL_ANTONYM_PAIRS
} from './hintService';
import { Word } from '../types';

describe('hintService', () => {
  it('cleanEnglishWord strips leading to and trims correctly', () => {
    expect(cleanEnglishWord('to hinder')).toBe('hinder');
    expect(cleanEnglishWord('TO STOP')).toBe('stop');
    expect(cleanEnglishWord('  to abandon  ')).toBe('abandon');
    expect(cleanEnglishWord('apple')).toBe('apple');
  });

  it('getLocalFallbackHints finds local antonym from curated list', () => {
    const word: Word = {
      id: 1,
      en: 'difficult',
      tr: 'zor, güç',
      examples: [],
      categories: ['oxford3000_a1']
    };

    const hints = getLocalFallbackHints(word, []);
    expect(hints.length).toBeGreaterThanOrEqual(1);
    const ant = hints.find(h => h.relation === 'antonym');
    expect(ant).toBeDefined();
    expect(ant?.word).toBe('easy');
  });

  it('getLocalFallbackHints finds matching Turkish concept from allWords', () => {
    const word1: Word = {
      id: 101,
      en: 'to hinder',
      tr: 'engel olmak, yavaşlatmak',
      examples: [],
      categories: []
    };

    const word2: Word = {
      id: 102,
      en: 'to prevent',
      tr: 'engel olmak, önlemek',
      examples: [],
      categories: []
    };

    const hints = getLocalFallbackHints(word1, [word1, word2]);
    expect(hints.some(h => h.word === 'to prevent')).toBe(true);
  });

  it('LOCAL_ANTONYM_PAIRS contains essential high-frequency pairs', () => {
    expect(LOCAL_ANTONYM_PAIRS.length).toBeGreaterThan(100);
    const hasGoodBad = LOCAL_ANTONYM_PAIRS.some(([a, b]) => a === 'good' && b === 'bad');
    const hasHotCold = LOCAL_ANTONYM_PAIRS.some(([a, b]) => a === 'cold' && b === 'hot');
    expect(hasGoodBad).toBe(true);
    expect(hasHotCold).toBe(true);
  });

  it('getWordHints returns hints with valid relation types', async () => {
    const sampleWord: Word = {
      id: 999,
      en: 'happy',
      tr: 'mutlu',
      examples: [],
      categories: []
    };

    const hints = await getWordHints(sampleWord, []);
    expect(Array.isArray(hints)).toBe(true);
    hints.forEach(hint => {
      expect(['synonym', 'similar', 'antonym']).toContain(hint.relation);
      expect(typeof hint.word).toBe('string');
      expect(hint.word.length).toBeGreaterThan(0);
    });
  });

  it('getMaxAllowedHints respects the user-defined progression rules', () => {
    // 1st encounter: NO hints allowed
    expect(getMaxAllowedHints(1)).toBe(0);
    expect(getMaxAllowedHints(0)).toBe(0);

    // 2nd encounter (bilemedi, 2. kez geldi): 1 hint allowed
    expect(getMaxAllowedHints(2)).toBe(1);

    // 3rd encounter (bilemedi, 3. kez geldi): 2 hints allowed
    expect(getMaxAllowedHints(3)).toBe(2);

    // 4th encounter (bilemedi, 4. kez geldi): 3 hints allowed
    expect(getMaxAllowedHints(4)).toBe(3);

    // 5th+ encounter: capped at 3 hints max
    expect(getMaxAllowedHints(5)).toBe(3);
    expect(getMaxAllowedHints(10)).toBe(3);
  });
});
