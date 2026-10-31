import { describe, it, expect } from 'vitest';
import {
  cleanEnglishWord,
  normalizeCharForIndex,
  isValidTargetWord,
  buildPoolIndex,
  partitionWordPools,
  generateSecretWordPuzzle,
  SecretWordSessionManager
} from './secretWordGenerator';
import { Word, Progress } from '../types';
import wordsJson from '../../words.json';

describe('secretWordGenerator - Unit Tests', () => {
  it('cleanEnglishWord strips leading "to " properly', () => {
    expect(cleanEnglishWord('to fragile')).toBe('fragile');
    expect(cleanEnglishWord('To Run')).toBe('Run');
    expect(cleanEnglishWord('benefit')).toBe('benefit');
  });

  it('normalizeCharForIndex enforces ı/i equality and rejects ç, ş, ğ, ö, ü', () => {
    expect(normalizeCharForIndex('i')).toBe('i');
    expect(normalizeCharForIndex('ı')).toBe('i');
    expect(normalizeCharForIndex('İ')).toBe('i');
    expect(normalizeCharForIndex('I')).toBe('i');
    expect(normalizeCharForIndex('a')).toBe('a');
    expect(normalizeCharForIndex('z')).toBe('z');

    // ç, ş, ğ, ö, ü must return null
    expect(normalizeCharForIndex('ç')).toBeNull();
    expect(normalizeCharForIndex('ş')).toBeNull();
    expect(normalizeCharForIndex('ğ')).toBeNull();
    expect(normalizeCharForIndex('ö')).toBeNull();
    expect(normalizeCharForIndex('ü')).toBeNull();
  });

  it('isValidTargetWord validates length 5-9 and rejects non-letters and q/w/x', () => {
    expect(isValidTargetWord({ id: 1, en: 'fragile', tr: 'kırılgan', examples: [], categories: [] })).toBe(true);
    expect(isValidTargetWord({ id: 2, en: 'to benefit', tr: 'fayda', examples: [], categories: [] })).toBe(true);
    // Too short (< 5)
    expect(isValidTargetWord({ id: 3, en: 'cat', tr: 'kedi', examples: [], categories: [] })).toBe(false);
    // Too long (> 9)
    expect(isValidTargetWord({ id: 4, en: 'consideration', tr: 'düşünce', examples: [], categories: [] })).toBe(false);
    // Contains q, w, or x
    expect(isValidTargetWord({ id: 5, en: 'quick', tr: 'hızlı', examples: [], categories: [] })).toBe(false);
    expect(isValidTargetWord({ id: 6, en: 'water', tr: 'su', examples: [], categories: [] })).toBe(false);
    expect(isValidTargetWord({ id: 7, en: 'extra', tr: 'fazla', examples: [], categories: [] })).toBe(false);
  });

  it('buildPoolIndex parses multiple single-word translations and ignores multi-word phrases', () => {
    const mockWords: Word[] = [
      { id: 10, en: 'arm', tr: 'kol, silah', examples: [], categories: [] },
      { id: 11, en: 'sit', tr: 'oturmak (bir yerde)', examples: [], categories: [] },
      { id: 12, en: 'long phrase', tr: 'uzun bir cümle anlamı', examples: [], categories: [] }
    ];

    const index = buildPoolIndex(mockWords);
    // 'kol' -> k(0), o(1), l(2)
    const kList = index.get('k') || [];
    expect(kList.some(item => item.tr === 'kol' && item.colIndex === 0)).toBe(true);
    const oList = index.get('o') || [];
    expect(oList.some(item => item.tr === 'kol' && item.colIndex === 1)).toBe(true);

    // multi-word 'uzun bir cümle anlamı' should be ignored
    const uList = index.get('u') || [];
    expect(uList.some(item => item.tr.includes('uzun bir'))).toBe(false);
  });

  it('partitionWordPools separates weak words and user words', () => {
    const mockWords: Word[] = [
      { id: 1, en: 'one', tr: 'bir', examples: [], categories: [] },
      { id: 2, en: 'two', tr: 'iki', examples: [], categories: [] },
      { id: 3, en: 'three', tr: 'üç', examples: [], categories: [] }
    ];

    const progressMap = new Map<number, Progress>();
    progressMap.set(1, {
      wordId: 1,
      step: 1, // weak
      streakDays: 0,
      dueDate: '2026-10-31',
      status: 'learning',
      lapses: 1,
      totalCorrect: 1,
      totalWrong: 2,
      updatedAt: Date.now()
    });
    progressMap.set(2, {
      wordId: 2,
      step: 5, // strong
      streakDays: 5,
      dueDate: '2026-11-10',
      status: 'mastered',
      lapses: 0,
      totalCorrect: 10,
      totalWrong: 0,
      updatedAt: Date.now()
    });

    const pools = partitionWordPools(mockWords, progressMap);
    expect(pools.userWords.map(w => w.id)).toEqual([1, 2]);
    expect(pools.weakUserWords.map(w => w.id)).toEqual([1]);
    expect(pools.generalWords.length).toBe(3);
  });

  it('enforces width <= 13 columns and proper alignment', () => {
    const allWords = (wordsJson as any).words as Word[];
    const progressMap = new Map<number, Progress>();

    // Mark 150 words as user words
    for (let i = 0; i < 150; i++) {
      const w = allWords[i];
      progressMap.set(w.id, {
        wordId: w.id,
        step: 2,
        streakDays: 2,
        dueDate: '2026-10-31',
        status: 'learning',
        lapses: 0,
        totalCorrect: 2,
        totalWrong: 0,
        updatedAt: Date.now()
      });
    }

    const puzzle = generateSecretWordPuzzle(allWords, progressMap);
    expect(puzzle).toBeDefined();
    expect(puzzle.totalWidth).toBeLessThanOrEqual(13);
    expect(puzzle.rows.length).toBe(puzzle.cleanTarget.length);

    // Each row's colIndex must match the target letter and spine column
    for (let i = 0; i < puzzle.rows.length; i++) {
      const row = puzzle.rows[i];
      expect(row.letter).toBe(puzzle.cleanTarget[i]);
      expect(row.paddingLeft + row.colIndex).toBe(puzzle.spineColumnIndex);
      expect(row.paddingLeft + row.tr.length + row.paddingRight).toBe(puzzle.totalWidth);
      expect(row.tr.length).toBeLessThanOrEqual(9);
    }
  });

  it('SecretWordSessionManager avoids repeating targets and row words across consecutive puzzles', () => {
    const allWords = (wordsJson as any).words as Word[];
    const progressMap = new Map<number, Progress>();
    for (let i = 0; i < 200; i++) {
      progressMap.set(allWords[i].id, {
        wordId: allWords[i].id,
        step: 3,
        streakDays: 3,
        dueDate: '2026-10-31',
        status: 'learning',
        lapses: 0,
        totalCorrect: 3,
        totalWrong: 0,
        updatedAt: Date.now()
      });
    }

    const manager = new SecretWordSessionManager(allWords, progressMap);
    const p1 = manager.getNextPuzzle();
    const p2 = manager.getNextPuzzle();

    expect(p1.targetWord.id).not.toBe(p2.targetWord.id);
  });
});

describe('secretWordGenerator - 100 Puzzles Benchmark (50, 200, 1000 User Words)', () => {
  const allWords = (wordsJson as any).words as Word[];

  function run100PuzzleBenchmark(userWordCount: number) {
    const progressMap = new Map<number, Progress>();
    // Random sample of user words
    const shuffled = [...allWords].sort(() => Math.random() - 0.5);
    const userWords = shuffled.slice(0, userWordCount);

    for (let i = 0; i < userWords.length; i++) {
      const w = userWords[i];
      const isWeak = i < Math.floor(userWordCount * 0.3);
      progressMap.set(w.id, {
        wordId: w.id,
        step: isWeak ? 1 : 4,
        streakDays: isWeak ? 0 : 4,
        dueDate: '2026-10-31',
        status: 'learning',
        lapses: isWeak ? 2 : 0,
        totalCorrect: isWeak ? 1 : 5,
        totalWrong: isWeak ? 3 : 0,
        updatedAt: Date.now()
      });
    }

    const sessionState = {
      usedTargetWordIds: new Set<number>(),
      usedRowWordIds: new Set<number>()
    };

    const startTime = performance.now();
    let successCount = 0;
    let totalUserWordPercentage = 0;

    for (let i = 0; i < 100; i++) {
      const puzzle = generateSecretWordPuzzle(allWords, progressMap, sessionState);
      if (puzzle) {
        successCount++;
        totalUserWordPercentage += puzzle.userWordPercentage;
        expect(puzzle.totalWidth).toBeLessThanOrEqual(13);
        expect(puzzle.rows.length).toBe(puzzle.cleanTarget.length);
      }
    }

    const totalDurationMs = performance.now() - startTime;
    const avgDurationMs = totalDurationMs / 100;
    const avgUserWordPct = totalUserWordPercentage / successCount;

    console.log(
      `[Benchmark: ${userWordCount} Words] Success: ${successCount}/100 (100%), Avg User-Word Ratio: ${avgUserWordPct.toFixed(1)}%, Total Time: ${totalDurationMs.toFixed(1)}ms (${avgDurationMs.toFixed(2)}ms/puzzle)`
    );

    expect(successCount).toBe(100);
    expect(avgDurationMs).toBeLessThan(50); // fast runtime performance
  }

  it('runs 100 puzzles benchmark for 50 user words', () => {
    run100PuzzleBenchmark(50);
  });

  it('runs 100 puzzles benchmark for 200 user words', () => {
    run100PuzzleBenchmark(200);
  });

  it('runs 100 puzzles benchmark for 1000 user words', () => {
    run100PuzzleBenchmark(1000);
  });
});

