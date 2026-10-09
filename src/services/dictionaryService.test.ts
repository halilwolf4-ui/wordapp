import { describe, it, expect } from 'vitest';
import { normalizeWord, lookupLocalWord } from './dictionaryService';
import { Word } from '../types';

const mockWords: Word[] = [
  {
    id: 1,
    en: 'arm',
    ipa: '[ɑːrm]',
    tr: 'kol',
    examples: [{ en: 'We were walking #arm# in #arm#.', tr: 'Kol kola yürüyorduk.' }],
    categories: ['anatomy']
  },
  {
    id: 2,
    en: 'to clean',
    ipa: '[kliːn]',
    tr: 'temizlemek, yıkamak',
    examples: [{ en: '#Clean# the room.', tr: 'Odayı temizle.' }],
    categories: ['basic_verbs']
  },
  {
    id: 3,
    en: 'book',
    ipa: '[bʊk]',
    tr: 'kitap',
    examples: [],
    categories: ['education']
  }
];

describe('dictionaryService - local lookup', () => {
  it('normalizes words properly', () => {
    expect(normalizeWord('  Hello ')).toBe('hello');
    expect(normalizeWord('Apple')).toBe('apple');
  });

  it('finds exact local matches with translation, ipa and example', () => {
    const res = lookupLocalWord('arm', mockWords);
    expect(res).not.toBeNull();
    expect(res?.en).toBe('arm');
    expect(res?.tr).toBe('kol');
    expect(res?.ipa).toBe('[ɑːrm]');
    expect(res?.exampleEn).toBe('We were walking #arm# in #arm#.');
    expect(res?.exampleTr).toBe('Kol kola yürüyorduk.');
    expect(res?.source).toBe('local');
  });

  it('handles "to " verb prefixes flexibly', () => {
    // Search "clean" when word is "to clean"
    const res1 = lookupLocalWord('clean', mockWords);
    expect(res1).not.toBeNull();
    expect(res1?.tr).toBe('temizlemek, yıkamak');

    // Search "to arm" when word is "arm"
    const res2 = lookupLocalWord('to arm', mockWords);
    expect(res2).not.toBeNull();
    expect(res2?.tr).toBe('kol');
  });

  it('handles plural suffix search fallback', () => {
    const res = lookupLocalWord('books', mockWords);
    expect(res).not.toBeNull();
    expect(res?.tr).toBe('kitap');
  });

  it('returns null if word is not found locally', () => {
    const res = lookupLocalWord('nonexistentword123', mockWords);
    expect(res).toBeNull();
  });
});
