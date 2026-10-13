import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Word, Progress } from '../types';
import {
  ClozeQuestion,
  generatePrepositionQuestions,
  generateVocabularyClozeQuestions,
  loadClozeData
} from '../services/clozeService';
import { sound } from '../services/audio';
import { speakEnglish } from '../services/speech';
import { fireCelebration, fireMicroSpark } from '../components/Confetti';
import { getSentenceTranslation } from '../services/translationService';
import { lookupWord } from '../services/dictionaryService';
import {
  ArrowLeft,
  Sparkles,
  Volume2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Flame,
  BookOpen,
  HelpCircle,
  ChevronRight,
  Award,
  Layers,
  ArrowRight,
  Plus,
  Check,
  X,
  Loader2
} from 'lucide-react';

interface Props {
  dueQueue: Progress[];
  allWordsMap: Map<number, Word>;
  allWords: Word[];
  allProgress?: Progress[];
  onReviewAnswer?: (wordId: number, isCorrect: boolean, isPartial: boolean) => Promise<void>;
  onAddXp?: (amount: number) => Promise<void>;
  onAddCustomWord?: (word: Omit<Word, 'id'>, silent?: boolean) => Promise<void>;
  onClose: () => void;
}

type ClozeMode = 'select' | 'vocab' | 'prep';
type RoundSize = 10 | 20 | 0; // 0 = all / endless

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

interface ActiveWordPopup {
  word: string;
  rect: { top: number; left: number; width: number; height: number };
  translation?: string;
  ipa?: string;
  source?: 'local' | 'online';
  isLoading: boolean;
  isAdded: boolean;
  isAlreadyCustom: boolean;
}

export const ClozeTestView: React.FC<Props> = ({
  dueQueue,
  allWordsMap,
  allWords,
  allProgress,
  onReviewAnswer,
  onAddXp,
  onAddCustomWord,
  onClose
}) => {
  // Navigation & session state
  const [mode, setMode] = useState<ClozeMode>('select');
  const [phase, setPhase] = useState<'study' | 'summary'>('study');
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<ClozeQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Question interaction state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasFeedback, setHasFeedback] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  // Floating Word Popup State
  const [activePopup, setActivePopup] = useState<ActiveWordPopup | null>(null);
  const activePopupRef = useRef<ActiveWordPopup | null>(null);
  activePopupRef.current = activePopup;
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Scoring & Stats
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);
  const [missedQuestions, setMissedQuestions] = useState<{ q: ClozeQuestion; selected: string }[]>([]);

  // Selected round size
  const [roundSize, setRoundSize] = useState<RoundSize>(10);

  // Timer ref for auto-advancing
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cooldown timestamp ref to prevent ghost clicks / touch bleeds between questions
  const questionLoadedTimeRef = useRef<number>(Date.now());

  // Trigger word lookup when clicked
  const handleWordTrigger = useCallback(
    async (rawWord: string, element: HTMLElement) => {
      const clean = rawWord.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (!clean || clean.length < 1) return;

      // Toggle off if clicking the already active word
      if (activePopupRef.current && activePopupRef.current.word.toLowerCase() === clean.toLowerCase()) {
        setActivePopup(null);
        return;
      }

      const rect = element.getBoundingClientRect();
      const isAlreadyCustom = allWords.some(
        w =>
          (w.isCustom || w.categories?.includes('custom')) &&
          w.en.toLowerCase().trim() === clean.toLowerCase()
      );

      setActivePopup({
        word: clean,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        isLoading: true,
        isAdded: false,
        isAlreadyCustom
      });

      try {
        const res = await lookupWord(clean, allWords, true);
        setActivePopup(prev => {
          if (!prev || prev.word !== clean) return prev;
          return {
            ...prev,
            isLoading: false,
            translation: res?.tr || 'Çeviri bulunamadı',
            ipa: res?.ipa,
            source: res?.source
          };
        });
      } catch {
        setActivePopup(prev => {
          if (!prev || prev.word !== clean) return prev;
          return {
            ...prev,
            isLoading: false,
            translation: 'Çeviri alınamadı'
          };
        });
      }
    },
    [allWords]
  );

  // Add word to custom words list
  const handleAddWordToCustom = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!activePopup || !onAddCustomWord || activePopup.isAdded || activePopup.isAlreadyCustom) return;

    const currentSentenceClean = currentQ
      ? `${currentQ.sentenceBefore} [${currentQ.answer}] ${currentQ.sentenceAfter}`.replace(/\s+/g, ' ').trim()
      : undefined;

    const wordData: Omit<Word, 'id'> = {
      en: activePopup.word,
      tr:
        activePopup.translation &&
        activePopup.translation !== 'Çeviri bulunamadı' &&
        activePopup.translation !== 'Çeviri alınamadı'
          ? activePopup.translation
          : activePopup.word,
      ipa: activePopup.ipa,
      examples: currentSentenceClean
        ? [
            {
              en: currentSentenceClean,
              tr: currentQ?.translationTr || ''
            }
          ]
        : [],
      categories: ['custom'],
      isCustom: true
    };

    try {
      await onAddCustomWord(wordData, true);
      sound.playCorrect();
      fireMicroSpark(0.5, 0.4);
      setActivePopup(prev => (prev ? { ...prev, isAdded: true } : null));
    } catch (err) {
      console.error('Failed to add custom word:', err);
    }
  };

  // Click outside and escape listeners for word popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-interactive-word]')) {
        return;
      }
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setActivePopup(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopup(null);
    };

    if (activePopup) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePopup]);

  // Close popup and reset cooldown whenever active question changes
  useEffect(() => {
    questionLoadedTimeRef.current = Date.now();
    setActivePopup(null);
  }, [currentIndex]);

  // Extract due words for vocabulary mode
  const dueWordsList = useMemo(() => {
    const list: Word[] = [];
    dueQueue.forEach(p => {
      const w = allWordsMap.get(p.wordId);
      if (w) list.push(w);
    });
    return list;
  }, [dueQueue, allWordsMap]);

  // Fallback learning words if dueQueue is empty
  const learningWordsList = useMemo(() => {
    if (!allProgress) return [];
    const list: Word[] = [];
    allProgress.forEach(p => {
      if (p.status === 'learning' || p.status === 'mastered') {
        const w = allWordsMap.get(p.wordId);
        if (w) list.push(w);
      }
    });
    return list;
  }, [allProgress, allWordsMap]);

  // Preload data on mount
  useEffect(() => {
    loadClozeData().catch(err => console.warn('Cloze data preload error:', err));
  }, []);

  // Current Question
  const currentQ: ClozeQuestion | undefined = questions[currentIndex];

  // Auto-fetch sentence translation in background if not already present
  useEffect(() => {
    if (!currentQ || currentQ.translationTr) return;
    let isMounted = true;
    getSentenceTranslation(currentQ.sentence, currentQ.answer).then(tr => {
      if (isMounted && tr) {
        setQuestions(prev => {
          const copy = [...prev];
          if (copy[currentIndex]) {
            copy[currentIndex] = { ...copy[currentIndex], translationTr: tr };
          }
          return copy;
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentQ, currentIndex]);

  // Start Vocabulary Cloze Session
  const startVocabularySession = async (size: RoundSize = 10) => {
    setIsLoading(true);
    setRoundSize(size);
    try {
      const sourcePool = dueWordsList.length > 0 ? dueWordsList : learningWordsList;
      const poolToUse = sourcePool.length > 0 ? sourcePool : allWords.slice(0, 100);

      const count = size === 0 ? poolToUse.length : Math.min(size, poolToUse.length);
      const generated = await generateVocabularyClozeQuestions(poolToUse, allWords, Math.max(5, count));

      if (generated.length === 0) {
        alert('Tekrar edilecek kelime bulunamadı!');
        setIsLoading(false);
        return;
      }

      setQuestions(generated);
      setCurrentIndex(0);
      setSelectedOption(null);
      setHasFeedback(false);
      setShowTranslation(false);
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setEarnedXp(0);
      setMissedQuestions([]);
      setPhase('study');
      setMode('vocab');
    } catch (err) {
      console.error('Error starting vocabulary cloze:', err);
      alert('Soru yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  // Start Prepositions Cloze Session
  const startPrepositionSession = async (size: RoundSize = 10) => {
    setIsLoading(true);
    setRoundSize(size);
    try {
      const count = size === 0 ? 25 : size;
      const generated = await generatePrepositionQuestions(count);

      if (generated.length === 0) {
        alert('Edat soruları yüklenemedi.');
        setIsLoading(false);
        return;
      }

      setQuestions(generated);
      setCurrentIndex(0);
      setSelectedOption(null);
      setHasFeedback(false);
      setShowTranslation(false);
      setScore(0);
      setCombo(0);
      setMaxCombo(0);
      setEarnedXp(0);
      setMissedQuestions([]);
      setPhase('study');
      setMode('prep');
    } catch (err) {
      console.error('Error starting preposition cloze:', err);
      alert('Soru yüklenirken bir hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  // Advance to Next Question or Summary
  const advanceToNextQuestion = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

    // Blur any active element so no button retains focus
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (currentIndex + 1 < questions.length) {
      questionLoadedTimeRef.current = Date.now();
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setHasFeedback(false);
      setShowTranslation(false);
    } else {
      // Completed round
      setPhase('summary');
      sound.playLevelUp();
      fireCelebration();
    }
  }, [currentIndex, questions.length]);

  // Handle Option Selection
  const handleSelectOption = useCallback(
    async (option: string, clickCoordinates?: { xRatio: number; yRatio: number }) => {
      // Transition Cooldown: Ignore any input within 400ms of a new question loading to prevent ghost clicks / touch bleeds
      if (Date.now() - questionLoadedTimeRef.current < 400) {
        return;
      }

      if (!currentQ || hasFeedback) return;

      // Blur active button immediately
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      // Clear any pending advance timer
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }

      setSelectedOption(option);
      setHasFeedback(true);

      const isCorrect = option.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

      if (isCorrect) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        if (nextCombo > maxCombo) setMaxCombo(nextCombo);
        setScore(prev => prev + 1);

        sound.playCorrect(nextCombo);
        if (clickCoordinates) {
          fireMicroSpark(clickCoordinates.xRatio, clickCoordinates.yRatio);
        }

        // Calculate XP
        const xpGain = Math.min(10, 4 + Math.floor(nextCombo / 2));
        setEarnedXp(prev => prev + xpGain);
        if (onAddXp) onAddXp(xpGain);

        // If vocabulary question, update SRS progress
        if (currentQ.wordId && onReviewAnswer) {
          onReviewAnswer(currentQ.wordId, true, false).catch(e =>
            console.warn('SRS update error:', e)
          );
        }

        // Pronounce completed sentence
        const fullSentence = currentQ.sentence.replace('[MASK]', currentQ.answer);
        speakEnglish(fullSentence, 0.95);
      } else {
        setCombo(0);
        sound.playWrong();
        setMissedQuestions(prev => [...prev, { q: currentQ, selected: option }]);

        // Award 1 participation XP
        if (onAddXp) onAddXp(1);
        setEarnedXp(prev => prev + 1);

        // If vocabulary question, mark lapse/wrong in SRS
        if (currentQ.wordId && onReviewAnswer) {
          onReviewAnswer(currentQ.wordId, false, false).catch(e =>
            console.warn('SRS update error:', e)
          );
        }

        // Automatically reveal translation on mistake
        if (currentQ.translationTr) {
          setShowTranslation(true);
        }

        // Pronounce correct version so user hears the proper pattern
        const fullSentence = currentQ.sentence.replace('[MASK]', currentQ.answer);
        speakEnglish(fullSentence, 0.95);
      }
    },
    [currentQ, hasFeedback, combo, maxCombo, onAddXp, onReviewAnswer, advanceToNextQuestion]
  );

  // Clean timer on unmount
  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  // Keyboard shortcut listener (1, 2, 3, 4 or Space/Enter to advance)
  useEffect(() => {
    if (mode === 'select' || phase === 'summary' || !currentQ) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (hasFeedback) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
          e.preventDefault();
          advanceToNextQuestion();
        }
        return;
      }

      // Ignore rapid keypresses right after question change
      if (Date.now() - questionLoadedTimeRef.current < 400) return;

      const keyIndex = ['1', '2', '3', '4'].indexOf(e.key);
      if (keyIndex >= 0 && keyIndex < currentQ.options.length) {
        e.preventDefault();
        handleSelectOption(currentQ.options[keyIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, phase, currentQ, hasFeedback, handleSelectOption, advanceToNextQuestion]);

  // Read current sentence audio
  const handlePlayAudio = () => {
    if (!currentQ) return;
    if (hasFeedback) {
      const full = currentQ.sentence.replace('[MASK]', currentQ.answer);
      speakEnglish(full, 0.9);
    } else {
      // Read with slight pause or emphasis
      const preview = currentQ.sentence.replace('[MASK]', 'blank');
      speakEnglish(preview, 0.85);
    }
  };

  // -------------------------------------------------------------
  // VIEW: 1. MODE SELECTOR SCREEN
  // -------------------------------------------------------------
  if (mode === 'select') {
    const vocabCount = dueWordsList.length > 0 ? dueWordsList.length : learningWordsList.length;

    return (
      <div className="flex flex-col min-h-[85vh] select-none text-white pb-6 animate-fade-in">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800/80">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 active:scale-95 transition-all"
          >
            <ArrowLeft size={16} />
            <span className="text-xs font-semibold">Geri</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px] font-bold uppercase tracking-wider">
              Cloze Test
            </span>
          </div>
        </div>

        {/* Hero banner */}
        <div className="bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 mb-5 shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                Boşluk Doldurma Testi
              </h2>
              <p className="text-xs text-slate-400">
                Kelimeleri ve edatları cümle bağlamında pekiştirin
              </p>
            </div>
          </div>
        </div>

        {/* Mode Option Cards */}
        <div className="space-y-4 flex-1">
          {/* Card 1: Kelime Tekrarı (Vocabulary Cloze) */}
          <div className="bg-slate-900 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-4 transition-all shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Kelime Tekrarı</span>
                    {dueWordsList.length > 0 && (
                      <span className="px-2 py-0.5 text-[10px] bg-rose-500 text-white rounded-md font-bold">
                        {dueWordsList.length} Bekleyen
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {dueWordsList.length > 0
                      ? 'Bugünkü tekrar kelimelerinden cümle boşlukları'
                      : 'Öğrenilen kelimelerden pratik yap'}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4 bg-slate-850/80 p-3 rounded-xl border border-slate-800">
              💡 Cümle içindeki eksik kelimeyi bulun. Doğru ve yanlışlarınız normal tekrar gibi <strong className="text-indigo-300">SRS ilerlemenize</strong> ve <strong className="text-indigo-300">günlük hedefinize</strong> işlenir.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => startVocabularySession(10)}
                disabled={isLoading || vocabCount === 0}
                className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20"
              >
                <span>10 Soru Başla</span>
                <ChevronRight size={14} />
              </button>
              {vocabCount >= 20 && (
                <button
                  onClick={() => startVocabularySession(20)}
                  disabled={isLoading}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-slate-200 font-bold text-xs transition-all border border-slate-700/80"
                >
                  20 Soru
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Prepositions (Edatlar) */}
          <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-4 transition-all shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center space-x-2">
                    <span>Edatlar (Prepositions)</span>
                    <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-md font-bold">
                      4,300+ Soru
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    in, on, at, for, by, with, about, from...
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4 bg-slate-850/80 p-3 rounded-xl border border-slate-800">
              🎯 Sınavlarda en çok çıkan edat ve fiil tamlamalarını (collocations) gerçek sınav cümleleri içinde doğru yerleştirin.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => startPrepositionSession(10)}
                disabled={isLoading}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md shadow-amber-600/20"
              >
                <span>10 Soru Başla</span>
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => startPrepositionSession(20)}
                disabled={isLoading}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 active:scale-95 text-slate-200 font-bold text-xs transition-all border border-slate-700/80"
              >
                20 Soru
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: 2. SUMMARY (SONUÇ EKRANI)
  // -------------------------------------------------------------
  if (phase === 'summary') {
    const accuracy = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

    return (
      <div className="flex flex-col min-h-[85vh] select-none text-white pb-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
            {mode === 'vocab' ? 'Kelime Cloze Testi Özeti' : 'Edatlar Testi Özeti'}
          </span>
          <button
            onClick={() => setMode('select')}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800"
          >
            Mod Değiştir
          </button>
        </div>

        {/* Celebration Badge */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center my-3 relative overflow-hidden shadow-lg">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 animate-bounce">
            <Award size={32} />
          </div>
          <h2 className="text-xl font-black text-white">
            {accuracy >= 80 ? '🎉 Harika Başarı!' : accuracy >= 50 ? '👏 Tebrikler!' : '💪 Pratik Yapmaya Devam!'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {questions.length} soruluk turu tamamladın.
          </p>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-slate-800">
            <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Doğruluk</span>
              <span className="text-base font-black text-emerald-400">%{accuracy}</span>
            </div>
            <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Kazanılan XP</span>
              <span className="text-base font-black text-indigo-400">+{earnedXp}</span>
            </div>
            <div className="bg-slate-850 p-2.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-medium">Maks. Seri</span>
              <span className="text-base font-black text-amber-400">🔥 {maxCombo}</span>
            </div>
          </div>
        </div>

        {/* Missed Questions Review */}
        {missedQuestions.length > 0 && (
          <div className="space-y-2 mb-4 flex-1">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Tekrar Edilecek Cümleler ({missedQuestions.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {missedQuestions.map((item, idx) => {
                const fullText = item.q.sentence.replace('[MASK]', `👉 ${item.q.answer} 👈`);
                return (
                  <div
                    key={idx}
                    className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs space-y-1"
                  >
                    <p className="text-slate-200 leading-snug font-medium">
                      {fullText}
                    </p>
                    {item.q.translationTr && (
                      <p className="text-[11px] text-slate-400 italic">
                        {item.q.translationTr}
                      </p>
                    )}
                    <div className="flex items-center space-x-2 text-[10px] pt-1">
                      <span className="text-rose-400 line-through">Seçimin: {item.selected}</span>
                      <span className="text-emerald-400 font-bold">Doğru: {item.q.answer}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            onClick={() => (mode === 'vocab' ? startVocabularySession(roundSize) : startPrepositionSession(roundSize))}
            className="w-full py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-indigo-600/30"
          >
            <RotateCcw size={16} />
            <span>Tekrar Oyna</span>
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-850 active:scale-98 text-slate-300 font-semibold text-xs border border-slate-800 transition-all"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: 3. ACTIVE QUIZ (SORU EKRANI)
  // -------------------------------------------------------------
  if (!currentQ) {
    return (
      <div className="p-8 text-center text-white">
        <p className="text-sm">Soru yükleniyor...</p>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);
  const isAnswerCorrect = selectedOption?.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

  // Helper to render sentence with interactive clickable words
  const renderInteractiveSentence = (text: string) => {
    if (!text) return null;
    const parts = text.split(/([a-zA-Z0-9'-]+)/g);

    return parts.map((part, idx) => {
      const isWord = /[a-zA-Z0-9]/.test(part);
      if (!isWord) {
        return <span key={idx}>{part}</span>;
      }

      return (
        <span
          key={idx}
          data-interactive-word="true"
          onClick={e => {
            e.stopPropagation();
            handleWordTrigger(part, e.currentTarget);
          }}
          title="Tıklayarak anlamına bakın ve kelimelerinize ekleyin"
          className="cursor-pointer hover:text-indigo-300 hover:bg-indigo-500/15 rounded px-0.5 transition-colors select-none inline-block active:text-indigo-400 active:scale-95"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {part}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col min-h-[85vh] select-none text-white pb-6 animate-fade-in relative">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-2">
        <button
          onClick={() => setMode('select')}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white active:scale-95 transition-all"
          title="Çıkış"
        >
          <ArrowLeft size={16} />
        </button>

        {/* Progress pill */}
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-slate-300">
            {currentIndex + 1} / {questions.length}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-[11px] font-semibold text-indigo-400">
            {currentQ.category === 'vocabulary' ? 'Kelime' : 'Edat'}
          </span>
        </div>

        {/* Combo flame */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-amber-400">
          <Flame size={14} className={combo > 1 ? 'fill-amber-400 animate-pulse' : 'text-slate-500'} />
          <span>{combo}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Question Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[170px]">
        {/* Audio speech button & Hint */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1">
              <HelpCircle size={12} className="text-indigo-400" />
              <span>Boşluğu Doldurun</span>
            </span>
            <span className="text-[10px] text-indigo-400/90 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
              ✨ Tıkla: Anlam & +Ekle
            </span>
          </div>

          <button
            onClick={handlePlayAudio}
            className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-indigo-400 hover:text-indigo-300 active:scale-95 transition-all"
            title="Cümleyi Dinle"
          >
            <Volume2 size={16} />
          </button>
        </div>

        {/* Sentence Text with styled [MASK] slot */}
        <div
          className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed my-auto select-none"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {renderInteractiveSentence(currentQ.sentenceBefore)}

          {/* DYNAMIC BLANK CHIP */}
          <span
            className={`inline-flex items-center justify-center px-3 py-0.5 mx-1.5 rounded-xl font-bold transition-all duration-200 align-middle ${
              hasFeedback
                ? isAnswerCorrect
                  ? 'bg-emerald-500/20 text-emerald-300 border-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-bounce-short'
                  : 'bg-rose-500/20 text-rose-300 border-2 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                : 'bg-indigo-500/15 text-indigo-300 border-2 border-dashed border-indigo-500/60 min-w-[70px] animate-pulse'
            }`}
          >
            {hasFeedback ? (
              <span
                data-interactive-word="true"
                onClick={e => {
                  e.stopPropagation();
                  handleWordTrigger(isAnswerCorrect ? selectedOption! : currentQ.answer, e.currentTarget);
                }}
                className="cursor-pointer hover:underline select-none active:scale-95"
                style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                title="Tıklayarak anlamına bakın ve listenize ekleyin"
              >
                {isAnswerCorrect ? selectedOption : currentQ.answer}
              </span>
            ) : (
              <span className="text-indigo-400 text-sm tracking-widest select-none">????</span>
            )}
          </span>

          {renderInteractiveSentence(currentQ.sentenceAfter)}
        </div>

        {/* Turkish Translation or Context Hint Accordion */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
          {showTranslation || hasFeedback ? (
            <div className="text-xs text-slate-200 leading-snug animate-fade-in bg-slate-850/80 p-3 rounded-xl border border-slate-800 space-y-2">
              {/* Entire sentence translation (shown to understand logic/context, never spoils the answer) */}
              {currentQ.translationTr ? (
                <div className="flex items-start space-x-2">
                  <span className="text-indigo-400 font-bold shrink-0">🇹🇷 Cümle Çevirisi:</span>
                  <span className="italic text-slate-100 font-medium">
                    "{currentQ.translationTr}"
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-slate-400 italic">
                  <span className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                  <span>Cümle çevirisi hazırlanıyor...</span>
                </div>
              )}

              {/* Word specific definition: ONLY shown AFTER user answers */}
              {hasFeedback && currentQ.wordTr && (
                <div className="flex items-center space-x-2 pt-2 border-t border-slate-800 text-[11px]">
                  <span className="font-bold text-emerald-400">{currentQ.answer}:</span>
                  <span className="text-slate-300">{currentQ.wordTr}</span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowTranslation(true)}
              className="text-[11px] text-slate-400 hover:text-indigo-300 flex items-center space-x-1.5 transition-colors group"
            >
              <span>🇹🇷</span>
              <span className="group-hover:underline">Tüm Cümlenin Türkçe Çevirisini Gör</span>
            </button>
          )}
        </div>
      </div>

      {/* Helper Tip */}
      <div className="text-[11px] text-slate-400 text-center mb-3 flex items-center justify-center space-x-1">
        <span>💡</span>
        <span>Cümledeki herhangi bir kelimeye <strong>tıklayarak</strong> anlamını görebilir ve <strong>+</strong> ile Özel Kelimelerinize ekleyebilirsiniz.</span>
      </div>

      {/* 4 Choices Grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-3 flex-1">
        {currentQ.options.map((opt, idx) => {
          const letter = OPTION_LETTERS[idx] || String(idx + 1);
          const isThisSelected = selectedOption === opt;
          const isThisCorrect = opt.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

          let btnStyle =
            'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-100 shadow-sm';
          let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-750';

          if (hasFeedback) {
            if (isThisCorrect) {
              btnStyle =
                'bg-emerald-950/50 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]';
              badgeStyle = 'bg-emerald-500 text-white border-emerald-400 font-bold';
            } else if (isThisSelected && !isThisCorrect) {
              btnStyle =
                'bg-rose-950/50 border-rose-500 text-rose-100 ring-2 ring-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.2)]';
              badgeStyle = 'bg-rose-500 text-white border-rose-400 font-bold';
            } else {
              btnStyle = 'bg-slate-900/40 border-slate-850 text-slate-500 opacity-40';
            }
          }

          return (
            <button
              key={`q-${currentIndex}-${idx}`}
              disabled={hasFeedback}
              onClick={e => {
                e.currentTarget.blur();
                const rect = e.currentTarget.getBoundingClientRect();
                const xRatio = (rect.left + rect.width / 2) / window.innerWidth;
                const yRatio = (rect.top + rect.height / 2) / window.innerHeight;
                handleSelectOption(opt, { xRatio, yRatio });
              }}
              className={`flex items-center p-3.5 rounded-2xl border text-left transition-all duration-150 active:scale-98 relative ${btnStyle}`}
            >
              <span
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold border mr-3 shrink-0 ${badgeStyle}`}
              >
                {letter}
              </span>
              <span className="text-sm sm:text-base font-bold truncate flex-1">
                {opt}
              </span>
              {hasFeedback && isThisCorrect && (
                <CheckCircle2 size={18} className="text-emerald-400 ml-1 shrink-0" />
              )}
              {hasFeedback && isThisSelected && !isThisCorrect && (
                <XCircle size={18} className="text-rose-400 ml-1 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback Bar & Manual Next Button */}
      {hasFeedback && (
        <div className="pt-2 animate-fade-in">
          <button
            onClick={advanceToNextQuestion}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-98 ${
              isAnswerCorrect
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
            }`}
          >
            <span>{currentIndex + 1 < questions.length ? 'Sonraki Soru' : 'Sonucu Gör'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Floating Word Lookup Popover */}
      {activePopup && (
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: `${
              activePopup.rect.top > 140
                ? activePopup.rect.top - 10
                : activePopup.rect.top + activePopup.rect.height + 10
            }px`,
            left: `${Math.max(
              12,
              Math.min(
                (typeof window !== 'undefined' ? window.innerWidth : 360) - 275,
                activePopup.rect.left + activePopup.rect.width / 2 - 130
              )
            )}px`,
            width: '265px',
            zIndex: 9999
          }}
          className={`bg-slate-900/95 backdrop-blur-md border border-indigo-500/40 rounded-2xl p-3.5 shadow-2xl shadow-black/90 text-white animate-scale-in transition-all ${
            activePopup.rect.top > 140 ? '-translate-y-full' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="font-bold text-sm sm:text-base text-white truncate">
                {activePopup.word}
              </span>
              <button
                onClick={() => speakEnglish(activePopup.word)}
                className="p-1 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors shrink-0"
                title="Dinle"
              >
                <Volume2 size={14} />
              </button>
            </div>

            <button
              onClick={() => setActivePopup(null)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              title="Kapat"
            >
              <X size={14} />
            </button>
          </div>

          {/* Phonetic IPA */}
          {activePopup.ipa && (
            <p className="text-[10px] text-slate-400 font-mono mt-1">
              {activePopup.ipa}
            </p>
          )}

          {/* Meaning & Add Action */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {activePopup.isLoading ? (
                <div className="flex items-center space-x-1.5 text-xs text-indigo-400 animate-pulse">
                  <Loader2 size={13} className="animate-spin shrink-0" />
                  <span>Anlam aranıyor...</span>
                </div>
              ) : (
                <p className="text-xs font-semibold text-emerald-400 line-clamp-2 leading-tight">
                  {activePopup.translation}
                </p>
              )}
            </div>

            {/* Plus (+) Button to Add to Custom Words */}
            <div className="shrink-0">
              {activePopup.isAdded ? (
                <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold animate-bounce-short">
                  <Check size={13} className="stroke-[3]" />
                  <span>Eklendi</span>
                </div>
              ) : activePopup.isAlreadyCustom ? (
                <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold">
                  <Check size={12} />
                  <span>Listende</span>
                </div>
              ) : (
                <button
                  onClick={handleAddWordToCustom}
                  disabled={
                    activePopup.isLoading ||
                    !activePopup.translation ||
                    activePopup.translation === 'Çeviri bulunamadı' ||
                    activePopup.translation === 'Çeviri alınamadı'
                  }
                  className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 text-white text-[11px] font-bold shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                  title="Özel Kelimelerime Ekle"
                >
                  <Plus size={14} className="stroke-[3] group-hover:rotate-90 transition-transform" />
                  <span>Ekle</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
