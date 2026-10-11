import { Word } from '../types';
import { getWordPos } from '../utils/distractorHelper';

export interface RawClothItem {
  id?: string;
  sentence: string;
  answer: string;
  distractors: string[];
}

export interface VocabItemData {
  sentence: string;
  answer: string;
  translationTr?: string;
  distractors?: string[];
}

export interface ClozeQuestion {
  id: string;
  sentence: string; // Contains [MASK]
  sentenceBefore: string;
  sentenceAfter: string;
  answer: string;
  options: string[]; // 4 options (shuffled)
  wordId?: number;
  translationTr?: string; // Turkish translation of the sentence (if available)
  wordTr?: string; // Turkish meaning of the word
  category: 'vocabulary' | 'preposition';
  explanation?: string;
}

let cachedPrepositions: RawClothItem[] | null = null;
let cachedVocabMap: Record<string, VocabItemData> | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Preload Cloze JSON data from /cloze_prepositions.json and /cloze_vocab.json
 */
export async function loadClozeData(): Promise<{
  prepositions: RawClothItem[];
  vocabMap: Record<string, VocabItemData>;
}> {
  if (cachedPrepositions && cachedVocabMap) {
    return { prepositions: cachedPrepositions, vocabMap: cachedVocabMap };
  }

  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const baseUrl = import.meta.env.BASE_URL.endsWith('/')
          ? import.meta.env.BASE_URL
          : `${import.meta.env.BASE_URL}/`;

        const [prepRes, vocabRes] = await Promise.all([
          fetch(`${baseUrl}cloze_prepositions.json`),
          fetch(`${baseUrl}cloze_vocab.json`)
        ]);

        if (prepRes.ok) {
          cachedPrepositions = await prepRes.json();
        } else {
          console.warn('Failed to load cloze_prepositions.json');
          cachedPrepositions = [];
        }

        if (vocabRes.ok) {
          cachedVocabMap = await vocabRes.json();
        } else {
          console.warn('Failed to load cloze_vocab.json');
          cachedVocabMap = {};
        }
      } catch (err) {
        console.error('Error loading cloze datasets:', err);
        cachedPrepositions = cachedPrepositions || [];
        cachedVocabMap = cachedVocabMap || {};
      }
    })();
  }

  await loadPromise;
  return {
    prepositions: cachedPrepositions || [],
    vocabMap: cachedVocabMap || {}
  };
}

/**
 * Helper to split sentence around [MASK]
 */
function splitSentenceOnMask(sentence: string): { before: string; after: string } {
  const parts = sentence.split('[MASK]');
  if (parts.length >= 2) {
    return {
      before: parts[0],
      after: parts.slice(1).join('[MASK]')
    };
  }
  return { before: sentence, after: '' };
}

/**
 * Shuffle array helper
 */
function shuffle<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Generate Preposition Cloze questions from the CLOTH prepositions dataset
 */
export async function generatePrepositionQuestions(count: number = 10): Promise<ClozeQuestion[]> {
  const { prepositions } = await loadClozeData();
  if (!prepositions || prepositions.length === 0) {
    return [];
  }

  const sampled = shuffle(prepositions).slice(0, count);

  return sampled.map((item, idx) => {
    const { before, after } = splitSentenceOnMask(item.sentence);
    const options = shuffle([item.answer, ...item.distractors.slice(0, 3)]);

    return {
      id: item.id || `prep_${idx}_${Date.now()}`,
      sentence: item.sentence,
      sentenceBefore: before,
      sentenceAfter: after,
      answer: item.answer,
      options,
      category: 'preposition',
      explanation: `Doğru edat: "${item.answer}"`
    };
  });
}

/**
 * Generate Vocabulary Cloze questions for words currently due / in review queue.
 * Ensures 100% REAL English sentences with blanks (NO definition placeholders).
 */
export async function generateVocabularyClozeQuestions(
  queueWords: Word[],
  allWords: Word[],
  count: number = 10
): Promise<ClozeQuestion[]> {
  const { vocabMap } = await loadClozeData();

  if (queueWords.length === 0) {
    return [];
  }

  const questions: ClozeQuestion[] = [];

  // Index allWords for smart POS distractor picking
  const wordsByPos = new Map<string, Word[]>();
  allWords.forEach(w => {
    const pos = getWordPos(w);
    if (!wordsByPos.has(pos)) wordsByPos.set(pos, []);
    wordsByPos.get(pos)!.push(w);
  });

  /**
   * Extract distractor in matching grammatical form (e.g. stripped 'to ' if answer has no 'to ')
   */
  function formatCandidate(wordEn: string, answerHasTo: boolean): string {
    const trimmed = wordEn.trim();
    if (!answerHasTo) {
      return trimmed.replace(/^to\s+/i, '');
    }
    return trimmed;
  }

  function getEnglishDistractors(
    targetWord: Word,
    targetAnswer: string,
    needed: number = 3
  ): string[] {
    const targetPos = getWordPos(targetWord);
    const answerHasTo = /^to\s+/i.test(targetAnswer);
    const targetNorm = targetAnswer.toLowerCase().trim();

    const result: string[] = [];
    const used = new Set<string>([targetNorm, targetWord.en.toLowerCase().trim()]);

    // 1. Try from other queue words with same POS
    const samePosInQueue = queueWords.filter(
      w => w.id !== targetWord.id && getWordPos(w) === targetPos
    );
    for (const w of shuffle(samePosInQueue)) {
      if (result.length >= needed) break;
      const formatted = formatCandidate(w.en, answerHasTo);
      const lower = formatted.toLowerCase();
      if (!used.has(lower) && formatted.length > 0) {
        result.push(formatted);
        used.add(lower);
      }
    }

    // 2. Try from allWords with same POS
    if (result.length < needed) {
      const samePosAll = (wordsByPos.get(targetPos) || []).filter(
        w => w.id !== targetWord.id
      );
      for (const w of shuffle(samePosAll)) {
        if (result.length >= needed) break;
        const formatted = formatCandidate(w.en, answerHasTo);
        const lower = formatted.toLowerCase();
        if (!used.has(lower) && formatted.length > 0) {
          result.push(formatted);
          used.add(lower);
        }
      }
    }

    // 3. Fallback to any words
    if (result.length < needed) {
      for (const w of shuffle(allWords)) {
        if (result.length >= needed) break;
        const formatted = formatCandidate(w.en, answerHasTo);
        const lower = formatted.toLowerCase();
        if (!used.has(lower) && formatted.length > 0) {
          result.push(formatted);
          used.add(lower);
        }
      }
    }

    return result;
  }

  // Shuffle queue words to randomize
  const shuffledQueue = shuffle(queueWords);

  for (const word of shuffledQueue) {
    if (questions.length >= count) break;

    let sentence = '';
    let answer = '';
    let translationTr: string | undefined = undefined;
    let customDistractors: string[] | undefined = undefined;

    // 1. Check cloze_vocab.json (which has authentic sentences for 95% of words!)
    const vocabData = vocabMap[word.id] || vocabMap[String(word.id)];
    if (vocabData && vocabData.sentence && vocabData.sentence.includes('[MASK]')) {
      sentence = vocabData.sentence;
      answer = vocabData.answer;
      translationTr = vocabData.translationTr;
      if (vocabData.distractors && vocabData.distractors.length >= 3) {
        customDistractors = vocabData.distractors.slice(0, 3);
      }
    }

    // 2. Check word.examples in words.json with #...# if not found or translation is available
    if (!sentence && word.examples && word.examples.length > 0) {
      const cleanBase = word.en.replace(/^to\s+/, '').trim().toLowerCase();
      const matchEx = word.examples.find(e => {
        const m = e.en.match(/#([^#]+)#/);
        return m && m[1].toLowerCase() === cleanBase;
      }) || word.examples.find(e => /#[^#]+#/.test(e.en));

      if (matchEx) {
        const m = matchEx.en.match(/#([^#]+)#/);
        if (m) {
          answer = m[1];
          sentence = matchEx.en.replace(/#[^#]+#/g, '[MASK]');
          translationTr = matchEx.tr;
        }
      }
    }

    // IMPORTANT: If this specific word does NOT have a real authentic sentence,
    // DO NOT use a fake definition sentence! Just skip this word and pick another.
    if (!sentence || !answer || !sentence.includes('[MASK]')) {
      continue;
    }

    // Generate distractors matching the answer form
    let distractors = customDistractors;
    if (!distractors || distractors.length < 3) {
      distractors = getEnglishDistractors(word, answer, 3);
    }

    const { before, after } = splitSentenceOnMask(sentence);
    const options = shuffle([answer, ...distractors.slice(0, 3)]);

    // Ensure 4 unique options
    while (options.length < 4) {
      const extra = getEnglishDistractors(word, answer, 1)[0];
      if (extra && !options.includes(extra)) {
        options.push(extra);
      } else {
        break;
      }
    }

    questions.push({
      id: `vocab_${word.id}_${questions.length}`,
      sentence,
      sentenceBefore: before,
      sentenceAfter: after,
      answer,
      options: shuffle(options),
      wordId: word.id,
      translationTr,
      wordTr: word.tr,
      category: 'vocabulary',
      explanation: `${word.en}: ${word.tr}`
    });
  }

  // If queue didn't have enough words with sentences, backfill from other words in allWords
  if (questions.length < count && allWords.length > 0) {
    const usedWordIds = new Set(questions.map(q => q.wordId));
    for (const w of shuffle(allWords)) {
      if (questions.length >= count) break;
      if (usedWordIds.has(w.id)) continue;

      const vocabData = vocabMap[w.id] || vocabMap[String(w.id)];
      if (vocabData && vocabData.sentence && vocabData.sentence.includes('[MASK]')) {
        const { before, after } = splitSentenceOnMask(vocabData.sentence);
        const distractors = vocabData.distractors && vocabData.distractors.length >= 3
          ? vocabData.distractors.slice(0, 3)
          : getEnglishDistractors(w, vocabData.answer, 3);

        const options = shuffle([vocabData.answer, ...distractors.slice(0, 3)]);
        questions.push({
          id: `vocab_${w.id}_${questions.length}`,
          sentence: vocabData.sentence,
          sentenceBefore: before,
          sentenceAfter: after,
          answer: vocabData.answer,
          options,
          wordId: w.id,
          translationTr: vocabData.translationTr,
          wordTr: w.tr,
          category: 'vocabulary',
          explanation: `${w.en}: ${w.tr}`
        });
        usedWordIds.add(w.id);
      }
    }
  }

  return questions;
}
