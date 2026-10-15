import { describe, it, expect } from 'vitest';
import { checkTurkishAnswer, checkTurkishAnswerDetailed } from './turkishMatcher';

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

  it('detects near matches like alet for küçük alet', () => {
    const res = checkTurkishAnswerDetailed('alet', 'aygıt, küçük alet');
    expect(res.isCorrect).toBe(false);
    expect(res.isNear).toBe(true);
    expect(res.nearExplanation).toContain('küçük alet');
  });

  it('detects 1 letter typos for words length >= 4', () => {
    const res = checkTurkishAnswerDetailed('silha', 'kol, silah');
    expect(res.isCorrect).toBe(false);
    expect(res.isNear).toBe(true);
  });
});
