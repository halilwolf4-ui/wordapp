import { describe, it, expect } from 'vitest';
import { getWordEmoji, formatCorrectAnswer } from './wordEmoji';
import { Word } from '../types';

describe('wordEmoji', () => {
  it('deduplicates repetitive Turkish meanings', () => {
    expect(formatCorrectAnswer('yaşlanma, yaşlanma')).toBe('yaşlanma');
    expect(formatCorrectAnswer('vücut, beden, ceset')).toBe('vücut, beden, ceset');
    expect(formatCorrectAnswer('hata, hata, yanlış')).toBe('hata, yanlış');
  });

  it('matches ageing and related words accurately', () => {
    const word1: Word = { id: 1, en: 'ageing', tr: 'yaşlanma, yaşlanma', examples: [], categories: [] };
    expect(getWordEmoji(word1)).toBe('⏳');

    const word2: Word = { id: 2, en: 'aging', tr: 'yaşlanma', examples: [], categories: [] };
    expect(getWordEmoji(word2)).toBe('⏳');

    const word3: Word = { id: 3, en: 'old', tr: 'yaşlı', examples: [], categories: [] };
    expect(getWordEmoji(word3)).toBe('👴');
  });

  it('matches action verbs and advanced vocabulary accurately', () => {
    expect(getWordEmoji({ id: 10, en: 'to suggest', tr: 'önermek', examples: [], categories: [] })).toBe('💡');
    expect(getWordEmoji({ id: 11, en: 'to compensate', tr: 'telafi etmek', examples: [], categories: [] })).toBe('⚖️');
    expect(getWordEmoji({ id: 12, en: 'outbreak', tr: 'patlak verme', examples: [], categories: [] })).toBe('💥');
    expect(getWordEmoji({ id: 13, en: 'investment', tr: 'yatırım', examples: [], categories: [] })).toBe('📈');
    expect(getWordEmoji({ id: 14, en: 'institution', tr: 'kurum', examples: [], categories: [] })).toBe('🏛️');
    expect(getWordEmoji({ id: 15, en: 'immune', tr: 'bağışık', examples: [], categories: [] })).toBe('🛡️');
    expect(getWordEmoji({ id: 16, en: 'cognitive', tr: 'bilişsel', examples: [], categories: [] })).toBe('🧠');
    expect(getWordEmoji({ id: 17, en: 'disruption', tr: 'aksama', examples: [], categories: [] })).toBe('⚠️');
    expect(getWordEmoji({ id: 18, en: 'to accelerate', tr: 'hızlandırmak', examples: [], categories: [] })).toBe('⚡');
  });

  it('prioritizes user-defined custom emojis (single or multiple emojis)', () => {
    const customWord: Word = {
      id: 50,
      en: 'ageing',
      tr: 'yaşlanma',
      emoji: '👴👵',
      examples: [],
      categories: []
    };
    // Even though default for ageing is ⏳, user custom emoji 👴👵 must win!
    expect(getWordEmoji(customWord)).toBe('👴👵');
  });

  it('returns null when no confident emoji is found to avoid irrelevant emojis', () => {
    expect(getWordEmoji({ id: 99, en: 'nonetheless', tr: 'yine de', examples: [], categories: [] })).toBeNull();
  });
});
