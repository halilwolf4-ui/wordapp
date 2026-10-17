import { Word } from '../types';

export type HintRelation = 'synonym' | 'similar' | 'antonym';

export interface WordHint {
  word: string;
  relation: HintRelation;
}

// In-memory cache for high-speed instant lookups
const memoryCache = new Map<string, WordHint[]>();

// Increment cache version to invalidate old non-B1 or obscure hints
const STORAGE_CACHE_KEY = 'kelime_avi_hints_cache_v2';

/**
 * Curated list of high-frequency English antonym pairs strictly at or below B1 level (A1, A2, B1).
 * Obscure, C1/C2, archaic, or overly complex pairs have been purged so hints remain intuitive.
 */
export const LOCAL_ANTONYM_PAIRS: [string, string][] = [
  ['accept', 'refuse'], ['alive', 'dead'], ['always', 'never'], ['ancient', 'modern'],
  ['answer', 'question'], ['apart', 'together'], ['appear', 'disappear'], ['arrive', 'leave'],
  ['attack', 'defend'], ['awake', 'asleep'], ['backward', 'forward'], ['bad', 'good'],
  ['beautiful', 'ugly'], ['before', 'after'], ['begin', 'finish'], ['behind', 'ahead'],
  ['believe', 'doubt'], ['best', 'worst'], ['better', 'worse'], ['big', 'small'],
  ['borrow', 'lend'], ['bottom', 'top'], ['break', 'repair'], ['bright', 'dark'],
  ['broad', 'narrow'], ['build', 'destroy'], ['busy', 'free'], ['buy', 'sell'],
  ['calm', 'stormy'], ['careful', 'careless'], ['catch', 'miss'], ['certain', 'uncertain'],
  ['cheap', 'expensive'], ['clean', 'dirty'], ['clear', 'cloudy'], ['clever', 'foolish'],
  ['close', 'open'], ['cold', 'hot'], ['combine', 'separate'], ['common', 'rare'],
  ['complex', 'simple'], ['connect', 'disconnect'], ['continue', 'stop'], ['cool', 'warm'],
  ['correct', 'incorrect'], ['create', 'destroy'], ['cruel', 'kind'], ['cry', 'laugh'],
  ['danger', 'safety'], ['dangerous', 'safe'], ['dark', 'light'], ['day', 'night'],
  ['deep', 'shallow'], ['defeat', 'victory'], ['defend', 'attack'], ['destroy', 'create'],
  ['difficult', 'easy'], ['direct', 'indirect'], ['dirty', 'clean'], ['disappear', 'appear'],
  ['divide', 'unite'], ['doubt', 'trust'], ['dry', 'wet'], ['early', 'late'],
  ['east', 'west'], ['easy', 'hard'], ['empty', 'full'], ['end', 'begin'],
  ['enemy', 'friend'], ['enjoy', 'hate'], ['enter', 'exit'], ['entrance', 'exit'],
  ['equal', 'unequal'], ['even', 'odd'], ['evil', 'good'], ['expensive', 'cheap'],
  ['fail', 'succeed'], ['failure', 'success'], ['false', 'true'], ['famous', 'unknown'],
  ['far', 'near'], ['fast', 'slow'], ['fat', 'thin'], ['fear', 'courage'],
  ['few', 'many'], ['final', 'first'], ['find', 'lose'], ['finish', 'start'],
  ['first', 'last'], ['fix', 'break'], ['foreign', 'native'], ['forget', 'remember'],
  ['forgive', 'blame'], ['forward', 'backward'], ['free', 'busy'], ['fresh', 'old'],
  ['friend', 'enemy'], ['front', 'back'], ['full', 'empty'], ['give', 'take'],
  ['glad', 'sad'], ['good', 'bad'], ['guilty', 'innocent'], ['hard', 'soft'],
  ['hate', 'love'], ['healthy', 'sick'], ['heavy', 'light'], ['help', 'hurt'],
  ['high', 'low'], ['hit', 'miss'], ['honest', 'dishonest'], ['hope', 'fear'],
  ['hot', 'cold'], ['huge', 'tiny'], ['ignore', 'notice'], ['ill', 'healthy'],
  ['important', 'unimportant'], ['improve', 'worsen'], ['increase', 'decrease'],
  ['innocent', 'guilty'], ['inside', 'outside'], ['intelligent', 'stupid'],
  ['interesting', 'boring'], ['interior', 'exterior'], ['internal', 'external'],
  ['join', 'separate'], ['joy', 'sorrow'], ['keep', 'lose'], ['kind', 'cruel'],
  ['large', 'small'], ['last', 'first'], ['late', 'early'], ['laugh', 'cry'],
  ['lead', 'follow'], ['leave', 'arrive'], ['left', 'right'], ['lend', 'borrow'],
  ['less', 'more'], ['light', 'heavy'], ['like', 'dislike'], ['little', 'much'],
  ['live', 'die'], ['lock', 'unlock'], ['long', 'short'], ['loose', 'tight'],
  ['lose', 'win'], ['loud', 'quiet'], ['love', 'hate'], ['low', 'high'],
  ['make', 'destroy'], ['many', 'few'], ['marry', 'divorce'], ['maximum', 'minimum'],
  ['melt', 'freeze'], ['minor', 'major'], ['miserable', 'happy'], ['modern', 'ancient'],
  ['more', 'less'], ['morning', 'evening'], ['move', 'stay'], ['much', 'little'],
  ['narrow', 'wide'], ['natural', 'artificial'], ['near', 'far'], ['neat', 'messy'],
  ['negative', 'positive'], ['never', 'always'], ['new', 'old'], ['night', 'day'],
  ['noisy', 'quiet'], ['normal', 'strange'], ['north', 'south'], ['notice', 'ignore'],
  ['now', 'then'], ['odd', 'even'], ['often', 'seldom'], ['old', 'young'],
  ['open', 'closed'], ['opposite', 'same'], ['outside', 'inside'], ['pain', 'pleasure'],
  ['past', 'future'], ['patient', 'impatient'], ['peace', 'war'], ['pleasant', 'unpleasant'],
  ['polite', 'impolite'], ['poor', 'rich'], ['positive', 'negative'], ['powerful', 'weak'],
  ['praise', 'criticize'], ['present', 'absent'], ['private', 'public'], ['profit', 'loss'],
  ['protect', 'attack'], ['proud', 'humble'], ['public', 'private'], ['pull', 'push'],
  ['punish', 'reward'], ['pure', 'dirty'], ['push', 'pull'], ['quick', 'slow'],
  ['quiet', 'noisy'], ['raise', 'lower'], ['rare', 'common'], ['real', 'fake'],
  ['refuse', 'accept'], ['remember', 'forget'], ['repair', 'break'], ['rich', 'poor'],
  ['right', 'wrong'], ['rise', 'fall'], ['rough', 'smooth'], ['rude', 'polite'],
  ['sad', 'happy'], ['safe', 'dangerous'], ['same', 'different'], ['send', 'receive'],
  ['separate', 'connect'], ['shallow', 'deep'], ['sharp', 'blunt'], ['short', 'tall'],
  ['shout', 'whisper'], ['show', 'hide'], ['sick', 'healthy'], ['silent', 'noisy'],
  ['simple', 'complex'], ['single', 'married'], ['sink', 'float'], ['sleep', 'wake'],
  ['slow', 'fast'], ['small', 'large'], ['smooth', 'rough'], ['soft', 'hard'],
  ['solid', 'liquid'], ['sour', 'sweet'], ['start', 'stop'], ['stay', 'leave'],
  ['stop', 'go'], ['straight', 'crooked'], ['strange', 'familiar'], ['strength', 'weakness'],
  ['strong', 'weak'], ['stupid', 'clever'], ['succeed', 'fail'], ['success', 'failure'],
  ['sunny', 'cloudy'], ['sweet', 'sour'], ['tall', 'short'], ['teach', 'learn'],
  ['terrible', 'wonderful'], ['thick', 'thin'], ['tight', 'loose'], ['tiny', 'huge'],
  ['together', 'apart'], ['top', 'bottom'], ['true', 'false'], ['ugly', 'beautiful'],
  ['under', 'over'], ['unite', 'divide'], ['useful', 'useless'], ['victory', 'defeat'],
  ['visible', 'invisible'], ['wake', 'sleep'], ['walk', 'run'], ['war', 'peace'],
  ['warm', 'cool'], ['waste', 'save'], ['weak', 'strong'], ['wealthy', 'poor'],
  ['wet', 'dry'], ['white', 'black'], ['wide', 'narrow'], ['win', 'lose'],
  ['wise', 'foolish'], ['wrong', 'correct'], ['young', 'old']
];

// Build local antonym map
const localAntonymMap = new Map<string, string>();
LOCAL_ANTONYM_PAIRS.forEach(([a, b]) => {
  localAntonymMap.set(a.toLowerCase(), b);
  localAntonymMap.set(b.toLowerCase(), a);
});

/**
 * Normalizes an English word by removing "to " prefix, trimming, and lowercasing.
 */
export function cleanEnglishWord(en: string): string {
  return en.trim().replace(/^to\s+/i, '').trim().toLowerCase();
}

/**
 * Checks whether a word is at or below CEFR B1 level (A1, A2, B1).
 * Rejects C1, C2, obscure, or multi-word phrases so hints remain clean and recognizable.
 */
export function isB1OrBelowWord(wordStr: string, allWords: Word[] = []): boolean {
  const clean = cleanEnglishWord(wordStr);
  if (!clean || clean.length < 2) return false;
  // Multi-word phrases or special symbols should not be shown as concise single-word hints
  if (/[\s\-_/]/.test(clean)) return false;

  // 1. Check in active dictionary
  if (allWords && allWords.length > 0) {
    const matched = allWords.find(w => cleanEnglishWord(w.en) === clean);
    if (matched) {
      const cats = matched.categories || [];
      // Explicitly reject C1
      if (cats.includes('oxford5000_c1')) return false;

      // Reject B2 unless it also has an A1, A2, B1, or NGSL top3000 rating
      const hasB2 = cats.includes('oxford5000_b2') || cats.includes('oxford3000_b2');
      const hasA1ToB1 = cats.some(c =>
        c === 'oxford3000_a1' ||
        c === 'oxford3000_a2' ||
        c === 'oxford3000_b1' ||
        c === 'top100' ||
        c === 'top1000' ||
        c === 'top3000'
      );
      if (hasB2 && !hasA1ToB1) return false;

      return true;
    }
  }

  // 2. Fallback to curated B1 antonym vocabulary set
  return localAntonymMap.has(clean);
}

/**
 * Calculates max allowed hints based on word encounter count:
 * - Encounter 1: 0 (No hints on first appearance)
 * - Encounter 2: 1 (1st hint allowed)
 * - Encounter 3: 2 (2nd hint allowed)
 * - Encounter 4+: 3 (3rd hint allowed)
 */
export function getMaxAllowedHints(encounters: number): number {
  if (encounters <= 1) return 0;
  return Math.min(3, encounters - 1);
}

/**
 * Loads cached hints from localStorage into memory on startup.
 */
function loadPersistentCache(): Record<string, WordHint[]> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Saves a hint to persistent localStorage cache.
 */
function savePersistentCache(key: string, hints: WordHint[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const cache = loadPersistentCache();
    cache[key] = hints;
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('Could not save hint cache to localStorage:', e);
  }
}

interface DatamuseItem {
  word: string;
  score?: number;
  tags?: string[];
}

/**
 * Generates local fallback hints using words.json dataset and curated B1 antonym map.
 * Ensures all returned hints never exceed B1 level.
 */
export function getLocalFallbackHints(targetWord: Word, allWords: Word[] = []): WordHint[] {
  const cleanTarget = cleanEnglishWord(targetWord.en);
  const used = new Set<string>([cleanTarget, targetWord.en.toLowerCase()]);
  const hints: WordHint[] = [];

  // 1. Check local antonym map (strictly B1)
  const localAnt = localAntonymMap.get(cleanTarget);
  if (localAnt && isB1OrBelowWord(localAnt, allWords) && !used.has(cleanEnglishWord(localAnt))) {
    hints.push({ word: localAnt, relation: 'antonym' });
    used.add(cleanEnglishWord(localAnt));
  }

  // 2. Extract keywords from Turkish meaning
  const trTokens = targetWord.tr
    .toLowerCase()
    .split(/[,;\/\(\)\-]+/)
    .map(s => s.trim())
    .filter(s => s.length >= 3);

  if (allWords.length > 0 && trTokens.length > 0) {
    for (const other of allWords) {
      if (other.id === targetWord.id) continue;
      const otherClean = cleanEnglishWord(other.en);
      if (used.has(otherClean)) continue;

      // STRICT B1 RULE: Hint word itself MUST be B1 or below!
      if (!isB1OrBelowWord(other.en, allWords)) continue;

      const otherTr = other.tr.toLowerCase();
      const hasExactMatch = trTokens.some(t => {
        const parts = otherTr.split(/[,;\/\(\)\-]+/).map(p => p.trim());
        return parts.some(p => p === t || (p.length > 4 && t.length > 4 && (p.includes(t) || t.includes(p))));
      });

      if (hasExactMatch) {
        // If it shares key Turkish meaning, mark as synonym or similar
        const rel: HintRelation = hints.some(h => h.relation === 'synonym') ? 'similar' : 'synonym';
        hints.push({ word: other.en, relation: rel });
        used.add(otherClean);
        if (hints.length >= 3) break;
      }
    }
  }

  return hints.slice(0, 3);
}

/**
 * Retrieves up to 3 English hints (synonym, similar, antonym) for a target word.
 * Enforces CEFR B1 level ceiling so learners receive accessible and intuitive clues.
 */
export async function getWordHints(targetWord: Word, allWords: Word[] = []): Promise<WordHint[]> {
  const cleanTarget = cleanEnglishWord(targetWord.en);
  if (!cleanTarget) return [];

  // 1. Check in-memory cache
  if (memoryCache.has(cleanTarget)) {
    return memoryCache.get(cleanTarget)!;
  }

  // 2. Check localStorage cache
  const diskCache = loadPersistentCache();
  if (diskCache[cleanTarget] && diskCache[cleanTarget].length > 0) {
    memoryCache.set(cleanTarget, diskCache[cleanTarget]);
    return diskCache[cleanTarget];
  }

  // 3. Attempt to fetch online via Datamuse API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const [synRes, antRes, mlRes] = await Promise.all([
      fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanTarget)}&max=10`, {
        signal: controller.signal
      })
        .then(r => (r.ok ? (r.json() as Promise<DatamuseItem[]>) : []))
        .catch(() => [] as DatamuseItem[]),
      fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(cleanTarget)}&max=10`, {
        signal: controller.signal
      })
        .then(r => (r.ok ? (r.json() as Promise<DatamuseItem[]>) : []))
        .catch(() => [] as DatamuseItem[]),
      fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(cleanTarget)}&max=12`, {
        signal: controller.signal
      })
        .then(r => (r.ok ? (r.json() as Promise<DatamuseItem[]>) : []))
        .catch(() => [] as DatamuseItem[])
    ]);

    clearTimeout(timeout);

    const used = new Set<string>([cleanTarget, targetWord.en.toLowerCase()]);
    const hints: WordHint[] = [];

    // Filter results strictly to B1 level or below
    const validAnts = antRes.filter(a => isB1OrBelowWord(a.word, allWords));
    const validSyns = synRes.filter(s => isB1OrBelowWord(s.word, allWords));
    const validMls = mlRes.filter(m => isB1OrBelowWord(m.word, allWords));

    // A) Antonym (Zıt Anlam - Kırmızı)
    const apiAnt = validAnts.find(a => !used.has(cleanEnglishWord(a.word)))?.word;
    const localAntCandidate = localAntonymMap.get(cleanTarget);
    const localAnt = localAntCandidate && isB1OrBelowWord(localAntCandidate, allWords) ? localAntCandidate : undefined;
    const antWord = apiAnt || localAnt;
    if (antWord && !used.has(cleanEnglishWord(antWord))) {
      used.add(cleanEnglishWord(antWord));
    }

    // B) Synonym (Eş Anlam - Yeşil)
    let synWord = validSyns.find(s => !used.has(cleanEnglishWord(s.word)))?.word;
    if (!synWord) {
      const mlSyn = validMls.find(m => m.tags?.includes('syn') && !used.has(cleanEnglishWord(m.word)));
      if (mlSyn) synWord = mlSyn.word;
    }
    if (synWord) used.add(cleanEnglishWord(synWord));

    // C) Similar (Benzer Anlam - Sarı)
    let simWord = validMls.find(m => !used.has(cleanEnglishWord(m.word)) && !m.tags?.includes('syn'))?.word;
    if (simWord) used.add(cleanEnglishWord(simWord));

    // Assemble prioritized: 1 Synonym (Yeşil), 1 Similar (Sarı), 1 Antonym (Kırmızı)
    if (synWord) hints.push({ word: synWord, relation: 'synonym' });
    if (simWord) hints.push({ word: simWord, relation: 'similar' });
    if (antWord) hints.push({ word: antWord, relation: 'antonym' });

    // Fill remaining slots if fewer than 3 hints found from valid B1 candidates
    if (hints.length < 3) {
      for (const item of validSyns) {
        if (hints.length >= 3) break;
        const wClean = cleanEnglishWord(item.word);
        if (!used.has(wClean)) {
          hints.push({ word: item.word, relation: 'synonym' });
          used.add(wClean);
        }
      }
      for (const item of validMls) {
        if (hints.length >= 3) break;
        const wClean = cleanEnglishWord(item.word);
        if (!used.has(wClean)) {
          hints.push({ word: item.word, relation: 'similar' });
          used.add(wClean);
        }
      }
    }

    if (hints.length > 0) {
      const finalHints = hints.slice(0, 3);
      memoryCache.set(cleanTarget, finalHints);
      savePersistentCache(cleanTarget, finalHints);
      return finalHints;
    }
  } catch (err) {
    console.warn(`Online hint lookup failed for "${cleanTarget}", using local fallback:`, err);
  }

  // 4. Local fallback (strictly B1)
  const localHints = getLocalFallbackHints(targetWord, allWords);
  if (localHints.length > 0) {
    memoryCache.set(cleanTarget, localHints);
    savePersistentCache(cleanTarget, localHints);
    return localHints;
  }

  return [];
}

/**
 * Silently pre-fetches and caches hints for a batch of words in the background.
 */
export async function prefetchHints(words: Word[], allWords: Word[] = []): Promise<void> {
  const promises = words.map(w => getWordHints(w, allWords).catch(() => []));
  await Promise.all(promises);
}
