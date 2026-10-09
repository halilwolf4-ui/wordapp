import { Word } from '../types';

export interface DictionaryResult {
  en: string;
  tr: string;
  ipa?: string;
  exampleEn?: string;
  exampleTr?: string;
  source: 'local' | 'online';
}

/**
 * Normalizes an English word for dictionary lookup:
 * lowercases, trims, strips punctuation and leading "to " infinitive prefix if needed.
 */
export function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

/**
 * Searches the local database of words (from words.json / Dexie) for an English match.
 */
export function lookupLocalWord(query: string, allWords: Word[]): DictionaryResult | null {
  const q = normalizeWord(query);
  if (!q) return null;

  // 1. Exact match
  let match = allWords.find(w => normalizeWord(w.en) === q);

  // 2. Try with or without "to " prefix (e.g., "to run" vs "run")
  if (!match) {
    if (q.startsWith('to ')) {
      const stripped = q.slice(3).trim();
      match = allWords.find(w => normalizeWord(w.en) === stripped);
    } else {
      const withTo = `to ${q}`;
      match = allWords.find(w => normalizeWord(w.en) === withTo);
    }
  }

  // 3. Try matching base words if query has plurals or suffixes
  if (!match && q.endsWith('s') && q.length > 3) {
    const singular = q.slice(0, -1);
    match = allWords.find(w => normalizeWord(w.en) === singular);
  }

  if (!match) return null;

  const firstExample = match.examples && match.examples.length > 0 ? match.examples[0] : undefined;

  return {
    en: match.en,
    tr: match.tr,
    ipa: match.ipa || undefined,
    exampleEn: firstExample ? firstExample.en : undefined,
    exampleTr: firstExample ? firstExample.tr : undefined,
    source: 'local'
  };
}

/**
 * Looks up a word using free online dictionary & translation services (timeout protected).
 */
export async function lookupOnlineWord(query: string): Promise<DictionaryResult | null> {
  const q = normalizeWord(query);
  if (!q) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // 1. Dictionary API for phonetics & example sentences
    const dictPromise = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`, {
      signal: controller.signal
    })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);

    // 2. Translation API for Turkish translation
    const transUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&dt=bd&q=${encodeURIComponent(q)}`;
    const transPromise = fetch(transUrl, { signal: controller.signal })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null);

    const [dictData, transData] = await Promise.all([dictPromise, transPromise]);
    clearTimeout(timeoutId);

    // Parse Turkish translation
    let trTranslation = '';
    if (Array.isArray(transData) && Array.isArray(transData[0])) {
      const parts = transData[0].map((item: unknown) => (Array.isArray(item) ? item[0] : '')).filter(Boolean);
      trTranslation = parts.join(' ').trim();
    }

    // Parse IPA and example from Dictionary API
    let ipa: string | undefined = undefined;
    let exampleEn: string | undefined = undefined;

    if (Array.isArray(dictData) && dictData.length > 0) {
      const entry = dictData[0];
      if (entry.phonetic) {
        ipa = entry.phonetic;
      } else if (Array.isArray(entry.phonetics)) {
        const pWithText = entry.phonetics.find((p: { text?: string }) => !!p.text);
        if (pWithText) ipa = pWithText.text;
      }

      // Search for an example sentence
      if (Array.isArray(entry.meanings)) {
        for (const meaning of entry.meanings) {
          if (Array.isArray(meaning.definitions)) {
            for (const def of meaning.definitions) {
              if (def.example) {
                exampleEn = def.example;
                break;
              }
            }
          }
          if (exampleEn) break;
        }
      }
    }

    if (!trTranslation && !ipa && !exampleEn) {
      return null;
    }

    // Wrap example word with #word# highlighting if available
    let formattedExampleEn = exampleEn;
    let formattedExampleTr: string | undefined = undefined;

    if (exampleEn) {
      // Highlight the word if present
      const reg = new RegExp(`\\b(${q})\\b`, 'gi');
      if (reg.test(exampleEn)) {
        formattedExampleEn = exampleEn.replace(reg, '#$1#');
      }

      // Translate example sentence to Turkish
      try {
        const exTransUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(exampleEn)}`;
        const exRes = await fetch(exTransUrl);
        if (exRes.ok) {
          const exData = await exRes.json();
          if (Array.isArray(exData) && Array.isArray(exData[0])) {
            formattedExampleTr = exData[0].map((item: unknown) => (Array.isArray(item) ? item[0] : '')).join(' ').trim();
          }
        }
      } catch {
        // Ignore example sentence translation error
      }
    }

    return {
      en: q,
      tr: trTranslation || q,
      ipa,
      exampleEn: formattedExampleEn,
      exampleTr: formattedExampleTr,
      source: 'online'
    };
  } catch (err) {
    console.warn('Online dictionary lookup error:', err);
    return null;
  }
}

/**
 * Main lookup function:
 * First checks local 6,120+ words dictionary.
 * If not found, attempts online dictionary lookup.
 */
export async function lookupWord(
  query: string,
  allWords: Word[],
  allowOnline = true
): Promise<DictionaryResult | null> {
  const localResult = lookupLocalWord(query, allWords);
  if (localResult) {
    return localResult;
  }

  if (allowOnline) {
    return await lookupOnlineWord(query);
  }

  return null;
}
