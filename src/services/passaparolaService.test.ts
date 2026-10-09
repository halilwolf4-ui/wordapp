import { describe, it, expect } from 'vitest';
import { cleanEnglishWord, generatePassaparolaQuestions } from './passaparolaService';
import { Word, Progress } from '../types';

describe('passaparolaService', () => {
  it('cleanEnglishWord strips leading "to " properly', () => {
    expect(cleanEnglishWord('to associate')).toBe('associate');
    expect(cleanEnglishWord('To Run')).toBe('Run');
    expect(cleanEnglishWord('brain')).toBe('brain');
    expect(cleanEnglishWord('  to clean  ')).toBe('clean');
  });

  it('generates questions for letters and prioritizes learning progress', () => {
    const mockWords: Word[] = [
      { id: 1, en: 'to associate', tr: 'ilişkilendirmek', examples: [], categories: [] },
      { id: 2, en: 'apple', tr: 'elma', examples: [], categories: [] },
      { id: 3, en: 'brain', tr: 'beyin', examples: [], categories: [] },
      { id: 4, en: 'cat', tr: 'kedi', examples: [], categories: [] }
    ];

    const progressMap = new Map<number, Progress>();
    // Word 1 is currently in learning progress
    progressMap.set(1, {
      wordId: 1,
      step: 1,
      streakDays: 1,
      dueDate: '2026-10-09',
      status: 'learning',
      lapses: 0,
      totalCorrect: 1,
      totalWrong: 0,
      updatedAt: Date.now()
    });

    const questions = generatePassaparolaQuestions(mockWords, progressMap);

    // Question for 'A' should prioritize 'to associate' and display 'associate'
    const qA = questions.find(q => q.letter === 'A');
    expect(qA).toBeDefined();
    expect(qA?.displayWord).toBe('associate');
    expect(qA?.word.en).toBe('to associate');

    // Question for 'B' should be 'brain'
    const qB = questions.find(q => q.letter === 'B');
    expect(qB).toBeDefined();
    expect(qB?.displayWord).toBe('brain');
  });
});
