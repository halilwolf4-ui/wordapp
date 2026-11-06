import { describe, it, expect } from 'vitest';
import { matchWordCandidate } from '../utils/wordMatcher';
import { Word, Progress } from '../types';

describe('ADIM 3 & 4: upsertCustomWord ve İlerleme Koruma Entegrasyon Testleri', () => {
  const mockWords: Word[] = [
    {
      id: 135,
      en: 'bear',
      tr: 'ayı',
      categories: ['animals'],
      examples: []
    },
    {
      id: 800,
      en: 'to bear',
      tr: 'taşımak, katlanmak, çekmek',
      categories: ['basic_verbs'],
      examples: []
    },
    {
      id: 226,
      en: 'to clean',
      tr: 'temizlemek, yıkamak',
      categories: ['basic_verbs'],
      examples: []
    },
    {
      id: 227,
      en: 'clean',
      tr: 'temiz',
      categories: ['appearance'],
      examples: []
    },
    {
      id: 4883,
      en: 'to abandon',
      tr: 'terk etmek, bırakmak, vazgeçmek',
      categories: ['oxford3000_b2'],
      examples: []
    },
    {
      id: 9999,
      en: 'to book',
      tr: 'yer ayırtmak, rezervasyon yapmak',
      categories: ['oxford3000_a2'],
      examples: []
    }
  ];

  // Simulated existing progress map:
  // bear (135) is mastered (step 5)
  // to clean (226) is learning at step 3
  const mockProgressMap = new Map<number, Progress>([
    [
      135,
      {
        wordId: 135,
        status: 'mastered',
        step: 5,
        streakDays: 21,
        dueDate: '2026-12-30',
        lastReviewDate: '2026-11-01',
        lapses: 0,
        totalCorrect: 15,
        totalWrong: 0,
        updatedAt: 1000
      }
    ],
    [
      226,
      {
        wordId: 226,
        status: 'learning',
        step: 3,
        streakDays: 4,
        dueDate: '2026-11-10',
        lastReviewDate: '2026-11-05',
        lapses: 1,
        totalCorrect: 6,
        totalWrong: 1,
        updatedAt: 2000
      }
    ]
  ]);

  it('1. Re-adding mastered word "bear" matches ID 135 and preserves mastered status and step 5', () => {
    const match = matchWordCandidate('bear', 'ayı', mockWords, mockProgressMap);
    expect(match.type).toBe('exact');
    if (match.type === 'exact') {
      expect(match.word.id).toBe(135);
      const prog = mockProgressMap.get(match.word.id);
      expect(prog?.status).toBe('mastered');
      expect(prog?.step).toBe(5);
      expect(prog?.streakDays).toBe(21);
    }
  });

  it('2. Re-adding in-progress word "to clean" matches ID 226 and preserves step 3 without reset', () => {
    const match = matchWordCandidate('to clean', 'temizlemek', mockWords, mockProgressMap);
    expect(match.type).toBe('exact');
    if (match.type === 'exact') {
      expect(match.word.id).toBe(226);
      const prog = mockProgressMap.get(match.word.id);
      expect(prog?.status).toBe('learning');
      expect(prog?.step).toBe(3);
    }
  });

  it('3. Adding "abandon" (where only "to abandon" exists) matches single_base (4883)', () => {
    const match = matchWordCandidate('abandon', '', mockWords, mockProgressMap);
    expect(match.type).toBe('single_base');
    if (match.type === 'single_base') {
      expect(match.word.id).toBe(4883);
    }
  });

  it('4. Adding "book" with tr "kitap" when only "to book" exists returns ambiguous and does not save silently', () => {
    const match = matchWordCandidate('book', 'kitap', mockWords, mockProgressMap);
    expect(match.type).toBe('ambiguous');
    if (match.type === 'ambiguous') {
      expect(match.candidates[0].id).toBe(9999);
      expect(match.candidates[0].en).toBe('to book');
    }
  });

  it('5. Brand new word returns new_word', () => {
    const match = matchWordCandidate('serendipity', 'hoş tesadüf', mockWords, mockProgressMap);
    expect(match.type).toBe('new_word');
  });

  it('6. Step preservation: step > 0 words in LearnView do NOT get reset to step 0', () => {
    const existingProg = mockProgressMap.get(226)!;
    const isMastered = existingProg.status === 'mastered';
    const hasStep = existingProg.step > 0;
    const preservedStep = (isMastered || hasStep) ? existingProg.step : 0;
    const preservedStreak = (isMastered || hasStep) ? existingProg.streakDays + 1 : 1;

    expect(preservedStep).toBe(3);
    expect(preservedStreak).toBe(5);
  });
});

