import { describe, it, expect } from 'vitest';
import {
  calculateNextProgress,
  selectDailyReviewQueue,
  selectDailyNewWordsQueue,
  SRS_INTERVALS
} from './srsEngine';
import { getEffectiveDate, addDays } from './dateUtils';
import { Progress, Word } from '../types';

describe('SRS Repetition Engine', () => {
  const TODAY = '2026-10-08';

  it('progresses through interval ladder: 1 -> 2 -> 4 -> 7 -> 14 -> 21 days', () => {
    let progress: Progress | null = null;
    expect(SRS_INTERVALS).toEqual([1, 2, 4, 7, 14, 21]);

    // Initial correct answer (step 0 -> 1)
    let res = calculateNextProgress(progress, 1, true, TODAY);
    expect(res.isMastered).toBe(false);
    expect(res.nextProgress.step).toBe(1);
    expect(res.nextProgress.dueDate).toBe(addDays(TODAY, 2)); // interval for step 1 is 2
    expect(res.nextProgress.streakDays).toBe(1);

    // Step 1 -> 2
    res = calculateNextProgress(res.nextProgress, 1, true, TODAY);
    expect(res.nextProgress.step).toBe(2);
    expect(res.nextProgress.dueDate).toBe(addDays(TODAY, 4));

    // Step 2 -> 3
    res = calculateNextProgress(res.nextProgress, 1, true, TODAY);
    expect(res.nextProgress.step).toBe(3);
    expect(res.nextProgress.dueDate).toBe(addDays(TODAY, 7));

    // Step 3 -> 4
    res = calculateNextProgress(res.nextProgress, 1, true, TODAY);
    expect(res.nextProgress.step).toBe(4);
    expect(res.nextProgress.dueDate).toBe(addDays(TODAY, 14));

    // Step 4 -> 5
    res = calculateNextProgress(res.nextProgress, 1, true, TODAY);
    expect(res.nextProgress.step).toBe(5);
    expect(res.nextProgress.dueDate).toBe(addDays(TODAY, 21));
  });

  it('marks word as mastered after 21-day interval when answered correctly again', () => {
    const at21DayStep: Progress = {
      wordId: 1,
      step: 5, // interval was 21 days
      streakDays: 5,
      dueDate: TODAY,
      lastReviewDate: '2026-09-17',
      status: 'learning',
      lapses: 0,
      totalCorrect: 5,
      totalWrong: 0,
      updatedAt: Date.now()
    };

    const res = calculateNextProgress(at21DayStep, 1, true, TODAY);
    expect(res.isMastered).toBe(true);
    expect(res.nextProgress.status).toBe('mastered');
  });

  it('marks word as mastered if streak reaches 21 consecutive correct reviews', () => {
    const highStreak: Progress = {
      wordId: 2,
      step: 3,
      streakDays: 20,
      dueDate: TODAY,
      status: 'learning',
      lapses: 1,
      totalCorrect: 20,
      totalWrong: 1,
      updatedAt: Date.now()
    };

    const res = calculateNextProgress(highStreak, 2, true, TODAY);
    expect(res.isMastered).toBe(true);
    expect(res.nextProgress.status).toBe('mastered');
    expect(res.nextProgress.streakDays).toBe(21);
  });

  it('resets step to 0 (1 day), resets streak and increments lapses on wrong answer', () => {
    const advancedWord: Progress = {
      wordId: 3,
      step: 4,
      streakDays: 8,
      dueDate: TODAY,
      status: 'learning',
      lapses: 0,
      totalCorrect: 8,
      totalWrong: 0,
      updatedAt: Date.now()
    };

    const res = calculateNextProgress(advancedWord, 3, false, TODAY);
    expect(res.isMastered).toBe(false);
    expect(res.nextProgress.step).toBe(0);
    expect(res.nextProgress.streakDays).toBe(0);
    expect(res.nextProgress.dueDate).toBe(addDays(TODAY, 1)); // 1 day interval
    expect(res.nextProgress.lapses).toBe(1);
    expect(res.nextProgress.totalWrong).toBe(1);
  });

  it('prioritizes user custom words ("kendi kelimelerim") in daily review queue', () => {
    const wordsMap = new Map<number, Word>([
      [10, { id: 10, en: 'regular1', tr: 'anlam1', examples: [], categories: ['top100'] }],
      [20, { id: 20, en: 'custom1', tr: 'özel1', examples: [], categories: ['custom'], isCustom: true }],
      [30, { id: 30, en: 'regular2', tr: 'anlam2', examples: [], categories: ['top100'] }]
    ]);

    const progressList: Progress[] = [
      { wordId: 10, step: 1, streakDays: 1, dueDate: TODAY, status: 'learning', lapses: 0, totalCorrect: 1, totalWrong: 0, updatedAt: 0 },
      { wordId: 20, step: 1, streakDays: 1, dueDate: TODAY, status: 'learning', lapses: 0, totalCorrect: 1, totalWrong: 0, updatedAt: 0 },
      { wordId: 30, step: 1, streakDays: 1, dueDate: TODAY, status: 'learning', lapses: 0, totalCorrect: 1, totalWrong: 0, updatedAt: 0 }
    ];

    const queue = selectDailyReviewQueue(progressList, wordsMap, 2, true, TODAY);
    expect(queue.length).toBe(2);
    // Custom word must be first in queue
    expect(queue[0].wordId).toBe(20);
  });

  it('prioritizes user custom words in new learning queue', () => {
    const allWords: Word[] = [
      { id: 1, en: 'regularA', tr: 'A', examples: [], categories: ['top100'] },
      { id: 2, en: 'myWord', tr: 'B', examples: [], categories: ['custom'], isCustom: true },
      { id: 3, en: 'regularC', tr: 'C', examples: [], categories: ['top100'] }
    ];

    const queue = selectDailyNewWordsQueue(allWords, new Set(), ['top100', 'custom'], 2, true);
    expect(queue.length).toBe(2);
    expect(queue[0].id).toBe(2); // Custom word comes first!
  });

  it('respects 04:00 AM day boundary', () => {
    // 03:30 AM should be considered previous day
    const nightOwl = new Date(2026, 9, 8, 3, 30, 0); // Month 9 is October (0-indexed)
    expect(getEffectiveDate(nightOwl)).toBe('2026-10-07');

    // 04:01 AM belongs to the new day
    const morning = new Date(2026, 9, 8, 4, 1, 0);
    expect(getEffectiveDate(morning)).toBe('2026-10-08');
  });
});
