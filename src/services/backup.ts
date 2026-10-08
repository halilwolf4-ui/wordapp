import { db, DEFAULT_SETTINGS, DEFAULT_PROFILE } from '../db';
import { BackupData } from '../types';
import { getEffectiveDate } from './dateUtils';

export const CURRENT_SCHEMA_VERSION = 1;
export const APP_VERSION = '1.0.0';

/**
 * Creates a JSON backup object containing progress, custom words, settings, and profile.
 * Does NOT include the static 6120 words to keep file size minimal (a few KB).
 */
export async function createBackupData(): Promise<BackupData> {
  const progress = await db.progress.toArray();
  const customWords = await db.words.filter(w => !!w.isCustom || w.id >= 1000000).toArray();
  const settings = (await db.settings.get(1)) || DEFAULT_SETTINGS;
  const profile = (await db.profile.get(1)) || DEFAULT_PROFILE;
  const dailyLogs = await db.dailyLogs.toArray();

  return {
    schema: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    progress,
    customWords,
    settings,
    profile,
    dailyLogs
  };
}

/**
 * Downloads or shares the backup file.
 */
export async function exportBackupFile(): Promise<{ fileName: string; shared: boolean }> {
  const backup = await createBackupData();
  const today = getEffectiveDate();
  const fileName = `kelime-avi-yedek-${today}.json`;
  const jsonContent = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });

  // Update last backup date in settings
  await db.settings.update(1, { lastBackupDate: today });

  let shared = false;
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Kelime Avı Yedek Dosyası',
          text: `Kelime Avı ${today} tarihli yedek dosyası`,
          files: [file]
        });
        shared = true;
      }
    } catch (e) {
      console.warn('Web Share API aborted or failed, falling back to download:', e);
    }
  }

  if (!shared && typeof document !== 'undefined') {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return { fileName, shared };
}

export interface BackupPreview {
  valid: boolean;
  error?: string;
  schema: number;
  appVersion: string;
  exportedAt: string;
  progressCount: number;
  customWordCount: number;
  lastStudyDate?: string;
  totalXp: number;
  level: number;
  streak: number;
  data: BackupData;
}

/**
 * Parses and validates backup JSON string, providing metadata for preview before restore.
 * Supports schema migration if older schema versions exist.
 */
export function inspectBackupFile(jsonString: string): BackupPreview {
  try {
    const parsed = JSON.parse(jsonString) as BackupData;
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'Geçersiz JSON formatı.', schema: 0, appVersion: '', exportedAt: '', progressCount: 0, customWordCount: 0, totalXp: 0, level: 0, streak: 0, data: {} as BackupData };
    }

    // Migration logic for future schemas
    const migratedData = migrateBackupIfNeeded(parsed);

    // Find latest review date among progress items
    let latestDate: string | undefined = undefined;
    for (const p of migratedData.progress || []) {
      if (p.lastReviewDate && (!latestDate || p.lastReviewDate > latestDate)) {
        latestDate = p.lastReviewDate;
      }
    }

    return {
      valid: true,
      schema: migratedData.schema || 1,
      appVersion: migratedData.appVersion || '1.0.0',
      exportedAt: migratedData.exportedAt || '',
      progressCount: migratedData.progress?.length || 0,
      customWordCount: migratedData.customWords?.length || 0,
      lastStudyDate: latestDate || migratedData.profile?.lastActiveDate,
      totalXp: migratedData.profile?.xp || 0,
      level: migratedData.profile?.level || 1,
      streak: migratedData.profile?.streak || 0,
      data: migratedData
    };
  } catch (err: unknown) {
    return {
      valid: false,
      error: `Dosya okunamadı: ${(err as Error).message}`,
      schema: 0,
      appVersion: '',
      exportedAt: '',
      progressCount: 0,
      customWordCount: 0,
      totalXp: 0,
      level: 0,
      streak: 0,
      data: {} as BackupData
    };
  }
}

/**
 * Migrates old backup versions to current schema.
 */
function migrateBackupIfNeeded(data: BackupData): BackupData {
  if (!data.schema || data.schema === 1) {
    // Current version
    return data;
  }
  // Future migration hooks can go here
  return data;
}

/**
 * Restores data into Dexie.
 * If mergeMode is true, keeps the newer record based on lastReviewDate / updatedAt.
 */
export async function restoreBackup(backup: BackupData, mergeMode: boolean = false): Promise<void> {
  const { progress = [], customWords = [], settings, profile, dailyLogs = [] } = backup;

  if (!mergeMode) {
    // Overwrite progress
    await db.progress.clear();
    if (progress.length > 0) {
      await db.progress.bulkPut(progress);
    }
  } else {
    // Merge mode: compare each item
    for (const incoming of progress) {
      const existing = await db.progress.get(incoming.wordId);
      if (!existing) {
        await db.progress.put(incoming);
      } else {
        // Keep the one with newer lastReviewDate or updatedAt
        const incomingDate = incoming.lastReviewDate || '';
        const existingDate = existing.lastReviewDate || '';
        if (incomingDate > existingDate || (incomingDate === existingDate && (incoming.updatedAt || 0) >= (existing.updatedAt || 0))) {
          await db.progress.put(incoming);
        }
      }
    }
  }

  // Restore custom words
  if (customWords.length > 0) {
    await db.words.bulkPut(customWords);
  }

  // Restore dailyLogs
  if (dailyLogs.length > 0) {
    await db.dailyLogs.bulkPut(dailyLogs);
  }

  // Restore settings and profile
  if (settings) {
    await db.settings.put({ ...DEFAULT_SETTINGS, ...settings, id: 1 });
  }

  if (profile) {
    const existingProf = await db.profile.get(1);
    if (mergeMode && existingProf) {
      // In merge mode, take highest XP and merge badges
      const mergedBadges = Array.from(new Set([...(existingProf.unlockedBadges || []), ...(profile.unlockedBadges || [])]));
      await db.profile.put({
        ...existingProf,
        xp: Math.max(existingProf.xp || 0, profile.xp || 0),
        level: Math.max(existingProf.level || 1, profile.level || 1),
        streak: Math.max(existingProf.streak || 0, profile.streak || 0),
        highScoreSpeedRound: Math.max(existingProf.highScoreSpeedRound || 0, profile.highScoreSpeedRound || 0),
        unlockedBadges: mergedBadges,
        id: 1
      });
    } else {
      await db.profile.put({ ...DEFAULT_PROFILE, ...profile, id: 1 });
    }
  }
}
