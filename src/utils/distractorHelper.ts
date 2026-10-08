import { Word } from '../types';

export type PartOfSpeech = 'phrasal_verb' | 'verb' | 'adjective' | 'adverb' | 'noun';
export type NounDomain = 'body' | 'profession' | 'finance' | 'nature' | 'place' | 'time' | 'event' | 'object' | 'general';

const NOT_ADVERBS = new Set([
  'fly', 'apply', 'reply', 'supply', 'imply', 'comply', 'rely', 'multiply',
  'butterfly', 'dragonfly', 'monopoly', 'assembly', 'family', 'belly', 'jelly', 'rally', 'italy', 'july',
  'ugly', 'silly', 'holy', 'curly', 'lovely', 'friendly', 'lonely', 'deadly', 'lively'
]);

const BODY_TOKENS = new Set([
  'back', 'spine', 'bone', 'body', 'arm', 'leg', 'eye', 'ear', 'nose', 'mouth', 'head', 'heart',
  'blood', 'skin', 'muscle', 'brain', 'neck', 'finger', 'foot', 'hand', 'stomach', 'chest', 'lung',
  'tooth', 'teeth', 'throat', 'organ', 'rib', 'skull', 'waist', 'wrist', 'ankle', 'knee', 'elbow', 'shoulder',
  'sırt', 'omurga', 'kemik', 'kol', 'bacak', 'göz', 'kulak', 'burun', 'ağız', 'baş', 'kafa', 'kalp',
  'kan', 'deri', 'kas', 'beyin', 'boyun', 'parmak', 'ayak', 'el', 'mide', 'göğüs', 'organ', 'vücut',
  'beden', 'kaburga', 'kafatası', 'bel', 'bilek', 'diz', 'dirsek', 'omuz', 'diş', 'boğaz'
]);

const JOB_TOKENS = new Set([
  'lawyer', 'attorney', 'doctor', 'nurse', 'engineer', 'teacher', 'police', 'judge', 'worker', 'author',
  'scientist', 'artist', 'manager', 'driver', 'occupation', 'job', 'profession', 'carpenter', 'dentist',
  'pilot', 'architect',
  'avukat', 'doktor', 'mühendis', 'öğretmen', 'polis', 'hâkim', 'hakim', 'işçi', 'yazar', 'sanatçı',
  'müdür', 'şoför', 'meslek', 'memur', 'marangoz', 'dişçi', 'pilot', 'mimar', 'avukatlık', 'doktorluk',
  'öğretmenlik'
]);

const FINANCE_TOKENS = new Set([
  'money', 'tax', 'tariff', 'price', 'cost', 'bank', 'court', 'law', 'trade', 'market', 'exemption',
  'contract', 'currency', 'debt', 'income', 'salary', 'fee', 'budget', 'wealth', 'loan', 'interest',
  'para', 'vergi', 'tarife', 'fiyat', 'maliyet', 'banka', 'mahkeme', 'yasa', 'hukuk', 'ticaret',
  'piyasa', 'muafiyet', 'sözleşme', 'borç', 'gelir', 'maaş', 'ücret', 'bütçe', 'servet', 'kredi', 'faiz'
]);

const OBJECT_TOKENS = new Set([
  'parmaklık', 'iplik', 'ip', 'çivi', 'demir', 'kutu', 'alet', 'aygıt', 'cihaz', 'makine', 'eşya', 'araba', 'anahtar', 'telefon', 'kazak', 'dolap', 'çorap', 'pantolon', 'gömlek'
]);

const PHRASAL_PARTICLES = new Set([
  'in', 'on', 'at', 'up', 'down', 'out', 'into', 'off', 'away', 'over', 'by', 'for', 'from',
  'with', 'about', 'across', 'along', 'around', 'through', 'back'
]);

const ADJ_SUFFIXES = [
  'able', 'ible', 'ive', 'ous', 'ful', 'less', 'al', 'ic', 'ical', 'ent', 'ant', 'ish', 'ary',
  'ory', 'wide', 'proof', 'like', 'some'
];

/**
 * Detect Part of Speech for a word accurately using English & Turkish patterns
 */
export function getWordPos(w: Word): PartOfSpeech {
  const en = w.en.toLowerCase().trim();
  const tr = w.tr.toLowerCase().trim();
  const trPrimary = tr.split(/[,;/]+/)[0].trim();

  // 1. Phrasal Verb check
  const parts = en.replace(/^to\s+/, '').split(/\s+/);
  if (parts.length >= 2 && PHRASAL_PARTICLES.has(parts[1])) {
    return 'phrasal_verb';
  }

  // 2. Verb check
  if (
    en.startsWith('to ') ||
    trPrimary.endsWith('mek') ||
    trPrimary.endsWith('mak') ||
    trPrimary.endsWith('ver-') ||
    (w.categories && (w.categories.includes('basic_verbs') || w.categories.includes('irregular_verbs')))
  ) {
    return 'verb';
  }

  // 3. Adverb check: e.g. "promptly", "fluently", "drastically", "considerably"
  if (
    (en.endsWith('ly') && !NOT_ADVERBS.has(en) && !en.endsWith('fly') && !en.endsWith('ply')) ||
    ['rather than', 'in person', 'any more', 'sooner', 'in charge', 'at least', 'by far', 'as well'].includes(en)
  ) {
    return 'adverb';
  }

  // 4. Turkish abstract / profession noun suffixes (-lik, -cilik)
  if (['lik', 'lık', 'luk', 'lük', 'cilik', 'cılık', 'culuk', 'cülük'].some(s => trPrimary.endsWith(s))) {
    return 'noun';
  }

  // 5. Adjective check
  if (
    ADJ_SUFFIXES.some(s => en.endsWith(s)) ||
    ['li', 'lı', 'lu', 'lü', 'siz', 'sız', 'suz', 'süz', 'sel', 'sal', 'ıcı', 'ici', 'ucu', 'ücü'].some(s => trPrimary.endsWith(s))
  ) {
    return 'adjective';
  }

  // 6. Default to Noun
  return 'noun';
}

/**
 * Check if noun represents an event, crisis, occurrence or verbal action noun
 */
function isEventOrProcessNoun(w: Word): boolean {
  const tr = w.tr.toLowerCase().trim();
  const trPrimary = tr.split(/[,;/]+/)[0].trim();
  const tokens = trPrimary.split(/\s+/);
  const lastToken = tokens[tokens.length - 1];

  if (tokens.length >= 2 && (lastToken.endsWith('me') || lastToken.endsWith('ma') || lastToken.endsWith('ış') || lastToken.endsWith('iş'))) {
    return true;
  }
  if (lastToken.length >= 5 && (lastToken.endsWith('me') || lastToken.endsWith('ma'))) {
    return true;
  }
  if (lastToken.length >= 5 && (lastToken.endsWith('ış') || lastToken.endsWith('iş') || lastToken.endsWith('uş') || lastToken.endsWith('üş'))) {
    return true;
  }
  if (lastToken.length >= 5 && (lastToken.endsWith('im') || lastToken.endsWith('ım') || lastToken.endsWith('üm') || lastToken.endsWith('um'))) {
    return true;
  }
  if (['kriz', 'salgın', 'felaket', 'tehlike', 'olay', 'süreç', 'faaliyet', 'hareket', 'etki', 'oluşum', 'patlama'].some(s => trPrimary.includes(s))) {
    return true;
  }
  return false;
}

/**
 * Detect Noun Semantic Domain (to avoid mixing "omurga" with "avukatlık", or "outbreak" with "parmaklık")
 */
export function getNounDomain(w: Word): NounDomain {
  const enTokens = w.en.toLowerCase().split(/[\s,;/.-]+/);
  const trTokens = w.tr.toLowerCase().split(/[\s,;/.-]+/);
  const allTokens = [...enTokens, ...trTokens];

  if (allTokens.some(t => BODY_TOKENS.has(t)) || (w.categories && (w.categories.includes('anatomy') || w.categories.includes('health')))) {
    return 'body';
  }
  if (allTokens.some(t => JOB_TOKENS.has(t))) {
    return 'profession';
  }
  if (allTokens.some(t => FINANCE_TOKENS.has(t)) || (w.categories && w.categories.includes('money'))) {
    return 'finance';
  }
  if (isEventOrProcessNoun(w)) {
    return 'event';
  }
  if (allTokens.some(t => OBJECT_TOKENS.has(t))) {
    return 'object';
  }
  return 'general';
}

/**
 * Difficulty / Level approximation (1 = A1 to 5 = C1/Advanced)
 */
export function getWordLevel(w: Word): number {
  const cats = w.categories || [];
  if (cats.includes('custom') || !!w.reword || cats.includes('oxford5000_c1')) return 5;
  if (cats.includes('oxford5000_b2') || cats.includes('oxford3000_b2')) return 4;
  if (cats.includes('oxford3000_b1') || cats.includes('top3000')) return 3;
  if (cats.includes('oxford3000_a2') || cats.includes('top1000')) return 2;
  return 1;
}

/**
 * Returns close, realistic, thematic distractors for multiple choice questions.
 * Priority 1: Words from the CURRENT 20-WORD SESSION that match the same Part of Speech!
 * Priority 2: Words from the database matching the exact POS, semantic domain & level!
 */
export function getSmartDistractors(
  targetWord: Word,
  allWords: Word[],
  count: number = 3,
  sessionWords?: Word[]
): string[] {
  const targetTrPrimary = targetWord.tr.split(/[,;/]+/)[0].trim();
  const targetTrNorm = targetTrPrimary.toLocaleLowerCase('tr-TR');

  const targetPos = getWordPos(targetWord);
  const targetDomain = targetPos === 'noun' ? getNounDomain(targetWord) : null;
  const targetLevel = getWordLevel(targetWord);

  const selectedDistractors: string[] = [];
  const usedTrSet = new Set<string>([targetTrNorm]);

  function pickFrom(pool: Word[], randomize: boolean = true) {
    const sorted = pool.slice().sort((a, b) => {
      const diffA = Math.abs(getWordLevel(a) - targetLevel);
      const diffB = Math.abs(getWordLevel(b) - targetLevel);
      if (diffA !== diffB) return diffA - diffB;
      return randomize ? Math.random() - 0.5 : 0;
    });

    for (const w of sorted) {
      if (selectedDistractors.length >= count) break;
      const trClean = w.tr.split(/[,;/]+/)[0].trim();
      const trNorm = trClean.toLocaleLowerCase('tr-TR');

      if (!usedTrSet.has(trNorm) && trClean.length > 0) {
        selectedDistractors.push(trClean);
        usedTrSet.add(trNorm);
      }
    }
  }

  // Priority 1: Pick from current session words matching the exact same POS!
  if (sessionWords && sessionWords.length > 0) {
    const sessionMatchPool = sessionWords.filter(w => {
      if (w.id === targetWord.id) return false;
      const wTr = w.tr.split(/[,;/]+/)[0].trim().toLocaleLowerCase('tr-TR');
      if (wTr === targetTrNorm || wTr.length === 0) return false;

      const wPos = getWordPos(w);
      const isTargetVerbFamily = targetPos === 'verb' || targetPos === 'phrasal_verb';
      const isWVerbFamily = wPos === 'verb' || wPos === 'phrasal_verb';
      if (isTargetVerbFamily !== isWVerbFamily) return false;
      if (!isTargetVerbFamily && wPos !== targetPos) return false;

      // In nouns, avoid mixing body with profession/object
      if (targetPos === 'noun' && targetDomain && targetDomain !== 'general') {
        const wDomain = getNounDomain(w);
        if (wDomain !== targetDomain && wDomain !== 'general') return false;
      }
      return true;
    });
    pickFrom(sessionMatchPool, true);
  }

  // Priority 2: Database matching exact POS and Domain (no "parmaklık/iplik" for abstract nouns)
  if (selectedDistractors.length < count) {
    const pool1 = allWords.filter(w => {
      if (w.id === targetWord.id) return false;
      const wTr = w.tr.split(/[,;/]+/)[0].trim().toLocaleLowerCase('tr-TR');
      if (wTr === targetTrNorm || wTr.length === 0) return false;

      const wPos = getWordPos(w);
      const isTargetVerbFamily = targetPos === 'verb' || targetPos === 'phrasal_verb';
      const isWVerbFamily = wPos === 'verb' || wPos === 'phrasal_verb';
      if (isTargetVerbFamily !== isWVerbFamily) return false;
      if (!isTargetVerbFamily && wPos !== targetPos) return false;

      if (targetPos === 'noun') {
        const wDomain = getNounDomain(w);
        if (targetDomain === 'event' && wDomain !== 'event') return false;
        if (targetDomain === 'body' && wDomain !== 'body') return false;
        if (targetDomain === 'profession' && wDomain !== 'profession') return false;
        if (targetDomain === 'finance' && wDomain !== 'finance') return false;
        if (targetDomain !== 'object' && wDomain === 'object') return false;
      }
      return true;
    });
    pickFrom(pool1, true);
  }

  // Priority 3: Fallback same POS
  if (selectedDistractors.length < count) {
    const pool2 = allWords.filter(w => {
      if (w.id === targetWord.id) return false;
      const wPos = getWordPos(w);
      const isTargetVerbFamily = targetPos === 'verb' || targetPos === 'phrasal_verb';
      const isWVerbFamily = wPos === 'verb' || wPos === 'phrasal_verb';
      if (isTargetVerbFamily !== isWVerbFamily) return false;
      if (!isTargetVerbFamily && wPos !== targetPos) return false;
      return true;
    });
    pickFrom(pool2, true);
  }

  return selectedDistractors;
}
