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
type RoundSize = 10 | 20 | 0;

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
  // Cooldown timestamp ref to prevent ghost clicks
  const questionLoadedTimeRef = useRef<number>(Date.now());

  // Trigger word lookup when clicked
  const handleWordTrigger = useCallback(
    async (rawWord: string, element: HTMLElement) => {
      const clean = rawWord.trim().replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      if (!clean || clean.length < 1) return;

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

  useEffect(() => {
    questionLoadedTimeRef.current = Date.now();
    setActivePopup(null);
  }, [currentIndex]);

  const dueWordsList = useMemo(() => {
    const list: Word[] = [];
    dueQueue.forEach(p => {
      const w = allWordsMap.get(p.wordId);
      if (w) list.push(w);
    });
    return list;
  }, [dueQueue, allWordsMap]);

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

  useEffect(() => {
    loadClozeData().catch(err => console.warn('Cloze data preload error:', err));
  }, []);

  const currentQ: ClozeQuestion | undefined = questions[currentIndex];

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

  const advanceToNextQuestion = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }

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
      setPhase('summary');
      sound.playLevelUp();
      fireCelebration();
    }
  }, [currentIndex, questions.length]);

  const handleSelectOption = useCallback(
    async (option: string, clickCoordinates?: { xRatio: number; yRatio: number }) => {
      if (Date.now() - questionLoadedTimeRef.current < 400) {
        return;
      }

      if (!currentQ || hasFeedback) return;

      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

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

        const xpGain = Math.min(10, 4 + Math.floor(nextCombo / 2));
        setEarnedXp(prev => prev + xpGain);
        if (onAddXp) onAddXp(xpGain);

        if (currentQ.wordId && onReviewAnswer) {
          onReviewAnswer(currentQ.wordId, true, false).catch(e =>
            console.warn('SRS update error:', e)
          );
        }

        const fullSentence = currentQ.sentence.replace('[MASK]', currentQ.answer);
        speakEnglish(fullSentence, 0.95);
      } else {
        setCombo(0);
        sound.playWrong();
        setMissedQuestions(prev => [...prev, { q: currentQ, selected: option }]);

        if (onAddXp) onAddXp(1);
        setEarnedXp(prev => prev + 1);

        if (currentQ.wordId && onReviewAnswer) {
          onReviewAnswer(currentQ.wordId, false, false).catch(e =>
            console.warn('SRS update error:', e)
          );
        }

        if (currentQ.translationTr) {
          setShowTranslation(true);
        }

        const fullSentence = currentQ.sentence.replace('[MASK]', currentQ.answer);
        speakEnglish(fullSentence, 0.95);
      }
    },
    [currentQ, hasFeedback, combo, maxCombo, onAddXp, onReviewAnswer, advanceToNextQuestion]
  );

  useEffect(() => {
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (mode === 'select' || phase === 'summary' || !currentQ) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (hasFeedback) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight') {
          e.preventDefault();
          advanceToNextQuestion();
        }
        return;
      }

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

  const handlePlayAudio = () => {
    if (!currentQ) return;
    if (hasFeedback) {
      const full = currentQ.sentence.replace('[MASK]', currentQ.answer);
      speakEnglish(full, 0.9);
    } else {
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
      <div className="flex flex-col min-h-[85vh] select-none text-black pb-6">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b-3 border-black">
          <button
            onClick={onClose}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
            <span>GERİ</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-[#FFE600] border-2 border-black text-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]">
              CLOZE TEST
            </span>
          </div>
        </div>

        {/* Hero banner */}
        <div className="bg-[#FFE600] border-3 border-black p-5 mb-5 shadow-[4px_4px_0px_0px_#000] relative">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-black text-[#FFE600] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_0px_#000]">
              <Sparkles size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-black">
                BOŞLUK DOLDURMA TESTİ
              </h2>
              <p className="text-xs font-bold text-black uppercase tracking-wide">
                Kelimeleri ve edatları cümle bağlamında pekiştirin
              </p>
            </div>
          </div>
        </div>

        {/* Mode Option Cards */}
        <div className="space-y-4 flex-1">
          {/* Card 1: Kelime Tekrarı */}
          <div className="bg-white border-3 border-black p-4 shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#00F0FF] border-2 border-black flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000]">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-black flex items-center space-x-2">
                    <span>KELİME TEKRARI</span>
                    {dueWordsList.length > 0 && (
                      <span className="px-2 py-0.5 text-[10px] bg-[#FF5588] text-white border border-black font-black">
                        {dueWordsList.length} BEKLEYEN
                      </span>
                    )}
                  </h3>
                  <p className="text-xs font-bold text-zinc-600 mt-0.5 uppercase">
                    {dueWordsList.length > 0
                      ? 'Bugünkü tekrar kelimelerinden cümle boşlukları'
                      : 'Öğrenilen kelimelerden pratik yap'}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-zinc-800 leading-relaxed mb-4 bg-[#FDFBF7] p-3 border-2 border-black">
              💡 Cümle içindeki eksik kelimeyi bulun. Doğru ve yanlışlarınız normal tekrar gibi <strong className="text-black underline">SRS ilerlemenize</strong> ve <strong className="text-black underline">günlük hedefinize</strong> işlenir.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => startVocabularySession(10)}
                disabled={isLoading || vocabCount === 0}
                className="flex-1 py-3 px-3 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black uppercase text-xs flex items-center justify-center space-x-1.5 border-3 border-black shadow-[3px_3px_0px_0px_#000] transition-all disabled:opacity-50"
              >
                <span>10 SORU BAŞLA</span>
                <ChevronRight size={14} strokeWidth={3} />
              </button>
              {vocabCount >= 20 && (
                <button
                  onClick={() => startVocabularySession(20)}
                  disabled={isLoading}
                  className="py-3 px-3 bg-white hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-black font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all"
                >
                  20 SORU
                </button>
              )}
            </div>
          </div>

          {/* Card 2: Prepositions */}
          <div className="bg-white border-3 border-black p-4 shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-[#FF69B4] border-2 border-black flex items-center justify-center text-black font-black shadow-[2px_2px_0px_0px_#000]">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-black flex items-center space-x-2">
                    <span>EDATLAR (PREPOSITIONS)</span>
                    <span className="px-2 py-0.5 text-[10px] bg-[#FFE600] border border-black text-black font-black">
                      4,300+ SORU
                    </span>
                  </h3>
                  <p className="text-xs font-bold text-zinc-600 mt-0.5 uppercase">
                    in, on, at, for, by, with, about, from...
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-zinc-800 leading-relaxed mb-4 bg-[#FDFBF7] p-3 border-2 border-black">
              🎯 Sınavlarda en çok çıkan edat ve fiil tamlamalarını (collocations) gerçek sınav cümleleri içinde doğru yerleştirin.
            </p>

            <div className="flex items-center space-x-2 pt-1">
              <button
                onClick={() => startPrepositionSession(10)}
                disabled={isLoading}
                className="flex-1 py-3 px-3 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black uppercase text-xs flex items-center justify-center space-x-1.5 border-3 border-black shadow-[3px_3px_0px_0px_#000] transition-all"
              >
                <span>10 SORU BAŞLA</span>
                <ChevronRight size={14} strokeWidth={3} />
              </button>
              <button
                onClick={() => startPrepositionSession(20)}
                disabled={isLoading}
                className="py-3 px-3 bg-white hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-black font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all"
              >
                20 SORU
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: 2. SUMMARY SCREEN
  // -------------------------------------------------------------
  if (phase === 'summary') {
    const accuracy = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

    return (
      <div className="flex flex-col min-h-[85vh] select-none text-black pb-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b-3 border-black">
          <span className="text-xs font-black uppercase tracking-wider bg-[#FFE600] text-black px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            {mode === 'vocab' ? 'KELİME CLOZE TESTİ ÖZETİ' : 'EDATLAR TESTİ ÖZETİ'}
          </span>
          <button
            onClick={() => setMode('select')}
            className="text-xs font-black uppercase text-black hover:bg-zinc-100 px-2.5 py-1 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000]"
          >
            MOD DEĞİŞTİR
          </button>
        </div>

        {/* Celebration Badge */}
        <div className="bg-white border-3 border-black p-6 text-center my-3 shadow-[5px_5px_0px_0px_#000]">
          <div className="w-16 h-16 mx-auto mb-3 bg-[#FFE600] border-3 border-black flex items-center justify-center text-black shadow-[3px_3px_0px_0px_#000]">
            <Award size={36} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-black uppercase text-black">
            {accuracy >= 80 ? '🎉 HARİKA BAŞARI!' : accuracy >= 50 ? '👏 TEBRİKLER!' : '💪 PRATİK YAPMAYA DEVAM!'}
          </h2>
          <p className="text-xs font-bold text-zinc-600 uppercase mt-1">
            {questions.length} soruluk turu tamamladın.
          </p>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t-2 border-black">
            <div className="bg-[#4ADE80] p-2.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[10px] text-black block font-black uppercase">DOĞRULUK</span>
              <span className="text-xl font-black text-black font-mono">%{accuracy}</span>
            </div>
            <div className="bg-[#FFE600] p-2.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[10px] text-black block font-black uppercase">KAZANILAN XP</span>
              <span className="text-xl font-black text-black font-mono">+{earnedXp}</span>
            </div>
            <div className="bg-[#00F0FF] p-2.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[10px] text-black block font-black uppercase">MAKS. SERİ</span>
              <span className="text-xl font-black text-black font-mono">🔥 {maxCombo}</span>
            </div>
          </div>
        </div>

        {/* Missed Questions Review */}
        {missedQuestions.length > 0 && (
          <div className="space-y-2 mb-4 flex-1">
            <h4 className="text-xs font-black text-black uppercase tracking-wider px-1">
              TEKRAR EDİLECEK CÜMLELER ({missedQuestions.length})
            </h4>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {missedQuestions.map((item, idx) => {
                const fullText = item.q.sentence.replace('[MASK]', `👉 ${item.q.answer} 👈`);
                return (
                  <div
                    key={idx}
                    className="p-3 bg-white border-2 border-black text-xs space-y-1 shadow-[2px_2px_0px_0px_#000]"
                  >
                    <p className="text-black leading-snug font-bold">
                      {fullText}
                    </p>
                    {item.q.translationTr && (
                      <p className="text-[11px] text-zinc-600 font-semibold italic border-t border-dashed border-black/30 pt-1">
                        "{item.q.translationTr}"
                      </p>
                    )}
                    <div className="flex items-center space-x-2 text-[10px] font-black pt-1">
                      <span className="bg-[#FF5588] text-white px-1.5 py-0.5 border border-black line-through">
                        SEÇİMİN: {item.selected}
                      </span>
                      <span className="bg-[#4ADE80] text-black px-1.5 py-0.5 border border-black">
                        DOĞRU: {item.q.answer}
                      </span>
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
            className="w-full py-4 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black uppercase text-sm flex items-center justify-center space-x-2 border-3 border-black shadow-[4px_4px_0px_0px_#000] transition-all"
          >
            <RotateCcw size={16} strokeWidth={2.5} />
            <span>TEKRAR OYNA</span>
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-white hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-black font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all"
          >
            ANA SAYFAYA DÖN
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW: 3. ACTIVE QUIZ SCREEN
  // -------------------------------------------------------------
  if (!currentQ) {
    return (
      <div className="p-8 text-center text-black font-black uppercase">
        <p className="text-sm">Soru yükleniyor...</p>
      </div>
    );
  }

  const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);
  const isAnswerCorrect = selectedOption?.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

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
          className="cursor-pointer hover:bg-[#FFE600] hover:text-black rounded-none px-0.5 transition-colors select-none inline-block active:scale-95 border-b border-dashed border-black/50"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {part}
        </span>
      );
    });
  };

  return (
    <div className="flex flex-col min-h-[85vh] select-none text-black pb-6 relative">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-2 mb-2">
        <button
          onClick={() => setMode('select')}
          className="p-2 bg-white border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          title="Çıkış"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
        </button>

        {/* Progress pill */}
        <div className="flex items-center space-x-2 bg-white px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <span className="text-xs font-black text-black font-mono">
            {currentIndex + 1} / {questions.length}
          </span>
          <span className="text-black font-black">•</span>
          <span className="text-[11px] font-black uppercase text-black">
            {currentQ.category === 'vocabulary' ? 'KELİME' : 'EDAT'}
          </span>
        </div>

        {/* Combo flame */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#FFE600] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_0px_#000]">
          <Flame size={14} className={combo > 1 ? 'fill-black animate-pulse' : 'text-black'} />
          <span>{combo}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-3 bg-white border-2 border-black overflow-hidden mb-4 shadow-[2px_2px_0px_0px_#000]">
        <div
          className="h-full bg-[#FFE600] border-r-2 border-black transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Question Card */}
      <div className="bg-white border-3 border-black p-5 mb-4 shadow-[4px_4px_0px_0px_#000] relative overflow-hidden flex flex-col justify-between min-h-[170px]">
        {/* Audio speech button & Hint */}
        <div className="flex items-center justify-between mb-3 border-b-2 border-black pb-2">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-black flex items-center space-x-1">
              <HelpCircle size={12} strokeWidth={2.5} />
              <span>BOŞLUĞU DOLDURUN</span>
            </span>
            <span className="text-[10px] text-black bg-[#FFE600] border border-black px-2 py-0.5 font-black uppercase">
              ✨ KELİMEYE TIKLA
            </span>
          </div>

          <button
            onClick={handlePlayAudio}
            className="p-1.5 bg-[#FFE600] hover:bg-[#FFD600] border-2 border-black text-black shadow-[1px_1px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title="Cümleyi Dinle"
          >
            <Volume2 size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Sentence Text with styled [MASK] slot */}
        <div
          className="text-base sm:text-lg font-bold text-black leading-relaxed my-auto select-none"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        >
          {renderInteractiveSentence(currentQ.sentenceBefore)}

          {/* DYNAMIC BLANK CHIP */}
          <span
            className={`inline-flex items-center justify-center px-3 py-1 mx-1.5 font-black uppercase border-2 border-black transition-all duration-150 align-middle shadow-[2px_2px_0px_0px_#000] ${
              hasFeedback
                ? isAnswerCorrect
                  ? 'bg-[#4ADE80] text-black'
                  : 'bg-[#FF5588] text-white'
                : 'bg-[#FFE600] text-black min-w-[70px] animate-pulse'
            }`}
          >
            {hasFeedback ? (
              <span
                data-interactive-word="true"
                onClick={e => {
                  e.stopPropagation();
                  handleWordTrigger(isAnswerCorrect ? selectedOption! : currentQ.answer, e.currentTarget);
                }}
                className="cursor-pointer hover:underline select-none"
                style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                title="Tıklayarak anlamına bakın ve listenize ekleyin"
              >
                {isAnswerCorrect ? selectedOption : currentQ.answer}
              </span>
            ) : (
              <span className="text-black text-sm tracking-widest select-none">____</span>
            )}
          </span>

          {renderInteractiveSentence(currentQ.sentenceAfter)}
        </div>

        {/* Turkish Translation */}
        <div className="mt-3 pt-2.5 border-t-2 border-black">
          {showTranslation || hasFeedback ? (
            <div className="text-xs text-black leading-snug bg-[#FDFBF7] p-3 border-2 border-black space-y-2 shadow-[2px_2px_0px_0px_#000]">
              {currentQ.translationTr ? (
                <div className="flex items-start space-x-2">
                  <span className="text-black font-black uppercase shrink-0">🇹🇷 CÜMLE:</span>
                  <span className="italic font-bold text-black">
                    "{currentQ.translationTr}"
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-zinc-600 font-bold uppercase italic">
                  <span>Cümle çevirisi hazırlanıyor...</span>
                </div>
              )}

              {hasFeedback && currentQ.wordTr && (
                <div className="flex items-center space-x-2 pt-2 border-t border-black text-[11px] font-black uppercase">
                  <span className="bg-[#4ADE80] text-black px-1 border border-black">{currentQ.answer}:</span>
                  <span className="text-black">{currentQ.wordTr}</span>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowTranslation(true)}
              className="text-[11px] font-black uppercase text-black hover:underline flex items-center space-x-1.5"
            >
              <span>🇹🇷</span>
              <span>CÜMLENİN TÜRKÇE ÇEVİRİSİNİ GÖR</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Choices Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 flex-1">
        {currentQ.options.map((opt, idx) => {
          const letter = OPTION_LETTERS[idx] || String(idx + 1);
          const isThisSelected = selectedOption === opt;
          const isThisCorrect = opt.trim().toLowerCase() === currentQ.answer.trim().toLowerCase();

          let btnStyle =
            'bg-white text-black border-3 border-black shadow-[3px_3px_0px_0px_#000] hover:bg-zinc-50 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none';
          let badgeStyle = 'bg-black text-white border-2 border-black';

          if (hasFeedback) {
            if (isThisCorrect) {
              btnStyle = 'bg-[#4ADE80] text-black border-3 border-black shadow-[3px_3px_0px_0px_#000]';
              badgeStyle = 'bg-black text-[#4ADE80] border-2 border-black';
            } else if (isThisSelected && !isThisCorrect) {
              btnStyle = 'bg-[#FF5588] text-white border-3 border-black shadow-[3px_3px_0px_0px_#000]';
              badgeStyle = 'bg-white text-black border-2 border-black';
            } else {
              btnStyle = 'bg-zinc-200 text-zinc-500 opacity-60 border-2 border-black shadow-none';
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
              className={`flex items-center p-3.5 border text-left transition-all duration-150 uppercase font-black relative ${btnStyle}`}
            >
              <span
                className={`w-7 h-7 flex items-center justify-center text-xs font-black mr-3 shrink-0 ${badgeStyle}`}
              >
                {letter}
              </span>
              <span className="text-sm sm:text-base font-black truncate flex-1">
                {opt}
              </span>
              {hasFeedback && isThisCorrect && (
                <CheckCircle2 size={18} className="text-black ml-1 shrink-0" strokeWidth={3} />
              )}
              {hasFeedback && isThisSelected && !isThisCorrect && (
                <XCircle size={18} className="text-white ml-1 shrink-0" strokeWidth={3} />
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback Bar & Manual Next Button */}
      {hasFeedback && (
        <div className="pt-2">
          <button
            onClick={advanceToNextQuestion}
            className={`w-full py-4 px-4 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all border-3 border-black shadow-[4px_4px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
              isAnswerCorrect
                ? 'bg-[#4ADE80] text-black hover:bg-[#3ec974]'
                : 'bg-[#FFE600] text-black hover:bg-[#FFD600]'
            }`}
          >
            <span>{currentIndex + 1 < questions.length ? 'SONRAKİ SORU' : 'SONUCU GÖR'}</span>
            <ArrowRight size={18} strokeWidth={3} />
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
                (typeof window !== 'undefined' ? window.innerWidth : 360) - 285,
                activePopup.rect.left + activePopup.rect.width / 2 - 140
              )
            )}px`,
            width: '275px',
            zIndex: 9999
          }}
          className={`bg-white border-3 border-black p-3.5 shadow-[5px_5px_0px_0px_#000] text-black transition-all ${
            activePopup.rect.top > 140 ? '-translate-y-full' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b-2 border-black">
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className="font-black text-base text-black uppercase truncate">
                {activePopup.word}
              </span>
              <button
                onClick={() => speakEnglish(activePopup.word)}
                className="p-1 bg-[#FFE600] border border-black text-black hover:bg-zinc-100 transition-colors shrink-0"
                title="Dinle"
              >
                <Volume2 size={14} />
              </button>
            </div>

            <button
              onClick={() => setActivePopup(null)}
              className="p-1 text-black hover:bg-zinc-200 border border-black transition-colors shrink-0"
              title="Kapat"
            >
              <X size={14} strokeWidth={3} />
            </button>
          </div>

          {/* Phonetic IPA */}
          {activePopup.ipa && (
            <p className="text-[10px] text-zinc-600 font-mono font-bold mt-1">
              {activePopup.ipa}
            </p>
          )}

          {/* Meaning & Add Action */}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              {activePopup.isLoading ? (
                <div className="flex items-center space-x-1.5 text-xs text-black font-black uppercase animate-pulse">
                  <Loader2 size={13} className="animate-spin shrink-0" />
                  <span>ARANIYOR...</span>
                </div>
              ) : (
                <p className="text-xs font-black uppercase text-black line-clamp-2 leading-tight">
                  {activePopup.translation}
                </p>
              )}
            </div>

            {/* Plus (+) Button to Add to Custom Words */}
            <div className="shrink-0">
              {activePopup.isAdded ? (
                <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#4ADE80] border-2 border-black text-black text-[11px] font-black uppercase shadow-[1px_1px_0px_0px_#000]">
                  <Check size={13} strokeWidth={3} />
                  <span>EKLENDİ</span>
                </div>
              ) : activePopup.isAlreadyCustom ? (
                <div className="flex items-center space-x-1 px-2 py-1 bg-zinc-200 border border-black text-black text-[10px] font-black uppercase">
                  <Check size={12} />
                  <span>LİSTENDE</span>
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
                  className="flex items-center space-x-1 px-2.5 py-1.5 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-black text-[11px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all disabled:opacity-50"
                  title="Özel Kelimelerime Ekle"
                >
                  <Plus size={14} strokeWidth={3} />
                  <span>EKLE</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
