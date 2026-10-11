/**
 * Sentence translation service for Cloze Test.
 * Fetches and caches natural Turkish translations for context sentences.
 */

const memoryCache = new Map<string, string>();
const LOCAL_STORAGE_KEY = 'kelime_avi_sentence_translations';

// Initialize memory cache from localStorage if available
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') memoryCache.set(k, v);
      });
    }
  } catch (err) {
    console.warn('Error reading translation cache:', err);
  }
}

function saveCacheToStorage() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, string> = {};
    memoryCache.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(obj));
  } catch (err) {
    console.warn('Error saving translation cache:', err);
  }
}

/**
 * Clean sentence by removing [MASK] or replacing with the actual answer for natural translation
 */
export function prepareSentenceForTranslation(sentence: string, answer?: string): string {
  if (!sentence) return '';
  let cleaned = sentence.replace(/\[MASK\]/g, answer ? answer.trim() : '...');
  // Expand common contractions for better translation quality
  cleaned = cleaned
    .replace(/\bThat'll\b/g, 'That will')
    .replace(/\bIt'll\b/g, 'It will')
    .replace(/\bI'll\b/g, 'I will')
    .replace(/\bYou'll\b/g, 'You will')
    .replace(/\bWe'll\b/g, 'We will')
    .replace(/\bThey'll\b/g, 'They will')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Fetch Turkish translation of a full sentence.
 * Returns natural Turkish translation without exposing the answer directly.
 */
export async function getSentenceTranslation(
  sentence: string,
  answer?: string
): Promise<string | null> {
  const fullText = prepareSentenceForTranslation(sentence, answer);
  if (!fullText) return null;

  // Check cache
  if (memoryCache.has(fullText)) {
    return memoryCache.get(fullText)!;
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(fullText)}&langpair=en|tr`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    let translated = data?.responseData?.translatedText;

    if (translated && typeof translated === 'string') {
      translated = translated.trim();
      memoryCache.set(fullText, translated);
      saveCacheToStorage();
      return translated;
    }
  } catch (err) {
    console.warn('Sentence translation fetch error:', err);
  }

  return null;
}
