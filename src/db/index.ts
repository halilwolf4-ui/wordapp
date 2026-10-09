import Dexie, { Table } from 'dexie';
import { Word, Progress, UserSettings, UserProfile, DailyLog } from '../types';

export class WordDatabase extends Dexie {
  words!: Table<Word, number>;
  progress!: Table<Progress, number>;
  settings!: Table<UserSettings, number>;
  profile!: Table<UserProfile, number>;
  dailyLogs!: Table<DailyLog, string>;

  constructor() {
    super('KelimeAviDB');
    this.version(1).stores({
      words: 'id, en, *categories, isCustom',
      progress: 'wordId, status, dueDate, step, streakDays, lastReviewDate',
      settings: 'id',
      profile: 'id',
      dailyLogs: 'date'
    });
  }
}

export const db = new WordDatabase();

export const DEFAULT_SETTINGS: UserSettings = {
  id: 1,
  dailyNewTarget: 10,
  dailyReviewLimit: 40,
  prioritizeCustomWords: true, // "öncelik kendi kelimelerimde olacak"
  enabledCategories: [
    'basic_verbs', 'colors', 'family', 'irregular_verbs', 'money', 'numbers',
    'numbers_ordinals', 'oxford3000_a1', 'oxford3000_a2', 'oxford3000_b1',
    'oxford3000_b2', 'oxford5000_b2', 'oxford5000_c1', 'time',
    'time_days_of_week', 'time_months', 'time_seasons', 'top100',
    'top1000', 'top3000', 'town', 'custom'
  ],
  surpriseMasteredCheck: true,
  soundEffects: true,
  vibration: true,
  speechSpeed: 0.9,
  theme: 'dark',
  lastBackupDate: undefined,
  lastSurpriseCheckDate: undefined
};

export const DEFAULT_PROFILE: UserProfile = {
  id: 1,
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: '',
  unlockedBadges: [],
  highScoreSpeedRound: 0,
  streakFreezes: 0,
  frozenDates: [],
  consecutiveCompletedDays: 0,
  lastCompletedDate: ''
};

/**
 * Request persistent storage from browser so data is not cleared on cache clean.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Storage] Persistent storage granted: ${isPersisted}`);
      return isPersisted;
    } catch (e) {
      console.warn('[Storage] Error requesting persist:', e);
      return false;
    }
  }
  return false;
}

/**
 * Initialize database and import words.json if words table is empty.
 */
export async function initializeDatabase(onProgress?: (progress: number, message: string) => void): Promise<void> {
  await requestStoragePersistence();

  // Ensure settings & profile exist
  const existingSettings = await db.settings.get(1);
  if (!existingSettings) {
    await db.settings.put(DEFAULT_SETTINGS);
  }

  const existingProfile = await db.profile.get(1);
  if (!existingProfile) {
    await db.profile.put(DEFAULT_PROFILE);
  }

  const wordCount = await db.words.count();
  if (wordCount > 0) {
    return; // Already initialized
  }

  onProgress?.(10, 'Kelime verisi indiriliyor...');
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
  const res = await fetch(`${baseUrl}words.json`);
  if (!res.ok) {
    throw new Error(`words.json yüklenemedi: HTTP ${res.status}`);
  }

  onProgress?.(30, 'Veriler ayrıştırılıyor...');
  const data = await res.json();
  const rawWords: Word[] = data.words || [];

  onProgress?.(50, 'Kelimeler veritabanına aktarılıyor (6120 kelime)...');
  // Bulk add words in chunks for smooth performance
  const chunkSize = 1000;
  for (let i = 0; i < rawWords.length; i += chunkSize) {
    const chunk = rawWords.slice(i, i + chunkSize);
    await db.words.bulkAdd(chunk);
    const pct = 50 + Math.floor((i / rawWords.length) * 30);
    onProgress?.(pct, `Kelimeler aktarılıyor... (${Math.min(i + chunkSize, rawWords.length)} / ${rawWords.length})`);
  }

  onProgress?.(100, 'Kurulum tamamlandı!');
}
