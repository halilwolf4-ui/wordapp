import { Word, Progress } from '../types';

/**
 * Normalizes English text for exact key comparison.
 * - Trims whitespace
 * - Converts to lowercase
 * - Collapses multiple spaces to single space
 * - Strips leading & trailing non-alphanumeric punctuation
 * - IMPORTANT: "to " prefix is strictly PRESERVED!
 */
export function exactKey(en: string): string {
  if (!en) return '';
  return en
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
}

/**
 * Base key for semantic group discovery:
 * exactKey with any leading "to " prefix stripped.
 */
export function baseKey(en: string): string {
  return exactKey(en).replace(/^to\s+/i, '').trim();
}

/**
 * Bi-directional Turkish translation overlap check.
 * Splits translations by comma, semicolon, or slash,
 * and checks if any part mutually contains another (partA.includes(partB) || partB.includes(partA)).
 */
export function checkTurkishOverlap(trA: string, trB: string): boolean {
  if (!trA || !trB) return false;

  const cleanParts = (s: string): string[] =>
    s
      .toLowerCase()
      .split(/[,;/]+/)
      .map(p => p.trim().replace(/^[^a-zçğıöşü0-9]+|[^a-zçğıöşü0-9]+$/g, ''))
      .filter(p => p.length >= 2);

  const partsA = cleanParts(trA);
  const partsB = cleanParts(trB);

  for (const a of partsA) {
    for (const b of partsB) {
      if (a === b || a.includes(b) || b.includes(a)) {
        return true;
      }
    }
  }

  return false;
}

export type MatchResult =
  | { type: 'exact'; word: Word }
  | { type: 'single_base'; word: Word }
  | { type: 'resolved'; word: Word; reason: 'has_to' | 'no_to' | 'tr_overlap' }
  | { type: 'ambiguous'; candidates: Word[] }
  | { type: 'new_word' };

/**
 * Evaluates candidate words from allWords for an input English word and optional Turkish meaning.
 * Follows strict 4-step matching hierarchy:
 * 1) exactKey match -> selects that word (if multiple exact matches, chooses most advanced progress).
 * 2) baseKey candidate list. If single candidate:
 *    - if inputTr provided and does NOT overlap candidate.tr -> returns 'ambiguous' (no silent mismatch).
 *    - if no inputTr or overlap matches -> returns 'single_base'.
 * 3) If multiple baseCandidates:
 *    - if user input has "to ", picks verb candidate.
 *    - if user input lacks "to ", picks noun candidate.
 *    - if still unresolved, checks tr overlap.
 *    - if still unresolved, returns 'ambiguous'.
 * 4) If no baseCandidates -> returns 'new_word'.
 */
export function matchWordCandidate(
  inputEn: string,
  inputTr: string = '',
  allWords: Word[],
  progressMap?: Map<number, Progress>
): MatchResult {
  const ex = exactKey(inputEn);
  if (!ex) return { type: 'new_word' };

  // Helper to score a word by learning progress (mastered > learning > new; then highest step)
  const getProgressScore = (wId: number): number => {
    if (!progressMap) return 0;
    const p = progressMap.get(wId);
    if (!p) return 0;
    const statusWeight = p.status === 'mastered' ? 100 : p.status === 'learning' ? 50 : 10;
    return statusWeight + (p.step || 0);
  };

  // 1) exactKey match
  const exactMatches = allWords.filter(w => exactKey(w.en) === ex);
  if (exactMatches.length === 1) {
    return { type: 'exact', word: exactMatches[0] };
  }
  if (exactMatches.length > 1) {
    // Pick the one with the most advanced progress (not just first element)
    const sorted = [...exactMatches].sort((a, b) => {
      const scoreDiff = getProgressScore(b.id) - getProgressScore(a.id);
      if (scoreDiff !== 0) return scoreDiff;
      return a.id - b.id;
    });
    return { type: 'exact', word: sorted[0] };
  }

  // 2) baseKey candidates
  const bk = baseKey(inputEn);
  const baseCandidates = allWords.filter(w => baseKey(w.en) === bk);

  if (baseCandidates.length === 0) {
    return { type: 'new_word' };
  }

  // Single base candidate
  if (baseCandidates.length === 1) {
    const single = baseCandidates[0];
    // If user entered Turkish translation, verify it overlaps
    if (inputTr && inputTr.trim()) {
      const overlaps = checkTurkishOverlap(inputTr, single.tr);
      if (!overlaps) {
        return { type: 'ambiguous', candidates: [single] };
      }
    }
    return { type: 'single_base', word: single };
  }

  // 3) Multiple base candidates (e.g. noun + verb pair)
  const userHasTo = /^to\s+/i.test(inputEn.trim());
  if (userHasTo) {
    const verbCandidate = baseCandidates.find(w => /^to\s+/i.test(w.en.trim()));
    if (verbCandidate) {
      return { type: 'resolved', word: verbCandidate, reason: 'has_to' };
    }
  } else {
    const nounCandidate = baseCandidates.find(w => !/^to\s+/i.test(w.en.trim()));
    if (nounCandidate) {
      return { type: 'resolved', word: nounCandidate, reason: 'no_to' };
    }
  }

  // Meaning overlap check if still ambiguous
  if (inputTr && inputTr.trim()) {
    const matchingByTr = baseCandidates.filter(w => checkTurkishOverlap(inputTr, w.tr));
    if (matchingByTr.length === 1) {
      return { type: 'resolved', word: matchingByTr[0], reason: 'tr_overlap' };
    }
  }

  return { type: 'ambiguous', candidates: baseCandidates };
}

