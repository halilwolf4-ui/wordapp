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

export const DEFAULT_CATEGORY_NAMES: Record<string, string> = {
  yokdil_asiri_onemli: 'YÖKDİL / YDS - AŞIRI ÖNEMLİ',
  yokdil_yds: 'YÖKDİL / YDS',
  basic_verbs: 'Temel fiiller',
  colors: 'Renkler',
  family: 'Aile',
  irregular_verbs: 'Düzensiz fiiller',
  money: 'Para',
  numbers: 'Sayma sayıları',
  numbers_ordinals: 'Sıra sayıları',
  oxford3000_a1: 'Oxford 3000 - A1',
  oxford3000_a2: 'Oxford 3000 - A2',
  oxford3000_b1: 'Oxford 3000 - B1',
  oxford3000_b2: 'Oxford 3000 - B2',
  oxford5000_b2: 'Oxford 5000 - B2',
  oxford5000_c1: 'Oxford 5000 - C1',
  time: 'Zaman',
  time_days_of_week: 'Haftanın günleri',
  time_months: 'Yılın ayları',
  time_seasons: 'Yılın sezonu',
  top100: 'NGSL 1-100',
  top1000: 'NGSL 101-1000',
  top3000: 'NGSL 1001-3000',
  town: 'Şehir',
  custom: 'Kelimelerim'
};

export const DEFAULT_SETTINGS: UserSettings = {
  id: 1,
  dailyNewTarget: 10,
  dailyReviewLimit: 40,
  prioritizeCustomWords: true, // "öncelik kendi kelimelerimde olacak"
  enabledCategories: [
    'yokdil_asiri_onemli', 'yokdil_yds',
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
  theme: 'light',
  darkPalette: 'cyber-yellow',
  customDarkColor: '#FFE600',
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
/**
 * Automatically merges and cleans up any duplicate words in existing IndexedDB.
 * Preserves user progress, custom status, examples, and combines multiple meanings.
 */
export async function deduplicateDatabaseWords(database: WordDatabase = db): Promise<void> {
  const dedupKey = 'kelime_avi_db_dedup_v1';
  if (typeof localStorage !== 'undefined' && localStorage.getItem(dedupKey) === 'true') {
    return;
  }

  try {
    const allDbWords = await database.words.toArray();
    if (!allDbWords || allDbWords.length === 0) return;

    const allProgressList = await database.progress.toArray();
    const progressMap = new Map(allProgressList.map(p => [p.wordId, p]));

    const byEn = new Map<string, Word[]>();
    for (const w of allDbWords) {
      const key = (w.en || '').trim().toLowerCase();
      if (!key) continue;
      if (!byEn.has(key)) byEn.set(key, []);
      byEn.get(key)!.push(w);
    }

    let hasDuplicates = false;
    for (const [, group] of byEn.entries()) {
      if (group.length <= 1) continue;
      hasDuplicates = true;

      // Determine primary word:
      // 1. One that has progress
      // 2. Or is custom
      // 3. Or lowest id
      group.sort((a, b) => {
        const progA = progressMap.get(a.id);
        const progB = progressMap.get(b.id);
        if (progA && !progB) return -1;
        if (!progA && progB) return 1;
        if (a.isCustom && !b.isCustom) return -1;
        if (!a.isCustom && b.isCustom) return 1;
        return a.id - b.id;
      });

      const primary = { ...group[0] };
      const duplicates = group.slice(1);

      // Merge translations
      const trParts: string[] = [];
      const seenTr = new Set<string>();
      for (const item of group) {
        const parts = (item.tr || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
          const lower = p.toLowerCase();
          if (!seenTr.has(lower)) {
            seenTr.add(lower);
            trParts.push(p);
          }
        }
      }
      primary.tr = trParts.join(', ');

      // Merge categories
      const catSet = new Set(primary.categories || []);
      for (const item of duplicates) {
        (item.categories || []).forEach(c => catSet.add(c));
      }
      primary.categories = Array.from(catSet);

      // Merge examples
      const seenEx = new Set((primary.examples || []).map(e => (e.en || '').trim().toLowerCase()));
      if (!primary.examples) primary.examples = [];
      for (const item of duplicates) {
        for (const ex of (item.examples || [])) {
          const exKey = (ex.en || '').trim().toLowerCase();
          if (exKey && !seenEx.has(exKey)) {
            seenEx.add(exKey);
            primary.examples.push(ex);
          }
        }
      }

      if (!primary.ipa) {
        const withIpa = duplicates.find(item => !!item.ipa);
        if (withIpa) primary.ipa = withIpa.ipa;
      }

      // Save merged primary
      await database.words.put(primary);

      // Transfer progress if duplicate had progress and primary didn't
      const primaryProg = progressMap.get(primary.id);
      for (const dup of duplicates) {
        const dupProg = progressMap.get(dup.id);
        if (dupProg && !primaryProg) {
          await database.progress.put({ ...dupProg, wordId: primary.id });
        }
        if (dupProg) {
          await database.progress.delete(dup.id);
        }
        await database.words.delete(dup.id);
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(dedupKey, 'true');
    }
    if (hasDuplicates) {
      console.log('[Database] Cleaned up duplicate words in IndexedDB');
    }
  } catch (err) {
    console.warn('[Database] Error deduplicating words:', err);
  }
}

/**
 * Syncs YÖKDİL / YDS and YÖKDİL / YDS - AŞIRI ÖNEMLİ categories and words into an existing IndexedDB.
 */
export async function syncYokdilCategoriesToDb(database: WordDatabase = db): Promise<void> {
  const syncKey = 'kelime_avi_yokdil_cat_sync_v2';
  if (typeof localStorage !== 'undefined' && localStorage.getItem(syncKey) === 'true') {
    return;
  }

  try {
    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    const res = await fetch(`${baseUrl}words.json?v=yokdil2`, { cache: 'no-store' });
    if (!res.ok) return;

    const data = await res.json();
    const jsonWords: Word[] = data.words || [];
    const yokdilJsonWords = jsonWords.filter(
      w => w.categories && (w.categories.includes('yokdil_yds') || w.categories.includes('yokdil_asiri_onemli'))
    );
    if (yokdilJsonWords.length === 0) return;

    const allDbWords = await database.words.toArray();
    const clean = (s: string) => s.toLowerCase().trim().replace(/^to\s+/i, '');
    const dbByEn = new Map<string, Word>();
    let maxId = 0;
    for (const w of allDbWords) {
      dbByEn.set(clean(w.en), w);
      if (w.id > maxId) maxId = w.id;
    }

    const toPut: Word[] = [];
    for (const jw of yokdilJsonWords) {
      const key = clean(jw.en);
      const existing = dbByEn.get(key);
      if (existing) {
        const cats = new Set(existing.categories || []);
        let changed = false;
        for (const c of jw.categories || []) {
          if (!cats.has(c)) {
            cats.add(c);
            changed = true;
          }
        }
        if (changed) {
          toPut.push({ ...existing, categories: Array.from(cats) });
        }
      } else {
        maxId++;
        toPut.push({ ...jw, id: maxId });
      }
    }

    if (toPut.length > 0) {
      await database.words.bulkPut(toPut);
    }

    const existingSettings = await database.settings.get(1);
    if (existingSettings) {
      const enabled = new Set(existingSettings.enabledCategories || []);
      let settingsChanged = false;
      for (const cat of ['yokdil_asiri_onemli', 'yokdil_yds']) {
        if (!enabled.has(cat)) {
          enabled.add(cat);
          settingsChanged = true;
        }
      }
      if (settingsChanged) {
        await database.settings.put({
          ...existingSettings,
          enabledCategories: Array.from(enabled)
        });
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(syncKey, 'true');
    }
  } catch (err) {
    console.warn('[Database] Error syncing YÖKDİL categories:', err);
  }
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
    await deduplicateDatabaseWords(db);
    await syncYokdilCategoriesToDb(db);
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

  onProgress?.(50, 'Kelimeler veritabanına aktarılıyor...');
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
