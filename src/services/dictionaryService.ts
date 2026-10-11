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
 * lowercases, trims, and strips surrounding punctuation.
 */
export function normalizeWord(word: string): string {
  if (!word) return '';
  return word
    .trim()
    .toLowerCase()
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
}

/**
 * Generates root candidate words for morphological lookup (plurals, verb tenses, adverbs).
 */
export function getWordCandidates(word: string): string[] {
  const q = normalizeWord(word);
  if (!q) return [];

  const candidates: string[] = [q];

  // "to " prefix handling
  if (q.startsWith('to ')) {
    candidates.push(q.slice(3).trim());
  } else {
    candidates.push(`to ${q}`);
  }

  // Plurals
  if (q.endsWith('ies') && q.length > 4) {
    candidates.push(q.slice(0, -3) + 'y');
  }
  if (q.endsWith('es') && q.length > 4) {
    candidates.push(q.slice(0, -2));
  }
  if (q.endsWith('s') && !q.endsWith('ss') && q.length > 3) {
    candidates.push(q.slice(0, -1));
  }

  // Past tense / participles (-ed)
  if (q.endsWith('ied') && q.length > 4) {
    candidates.push(q.slice(0, -3) + 'y');
  }
  if (q.endsWith('ed') && q.length > 4) {
    candidates.push(q.slice(0, -2)); // e.g. played -> play
    candidates.push(q.slice(0, -1)); // e.g. cared -> care
    // Double consonant check (e.g. stopped -> stop, travelled -> travel)
    if (q.length > 5 && q[q.length - 3] === q[q.length - 4]) {
      candidates.push(q.slice(0, -3));
    }
  }

  // Continuous (-ing)
  if (q.endsWith('ing') && q.length > 5) {
    candidates.push(q.slice(0, -3)); // e.g. speaking -> speak
    candidates.push(q.slice(0, -3) + 'e'); // e.g. caring -> care
    // Double consonant check (e.g. running -> run)
    if (q.length > 6 && q[q.length - 4] === q[q.length - 5]) {
      candidates.push(q.slice(0, -4));
    }
  }

  // Adverbs (-ly)
  if (q.endsWith('ly') && q.length > 4) {
    candidates.push(q.slice(0, -2)); // e.g. quickly -> quick
    if (q.endsWith('ily') && q.length > 5) {
      candidates.push(q.slice(0, -3) + 'y'); // e.g. happily -> happy
    }
  }

  // Comparatives / Superlatives (-er, -est)
  if (q.endsWith('est') && q.length > 5) {
    candidates.push(q.slice(0, -3));
    candidates.push(q.slice(0, -2));
  }
  if (q.endsWith('er') && q.length > 4) {
    candidates.push(q.slice(0, -2));
    candidates.push(q.slice(0, -1));
  }

  return Array.from(new Set(candidates));
}

/**
 * Searches the local database of words (from words.json / Dexie) for an English match.
 */
export function lookupLocalWord(query: string, allWords: Word[]): DictionaryResult | null {
  const candidates = getWordCandidates(query);
  if (candidates.length === 0) return null;

  for (const cand of candidates) {
    // 1. Exact match on en
    let match = allWords.find(w => normalizeWord(w.en) === cand);

    // 2. Try match with "to " prefix
    if (!match && !cand.startsWith('to ')) {
      match = allWords.find(w => normalizeWord(w.en) === `to ${cand}`);
    }

    // 3. Try irregular verbs check (e.g. went in "go, goes - went - gone")
    if (!match) {
      match = allWords.find(w => {
        if (w.categories && w.categories.includes('irregular_verbs')) {
          const forms = w.en.toLowerCase().split(/\s*-\s*|\s*,\s*/);
          return forms.includes(cand);
        }
        return false;
      });
    }

    if (match) {
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
  }

  return null;
}

// In-memory cache for Kaikki dictionary
let kaikkiDictCache: Record<string, { tr: string; ipa?: string }> | null = null;
let kaikkiLoadingPromise: Promise<Record<string, { tr: string; ipa?: string }> | null> | null = null;

/**
 * Loads the Kaikki English-to-Turkish dictionary from /dict_kaikki.json
 */
export async function loadKaikkiDict(): Promise<Record<string, { tr: string; ipa?: string }> | null> {
  if (kaikkiDictCache) return kaikkiDictCache;
  if (kaikkiLoadingPromise) return await kaikkiLoadingPromise;

  kaikkiLoadingPromise = (async () => {
    try {
      if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
          ? (import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`)
          : '/';
        const res = await fetch(`${baseUrl}dict_kaikki.json`);
        if (res.ok) {
          kaikkiDictCache = await res.json();
          return kaikkiDictCache;
        }
      }
      return null;
    } catch (err) {
      console.warn('Failed to load Kaikki dictionary:', err);
      return null;
    }
  })();

  return await kaikkiLoadingPromise;
}

/**
 * Searches the Kaikki Wiktionary dictionary for a word candidate.
 */
export function lookupKaikkiWord(
  query: string,
  dict: Record<string, { tr: string; ipa?: string }>
): DictionaryResult | null {
  const candidates = getWordCandidates(query);
  for (const cand of candidates) {
    const entry = dict[cand];
    if (entry && entry.tr) {
      return {
        en: cand,
        tr: entry.tr,
        ipa: entry.ipa,
        source: 'local'
      };
    }
  }
  return null;
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
 * 1. Checks local 6,120+ words database (words.json / Dexie).
 * 2. Checks Kaikki Wiktionary database (25,400+ words).
 * 3. If not found and allowOnline is true, queries Google Translate & Free Dictionary APIs.
 */
export async function lookupWord(
  query: string,
  allWords: Word[],
  allowOnline = true
): Promise<DictionaryResult | null> {
  // 1. Local App Database (words.json / user custom words)
  const localResult = lookupLocalWord(query, allWords);
  if (localResult) {
    return localResult;
  }

  // 2. Kaikki English-to-Turkish Database
  try {
    const kaikkiDict = await loadKaikkiDict();
    if (kaikkiDict) {
      const kaikkiResult = lookupKaikkiWord(query, kaikkiDict);
      if (kaikkiResult) {
        return kaikkiResult;
      }
    }
  } catch (e) {
    console.warn('Kaikki lookup error:', e);
  }

  // 3. Online Lookup Fallback
  if (allowOnline) {
    return await lookupOnlineWord(query);
  }

  return null;
}
