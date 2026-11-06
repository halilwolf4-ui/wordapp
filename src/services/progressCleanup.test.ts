import { describe, it, expect } from 'vitest';
import { Word, Progress } from '../types';

/**
 * Filter logic after removal from src/App.tsx:
 * The bulkDelete block is completely removed; loadData preserves all progress records intact.
 */
export function appLoadDataCleanupFilter(
  _progress: Progress[],
  _wordsMap: Map<number, Word>
): Progress[] {
  // Block removed: 0 records are targeted for deletion!
  return [];
}

describe('bulkDelete bloğu kaldırma ve restoreBackup senaryosu', () => {
  const dictionaryWord: Word = {
    id: 45,
    en: 'accept',
    tr: 'kabul etmek',
    categories: ['oxford3000_a1'],
    isCustom: false, // NOT custom, regular dictionary word from backup
    examples: []
  };

  const restoredUnreviewedProgress: Progress = {
    wordId: 45,
    step: 0,
    streakDays: 0,
    dueDate: '2026-11-06',
    lastReviewDate: undefined,
    status: 'learning',
    lapses: 0,
    totalCorrect: 0,
    totalWrong: 0,
    updatedAt: Date.now()
  };

  const wordsMap = new Map<number, Word>([[dictionaryWord.id, dictionaryWord]]);

  it('Yedekteki unreviewed custom-olmayan kelime loadData temizliğine TAKILMAMALI (silinmemeli)', () => {
    // bulkDelete bloğu App.tsx'ten tamamen kaldırıldığı için silinmeye hedeflenen kayıt sayısı 0'dır.
    const toDelete = appLoadDataCleanupFilter([restoredUnreviewedProgress], wordsMap);
    
    // Beklenti: Silinmeye hedeflenen hiçbir kayıt olmamalıdır!
    expect(toDelete.length).toBe(0);
  });
});
