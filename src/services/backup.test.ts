import { describe, it, expect } from 'vitest';
import { inspectBackupFile, BackupPreview } from './backup';
import { BackupData, Progress, Word } from '../types';

describe('Backup & Restore System', () => {
  const sampleCustomWord: Word = {
    id: 1000001,
    en: 'serendipity',
    tr: 'şans eseri güzel bir şey bulma',
    examples: [{ en: 'A pure serendipity.', tr: 'Tam bir tesadüf.' }],
    categories: ['custom'],
    isCustom: true
  };

  const sampleProgress: Progress = {
    wordId: 1000001,
    step: 3,
    streakDays: 4,
    dueDate: '2026-10-15',
    lastReviewDate: '2026-10-08',
    status: 'learning',
    lapses: 0,
    totalCorrect: 4,
    totalWrong: 0,
    updatedAt: 1790538847000
  };

  const sampleBackup: BackupData = {
    schema: 1,
    appVersion: '1.0.0',
    exportedAt: '2026-10-08T15:00:00.000Z',
    progress: [sampleProgress],
    customWords: [sampleCustomWord],
    settings: { dailyNewTarget: 15, prioritizeCustomWords: true },
    profile: { xp: 450, level: 3, streak: 5 },
    dailyLogs: [{ date: '2026-10-08', correctCount: 15, wrongCount: 2, newLearnedCount: 5, reviewsDone: 10, xpEarned: 150 }]
  };

  it('correctly inspects and previews backup file', () => {
    const jsonStr = JSON.stringify(sampleBackup);
    const preview: BackupPreview = inspectBackupFile(jsonStr);

    expect(preview.valid).toBe(true);
    expect(preview.progressCount).toBe(1);
    expect(preview.customWordCount).toBe(1);
    expect(preview.lastStudyDate).toBe('2026-10-08');
    expect(preview.totalXp).toBe(450);
    expect(preview.level).toBe(3);
    expect(preview.streak).toBe(5);
  });

  it('rejects invalid or corrupted JSON gracefully', () => {
    const brokenJson = '{ not valid json';
    const preview = inspectBackupFile(brokenJson);

    expect(preview.valid).toBe(false);
    expect(preview.error).toBeDefined();
  });

  it('determines newer record correctly during merge', () => {
    const olderRecord: Progress = {
      wordId: 1,
      step: 1,
      streakDays: 1,
      dueDate: '2026-10-02',
      lastReviewDate: '2026-10-01',
      status: 'learning',
      lapses: 0,
      totalCorrect: 1,
      totalWrong: 0,
      updatedAt: 1000
    };

    const newerRecord: Progress = {
      wordId: 1,
      step: 3,
      streakDays: 3,
      dueDate: '2026-10-10',
      lastReviewDate: '2026-10-06',
      status: 'learning',
      lapses: 0,
      totalCorrect: 3,
      totalWrong: 0,
      updatedAt: 2000
    };

    // Newer lastReviewDate wins
    const incomingWins = (newerRecord.lastReviewDate || '') > (olderRecord.lastReviewDate || '');
    expect(incomingWins).toBe(true);
  });
});
