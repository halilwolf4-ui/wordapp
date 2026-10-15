/**
 * Normalizes and checks Turkish answer input against multi-meaning dictionary entries.
 * Example:
 *   tr: "kol, silah"
 *   input: "kol" -> TRUE
 *   input: "silah" -> TRUE
 *   input: "  KOL " -> TRUE
 */

function normalizeText(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ');
}

// Remove Turkish accents for relaxed matching
function stripAccents(text: string): string {
  return text
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u');
}

export function checkTurkishAnswer(input: string, correctTr: string): boolean {
  if (!input || !correctTr) return false;

  const normalizedInput = normalizeText(input);
  if (!normalizedInput) return false;

  const strippedInput = stripAccents(normalizedInput);

  // Split target meanings by comma, semicolon or slash
  const meanings = correctTr
    .split(/[,;/]+/)
    .map(m => m.trim())
    .filter(Boolean);

  for (const meaning of meanings) {
    const normMeaning = normalizeText(meaning);
    const stripMeaning = stripAccents(normMeaning);

    // Exact or accent-insensitive match
    if (normalizedInput === normMeaning || strippedInput === stripMeaning) {
      return true;
    }

    // Also match without parentheses (e.g. "gitmek (bir yere)")
    const cleanMeaning = normMeaning.replace(/\([^)]*\)/g, '').trim();
    if (cleanMeaning && (normalizedInput === cleanMeaning || strippedInput === stripAccents(cleanMeaning))) {
      return true;
    }
  }

  // Also check if user typed the entire full string
  const fullNorm = normalizeText(correctTr);
  if (normalizedInput === fullNorm || strippedInput === stripAccents(fullNorm)) {
    return true;
  }

  return false;
}

function damerauLevenshtein(a: string, b: string): number {
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
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[a.length][b.length];
}

export interface TurkishAnswerMatchResult {
  isCorrect: boolean;
  isNear: boolean;
  nearExplanation?: string;
}

export function checkTurkishAnswerDetailed(input: string, correctTr: string): TurkishAnswerMatchResult {
  const isCorrect = checkTurkishAnswer(input, correctTr);
  if (isCorrect) {
    return { isCorrect: true, isNear: false };
  }

  if (!input || !correctTr) {
    return { isCorrect: false, isNear: false };
  }

  const normalizedInput = normalizeText(input);
  const strippedInput = stripAccents(normalizedInput);
  if (!normalizedInput) {
    return { isCorrect: false, isNear: false };
  }

  const meanings = correctTr
    .split(/[,;/]+/)
    .map(m => m.trim())
    .filter(Boolean);

  for (const meaning of meanings) {
    const normMeaning = normalizeText(meaning);
    const stripMeaning = stripAccents(normMeaning);

    // 1. Is user's input a standalone word inside a multi-word phrase?
    // e.g. "küçük alet" contains "alet" -> near match!
    const wordsInMeaning = normMeaning.split(/\s+/);
    const stripWordsInMeaning = stripMeaning.split(/\s+/);

    if (wordsInMeaning.includes(normalizedInput) || stripWordsInMeaning.includes(strippedInput)) {
      return {
        isCorrect: false,
        isNear: true,
        nearExplanation: `Çok yakın! Tam karşılık: "${meaning}"`
      };
    }

    // 2. Damerau-Levenshtein distance: 1 edit (typo/swap) for words of length >= 4
    if (Math.abs(normalizedInput.length - normMeaning.length) <= 1 && normMeaning.length >= 4) {
      const dist = damerauLevenshtein(strippedInput, stripMeaning);
      if (dist === 1) {
        return {
          isCorrect: false,
          isNear: true,
          nearExplanation: `1 harf fark var! Doğrusu: "${meaning}"`
        };
      }
    }
  }

  return { isCorrect: false, isNear: false };
}
