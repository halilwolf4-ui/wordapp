import { Word, Progress } from '../types';
import { SnakeGameConfig } from './snakeGameConfig';
import yokdilSynonymsMap from './yokdilSynonymsMap.json';

const synonymsData = yokdilSynonymsMap as unknown as Record<string, string[]>;

export const EXTRA_TURKISH_SYNONYMS: Record<string, string[]> = {
  poet: ['şair', 'ozan', 'şiir', 'yazar', 'şiir yazarı'],
  poem: ['şiir', 'manzume', 'koşuk'],
  poetry: ['şiir', 'şairlik', 'şiir sanatı'],
  formerly: ['eskiden', 'önceden', 'önce', 'daha önce', 'geçmişte', 'eski', 'önceleri', 'evvelce'],
  ancient: ['antik', 'eski', 'kadim', 'çağlar öncesi'],
  rapid: ['hızlı', 'çabuk', 'seri', 'ani'],
  swift: ['hızlı', 'çabuk', 'seri', 'tez'],
  expand: ['genişlemek', 'genişletmek', 'genişle', 'büyümek', 'yayılmak', 'büyütmek'],
  abandon: ['terk etmek', 'terketmek', 'bırakmak', 'vazgeçmek', 'ayrılmak'],
  persist: ['ısrar etmek', 'ısrarcı olmak', 'sürdürmek', 'direnmek', 'devam etmek'],
  acquire: ['edinmek', 'elde etmek', 'kazanmak', 'almak'],
  annual: ['yıllık', 'yılda bir', 'senelik'],
  accurate: ['doğru', 'tam', 'kesin', 'hatasız'],
  brief: ['kısa', 'öz', 'özet'],
  crucial: ['önemli', 'kritik', 'hayati', 'çok önemli'],
  gather: ['toplamak', 'toplanmak', 'bir araya gelmek', 'biriktirmek'],
  cease: ['durdurmak', 'durmak', 'son vermek', 'bitmek'],
  seek: ['aramak', 'peşinde olmak', 'araştırmak'],
  reveal: ['ortaya çıkarmak', 'açığa çıkarmak', 'göstermek', 'ifşa etmek'],
  vital: ['hayati', 'önemli', 'çok önemli', 'yaşamsal'],
  vast: ['geniş', 'büyük', 'muazzam', 'uçsuz bucaksız']
};

export type WordLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'default';

/**
 * Extracts the CEFR level from word categories.
 */
export function getWordLevel(word: Word): WordLevel {
  const cats = word.categories || [];
  for (const c of cats) {
    const lower = c.toLowerCase();
    if (lower.includes('_c2') || lower.endsWith('c2')) return 'C2';
    if (lower.includes('_c1') || lower.endsWith('c1')) return 'C1';
    if (lower.includes('_b2') || lower.endsWith('b2')) return 'B2';
    if (lower.includes('_b1') || lower.endsWith('b1')) return 'B1';
    if (lower.includes('_a2') || lower.endsWith('a2')) return 'A2';
    if (lower.includes('_a1') || lower.endsWith('a1')) return 'A1';
  }
  return 'default';
}

/**
 * Strips leading 'to ' infinitive marker from English words.
 */
export function cleanEnglishWord(en: string): string {
  return en
    .trim()
    .toLowerCase()
    .replace(/^to\s+/i, '')
    .trim();
}

/**
 * Normalizes Turkish text: removes parentheses first, then punctuation, extra spaces and lowers case.
 */
export function cleanTurkishText(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\([^)]*\)/g, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips Turkish diacritics for relaxed/tolerant mobile typing (e.g. guzel == güzel).
 */
export function stripTurkishAccents(text: string): string {
  return text
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');
}

/**
 * Damerau-Levenshtein distance calculation to detect 1-letter typos / swaps.
 */
export function getDamerauLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Checks if a Turkish input matches a target meaning, with full verb suffix, root, and phrase tolerance:
 * - Exact match
 * - Accent insensitive (guzel == güzel)
 * - Space insensitive (terketmek == terk etmek)
 * - Root prefix match (once in onceden, eski in eskiden)
 * - Phrase sub-word match (daha once in onceden)
 * - Verb suffix / root tolerance (genişle, genişletmek in genişlemek)
 */
export function matchSingleTurkishMeaning(input: string, meaning: string): boolean {
  const inClean = cleanTurkishText(input);
  const mClean = cleanTurkishText(meaning);
  if (!inClean || !mClean) return false;

  const inStrip = stripTurkishAccents(inClean);
  const mStrip = stripTurkishAccents(mClean);

  if (inClean === mClean || inStrip === mStrip) return true;
  if (inStrip.replace(/\s+/g, '') === mStrip.replace(/\s+/g, '')) return true;

  // Root prefix match: e.g. once in onceden, eski in eskiden
  if (inStrip.length >= 4 && mStrip.startsWith(inStrip)) return true;
  if (mStrip.length >= 4 && inStrip.startsWith(mStrip)) return true;

  // Verb suffix & root tolerance
  const isVerbTarget = mStrip.endsWith('mek') || mStrip.endsWith('mak') || inStrip.endsWith('mek') || inStrip.endsWith('mak');
  if (isVerbTarget) {
    const inStem = inStrip.replace(/(mek|mak)$/, '').trim();
    const mStem = mStrip.replace(/(mek|mak)$/, '').trim();

    if (inStem === mStem) return true;

    let commonPrefix = 0;
    while (
      commonPrefix < inStem.length &&
      commonPrefix < mStem.length &&
      inStem[commonPrefix] === mStem[commonPrefix]
    ) {
      commonPrefix++;
    }

    if (commonPrefix >= 4 && commonPrefix >= Math.min(inStem.length, mStem.length) - 2) {
      return true;
    }
  }

  // Phrase word root match: e.g. "daha once" matches "onceden"
  const inWords = inStrip.split(' ');
  const mWords = mStrip.split(' ');
  for (const iw of inWords) {
    if (iw.length >= 4) {
      if (mWords.some(mw => mw === iw || mw.startsWith(iw) || iw.startsWith(mw))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Builds SVG path string for the serpentine road with 6 horizontal rows and 5 smooth U-turns.
 * ViewBox: 0 0 440 240
 */
export function buildSerpentinePathD(numRows = 6, rowSpacing = 40, R = 20): string {
  let d = 'M 360 20 ';
  for (let r = 0; r < numRows; r++) {
    const y = 20 + r * rowSpacing;
    const isEven = r % 2 === 0;
    if (isEven) {
      d += `L 40 ${y} `;
      if (r < numRows - 1) {
        d += `A ${R} ${R} 0 0 0 40 ${y + rowSpacing} `;
      }
    } else {
      d += `L 360 ${y} `;
      if (r < numRows - 1) {
        d += `A ${R} ${R} 0 0 1 360 ${y + rowSpacing} `;
      }
    }
  }
  return d.trim();
}

export interface SerpentinePoint {
  x: number;
  y: number;
  angle: number; // degrees
}

/**
 * Calculates head position (x, y, angle) along the serpentine path according to distance:
 * - At distance = 60s: head is at start of Row 0 (360, 20) facing left (180 deg)
 * - At distance = 0s: head reached player at end of Row 5 (360, 220) facing right (0 deg)
 * - At distance > 60s (up to 120s): head is in the visible right entrance buffer (x = 360 -> 430)
 */
export function getSerpentinePointAtTime(distance: number, config: SnakeGameConfig): SerpentinePoint {
  const startDist = config.initialDistance; // 60
  const t = startDist - distance; // elapsed progress in seconds

  const numRows = config.pathRows;
  const numTurns = numRows - 1;
  const rowSpacing = 200 / numTurns; // 40
  const R = rowSpacing / 2; // 20

  const totalTurnSec = numTurns * config.turnSec;
  const straightSec = Math.max(1, startDist - totalTurnSec);
  const rowSec = straightSec / numRows;

  // 1. Visible right entrance zone (distance > 60s, up to 120s)
  if (t < 0) {
    const overflowSec = Math.min(60, -t);
    // Move head smoothly rightwards from 360 up to 430 as distance increases from 60 to 120
    const x = 360 + (overflowSec / 60) * 70;
    return { x, y: 20, angle: 180 };
  }

  // 2. Along the track (0 <= t <= 60s)
  const totalSegments = numRows + numTurns;
  let accTime = 0;

  for (let seg = 0; seg < totalSegments; seg++) {
    const isRow = seg % 2 === 0;
    const r = Math.floor(seg / 2);
    const segDuration = isRow ? rowSec : config.turnSec;

    if (t <= accTime + segDuration || seg === totalSegments - 1) {
      const p = Math.max(0, Math.min(1, (t - accTime) / segDuration));

      if (isRow) {
        const y = 20 + r * rowSpacing;
        const isEvenRow = r % 2 === 0;
        const x = isEvenRow ? 360 - p * 320 : 40 + p * 320;
        const angle = isEvenRow ? 180 : 0;
        return { x, y, angle };
      } else {
        const y1 = 20 + r * rowSpacing;
        const isLeftTurn = r % 2 === 0;

        if (isLeftTurn) {
          const x = 40 - R * Math.sin(p * Math.PI);
          const y = y1 + p * rowSpacing;
          const angle = 180 - p * 180;
          return { x, y, angle };
        } else {
          const x = 360 + R * Math.sin(p * Math.PI);
          const y = y1 + p * rowSpacing;
          const angle = p * 180;
          return { x, y, angle };
        }
      }
    }
    accTime += segDuration;
  }

  return { x: 360, y: 220, angle: 0 };
}

/**
 * Pre-builds a lookup map of English words to all their accepted Turkish definitions
 * including definitions from synonyms in yokdilSynonymsMap and EXTRA_TURKISH_SYNONYMS.
 */
export function buildWordSynonymTrMap(allWords: Word[]): Map<string, string[]> {
  const enToWordMap = new Map<string, Word[]>();
  for (const w of allWords) {
    const key = cleanEnglishWord(w.en);
    if (!enToWordMap.has(key)) {
      enToWordMap.set(key, []);
    }
    enToWordMap.get(key)!.push(w);
  }

  const resultMap = new Map<string, string[]>();

  for (const w of allWords) {
    const cleanEn = cleanEnglishWord(w.en);
    const meaningsSet = new Set<string>();

    if (w.tr) {
      w.tr.split(/[,;\/]+/).forEach(m => {
        const clean = cleanTurkishText(m);
        if (clean) meaningsSet.add(clean);
      });
    }

    // Add extra curated Turkish synonyms
    const extraSyns = EXTRA_TURKISH_SYNONYMS[cleanEn] || EXTRA_TURKISH_SYNONYMS[w.en.toLowerCase().trim()];
    if (extraSyns && Array.isArray(extraSyns)) {
      for (const es of extraSyns) {
        const clean = cleanTurkishText(es);
        if (clean) meaningsSet.add(clean);
      }
    }

    const synList = synonymsData[cleanEn] || synonymsData[w.en.toLowerCase().trim()];
    if (synList && Array.isArray(synList)) {
      for (const syn of synList) {
        const cleanSyn = cleanEnglishWord(syn);
        const relatedWords = enToWordMap.get(cleanSyn);
        if (relatedWords) {
          for (const rw of relatedWords) {
            if (rw.tr) {
              rw.tr.split(/[,;\/]+/).forEach(m => {
                const clean = cleanTurkishText(m);
                if (clean) meaningsSet.add(clean);
              });
            }
          }
        }
      }
    }

    resultMap.set(cleanEn, Array.from(meaningsSet));
  }

  return resultMap;
}

export interface CheckSnakeAnswerResult {
  isCorrect: boolean;
  isAlmostCorrect: boolean;
  nearExplanation?: string;
  matchedMeaning?: string;
  displayTurkish: string;
}

/**
 * Checks Turkish user input against target English word's Turkish translations:
 * - English word displayed, user types Turkish
 * - Accepts any single matching Turkish definition (e.g. "rahat" or "kolaylık")
 * - Accent insensitive (guzel == güzel, satici == satıcı)
 * - Space insensitive for compound verbs (terketmek == terk etmek)
 * - Verb suffix & root tolerance (genişle, genişletmek == genişlemek)
 * - Phrase root tolerance (daha önce in önceden)
 * - Extra synonym expansion (poet -> şiir, şair, ozan; formerly -> önce, daha önce)
 * - Parentheses removed ((bir yere) gitmek -> gitmek)
 * - 1-letter typo flagged as isAlmostCorrect (without accepting as correct)
 */
export function checkSnakeAnswer(
  rawInput: string,
  targetWord: Word,
  synonymTrMap?: Map<string, string[]>
): CheckSnakeAnswerResult {
  const displayTurkish = targetWord.tr || '';
  if (!rawInput || !rawInput.trim()) {
    return { isCorrect: false, isAlmostCorrect: false, displayTurkish };
  }

  const inputClean = cleanTurkishText(rawInput);
  if (!inputClean) {
    return { isCorrect: false, isAlmostCorrect: false, displayTurkish };
  }

  const cleanEn = cleanEnglishWord(targetWord.en);
  let acceptedMeanings: string[] = [];

  if (synonymTrMap && synonymTrMap.has(cleanEn)) {
    acceptedMeanings = synonymTrMap.get(cleanEn)!;
  } else if (targetWord.tr) {
    acceptedMeanings = targetWord.tr
      .split(/[,;\/]+/)
      .map(m => cleanTurkishText(m))
      .filter(Boolean);
  }

  // Include extra synonyms if available
  const extra = EXTRA_TURKISH_SYNONYMS[cleanEn];
  if (extra) {
    for (const item of extra) {
      const c = cleanTurkishText(item);
      if (c && !acceptedMeanings.includes(c)) acceptedMeanings.push(c);
    }
  }

  if (targetWord.tr) {
    targetWord.tr.split(/[,;\/]+/).forEach(m => {
      const c = cleanTurkishText(m);
      if (c && !acceptedMeanings.includes(c)) acceptedMeanings.push(c);
    });
  }

  // 1. Direct or Verb Stem / Root / Phrase match check
  for (const meaning of acceptedMeanings) {
    if (matchSingleTurkishMeaning(inputClean, meaning)) {
      return {
        isCorrect: true,
        isAlmostCorrect: false,
        matchedMeaning: meaning,
        displayTurkish
      };
    }
  }

  // Also check if user typed the full raw targetWord.tr
  if (matchSingleTurkishMeaning(inputClean, targetWord.tr)) {
    return {
      isCorrect: true,
      isAlmostCorrect: false,
      matchedMeaning: targetWord.tr,
      displayTurkish
    };
  }

  // 2. Near match check (1-letter typo)
  let isAlmostCorrect = false;
  let nearExplanation: string | undefined;
  const inputStrip = stripTurkishAccents(inputClean);

  for (const meaning of acceptedMeanings) {
    const meaningStrip = stripTurkishAccents(meaning);

    const wordsInMeaning = meaningStrip.split(/\s+/);
    if (wordsInMeaning.length > 1 && wordsInMeaning.includes(inputStrip)) {
      isAlmostCorrect = true;
      nearExplanation = `Çok yakın! Tam karşılık: "${meaning}"`;
      break;
    }

    if (Math.abs(inputStrip.length - meaningStrip.length) <= 1 && meaningStrip.length >= 3) {
      const dist = getDamerauLevenshteinDistance(inputStrip, meaningStrip);
      if (dist === 1) {
        isAlmostCorrect = true;
        nearExplanation = `1 harf fark var! Doğrusu: "${meaning}"`;
        break;
      }
    }
  }

  return {
    isCorrect: false,
    isAlmostCorrect,
    nearExplanation,
    displayTurkish
  };
}

/**
 * Queue manager that enforces:
 * - MAX_ASKS_PER_WORD (default: 2): Max 2 asks per word in the entire game (1 initial + 1 retry if wrong/pass)
 * - RETRY_GAP_MIN (6) / RETRY_GAP_MAX (10): Retry comes 6-10 questions later
 * - WEAK_WORD_SHARE (0.25): Max 25% of questions come from DB weak words
 * - Words asked in this session are excluded from general pool (never immediate repeats)
 */
export class SnakeQueueManager {
  private static sessionGlobalAskedIds = new Set<number>();
  private allWords: Word[];
  private _progressMap: Map<number, Progress>;
  private config: SnakeGameConfig;
  private recentWordIds: number[] = [];
  private askedWordIds = new Set<number>(); // Words already asked in this game
  private sessionWeakWordIds = new Set<number>();
  private stepCounter = 0;

  constructor(allWords: Word[], progressMap: Map<number, Progress>, config: SnakeGameConfig) {
    this.allWords = allWords.filter(w => w.en && w.tr);
    this._progressMap = progressMap;
    this.config = config;
  }

  public getProgressMap() {
    return this._progressMap;
  }

  public updateConfig(newConfig: SnakeGameConfig) {
    this.config = newConfig;
  }

  public getAskedCount(wordId: number): number {
    return this.askedWordIds.has(wordId) ? 1 : 0;
  }

  /**
   * Tracks weak words for game-over recap only, NO IN-GAME RE-ASKING!
   */
  public enqueueWeakWord(word: Word): boolean {
    this.sessionWeakWordIds.add(word.id);
    return false; // As requested: never repeat the same word in a game!
  }

  public resolveWeakWordIfCorrect(word: Word): void {
    this.sessionWeakWordIds.delete(word.id);
  }

  private pickRandom<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  public getNextWord(): Word {
    this.stepCounter++;

    // 1. Candidate pool: words NOT asked in this game and NOT in recent buffer
    let unaskedWords = this.allWords.filter(
      w => !this.askedWordIds.has(w.id) && !this.recentWordIds.includes(w.id)
    );

    // Also prefer words that haven't been asked in recent games in this user session
    const freshSessionWords = unaskedWords.filter(
      w => !SnakeQueueManager.sessionGlobalAskedIds.has(w.id)
    );
    const pool = freshSessionWords.length > 20 ? freshSessionWords : (unaskedWords.length > 0 ? unaskedWords : this.allWords);

    // 2. Normal distribution by CEFR level
    const rand = Math.random();
    let targetLevels: WordLevel[];

    if (rand < this.config.levelWeights.A1_A2) {
      targetLevels = ['A1', 'A2'];
    } else if (rand < this.config.levelWeights.A1_A2 + this.config.levelWeights.B1) {
      targetLevels = ['B1'];
    } else if (rand < this.config.levelWeights.A1_A2 + this.config.levelWeights.B1 + this.config.levelWeights.B2) {
      targetLevels = ['B2'];
    } else if (rand < this.config.levelWeights.A1_A2 + this.config.levelWeights.B1 + this.config.levelWeights.B2 + this.config.levelWeights.C1) {
      targetLevels = ['C1'];
    } else {
      targetLevels = ['C2', 'default'];
    }

    let candidates = pool.filter(w => {
      const lvl = getWordLevel(w);
      return targetLevels.includes(lvl);
    });

    if (candidates.length === 0) {
      candidates = pool;
    }
    if (candidates.length === 0) {
      candidates = this.allWords.filter(w => !this.recentWordIds.includes(w.id));
    }
    if (candidates.length === 0) {
      candidates = this.allWords;
    }

    const selected = this.pickRandom(candidates) || this.allWords[0];
    this.askedWordIds.add(selected.id);
    this.recordRecent(selected.id);
    return selected;
  }

  private recordRecent(id: number): void {
    this.recentWordIds.push(id);
    SnakeQueueManager.sessionGlobalAskedIds.add(id);

    // Keep session history bounded to 300 words
    if (SnakeQueueManager.sessionGlobalAskedIds.size > 300) {
      const first = SnakeQueueManager.sessionGlobalAskedIds.values().next().value;
      if (first !== undefined) SnakeQueueManager.sessionGlobalAskedIds.delete(first);
    }

    // Keep recent within-game buffer to 100 words
    if (this.recentWordIds.length > 100) {
      this.recentWordIds.shift();
    }
  }
}
