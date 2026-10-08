import { describe, it, expect } from 'vitest';
import { checkTurkishAnswer } from './turkishMatcher';

describe('Turkish Answer Matcher', () => {
  it('matches single word from comma-separated list', () => {
    expect(checkTurkishAnswer('kol', 'kol, silah')).toBe(true);
    expect(checkTurkishAnswer('silah', 'kol, silah')).toBe(true);
    expect(checkTurkishAnswer('Kol', 'kol, silah')).toBe(true);
  });

  it('handles Turkish characters and accent-insensitive matching', () => {
    expect(checkTurkishAnswer('ayak bilegi', 'ayak bileği')).toBe(true);
    expect(checkTurkishAnswer('ayak bileği', 'ayak bileği')).toBe(true);
    expect(checkTurkishAnswer('GÖĞÜS', 'göğüs kafesi, göğüs')).toBe(true);
  });

  it('rejects completely wrong answers', () => {
    expect(checkTurkishAnswer('elma', 'kol, silah')).toBe(false);
    expect(checkTurkishAnswer('', 'kol, silah')).toBe(false);
  });
});
