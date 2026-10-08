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
