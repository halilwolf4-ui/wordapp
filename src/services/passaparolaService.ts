import { Word, Progress } from '../types';

export interface PassaparolaQuestion {
  letter: string;
  word: Word;
  displayWord: string; // "to " removed for verbs, e.g. "associate"
  state: 'unvisited' | 'current' | 'correct' | 'wrong' | 'pass';
  userAnswer?: string;
}

export const PASSAPAROLA_LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
  'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'Z'
];

/**
 * Strips leading "to " infinitive marker and trims English word.
 */
export function cleanEnglishWord(en: string): string {
  return en.trim().replace(/^to\s+/i, '').trim();
}

/**
 * Generates 24 Passaparola questions for letters A to Z.
 * Prioritizes words currently in the user's study/review progress.
 */
export function generatePassaparolaQuestions(
  allWords: Word[],
  progressMap: Map<number, Progress>
): PassaparolaQuestion[] {
  const questions: PassaparolaQuestion[] = [];

  for (const letter of PASSAPAROLA_LETTERS) {
    const lLower = letter.toLowerCase();

    // Find all matching candidate words starting with this letter
    const candidates = allWords.filter(w => {
      const cleaned = cleanEnglishWord(w.en).toLowerCase();
      return cleaned.startsWith(lLower) && w.tr.trim().length > 0;
    });

    if (candidates.length === 0) continue;

    // Prioritize learning progress words
    const learningCandidates = candidates.filter(w => {
      const prog = progressMap.get(w.id);
      return prog && prog.status === 'learning';
    });

    const masteredCandidates = candidates.filter(w => {
      const prog = progressMap.get(w.id);
      return prog && prog.status === 'mastered';
    });

    let selected: Word;
    if (learningCandidates.length > 0) {
      // 80% chance to pick learning candidate if available
      selected = learningCandidates[Math.floor(Math.random() * learningCandidates.length)];
    } else if (masteredCandidates.length > 0 && Math.random() < 0.4) {
      selected = masteredCandidates[Math.floor(Math.random() * masteredCandidates.length)];
    } else {
      // Pick random from all candidates
      selected = candidates[Math.floor(Math.random() * candidates.length)];
    }

    questions.push({
      letter,
      word: selected,
      displayWord: cleanEnglishWord(selected.en),
      state: questions.length === 0 ? 'current' : 'unvisited'
    });
  }

  return questions;
}
