import { describe, it, expect } from 'vitest';
import { exactKey, baseKey, checkTurkishOverlap, matchWordCandidate } from './wordMatcher';
import { Word, Progress } from '../types';

describe('ADIM 2: Normalizasyon ve Eşleştirici Testleri', () => {
  describe('exactKey & baseKey', () => {
    it('exactKey lowercases, trims, collapses spaces, strips edge punctuation and PRESERVES "to "', () => {
      expect(exactKey('  Bear  ')).toBe('bear');
      expect(exactKey('To Bear')).toBe('to bear');
      expect(exactKey(' "clean" ')).toBe('clean');
      expect(exactKey('to   clean!')).toBe('to clean');
    });

    it('baseKey strips leading "to "', () => {
      expect(baseKey('to bear')).toBe('bear');
      expect(baseKey('bear')).toBe('bear');
      expect(baseKey('to clean')).toBe('clean');
    });
  });

  describe('checkTurkishOverlap', () => {
    it('checks bi-directional overlap with comma/semicolon/slash separation', () => {
      expect(checkTurkishOverlap('temizlemek, yıkamak', 'temizlemek')).toBe(true);
      expect(checkTurkishOverlap('temiz', 'temizlemek')).toBe(true);
      expect(checkTurkishOverlap('kitap', 'yer ayırtmak, rezervasyon')).toBe(false);
      expect(checkTurkishOverlap('fotoğraf', 'fotoğraf çekmek')).toBe(true);
    });
  });

  describe('matchWordCandidate with dictionary words', () => {
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

    it('Test 1: "bear" -> 135 (ayı)', () => {
      const res = matchWordCandidate('bear', '', mockWords);
      expect(res.type).toBe('exact');
      if (res.type === 'exact') {
        expect(res.word.id).toBe(135);
      }
    });

    it('Test 2: "to bear" -> 800 (taşımak, katlanmak)', () => {
      const res = matchWordCandidate('to bear', '', mockWords);
      expect(res.type).toBe('exact');
      if (res.type === 'exact') {
        expect(res.word.id).toBe(800);
      }
    });

    it('Test 3: "Bear " -> 135 (ayı)', () => {
      const res = matchWordCandidate('Bear ', '', mockWords);
      expect(res.type).toBe('exact');
      if (res.type === 'exact') {
        expect(res.word.id).toBe(135);
      }
    });

    it('Test 4: "abandon" when only "to abandon" exists -> 4883 (single_base)', () => {
      const res = matchWordCandidate('abandon', '', mockWords);
      expect(res.type).toBe('single_base');
      if (res.type === 'single_base') {
        expect(res.word.id).toBe(4883);
      }
    });

    it('Test 5 (Yeni Kural b/d): "book" entered with tr "kitap" when only "to book" exists -> ambiguous', () => {
      // User entered "book" (meaning book/kitap), but dictionary only has "to book" (reserve).
      // They do NOT match in Turkish, so it must NOT silently link to "to book"; must return ambiguous!
      const res = matchWordCandidate('book', 'kitap', mockWords);
      expect(res.type).toBe('ambiguous');
      if (res.type === 'ambiguous') {
        expect(res.candidates.length).toBe(1);
        expect(res.candidates[0].id).toBe(9999);
      }
    });

    it('Test 6 (Yeni Kural d): "clean" with tr "temizlemek, yıkamak" -> resolves to to clean (226)', () => {
      // User typed "to clean" or "clean" with verb tr
      const resVerb = matchWordCandidate('to clean', 'temizlemek, yıkamak', mockWords);
      expect(resVerb.type).toBe('exact');
      if (resVerb.type === 'exact') {
        expect(resVerb.word.id).toBe(226);
      }
    });

    it('Test 7 (Yeni Kural a): exactMatches.length > 1 picks most advanced progress', () => {
      // Duplicate words in dictionary with same exact name
      const dupWordA: Word = { id: 10, en: 'lead', tr: 'kurşun', categories: [], examples: [] };
      const dupWordB: Word = { id: 20, en: 'lead', tr: 'önderlik', categories: [], examples: [] };

      // Progress map: dupWordB has mastered progress, dupWordA is unstudied
      const progressMap = new Map<number, Progress>([
        [
          20,
          {
            wordId: 20,
            status: 'mastered',
            step: 5,
            streakDays: 10,
            dueDate: '2026-12-01',
            lapses: 0,
            totalCorrect: 10,
            totalWrong: 0,
            updatedAt: Date.now()
          }
        ]
      ]);

      const res = matchWordCandidate('lead', '', [dupWordA, dupWordB], progressMap);
      expect(res.type).toBe('exact');
      if (res.type === 'exact') {
        expect(res.word.id).toBe(20); // Picked 20 because it has mastered progress!
      }
    });
  });
});

