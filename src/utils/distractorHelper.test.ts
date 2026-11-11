import { describe, it, expect } from 'vitest';
import { getSmartDistractors, getWordPos, getNounDomain, buildMultipleChoiceOptions } from './distractorHelper';
import { Word } from '../types';

describe('Smart Distractor Helper', () => {
  const words: Word[] = [
    { id: 1, en: 'back', tr: 'sırt', examples: [], categories: ['anatomy', 'health'] },
    { id: 2, en: 'arm', tr: 'kol', examples: [], categories: ['anatomy', 'health'] },
    { id: 3, en: 'leg', tr: 'bacak', examples: [], categories: ['anatomy', 'health'] },
    { id: 4, en: 'chest', tr: 'göğüs', examples: [], categories: ['anatomy', 'health'] },
    { id: 5, en: 'spine', tr: 'omurga', examples: [], categories: ['anatomy', 'health'] },
    { id: 6, en: 'capitalism', tr: 'kapitalizm', examples: [], categories: ['politics', 'economy'] },
    { id: 7, en: 'lawyer', tr: 'avukatlık', examples: [], categories: ['custom'] },
    { id: 8, en: 'doctor', tr: 'doktorluk', examples: [], categories: ['custom'] },
    { id: 9, en: 'teacher', tr: 'öğretmenlik', examples: [], categories: ['custom'] },
    { id: 10, en: 'run', tr: 'koşmak', examples: [], categories: ['basic_verbs'] },
    { id: 11, en: 'walk', tr: 'yürümek', examples: [], categories: ['basic_verbs'] },
    { id: 12, en: 'jump', tr: 'zıplamak', examples: [], categories: ['basic_verbs'] },
    { id: 13, en: 'give up', tr: 'vazgeçmek', examples: [], categories: ['custom'] },
    { id: 14, en: 'irreversible', tr: 'geri dönülemez', examples: [], categories: ['custom'] },
    { id: 15, en: 'susceptible', tr: 'duyarlı', examples: [], categories: ['custom'] },
    { id: 16, en: 'spotless', tr: 'tertemiz', examples: [], categories: ['custom'] },
    { id: 17, en: 'promptly', tr: 'derhal', examples: [], categories: ['custom'] }
  ];

  it('selects thematic body part distractors for back, avoiding capitalism and avukatlık', () => {
    const backWord = words[0];
    const distractors = getSmartDistractors(backWord, words, 3);

    expect(distractors.length).toBe(3);
    expect(distractors).not.toContain('kapitalizm');
    expect(distractors).not.toContain('avukatlık');
    expect(distractors.every(d => ['kol', 'bacak', 'göğüs', 'omurga'].includes(d))).toBe(true);
  });

  it('omurga (spine) never gets avukatlık or other professions as distractor', () => {
    const spineWord = words[4]; // spine (omurga)
    const distractors = getSmartDistractors(spineWord, words, 3);

    expect(distractors).not.toContain('avukatlık');
    expect(distractors).not.toContain('doktorluk');
    expect(distractors).not.toContain('öğretmenlik');
    expect(distractors.every(d => ['kol', 'bacak', 'göğüs', 'sırt'].includes(d))).toBe(true);
  });

  it('selects verbs for verbs and phrasal verbs', () => {
    const runWord = words[9];
    const distractors = getSmartDistractors(runWord, words, 2);

    expect(distractors.length).toBe(2);
    expect(distractors).toContain('yürümek');
    expect(distractors).toContain('zıplamak');
  });

  it('selects only adjectives for adjective target (sıfatlar sıfatlarla)', () => {
    const adjWord = words[13]; // irreversible (geri dönülemez)
    const distractors = getSmartDistractors(adjWord, words, 2);

    expect(distractors.length).toBe(2);
    expect(distractors).toContain('duyarlı');
    expect(distractors).toContain('tertemiz');
    // Must NOT contain verbs or nouns
    expect(distractors).not.toContain('koşmak');
    expect(distractors).not.toContain('omurga');
    expect(distractors).not.toContain('avukatlık');
  });

  it('detects POS correctly', () => {
    expect(getWordPos(words[9])).toBe('verb'); // run
    expect(getWordPos(words[12])).toBe('phrasal_verb'); // give up
    expect(getWordPos(words[13])).toBe('adjective'); // irreversible
    expect(getWordPos(words[16])).toBe('adverb'); // promptly
    expect(getWordPos(words[0])).toBe('noun'); // back
  });

  it('detects domain correctly for nouns', () => {
    expect(getNounDomain(words[0])).toBe('body'); // back
    expect(getNounDomain(words[4])).toBe('body'); // spine
    expect(getNounDomain(words[6])).toBe('profession'); // lawyer
  });

  it('never picks a distractor that shares an alternative meaning with target (e.g. rear for back)', () => {
    const testWords: Word[] = [
      { id: 101, en: 'back', tr: 'sırt, arka, geri, geriye', examples: [], categories: ['anatomy'] },
      { id: 102, en: 'rear', tr: 'geri, arka', examples: [], categories: ['anatomy'] },
      { id: 103, en: 'chest', tr: 'göğüs', examples: [], categories: ['anatomy'] },
      { id: 104, en: 'arm', tr: 'kol', examples: [], categories: ['anatomy'] },
      { id: 105, en: 'leg', tr: 'bacak', examples: [], categories: ['anatomy'] }
    ];

    const distractors = getSmartDistractors(testWords[0], testWords, 3);
    expect(distractors.length).toBe(3);
    // 'rear' shares 'geri' and 'arka' with 'back', so it must be rejected!
    expect(distractors).not.toContain('geri');
    expect(distractors).not.toContain('arka');
    expect(distractors).toContain('göğüs');
    expect(distractors).toContain('kol');
    expect(distractors).toContain('bacak');
  });

  it('rejects circumflex differences as overlap (e.g. hâkim vs hakim)', () => {
    const testWords: Word[] = [
      { id: 201, en: 'judge', tr: 'hâkim, yargıç', examples: [], categories: ['custom'] },
      { id: 202, en: 'ruler', tr: 'hakim, egemen', examples: [], categories: ['custom'] },
      { id: 203, en: 'lawyer', tr: 'avukat', examples: [], categories: ['custom'] },
      { id: 204, en: 'doctor', tr: 'doktor', examples: [], categories: ['custom'] },
      { id: 205, en: 'teacher', tr: 'öğretmen', examples: [], categories: ['custom'] }
    ];

    const distractors = getSmartDistractors(testWords[0], testWords, 3);
    expect(distractors.length).toBe(3);
    expect(distractors).not.toContain('hakim');
    expect(distractors).not.toContain('hâkim');
  });

  it('buildMultipleChoiceOptions produces exactly 4 unique options including correct primary answer', () => {
    const testWords: Word[] = [
      { id: 301, en: 'back', tr: 'sırt, arka, geri, geriye', examples: [], categories: ['anatomy'] },
      { id: 302, en: 'rear', tr: 'geri, arka', examples: [], categories: ['anatomy'] },
      { id: 303, en: 'chest', tr: 'göğüs', examples: [], categories: ['anatomy'] },
      { id: 304, en: 'arm', tr: 'kol', examples: [], categories: ['anatomy'] },
      { id: 305, en: 'leg', tr: 'bacak', examples: [], categories: ['anatomy'] }
    ];

    const options = buildMultipleChoiceOptions(testWords[0], testWords, 4);
    expect(options.length).toBe(4);
    expect(options).toContain('sırt');
    expect(options).not.toContain('geri');
    expect(options).not.toContain('arka');
    // Ensure all options are unique
    const unique = new Set(options);
    expect(unique.size).toBe(4);
  });
});
