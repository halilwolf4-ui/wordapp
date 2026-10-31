import { Word, Progress } from '../types';

export interface LetterCandidate {
  wordId: number;
  en: string; // "to" stripped e.g. "benefit"
  tr: string; // single Turkish word e.g. "fayda"
  colIndex: number; // 0-based index in tr where the letter is located
  word: Word;
}

export type CandidatePool = '1a' | '1' | '2';

export interface SecretWordRow {
  rowId: number;
  letter: string; // Secret letter on spine (uppercase e.g. 'F')
  wordId: number;
  en: string; // English clue word
  tr: string; // Turkish target answer
  colIndex: number; // Index in tr where letter is
  pool: CandidatePool;
  isUserWord: boolean;
  paddingLeft: number; // Empty columns before this word in the 13-column grid
  paddingRight: number; // Empty columns after this word in the 13-column grid
  word: Word;
}

export interface SecretWordPuzzle {
  id: string; // unique puzzle id
  targetWord: Word;
  cleanTarget: string; // Uppercase target English word e.g. "FRAGILE"
  targetTr: string; // Turkish definition of target
  rows: SecretWordRow[];
  spineColumnIndex: number; // 0-based column index where the spine resides (maxLeft)
  totalWidth: number; // <= 13
  userWordCount: number;
  totalRows: number;
  userWordPercentage: number; // Math.round((userWordCount / totalRows) * 100)
}

export interface SecretWordSessionState {
  usedTargetWordIds: Set<number>;
  usedRowWordIds: Set<number>;
  indexes?: {
    pool1a: Map<string, LetterCandidate[]>;
    pool1: Map<string, LetterCandidate[]>;
    pool2: Map<string, LetterCandidate[]>;
  };
  nextPuzzle?: SecretWordPuzzle | null;
}

const RARE_LETTERS = new Set(['f', 'v', 'j', 'z', 'p', 'b', 'c', 'g', 'h']);

const B1_C2_CATEGORIES = new Set([
  'oxford3000_b1',
  'oxford3000_b2',
  'oxford5000_b2',
  'oxford5000_c1',
  'yokdil',
  'yds',
  'top3000',
  'career',
  'business',
  'economy',
  'legal_english',
  'politics',
  'psychology',
  'literature'
]);

/**
 * Strips leading "to " infinitive marker and trims English word.
 */
export function cleanEnglishWord(en: string): string {
  return en.trim().replace(/^to\s+/i, '').trim();
}

/**
 * Normalizes a character for matching with English target letters.
 * Rules:
 *  - ı/i and İ/I are considered equal (maps to 'i').
 *  - ç, ş, ğ, ö, ü do NOT match English letters (returns null).
 *  - Standard a-z matches directly.
 */
export function normalizeCharForIndex(ch: string): string | null {
  const c = ch.toLocaleLowerCase('tr-TR');
  if (c === 'i' || c === 'ı') return 'i';
  if (c >= 'a' && c <= 'z') return c;
  return null;
}

/**
 * Checks if an English word is a valid target candidate.
 * Must be 5-9 letters, only a-z, without q, w, x (since Turkish words do not contain q,w,x).
 */
export function isValidTargetWord(word: Word): boolean {
  const en = cleanEnglishWord(word.en).toLowerCase();
  if (!/^[a-z]+$/.test(en)) return false;
  if (en.length < 5 || en.length > 9) return false;
  if (/[qwx]/.test(en)) return false;
  return true;
}

/**
 * Checks whether a word is weighted towards B1-C2 levels.
 */
export function isB1ToC2Word(word: Word): boolean {
  if (!word.categories || word.categories.length === 0) return false;
  return word.categories.some(cat => B1_C2_CATEGORIES.has(cat.toLowerCase()));
}

/**
 * Builds a letter index (letter -> LetterCandidate[]) for a given list of words.
 */
export function buildPoolIndex(words: Word[]): Map<string, LetterCandidate[]> {
  const map = new Map<string, LetterCandidate[]>();
  for (let c = 97; c <= 122; c++) {
    map.set(String.fromCharCode(c), []);
  }

  for (const w of words) {
    if (!w.tr) continue;
    const cleanEn = cleanEnglishWord(w.en);
    // Split by comma, semicolon, slash
    const parts = w.tr
      .split(/[,;/]+/)
      .map(p => p.replace(/\([^)]*\)/g, '').trim())
      .filter(Boolean);

    for (const part of parts) {
      // Must be single-word and <= 9 characters
      if (part.includes(' ') || part.includes('-')) continue;
      if (part.length < 2 || part.length > 9) continue;

      for (let i = 0; i < part.length; i++) {
        const key = normalizeCharForIndex(part[i]);
        if (key && map.has(key)) {
          map.get(key)!.push({
            wordId: w.id,
            en: cleanEn,
            tr: part,
            colIndex: i,
            word: w
          });
        }
      }
    }
  }

  return map;
}

/**
 * Partitions the full vocabulary into Havuz 1a (weak user words), Havuz 1 (user words),
 * and Havuz 2 (general words).
 */
export function partitionWordPools(
  allWords: Word[],
  progressMap: Map<number, Progress>
): {
  weakUserWords: Word[];
  userWords: Word[];
  generalWords: Word[];
} {
  const userWords: Word[] = [];
  const weakUserWords: Word[] = [];
  const generalWords: Word[] = allWords;

  for (const w of allWords) {
    const prog = progressMap.get(w.id);
    if (!prog) continue;

    const isUserStudying =
      prog.status === 'learning' ||
      prog.status === 'mastered' ||
      prog.step > 0 ||
      prog.lapses > 0 ||
      prog.totalCorrect > 0 ||
      prog.totalWrong > 0;

    if (isUserStudying) {
      userWords.push(w);

      const isWeak =
        prog.lapses > 0 ||
        prog.totalWrong > prog.totalCorrect ||
        prog.step <= 2 ||
        prog.status === 'learning';

      if (isWeak) {
        weakUserWords.push(w);
      }
    }
  }

  return { weakUserWords, userWords, generalWords };
}

/**
 * Tries to construct a puzzle for a specific target word given letter indexes.
 * Enforces:
 *  - no duplicate words across rows
 *  - target's own word not used in rows
 *  - maximum 13 columns width alignment
 *  - priority: 1a -> 1 -> 2
 */
export function generatePuzzleForTarget(
  targetWord: Word,
  pool1a: Map<string, LetterCandidate[]>,
  pool1: Map<string, LetterCandidate[]>,
  pool2: Map<string, LetterCandidate[]>,
  sessionUsedRowWordIds: Set<number>
): SecretWordPuzzle | null {
  const cleanEn = cleanEnglishWord(targetWord.en).toLowerCase();
  const letters = cleanEn.split('');
  const chosenRows: Array<LetterCandidate & { pool: CandidatePool }> = [];
  const puzzleUsedWordIds = new Set<number>();
  puzzleUsedWordIds.add(targetWord.id);

  let currentMaxLeft = 0;
  let currentMaxRight = 0;

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const c1a = pool1a.get(letter) || [];
    const c1 = pool1.get(letter) || [];
    const c2 = pool2.get(letter) || [];

    const filterCandidates = (
      candidatesList: LetterCandidate[],
      poolName: CandidatePool
    ) => {
      const result: Array<LetterCandidate & { pool: CandidatePool; fitsWidth: boolean }> = [];
      for (const item of candidatesList) {
        if (puzzleUsedWordIds.has(item.wordId)) continue;
        const nLeft = Math.max(currentMaxLeft, item.colIndex);
        const nRight = Math.max(currentMaxRight, item.tr.length - 1 - item.colIndex);
        if (nLeft + 1 + nRight <= 13) {
          result.push({ ...item, pool: poolName, fitsWidth: true });
        }
      }
      return result;
    };

    let validCandidates = filterCandidates(c1a, '1a');
    if (validCandidates.length === 0) {
      validCandidates = filterCandidates(c1, '1');
    }

    // If rare letter or pool 1 produced no candidate fitting the 13-col width, fallback to pool 2
    if (validCandidates.length === 0 || (RARE_LETTERS.has(letter) && Math.random() < 0.4)) {
      const pool2Filtered = filterCandidates(c2, '2');
      if (validCandidates.length === 0) {
        validCandidates = pool2Filtered;
      } else {
        validCandidates = validCandidates.concat(pool2Filtered);
      }
    }

    if (validCandidates.length === 0) {
      return null; // Could not find a row candidate for this letter within 13 width
    }

    // Sort candidates to prefer:
    // 1. Not used in earlier puzzles of this session
    // 2. Pool 1a > Pool 1 > Pool 2
    // 3. More balanced colIndex (closer to currentMaxLeft)
    validCandidates.sort((a, b) => {
      const aUsed = sessionUsedRowWordIds.has(a.wordId) ? 1 : 0;
      const bUsed = sessionUsedRowWordIds.has(b.wordId) ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;

      const sa = a.pool === '1a' ? 3 : a.pool === '1' ? 2 : 1;
      const sb = b.pool === '1a' ? 3 : b.pool === '1' ? 2 : 1;
      if (sa !== sb) return sb - sa;

      return Math.abs(a.colIndex - currentMaxLeft) - Math.abs(b.colIndex - currentMaxLeft);
    });

    // Pick among the top candidates with slight randomness
    const topCandidates = validCandidates.slice(0, Math.min(4, validCandidates.length));
    const chosen = topCandidates[Math.floor(Math.random() * topCandidates.length)];

    chosenRows.push(chosen);
    puzzleUsedWordIds.add(chosen.wordId);
    currentMaxLeft = Math.max(currentMaxLeft, chosen.colIndex);
    currentMaxRight = Math.max(currentMaxRight, chosen.tr.length - 1 - chosen.colIndex);
  }

  const spineColumnIndex = currentMaxLeft;
  const totalWidth = currentMaxLeft + 1 + currentMaxRight;

  const rows: SecretWordRow[] = chosenRows.map((r, idx) => {
    const paddingLeft = spineColumnIndex - r.colIndex;
    const paddingRight = totalWidth - (paddingLeft + r.tr.length);
    const isUserWord = r.pool === '1' || r.pool === '1a';

    return {
      rowId: idx,
      letter: letters[idx].toUpperCase(),
      wordId: r.wordId,
      en: r.en,
      tr: r.tr,
      colIndex: r.colIndex,
      pool: r.pool,
      isUserWord,
      paddingLeft,
      paddingRight,
      word: r.word
    };
  });

  const userWordCount = rows.filter(r => r.isUserWord).length;
  const totalRows = rows.length;
  const userWordPercentage = Math.round((userWordCount / totalRows) * 100);

  return {
    id: `puzzle_${targetWord.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    targetWord,
    cleanTarget: cleanEn.toUpperCase(),
    targetTr: targetWord.tr,
    rows,
    spineColumnIndex,
    totalWidth,
    userWordCount,
    totalRows,
    userWordPercentage
  };
}

/**
 * Main generator function that:
 * 1. Collects target candidates (prioritizing user words & B1-C2 levels).
 * 2. Tries up to 30 target candidates.
 * 3. Builds a puzzle for each and selects the one with the HIGHEST user-word count.
 * 4. Gracefully scales with general pool if user has < 100 words.
 */
export function generateSecretWordPuzzle(
  allWords: Word[],
  progressMap: Map<number, Progress>,
  sessionState?: SecretWordSessionState
): SecretWordPuzzle {
  const { weakUserWords, userWords, generalWords } = partitionWordPools(allWords, progressMap);

  // Build indexes if not provided in sessionState
  let indexes = sessionState?.indexes;
  if (!indexes) {
    indexes = {
      pool1a: buildPoolIndex(weakUserWords),
      pool1: buildPoolIndex(userWords),
      pool2: buildPoolIndex(generalWords)
    };
    if (sessionState) {
      sessionState.indexes = indexes;
    }
  }

  const usedTargets = sessionState?.usedTargetWordIds || new Set<number>();
  const usedRows = sessionState?.usedRowWordIds || new Set<number>();

  // 1. Target word candidate pool
  let targetCandidates: Word[] = userWords.filter(
    w => isValidTargetWord(w) && !usedTargets.has(w.id)
  );

  // If user has few words (< 100 or < 15 valid targets), gracefully fallback to general words
  const userWordCount = userWords.length;
  if (userWordCount < 100 || targetCandidates.length < 15) {
    const generalValid = generalWords.filter(
      w => isValidTargetWord(w) && !usedTargets.has(w.id)
    );
    // Add B1-C2 general words
    targetCandidates = targetCandidates.concat(generalValid.slice(0, 50));
  }

  // If all targets were exhausted in session, reset usedTargets
  if (targetCandidates.length === 0) {
    usedTargets.clear();
    targetCandidates = userWords
      .concat(generalWords)
      .filter(w => isValidTargetWord(w));
  }

  // Weight candidates towards B1-C2 levels
  targetCandidates.sort((a, b) => {
    const aB1 = isB1ToC2Word(a) ? 1 : 0;
    const bB1 = isB1ToC2Word(b) ? 1 : 0;
    if (aB1 !== bB1) return bB1 - aB1;
    return Math.random() - 0.5;
  });

  // Try up to 30 target candidates
  const sampleTargets = targetCandidates.slice(0, Math.min(30, targetCandidates.length));
  let bestPuzzle: SecretWordPuzzle | null = null;

  for (const target of sampleTargets) {
    const puzzle = generatePuzzleForTarget(
      target,
      indexes.pool1a,
      indexes.pool1,
      indexes.pool2,
      usedRows
    );

    if (puzzle) {
      if (!bestPuzzle || puzzle.userWordCount > bestPuzzle.userWordCount) {
        bestPuzzle = puzzle;
        // If 100% of rows are from user words, we can stop early
        if (puzzle.userWordCount === puzzle.totalRows) {
          break;
        }
      }
    }
  }

  // Fallback: If no candidate among sampleTargets produced a valid puzzle, try general pool targets
  if (!bestPuzzle) {
    const generalFallbackTargets = generalWords
      .filter(w => isValidTargetWord(w))
      .sort(() => Math.random() - 0.5)
      .slice(0, 30);

    for (const target of generalFallbackTargets) {
      const puzzle = generatePuzzleForTarget(
        target,
        indexes.pool1a,
        indexes.pool1,
        indexes.pool2,
        new Set<number>()
      );
      if (puzzle) {
        bestPuzzle = puzzle;
        break;
      }
    }
  }

  if (!bestPuzzle) {
    throw new Error('Bulmaca oluşturulamadı: Uygun kelime eşleşmesi bulunamadı.');
  }

  // Register used words in session
  if (sessionState) {
    sessionState.usedTargetWordIds.add(bestPuzzle.targetWord.id);
    for (const row of bestPuzzle.rows) {
      sessionState.usedRowWordIds.add(row.wordId);
    }
  }

  return bestPuzzle;
}

/**
 * Stateful manager for Secret Word sessions.
 * Manages pools, indexes, session word deduplication, and background pre-generation.
 */
export class SecretWordSessionManager {
  private allWords: Word[];
  private progressMap: Map<number, Progress>;
  public sessionState: SecretWordSessionState;

  constructor(allWords: Word[], progressMap: Map<number, Progress>) {
    this.allWords = allWords;
    this.progressMap = progressMap;
    this.sessionState = {
      usedTargetWordIds: new Set<number>(),
      usedRowWordIds: new Set<number>()
    };
    this.initIndexes();
  }

  public initIndexes() {
    const { weakUserWords, userWords, generalWords } = partitionWordPools(
      this.allWords,
      this.progressMap
    );
    this.sessionState.indexes = {
      pool1a: buildPoolIndex(weakUserWords),
      pool1: buildPoolIndex(userWords),
      pool2: buildPoolIndex(generalWords)
    };
  }

  /**
   * Returns a fresh puzzle. If a background pre-generated puzzle is ready, returns it
   * and immediately triggers generation for the subsequent puzzle in the background.
   */
  public getNextPuzzle(): SecretWordPuzzle {
    let puzzle: SecretWordPuzzle;
    if (this.sessionState.nextPuzzle) {
      puzzle = this.sessionState.nextPuzzle;
      this.sessionState.nextPuzzle = null;
    } else {
      puzzle = generateSecretWordPuzzle(this.allWords, this.progressMap, this.sessionState);
    }

    // Pre-generate subsequent puzzle in background / idle
    this.preGenerateBackground();

    return puzzle;
  }

  /**
   * Asynchronously pre-generates the next puzzle so that user never waits.
   */
  public preGenerateBackground() {
    setTimeout(() => {
      try {
        if (!this.sessionState.nextPuzzle) {
          this.sessionState.nextPuzzle = generateSecretWordPuzzle(
            this.allWords,
            this.progressMap,
            this.sessionState
          );
        }
      } catch (err) {
        console.warn('SecretWord pregeneration warning:', err);
      }
    }, 50);
  }

  public updateData(allWords: Word[], progressMap: Map<number, Progress>) {
    this.allWords = allWords;
    this.progressMap = progressMap;
    this.initIndexes();
  }
}

