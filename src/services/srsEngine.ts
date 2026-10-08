import { Progress, Word } from '../types';
import { addDays, getEffectiveDate } from './dateUtils';

export const SRS_INTERVALS = [1, 2, 4, 7, 14, 21]; // ladder in days

export interface SrsAnswerResult {
  nextProgress: Progress;
  isMastered: boolean;
  intervalDays: number;
}

/**
 * Calculates updated progress after answering a word.
 *
 * Ladder: 1 -> 2 -> 4 -> 7 -> 14 -> 21 days.
 * If correct after 21 days interval (step index 5) -> mastered!
 * If streakDays >= 21 -> mastered!
 * If wrong -> step resets to 0 (1 day), streakDays resets to 0, lapses incremented.
 */
export function calculateNextProgress(
  current: Progress | null,
  wordId: number,
  isCorrect: boolean,
  effectiveDate: string = getEffectiveDate()
): SrsAnswerResult {
  const base: Progress = current || {
    wordId,
    step: 0,
    streakDays: 0,
    dueDate: effectiveDate,
    lastReviewDate: undefined,
    status: 'learning',
    lapses: 0,
    totalCorrect: 0,
    totalWrong: 0,
    updatedAt: Date.now()
  };

  if (!isCorrect) {
    // Wrong answer: step resets to 1 day interval (step 0), streakDays to 0
    const nextProgress: Progress = {
      ...base,
      step: 0,
      streakDays: 0,
      dueDate: addDays(effectiveDate, 1),
      lastReviewDate: effectiveDate,
      status: 'learning',
      lapses: base.lapses + 1,
      totalWrong: base.totalWrong + 1,
      updatedAt: Date.now()
    };
    return {
      nextProgress,
      isMastered: false,
      intervalDays: 1
    };
  }

  // Correct answer
  const nextTotalCorrect = base.totalCorrect + 1;
  const nextStreakDays = base.streakDays + 1;

  // Check mastered conditions:
  // 1. Correct after 21 days interval (base.step >= 5)
  // 2. Or streak >= 21 days
  if (base.step >= 5 || nextStreakDays >= 21) {
    const nextProgress: Progress = {
      ...base,
      step: 5,
      streakDays: nextStreakDays,
      dueDate: addDays(effectiveDate, 60), // surprise check buffer or stored away
      lastReviewDate: effectiveDate,
      status: 'mastered',
      totalCorrect: nextTotalCorrect,
      updatedAt: Date.now()
    };
    return {
      nextProgress,
      isMastered: true,
      intervalDays: 21
    };
  }

  // Advance ladder
  const nextStep = base.step + 1;
  const intervalDays = SRS_INTERVALS[nextStep] ?? 21;
  const nextProgress: Progress = {
    ...base,
    step: nextStep,
    streakDays: nextStreakDays,
    dueDate: addDays(effectiveDate, intervalDays),
    lastReviewDate: effectiveDate,
    status: 'learning',
    totalCorrect: nextTotalCorrect,
    updatedAt: Date.now()
  };

  return {
    nextProgress,
    isMastered: false,
    intervalDays
  };
}

/**
 * Filter and prioritize review candidates for today.
 * - Respects daily limit (default 40).
 * - Overdue words are sorted oldest first.
 * - Custom words ("kendi kelimelerim") receive top priority in review selection.
 */
export function selectDailyReviewQueue(
  allProgress: Progress[],
  allWordsMap: Map<number, Word>,
  limit: number = 40,
  prioritizeCustom: boolean = true,
  effectiveDate: string = getEffectiveDate()
): Progress[] {
  // Due words (status is 'learning' and dueDate <= effectiveDate)
  const dueItems = allProgress.filter(
    p => p.status === 'learning' && p.dueDate <= effectiveDate
  );

  // If dueItems doesn't fill the limit, also include in-progress 'learning' words
  // so that the user's learned words are ALWAYS available in "Tekrar"!
  const candidates = [...dueItems];
  if (candidates.length < limit) {
    const nonDueLearning = allProgress.filter(
      p => p.status === 'learning' && p.dueDate > effectiveDate
    );
    candidates.push(...nonDueLearning.slice(0, limit - candidates.length));
  }

  // Sort: custom & reword words first if prioritizeCustom is on, then oldest overdue first
  candidates.sort((a, b) => {
    if (prioritizeCustom) {
      const wordA = allWordsMap.get(a.wordId);
      const wordB = allWordsMap.get(b.wordId);
      const isCustomA = wordA?.isCustom || wordA?.categories?.includes('custom') || !!wordA?.reword;
      const isCustomB = wordB?.isCustom || wordB?.categories?.includes('custom') || !!wordB?.reword;

      if (isCustomA && !isCustomB) return -1;
      if (!isCustomA && isCustomB) return 1;
    }

    // Overdue first
    const isDueA = a.dueDate <= effectiveDate;
    const isDueB = b.dueDate <= effectiveDate;
    if (isDueA && !isDueB) return -1;
    if (!isDueA && isDueB) return 1;

    // Oldest dueDate first
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    // Then lowest streak
    return a.streakDays - b.streakDays;
  });

  return candidates.slice(0, limit);
}

/**
 * Filter and prioritize new words for learning.
 * - Custom words ("kendi kelimelerim") come first!
 * - Category filter respected.
 */
export function selectDailyNewWordsQueue(
  allWords: Word[],
  existingProgressWordIds: Set<number>,
  enabledCategories: string[],
  limit: number = 10,
  prioritizeCustom: boolean = true
): Word[] {
  const categorySet = new Set(enabledCategories);

  // Words that have no progress yet or status == 'new'
  const availableWords = allWords.filter(w => {
    if (existingProgressWordIds.has(w.id)) return false;
    // Word must belong to at least one enabled category or be custom / reword
    const hasCategory = w.categories && w.categories.some(c => categorySet.has(c));
    return hasCategory || w.isCustom || w.categories.includes('custom') || !!w.reword;
  });

  // Sort by custom priority: User custom (0) -> Reword words (1) -> Dictionary words (2)
  availableWords.sort((a, b) => {
    if (prioritizeCustom) {
      const pA = (a.isCustom || a.categories?.includes('custom')) ? 0 : (a.reword ? 1 : 2);
      const pB = (b.isCustom || b.categories?.includes('custom')) ? 0 : (b.reword ? 1 : 2);
      if (pA !== pB) return pA - pB;
    }
    return a.id - b.id;
  });

  return availableWords.slice(0, limit);
}

/**
 * Interleave array of review words and new words so they don't appear in monotone blocks.
 * Shuffles smoothly preventing immediate same category repetition where possible.
 */
export function interleaveStudySession<T extends { categories?: string[] }>(items: T[]): T[] {
  if (items.length <= 1) return [...items];

  // Fisher-Yates shuffle with category dispersion
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }

  // Slight re-ordering to prevent same category > 2 in a row
  for (let i = 2; i < list.length; i++) {
    const catPrev1 = list[i - 1].categories?.[0];
    const catPrev2 = list[i - 2].categories?.[0];
    const catCurr = list[i].categories?.[0];

    if (catCurr && catCurr === catPrev1 && catCurr === catPrev2) {
      // Find a swap candidate ahead
      for (let k = i + 1; k < list.length; k++) {
        if (list[k].categories?.[0] !== catCurr) {
          [list[i], list[k]] = [list[k], list[i]];
          break;
        }
      }
    }
  }

  return list;
}
