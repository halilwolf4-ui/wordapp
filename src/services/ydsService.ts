export interface YdsQuestion {
  id: string;
  category: 'fen' | 'sosyal';
  year: number;
  term: string;
  exam: string;
  shortExam: string;
  questionNumber: number;
  prompt: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  answer: 'A' | 'B' | 'C' | 'D' | 'E';
}

export interface YokdilVocabItem {
  id: string;
  word: string;
  tr: string;
  synonyms: string[];
  years: number[];
}

let cachedQuestions: YdsQuestion[] | null = null;
let loadPromise: Promise<YdsQuestion[]> | null = null;
let cachedVocab: YokdilVocabItem[] | null = null;
let loadVocabPromise: Promise<YokdilVocabItem[]> | null = null;

/**
 * Loads the pre-extracted YÖKDİL / YDS questions from /yokdil_questions.json
 */
export async function loadYdsQuestions(): Promise<YdsQuestion[]> {
  if (cachedQuestions) {
    return cachedQuestions;
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL.endsWith('/')
          ? import.meta.env.BASE_URL
          : `${import.meta.env.BASE_URL}/`;

        const res = await fetch(`${baseUrl}yokdil_questions.json`);
        if (!res.ok) {
          throw new Error(`Failed to load yokdil_questions.json (status: ${res.status})`);
        }

        const data: YdsQuestion[] = await res.json();
        cachedQuestions = data;
        return data;
      } catch (err) {
        console.error('Error loading YÖKDİL questions:', err);
        return [];
      }
    })();
  }

  return loadPromise;
}

/**
 * Loads the YÖKDİL 2021-2025 vocabulary & synonyms list from /yokdil_vocab.json
 */
export async function loadYokdilVocab(): Promise<YokdilVocabItem[]> {
  if (cachedVocab) {
    return cachedVocab;
  }

  if (!loadVocabPromise) {
    loadVocabPromise = (async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL.endsWith('/')
          ? import.meta.env.BASE_URL
          : `${import.meta.env.BASE_URL}/`;

        const res = await fetch(`${baseUrl}yokdil_vocab.json`);
        if (!res.ok) {
          throw new Error(`Failed to load yokdil_vocab.json (status: ${res.status})`);
        }

        const data: YokdilVocabItem[] = await res.json();
        cachedVocab = data;
        return data;
      } catch (err) {
        console.error('Error loading YÖKDİL vocab:', err);
        return [];
      }
    })();
  }

  return loadVocabPromise;
}

/**
 * Fisher-Yates array shuffle
 */
function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Filter and randomly pick N questions
 */
export function getRandomYdsQuestions(
  pool: YdsQuestion[],
  category: 'all' | 'fen' | 'sosyal' = 'all',
  count: number = 10,
  yearFilter: number | 'all' = 'all'
): YdsQuestion[] {
  let filtered = pool;

  if (category !== 'all') {
    filtered = filtered.filter(q => q.category === category);
  }

  if (yearFilter !== 'all') {
    filtered = filtered.filter(q => q.year === yearFilter);
  }

  const shuffled = shuffle(filtered);
  if (count <= 0 || count >= shuffled.length) {
    return shuffled;
  }
  return shuffled.slice(0, count);
}

/**
 * Get list of available years
 */
export function getAvailableYears(pool: YdsQuestion[]): number[] {
  const set = new Set<number>();
  pool.forEach(q => set.add(q.year));
  return Array.from(set).sort((a, b) => b - a);
}
