import { Word } from '../types';

export type HintRelation = 'synonym' | 'similar' | 'antonym';

export interface WordHint {
  word: string;
  relation: HintRelation;
}

// In-memory cache for high-speed instant lookups
const memoryCache = new Map<string, WordHint[]>();

const STORAGE_CACHE_KEY = 'kelime_avi_hints_cache_v1';

/**
 * Curated list of common English antonym pairs for local & offline fallback.
 */
export const LOCAL_ANTONYM_PAIRS: [string, string][] = [
  ['accept', 'refuse'], ['admit', 'deny'], ['advance', 'retreat'], ['alive', 'dead'],
  ['allow', 'forbid'], ['always', 'never'], ['ancient', 'modern'], ['answer', 'question'],
  ['apart', 'together'], ['appear', 'disappear'], ['approve', 'disapprove'], ['arrive', 'depart'],
  ['artificial', 'natural'], ['ascend', 'descend'], ['attack', 'defend'], ['attract', 'repel'],
  ['awake', 'asleep'], ['backward', 'forward'], ['bad', 'good'], ['beautiful', 'ugly'],
  ['before', 'after'], ['begin', 'finish'], ['behind', 'ahead'], ['believe', 'doubt'],
  ['benefit', 'harm'], ['best', 'worst'], ['better', 'worse'], ['big', 'small'],
  ['bitter', 'sweet'], ['blame', 'praise'], ['bless', 'curse'], ['bold', 'timid'],
  ['borrow', 'lend'], ['bottom', 'top'], ['brave', 'cowardly'], ['break', 'repair'],
  ['brief', 'long'], ['bright', 'dark'], ['broad', 'narrow'], ['build', 'destroy'],
  ['busy', 'idle'], ['calm', 'stormy'], ['careful', 'careless'], ['catch', 'miss'],
  ['certain', 'uncertain'], ['cheap', 'expensive'], ['clean', 'dirty'], ['clear', 'cloudy'],
  ['clever', 'foolish'], ['close', 'open'], ['cold', 'hot'], ['combine', 'separate'],
  ['comfort', 'discomfort'], ['common', 'rare'], ['complex', 'simple'], ['conceal', 'reveal'],
  ['connect', 'disconnect'], ['constant', 'variable'], ['continue', 'stop'], ['cool', 'warm'],
  ['correct', 'incorrect'], ['courage', 'cowardice'], ['create', 'destroy'], ['cruel', 'kind'],
  ['danger', 'safety'], ['dark', 'light'], ['dawn', 'dusk'], ['day', 'night'],
  ['deep', 'shallow'], ['defeat', 'victory'], ['defend', 'attack'], ['demand', 'supply'],
  ['depart', 'arrive'], ['descend', 'ascend'], ['destroy', 'create'], ['difficult', 'easy'],
  ['diminish', 'increase'], ['direct', 'indirect'], ['dirty', 'clean'], ['disappear', 'appear'],
  ['discourage', 'encourage'], ['divide', 'unite'], ['doubt', 'trust'], ['drunk', 'sober'],
  ['dry', 'wet'], ['dull', 'sharp'], ['early', 'late'], ['east', 'west'],
  ['easy', 'hard'], ['empty', 'full'], ['encourage', 'discourage'], ['end', 'begin'],
  ['enemy', 'friend'], ['enjoy', 'hate'], ['enter', 'exit'], ['entrance', 'exit'],
  ['equal', 'unequal'], ['even', 'odd'], ['evil', 'good'], ['exhale', 'inhale'],
  ['expand', 'contract'], ['expensive', 'cheap'], ['export', 'import'], ['external', 'internal'],
  ['fail', 'succeed'], ['failure', 'success'], ['false', 'true'], ['famous', 'unknown'],
  ['far', 'near'], ['fast', 'slow'], ['fat', 'thin'], ['fear', 'courage'],
  ['feeble', 'strong'], ['few', 'many'], ['final', 'first'], ['find', 'lose'],
  ['finish', 'start'], ['first', 'last'], ['fix', 'break'], ['float', 'sink'],
  ['foolish', 'wise'], ['forbid', 'allow'], ['foreign', 'domestic'], ['forget', 'remember'],
  ['forgive', 'blame'], ['former', 'latter'], ['forward', 'backward'], ['free', 'bound'],
  ['frequent', 'rare'], ['fresh', 'stale'], ['friend', 'enemy'], ['front', 'back'],
  ['full', 'empty'], ['gain', 'lose'], ['generous', 'stingy'], ['gentle', 'rough'],
  ['giant', 'tiny'], ['give', 'take'], ['glad', 'sad'], ['gloomy', 'cheerful'],
  ['good', 'bad'], ['graceful', 'clumsy'], ['guilty', 'innocent'], ['hard', 'soft'],
  ['harm', 'heal'], ['hate', 'love'], ['healthy', 'sick'], ['heavy', 'light'],
  ['help', 'hinder'], ['hero', 'coward'], ['high', 'low'], ['hinder', 'help'],
  ['hire', 'fire'], ['hit', 'miss'], ['hold', 'release'], ['honest', 'dishonest'],
  ['hope', 'despair'], ['hostile', 'friendly'], ['hot', 'cold'], ['huge', 'tiny'],
  ['humble', 'proud'], ['idle', 'active'], ['ignore', 'notice'], ['ill', 'healthy'],
  ['imitate', 'originate'], ['immature', 'mature'], ['important', 'trivial'], ['improve', 'worsen'],
  ['increase', 'decrease'], ['inferior', 'superior'], ['inhale', 'exhale'], ['inner', 'outer'],
  ['innocent', 'guilty'], ['inside', 'outside'], ['intelligent', 'stupid'], ['intentional', 'accidental'],
  ['interesting', 'boring'], ['interior', 'exterior'], ['internal', 'external'], ['join', 'separate'],
  ['joy', 'sorrow'], ['junior', 'senior'], ['justice', 'injustice'], ['keep', 'lose'],
  ['kind', 'cruel'], ['knowledge', 'ignorance'], ['large', 'small'], ['last', 'first'],
  ['late', 'early'], ['laugh', 'cry'], ['lawful', 'illegal'], ['lazy', 'industrious'],
  ['lead', 'follow'], ['leader', 'follower'], ['leave', 'arrive'], ['left', 'right'],
  ['lend', 'borrow'], ['less', 'more'], ['level', 'uneven'], ['light', 'heavy'],
  ['like', 'dislike'], ['liquid', 'solid'], ['little', 'much'], ['live', 'die'],
  ['lock', 'unlock'], ['long', 'short'], ['loose', 'tight'], ['lose', 'win'],
  ['loud', 'quiet'], ['love', 'hate'], ['low', 'high'], ['loyal', 'disloyal'],
  ['mad', 'sane'], ['major', 'minor'], ['make', 'destroy'], ['male', 'female'],
  ['many', 'few'], ['marry', 'divorce'], ['master', 'servant'], ['mature', 'immature'],
  ['maximum', 'minimum'], ['melt', 'freeze'], ['minor', 'major'], ['miserable', 'happy'],
  ['modern', 'ancient'], ['modest', 'arrogant'], ['more', 'less'], ['morning', 'evening'],
  ['move', 'stay'], ['much', 'little'], ['narrow', 'wide'], ['native', 'foreign'],
  ['natural', 'artificial'], ['near', 'far'], ['neat', 'messy'], ['negative', 'positive'],
  ['never', 'always'], ['new', 'old'], ['night', 'day'], ['noble', 'ignoble'],
  ['noisy', 'quiet'], ['none', 'all'], ['normal', 'strange'], ['north', 'south'],
  ['notice', 'ignore'], ['now', 'then'], ['obedient', 'disobedient'], ['obvious', 'hidden'],
  ['odd', 'even'], ['offend', 'please'], ['often', 'seldom'], ['old', 'young'],
  ['open', 'closed'], ['opponent', 'ally'], ['opposite', 'same'], ['optimist', 'pessimist'],
  ['order', 'chaos'], ['ordinary', 'extraordinary'], ['outside', 'inside'], ['pain', 'pleasure'],
  ['partial', 'complete'], ['past', 'future'], ['patient', 'impatient'], ['peace', 'war'],
  ['permanent', 'temporary'], ['permit', 'forbid'], ['physical', 'mental'], ['plain', 'fancy'],
  ['pleasant', 'unpleasant'], ['plenty', 'scarce'], ['polite', 'impolite'], ['poor', 'rich'],
  ['positive', 'negative'], ['powerful', 'weak'], ['praise', 'criticize'], ['present', 'absent'],
  ['prevent', 'allow'], ['private', 'public'], ['profit', 'loss'], ['protect', 'attack'],
  ['proud', 'humble'], ['public', 'private'], ['pull', 'push'], ['punish', 'reward'],
  ['pure', 'impure'], ['push', 'pull'], ['quick', 'slow'], ['quiet', 'noisy'],
  ['raise', 'lower'], ['rapid', 'slow'], ['rare', 'common'], ['raw', 'cooked'],
  ['real', 'fake'], ['rear', 'front'], ['refuse', 'accept'], ['regret', 'rejoice'],
  ['regular', 'irregular'], ['reject', 'accept'], ['release', 'hold'], ['remember', 'forget'],
  ['repair', 'damage'], ['repel', 'attract'], ['resist', 'yield'], ['reward', 'punishment'],
  ['rich', 'poor'], ['right', 'wrong'], ['rigid', 'flexible'], ['rise', 'fall'],
  ['rough', 'smooth'], ['rude', 'polite'], ['sad', 'happy'], ['safe', 'dangerous'],
  ['salt', 'sweet'], ['same', 'different'], ['sane', 'insane'], ['satisfy', 'dissatisfy'],
  ['scatter', 'collect'], ['secondhand', 'new'], ['secure', 'insecure'], ['seldom', 'often'],
  ['selfish', 'unselfish'], ['send', 'receive'], ['senior', 'junior'], ['separate', 'connect'],
  ['severe', 'mild'], ['shallow', 'deep'], ['sharp', 'blunt'], ['short', 'tall'],
  ['shout', 'whisper'], ['show', 'hide'], ['sick', 'healthy'], ['silent', 'noisy'],
  ['simple', 'complex'], ['single', 'married'], ['sink', 'float'], ['slave', 'master'],
  ['sleep', 'wake'], ['slow', 'fast'], ['small', 'large'], ['smooth', 'rough'],
  ['sober', 'drunk'], ['soft', 'hard'], ['solid', 'liquid'], ['somber', 'cheerful'],
  ['sorrow', 'joy'], ['sour', 'sweet'], ['sow', 'reap'], ['start', 'stop'],
  ['stay', 'leave'], ['steep', 'flat'], ['stem', 'root'], ['stingy', 'generous'],
  ['stop', 'go'], ['straight', 'crooked'], ['strange', 'familiar'], ['strength', 'weakness'],
  ['strict', 'lenient'], ['strong', 'weak'], ['stupid', 'clever'], ['subtle', 'blatant'],
  ['succeed', 'fail'], ['success', 'failure'], ['sunny', 'cloudy'], ['superior', 'inferior'],
  ['supply', 'demand'], ['sweet', 'sour'], ['swift', 'slow'], ['sympathy', 'indifference'],
  ['tame', 'wild'], ['temporary', 'permanent'], ['terrible', 'wonderful'], ['thick', 'thin'],
  ['tight', 'loose'], ['timid', 'bold'], ['tiny', 'huge'], ['together', 'apart'],
  ['top', 'bottom'], ['tough', 'tender'], ['transparent', 'opaque'], ['true', 'false'],
  ['trust', 'suspect'], ['ugly', 'beautiful'], ['under', 'over'], ['unite', 'divide'],
  ['upper', 'lower'], ['urgent', 'unimportant'], ['vacant', 'occupied'], ['vague', 'definite'],
  ['valuable', 'worthless'], ['vanish', 'appear'], ['victory', 'defeat'], ['violent', 'gentle'],
  ['visible', 'invisible'], ['voluntary', 'compulsory'], ['vowel', 'consonant'], ['wake', 'sleep'],
  ['walk', 'run'], ['war', 'peace'], ['warm', 'cool'], ['waste', 'save'],
  ['wax', 'wane'], ['weak', 'strong'], ['wealthy', 'poor'], ['wet', 'dry'],
  ['whisper', 'scream'], ['white', 'black'], ['wide', 'narrow'], ['wild', 'tame'],
  ['win', 'lose'], ['wisdom', 'folly'], ['wise', 'foolish'], ['withdraw', 'deposit'],
  ['within', 'without'], ['wrong', 'correct'], ['young', 'old'], ['zenith', 'nadir']
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
 * Generates local fallback hints using words.json dataset and local antonym map.
 */
export function getLocalFallbackHints(targetWord: Word, allWords: Word[] = []): WordHint[] {
  const cleanTarget = cleanEnglishWord(targetWord.en);
  const used = new Set<string>([cleanTarget, targetWord.en.toLowerCase()]);
  const hints: WordHint[] = [];

  // 1. Check local antonym map
  const localAnt = localAntonymMap.get(cleanTarget);
  if (localAnt && !used.has(localAnt.toLowerCase())) {
    hints.push({ word: localAnt, relation: 'antonym' });
    used.add(localAnt.toLowerCase());
  }

  // 2. Extract keywords from Turkish meaning
  const trTokens = targetWord.tr
    .toLowerCase()
    .split(/[,;\/\(\)\-]+/)
    .map(s => s.trim())
    .filter(s => s.length > 2);

  if (allWords.length > 0 && trTokens.length > 0) {
    for (const other of allWords) {
      if (other.id === targetWord.id) continue;
      const otherClean = cleanEnglishWord(other.en);
      if (used.has(otherClean)) continue;

      const otherTr = other.tr.toLowerCase();
      const hasExactMatch = trTokens.some(t => otherTr.includes(t));
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
 * Combines online Datamuse API with offline local dictionary matching and memory cache.
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

  // 3. Attempt to fetch online via Datamuse API (fast, rate-limit free, JSON)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const [synRes, antRes, mlRes] = await Promise.all([
      fetch(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(cleanTarget)}&max=8`, {
        signal: controller.signal
      })
        .then(r => (r.ok ? (r.json() as Promise<DatamuseItem[]>) : []))
        .catch(() => [] as DatamuseItem[]),
      fetch(`https://api.datamuse.com/words?rel_ant=${encodeURIComponent(cleanTarget)}&max=8`, {
        signal: controller.signal
      })
        .then(r => (r.ok ? (r.json() as Promise<DatamuseItem[]>) : []))
        .catch(() => [] as DatamuseItem[]),
      fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(cleanTarget)}&max=10`, {
        signal: controller.signal
      })
        .then(r => (r.ok ? (r.json() as Promise<DatamuseItem[]>) : []))
        .catch(() => [] as DatamuseItem[])
    ]);

    clearTimeout(timeout);

    const used = new Set<string>([cleanTarget, targetWord.en.toLowerCase()]);
    const hints: WordHint[] = [];

    // A) Antonym (Zıt Anlam - Kırmızı)
    const apiAnt = antRes.find(a => !used.has(a.word.toLowerCase()))?.word;
    const antWord = apiAnt || localAntonymMap.get(cleanTarget);
    if (antWord && !used.has(antWord.toLowerCase())) {
      used.add(antWord.toLowerCase());
    }

    // B) Synonym (Eş Anlam - Yeşil)
    let synWord = synRes.find(s => !used.has(s.word.toLowerCase()))?.word;
    if (!synWord) {
      const mlSyn = mlRes.find(m => m.tags?.includes('syn') && !used.has(m.word.toLowerCase()));
      if (mlSyn) synWord = mlSyn.word;
    }
    if (synWord) used.add(synWord.toLowerCase());

    // C) Similar (Benzer Anlam - Sarı)
    let simWord = mlRes.find(m => !used.has(m.word.toLowerCase()) && !m.tags?.includes('syn'))?.word;
    if (simWord) used.add(simWord.toLowerCase());

    // Assemble prioritized: 1 Synonym (Yeşil), 1 Similar (Sarı), 1 Antonym (Kırmızı)
    if (synWord) hints.push({ word: synWord, relation: 'synonym' });
    if (simWord) hints.push({ word: simWord, relation: 'similar' });
    if (antWord) hints.push({ word: antWord, relation: 'antonym' });

    // Fill remaining slots if fewer than 3 hints found
    if (hints.length < 3) {
      for (const item of synRes) {
        if (hints.length >= 3) break;
        if (!used.has(item.word.toLowerCase())) {
          hints.push({ word: item.word, relation: 'synonym' });
          used.add(item.word.toLowerCase());
        }
      }
      for (const item of mlRes) {
        if (hints.length >= 3) break;
        if (!used.has(item.word.toLowerCase())) {
          hints.push({ word: item.word, relation: 'similar' });
          used.add(item.word.toLowerCase());
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

  // 4. Local fallback
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
