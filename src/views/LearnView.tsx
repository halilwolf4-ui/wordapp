import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Word } from '../types';
import { AudioButton } from '../components/AudioButton';
import { HighlightedText } from '../components/HighlightedText';
import { sound } from '../services/audio';
import { fireCelebration } from '../components/Confetti';
import { checkTurkishAnswer } from '../utils/turkishMatcher';
import { getSmartDistractors } from '../utils/distractorHelper';
import {
  ArrowLeft,
  Check,
  X,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Eye,
  Keyboard,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { speakEnglish } from '../services/speech';

import { Progress, UserProfile, DailyLog } from '../types';
import { DailyStreakCompletion } from '../components/DailyStreakCompletion';
import { QuizOptionButton } from '../components/QuizOptionButton';
import { WordHintsList } from '../components/WordHintsList';
import { getWordHints, prefetchHints, getMaxAllowedHints, WordHint } from '../services/hintService';

interface Props {
  wordsQueue: Word[];
  allWordsMap: Map<number, Word>;
  allProgress?: Progress[];
  dailyNewTarget?: number;
  profile?: UserProfile;
  dailyLogs?: DailyLog[];
  todayStr?: string;
  onCompleteWord: (word: Word, isCorrect: boolean) => Promise<void>;
  onMarkWordKnown?: (word: Word) => Promise<void>;
  onMarkWordLearning?: (word: Word) => Promise<void>;
  onSessionCompleted?: () => Promise<{ earnedFreeze: boolean }>;
  onClose: () => void;
  onRefreshBatch: () => void;
}

type Phase = 'discovery' | 'study' | 'summary';

interface WordSessionState {
  word: Word;
  choicePassed: boolean;
  typingPassed: boolean;
  choicePassedAtStep: number | null;
}

interface PersistedState {
  items: {
    wordId: number;
    choicePassed: boolean;
    typingPassed: boolean;
    choicePassedAtStep: number | null;
  }[];
  globalStep: number;
  hintStats?: Record<number, { encounters: number; wrongCount: number; revealedCount: number }>;
}

const MIN_QUESTION_GAP = 5;
const STORAGE_LEARN_SESSION = 'kelime_avi_active_learn_session';
const STORAGE_BASKET = 'kelime_avi_learn_unknown_basket';

export const LearnView: React.FC<Props> = ({
  wordsQueue,
  allWordsMap,
  allProgress,
  dailyNewTarget = 10,
  profile,
  dailyLogs,
  todayStr,
  onCompleteWord,
  onMarkWordKnown,
  onMarkWordLearning,
  onSessionCompleted,
  onClose,
  onRefreshBatch
}) => {
  const targetWordsCount = Math.max(1, dailyNewTarget);
  const [earnedFreeze, setEarnedFreeze] = useState(false);

  // Discovery phase state
  const [candidateList, setCandidateList] = useState<Word[]>([]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [unknownBasket, setUnknownBasket] = useState<Word[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);

  // Swipe gesture
  const [dragOffset, setDragOffset] = useState(0);
  const touchStartX = useRef<number | null>(null);

  // Study phase state
  const [phase, setPhase] = useState<Phase>('study'); // Default to check study first
  const [sessionList, setSessionList] = useState<WordSessionState[]>([]);
  const [globalStep, setGlobalStep] = useState(0);

  // Encounter-based Hints state
  const [hintStats, setHintStats] = useState<Record<number, { encounters: number; wrongCount: number; revealedCount: number }>>({});
  const [currentWordHints, setCurrentWordHints] = useState<WordHint[]>([]);

  // Active question
  const [currentQuestion, setCurrentQuestion] = useState<{
    word: Word;
    type: 'choice' | 'typing';
    isFiller?: boolean;
  } | null>(null);

  // Inputs
  const [choiceOptions, setChoiceOptions] = useState<string[]>([]);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [typedInput, setTypedInput] = useState('');

  // Inline feedback
  const [inlineFeedback, setInlineFeedback] = useState<{
    status: 'correct' | 'wrong';
    correctAnswer: string;
  } | null>(null);

  const [combo, setCombo] = useState(0);
  const lastWordIdRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const typingInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus and center typing input when keyboard appears
  useEffect(() => {
    if (currentQuestion?.type === 'typing') {
      const timer = setTimeout(() => {
        typingInputRef.current?.focus();
        typingInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentQuestion]);

  // Helper to persist study session
  const saveSession = (
    list: WordSessionState[],
    step: number,
    stats: Record<number, { encounters: number; wrongCount: number; revealedCount: number }> = hintStats
  ) => {
    const uncompleted = list.filter(i => !i.typingPassed);
    const learned = list.filter(i => i.typingPassed).length;
    if (learned >= targetWordsCount || uncompleted.length === 0) {
      localStorage.removeItem(STORAGE_LEARN_SESSION);
      return;
    }
    const data: PersistedState = {
      items: list.map(i => ({
        wordId: i.word.id,
        choicePassed: i.choicePassed,
        typingPassed: i.typingPassed,
        choicePassedAtStep: i.choicePassedAtStep
      })),
      globalStep: step,
      hintStats: stats
    };
    try {
      localStorage.setItem(STORAGE_LEARN_SESSION, JSON.stringify(data));
    } catch {
      // Ignore
    }
  };

  // Helper to persist discovery basket
  const saveBasket = (basket: Word[]) => {
    try {
      localStorage.setItem(STORAGE_BASKET, JSON.stringify(basket.map(w => w.id)));
    } catch {
      // Ignore
    }
  };

  // Pick Next Question
  const pickNextQuestion = useCallback(
    (list: WordSessionState[], currentStep: number, excludeWordId: number | null) => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      setInlineFeedback(null);
      setSelectedChoice(null);
      setTypedInput('');

      const uncompleted = list.filter(item => !item.typingPassed);
      const learned = list.filter(item => item.typingPassed).length;

      // Hedef tamamlandıysa veya tüm kelimeler bittiyse oturumu tamamla:
      // "yukarıdaki bar dolunca bitsin diğerlerini bitirmesine gerek kalmasın"
      if (learned >= targetWordsCount || uncompleted.length === 0) {
        localStorage.removeItem(STORAGE_LEARN_SESSION);
        localStorage.removeItem(STORAGE_BASKET);
        if (todayStr) {
          localStorage.setItem('kelime_avi_learn_completed_' + todayStr, 'true');
        }
        setPhase('summary');
        sound.playLevelUp();
        fireCelebration();
        if (onSessionCompleted) {
          onSessionCompleted().then(res => {
            if (res?.earnedFreeze) setEarnedFreeze(true);
          });
        }
        return;
      }

      // KULLANICI İSTEĞİ:
      // "öğren kısmında 4 tane öğrenmesi kaldıysa kullanıcının biliyorum bilmiyorum kartları çıksın arada 5e çıkınca devam etsin öğrenmeye ama yukarıdaki bar dolunca bitsin diğerlerini bitirmesine gerek kalmasın sadece sonda 4 taneyi sürekli sormasın"
      if (uncompleted.length <= 4) {
        const inSessionIds = new Set(list.map(i => i.word.id));
        const availableCandidates = wordsQueue.filter(w => !inSessionIds.has(w.id));
        if (availableCandidates.length > 0) {
          setCandidateList(availableCandidates);
          setCandidateIndex(0);
          setIsFlipped(false);
          setPhase('discovery');
          return;
        }
      }

      const needChoice = uncompleted.filter(item => !item.choicePassed);
      const eligibleForTyping = uncompleted.filter(
        item =>
          item.choicePassed &&
          !item.typingPassed &&
          item.choicePassedAtStep !== null &&
          currentStep - item.choicePassedAtStep >= MIN_QUESTION_GAP
      );

      let availableChoice = needChoice;
      if (needChoice.length > 1 && excludeWordId !== null) {
        availableChoice = needChoice.filter(i => i.word.id !== excludeWordId);
        if (availableChoice.length === 0) availableChoice = needChoice;
      }

      let availableTyping = eligibleForTyping;
      if (eligibleForTyping.length > 1 && excludeWordId !== null) {
        availableTyping = eligibleForTyping.filter(i => i.word.id !== excludeWordId);
        if (availableTyping.length === 0) availableTyping = eligibleForTyping;
      }

      let chosenWord: Word;
      let questionType: 'choice' | 'typing';
      let isFiller = false;

      if (availableTyping.length > 0 && (availableChoice.length === 0 || Math.random() < 0.45)) {
        const picked = availableTyping[Math.floor(Math.random() * availableTyping.length)];
        chosenWord = picked.word;
        questionType = 'typing';
      } else if (availableChoice.length > 0) {
        const picked = availableChoice[Math.floor(Math.random() * availableChoice.length)];
        chosenWord = picked.word;
        questionType = 'choice';
      } else {
        // Cooldown filler question: prefer words already learned in this session for real reinforcement
        const learnedWordsInSession = list.filter(i => i.typingPassed).map(i => i.word);
        if (learnedWordsInSession.length > 0 && Math.random() < 0.8) {
          chosenWord = learnedWordsInSession[Math.floor(Math.random() * learnedWordsInSession.length)];
        } else {
          const allWordsArr = Array.from(allWordsMap.values());
          const nonActiveWords = allWordsArr.filter(
            w => !uncompleted.some(u => u.word.id === w.id) && w.id !== excludeWordId
          );
          chosenWord =
            nonActiveWords[Math.floor(Math.random() * nonActiveWords.length)] ||
            allWordsArr[Math.floor(Math.random() * allWordsArr.length)];
        }
        questionType = 'choice';
        isFiller = true;
      }

      lastWordIdRef.current = chosenWord.id;
      setCurrentQuestion({ word: chosenWord, type: questionType, isFiller });

      // Track encounter count for hints
      setHintStats(prev => {
        const existing = prev[chosenWord.id] || { encounters: 0, wrongCount: 0, revealedCount: 0 };
        const updated = {
          ...prev,
          [chosenWord.id]: {
            ...existing,
            encounters: existing.encounters + 1
          }
        };
        saveSession(list, currentStep, updated);
        return updated;
      });

      // Load English hints for this word
      getWordHints(chosenWord, Array.from(allWordsMap.values())).then(hints => {
        setCurrentWordHints(hints);
      });

      if (questionType === 'choice') {
        const allWordsArr = Array.from(allWordsMap.values());
        const correctTr = chosenWord.tr.split(/[,;/]+/)[0].trim();
        const sessionWords = list.map(i => i.word);
        const smartDistractors = getSmartDistractors(chosenWord, allWordsArr, 3, sessionWords);
        const opts = [correctTr, ...smartDistractors].sort(() => Math.random() - 0.5);
        setChoiceOptions(opts);
      }
    },
    [allWordsMap, onSessionCompleted, targetWordsCount, wordsQueue, todayStr]
  );

  // Start study with given words
  const startStudy = useCallback(
    (words: Word[]) => {
      const list: WordSessionState[] = words.map(w => ({
        word: w,
        choicePassed: false,
        typingPassed: false,
        choicePassedAtStep: null
      }));

      setSessionList(list);
      setPhase('study');
      setGlobalStep(1);
      saveSession(list, 1);
      localStorage.removeItem(STORAGE_BASKET);
      prefetchHints(words, Array.from(allWordsMap.values()));
      pickNextQuestion(list, 1, null);
    },
    [pickNextQuestion, allWordsMap]
  );

  // Initialize or resume on mount
  useEffect(() => {
    if (initializedRef.current) return;
    if (!allWordsMap || allWordsMap.size === 0) return; // Must wait for dictionary!
    initializedRef.current = true;

    // 0. Gün tamamlandı mı kontrolü ("gün sıfırlanmadan o ekran kalacak")
    const isCompletedToday =
      (todayStr && localStorage.getItem('kelime_avi_learn_completed_' + todayStr) === 'true') ||
      (dailyLogs && todayStr && (dailyLogs.find(l => l.date === todayStr)?.newLearnedCount || 0) >= targetWordsCount && (dailyLogs.find(l => l.date === todayStr)?.newLearnedCount || 0) > 0);

    if (isCompletedToday) {
      setPhase('summary');
      return;
    }

    // 1. Check if there is an active unfinished study session
    const savedSessionRaw = localStorage.getItem(STORAGE_LEARN_SESSION);
    if (savedSessionRaw) {
      try {
        const parsed: PersistedState = JSON.parse(savedSessionRaw);
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
          const restoredList: WordSessionState[] = [];
          for (const item of parsed.items) {
            const word = allWordsMap.get(item.wordId);
            if (word) {
              restoredList.push({
                word,
                choicePassed: item.choicePassed,
                typingPassed: item.typingPassed,
                choicePassedAtStep: item.choicePassedAtStep
              });
            }
          }

          const hasUncompleted = restoredList.some(i => !i.typingPassed);
          if (hasUncompleted) {
            // Trim to targetWordsCount if previously loaded with 20 items and target is lower
            const trimmedList = restoredList.length > targetWordsCount
              ? restoredList.slice(0, targetWordsCount)
              : restoredList;
            setSessionList(trimmedList);
            if (parsed.hintStats) {
              setHintStats(parsed.hintStats);
            }
            prefetchHints(trimmedList.map(i => i.word), Array.from(allWordsMap.values()));
            const step = parsed.globalStep || 1;
            setGlobalStep(step);
            setPhase('study');
            pickNextQuestion(trimmedList, step, null);
            return;
          }
        }
      } catch (e) {
        console.warn('Error reading persisted learn session:', e);
      }
    }

    // 2. Check if user already had some words in unknown basket
    const savedBasketRaw = localStorage.getItem(STORAGE_BASKET);
    let initialBasket: Word[] = [];
    if (savedBasketRaw) {
      try {
        const ids: number[] = JSON.parse(savedBasketRaw);
        if (Array.isArray(ids)) {
          initialBasket = ids.map(id => allWordsMap.get(id)).filter((w): w is Word => !!w);
        }
      } catch {
        // Ignore
      }
    }

    // Automatically include unstudied custom words or unstudied 'learning' words
    if (allProgress && allProgress.length > 0) {
      for (const prog of allProgress) {
        if (prog.status === 'learning' && prog.totalCorrect === 0 && !prog.lastReviewDate) {
          const w = allWordsMap.get(prog.wordId);
          if (w && !initialBasket.some(b => b.id === w.id)) {
            if (w.isCustom || w.categories?.includes('custom') || !!w.reword) {
              initialBasket.unshift(w); // Custom words first!
            } else {
              initialBasket.push(w);
            }
          }
        }
      }
    }

    if (initialBasket.length >= targetWordsCount) {
      startStudy(initialBasket.slice(0, targetWordsCount));
      return;
    }

    // 3. No active study: show discovery to find targetWordsCount unknown words
    const unselectedCandidates = wordsQueue.filter(
      w => !initialBasket.some(b => b.id === w.id)
    );

    // If no candidate words remain in discovery pool, but we have words waiting:
    if (unselectedCandidates.length === 0 && initialBasket.length > 0) {
      startStudy(initialBasket.slice(0, targetWordsCount));
      return;
    }

    setCandidateList(unselectedCandidates);
    setCandidateIndex(0);
    setUnknownBasket(initialBasket);
    setIsFlipped(false);
    setPhase('discovery');
    setCombo(0);
    setGlobalStep(0);
    lastWordIdRef.current = null;
  }, [wordsQueue, allWordsMap, allProgress, pickNextQuestion, startStudy]);

  const currentCandidate = candidateList[candidateIndex];

  // Auto pronounce
  useEffect(() => {
    if (currentCandidate && phase === 'discovery') {
      speakEnglish(currentCandidate.en);
    }
  }, [currentCandidate, phase]);

  useEffect(() => {
    if (currentQuestion && phase === 'study') {
      speakEnglish(currentQuestion.word.en);
    }
  }, [currentQuestion, phase]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    setDragOffset(e.touches[0].clientX - touchStartX.current);
  };
  const handleTouchEnd = () => {
    if (dragOffset > 70) {
      handleFlashcardChoice(true); // Biliyorum
    } else if (dragOffset < -70) {
      handleFlashcardChoice(false); // Bilmiyorum
    }
    setDragOffset(0);
    touchStartX.current = null;
  };

  // Flashcard Choice
  const handleFlashcardChoice = async (knows: boolean) => {
    if (!currentCandidate) return;

    // Çalışma esnasında ara keşif (öğrenmede son 4 kelime kaldığında 5'e tamamlamak için açılan kartlar)
    const isMidStudy = sessionList.length > 0;

    if (isMidStudy) {
      if (!knows) {
        sound.playWrong();
        // Bilmediği için veritabanında 'learning' olarak kaydet
        if (onMarkWordLearning) {
          await onMarkWordLearning(currentCandidate);
        }
        const newItem: WordSessionState = {
          word: currentCandidate,
          choicePassed: false,
          typingPassed: false,
          choicePassedAtStep: null
        };
        const updatedList = [...sessionList, newItem];
        setSessionList(updatedList);
        saveSession(updatedList, globalStep + 1);

        setIsFlipped(false);
        setDragOffset(0);

        const uncomp = updatedList.filter(i => !i.typingPassed);
        // "arada 5e çıkınca devam etsin öğrenmeye"
        if (uncomp.length >= 5) {
          setPhase('study');
          const nextStep = globalStep + 1;
          setGlobalStep(nextStep);
          pickNextQuestion(updatedList, nextStep, currentCandidate.id);
          return;
        } else {
          // Henüz 5 olmadıysa sıradaki karta geç
          if (candidateIndex + 1 < candidateList.length) {
            setCandidateIndex(prev => prev + 1);
          } else {
            // Aday kalmadıysa çalışmaya dön
            setPhase('study');
            pickNextQuestion(updatedList, globalStep, null);
          }
          return;
        }
      } else {
        sound.playCorrect(1);
        if (onMarkWordKnown) {
          await onMarkWordKnown(currentCandidate);
        }
        setIsFlipped(false);
        setDragOffset(0);
        if (candidateIndex + 1 < candidateList.length) {
          setCandidateIndex(prev => prev + 1);
        } else {
          setPhase('study');
          pickNextQuestion(sessionList, globalStep, null);
        }
        return;
      }
    }

    // İlk Keşif Aşaması (Henüz oturum başlamadan önceki 10 kelime seçimi)
    let updatedBasket = unknownBasket;

    if (!knows) {
      sound.playWrong();
      updatedBasket = [...unknownBasket, currentCandidate];
      setUnknownBasket(updatedBasket);
      saveBasket(updatedBasket);
      // Immediately mark as 'learning' in database!
      if (onMarkWordLearning) {
        await onMarkWordLearning(currentCandidate);
      }
    } else {
      sound.playCorrect(1);
      // PERMANENTLY MARK AS KNOWN so it never shows up in discovery again!
      if (onMarkWordKnown) {
        await onMarkWordKnown(currentCandidate);
      }
    }

    setIsFlipped(false);
    setDragOffset(0);

    // If target unknown words collected -> immediately start study!
    if (updatedBasket.length >= targetWordsCount) {
      startStudy(updatedBasket.slice(0, targetWordsCount));
      return;
    }

    if (candidateIndex + 1 < candidateList.length) {
      setCandidateIndex(prev => prev + 1);
    } else {
      if (updatedBasket.length > 0) {
        startStudy(updatedBasket);
      } else {
        startStudy(candidateList.slice(0, 10));
      }
    }
  };

  // Reveal next English hint (Eş anlamlı / Benzer anlamlı / Zıt anlamlı)
  const handleRevealNextHint = () => {
    if (!currentQuestion) return;
    const wordId = currentQuestion.word.id;
    setHintStats(prev => {
      const existing = prev[wordId] || { encounters: 1, wrongCount: 0, revealedCount: 0 };
      const nextRevealed = Math.min(3, existing.revealedCount + 1);
      const updated = {
        ...prev,
        [wordId]: {
          ...existing,
          revealedCount: nextRevealed
        }
      };
      saveSession(sessionList, globalStep, updated);
      return updated;
    });
  };

  // Multiple Choice Answer
  const handleSelectChoice = (option: string) => {
    if (selectedChoice !== null || !currentQuestion) return;

    setSelectedChoice(option);
    const targetWord = currentQuestion.word;
    const isCorrect = checkTurkishAnswer(option, targetWord.tr);

    if (isCorrect) {
      sound.playCorrect(combo + 1);
      setCombo(prev => prev + 1);

      let updatedList = sessionList;
      if (!currentQuestion.isFiller) {
        updatedList = sessionList.map(item =>
          item.word.id === targetWord.id
            ? { ...item, choicePassed: true, choicePassedAtStep: globalStep }
            : item
        );
        setSessionList(updatedList);
        saveSession(updatedList, globalStep + 1);
      }

      setInlineFeedback({ status: 'correct', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);
      feedbackTimerRef.current = setTimeout(() => {
        pickNextQuestion(updatedList, nextStep, targetWord.id);
      }, 350);
    } else {
      sound.playWrong();
      setCombo(0);

      setInlineFeedback({ status: 'wrong', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);

      // Increment wrong count for hints logic
      setHintStats(prev => {
        const existing = prev[targetWord.id] || { encounters: 1, wrongCount: 0, revealedCount: 0 };
        const updated = {
          ...prev,
          [targetWord.id]: {
            ...existing,
            wrongCount: existing.wrongCount + 1
          }
        };
        saveSession(sessionList, nextStep, updated);
        return updated;
      });
    }
  };

  // Keyboard Typing Answer
  const handleTypingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim() || !currentQuestion) return;

    const targetWord = currentQuestion.word;
    const isCorrect = checkTurkishAnswer(typedInput, targetWord.tr);

    if (isCorrect) {
      sound.playCorrect(combo + 1);
      setCombo(prev => prev + 1);
      fireCelebration();

      // Mark typingPassed = true -> OFFICIALLY LEARNED!
      const updatedList = sessionList.map(item =>
        item.word.id === targetWord.id ? { ...item, typingPassed: true } : item
      );
      setSessionList(updatedList);

      await onCompleteWord(targetWord, true);

      setInlineFeedback({ status: 'correct', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);
      saveSession(updatedList, nextStep);

      feedbackTimerRef.current = setTimeout(() => {
        pickNextQuestion(updatedList, nextStep, targetWord.id);
      }, 350);
    } else {
      sound.playWrong();
      setCombo(0);

      setInlineFeedback({ status: 'wrong', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);

      // Increment wrong count for hints logic
      setHintStats(prev => {
        const existing = prev[targetWord.id] || { encounters: 1, wrongCount: 0, revealedCount: 0 };
        const updated = {
          ...prev,
          [targetWord.id]: {
            ...existing,
            wrongCount: existing.wrongCount + 1
          }
        };
        saveSession(sessionList, nextStep, updated);
        return updated;
      });
    }
  };

  // Advance on wrong answer
  const handleAdvanceManually = () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    pickNextQuestion(sessionList, globalStep, currentQuestion?.word.id ?? null);
  };

  // Reset and find new 20 words
  const handleStartFreshDiscovery = () => {
    localStorage.removeItem(STORAGE_LEARN_SESSION);
    localStorage.removeItem(STORAGE_BASKET);
    setSessionList([]);
    setUnknownBasket([]);
    setHintStats({});
    setCurrentWordHints([]);
    setCandidateIndex(0);
    setCandidateList(wordsQueue);
    setIsFlipped(false);
    setPhase('discovery');
    setCombo(0);
    setGlobalStep(0);
    lastWordIdRef.current = null;
    onRefreshBatch();
  };

  const learnedCount = sessionList.filter(i => i.typingPassed).length;

  // SUMMARY SCREEN: Daily Streak & Freeze Progress
  if (phase === 'summary') {
    if (profile && dailyLogs && todayStr) {
      return (
        <DailyStreakCompletion
          profile={profile}
          dailyLogs={dailyLogs}
          todayStr={todayStr}
          earnedFreeze={earnedFreeze}
          onClose={onClose}
        />
      );
    }

    return (
      <div className="space-y-6 pb-20 pt-4 text-center">
        <div className="w-20 h-20 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
          <CheckCircle2 size={44} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-white">{learnedCount} Kelime Tamamlandı!</h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Bilmeyip seçtiğin tüm kelimeleri önce şıklarla, ardından klavyeyle yazarak başarıyla öğrendin.
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-5 max-w-sm mx-auto text-left space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            Öğrenilen Kelimeler ({learnedCount})
          </span>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {sessionList.filter(i => i.typingPassed).map(i => (
              <span
                key={i.word.id}
                className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 text-xs font-bold"
              >
                {i.word.en}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-2 max-w-sm mx-auto">
          {!(todayStr && localStorage.getItem('kelime_avi_learn_completed_' + todayStr) === 'true') && (
            <button
              onClick={handleStartFreshDiscovery}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-base"
            >
              <RotateCcw size={18} />
              <span>Yeni {targetWordsCount} Kelime Bul (Flash Kart)</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-2xl"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 pt-2">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Progress Display */}
        <div className="flex-1 mx-3">
          {phase === 'discovery' ? (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                {sessionList.length > 0 ? (
                  <>
                    <span className="text-amber-400 font-bold">
                      🎯 Havuzu 5'e Tamamla ({sessionList.filter(i => !i.typingPassed).length}/5 Aktif)
                    </span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {learnedCount} / {targetWordsCount} Hedef
                    </span>
                  </>
                ) : (
                  <>
                    <span>🎯 {targetWordsCount} Bilinmeyen Kelime Topla</span>
                    <span className="font-bold text-amber-400 font-mono">
                      {unknownBasket.length} / {targetWordsCount}
                    </span>
                  </>
                )}
              </div>
              <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    sessionList.length > 0 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{
                    width: sessionList.length > 0
                      ? `${Math.min(100, (learnedCount / targetWordsCount) * 100)}%`
                      : `${(unknownBasket.length / targetWordsCount) * 100}%`
                  }}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span className="flex items-center space-x-1">
                  <span>
                    {currentQuestion?.isFiller
                      ? '🔄 Ara Pekiştirme'
                      : currentQuestion?.type === 'choice'
                      ? 'Şıklı Test'
                      : 'Klavyeyle Yazma'}
                  </span>
                  {currentQuestion?.type === 'typing' && (
                    <Keyboard size={12} className="text-emerald-400 inline" />
                  )}
                </span>
                <span className="font-bold text-emerald-400 font-mono">
                  {learnedCount} / {targetWordsCount} Tamamen Öğrenildi
                </span>
              </div>
              <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (learnedCount / targetWordsCount) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {combo >= 2 && (
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black animate-bounce">
            <span>🔥 {combo}x</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. AŞAMA: KEŞİF (SADECE BİLİNMEYEN KELİME YOKSA AÇILIR)                     */}
      {/* ========================================================================= */}
      {phase === 'discovery' && currentCandidate && (
        <div className="space-y-4">
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => setIsFlipped(prev => !prev)}
            style={{
              transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.08}deg)`,
              transition: dragOffset === 0 ? 'transform 0.25s ease' : 'none'
            }}
            className={`cursor-pointer select-none bg-slate-900 border rounded-3xl p-6 shadow-sm min-h-[350px] flex flex-col justify-between relative transition-colors ${
              dragOffset > 30
                ? 'border-emerald-500 bg-emerald-950/20'
                : dragOffset < -30
                ? 'border-rose-500 bg-rose-950/20'
                : 'border-slate-800'
            }`}
          >
            {(currentCandidate.isCustom || currentCandidate.categories?.includes('custom') || !!currentCandidate.reword) && (
              <div className="absolute top-4 left-4 inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold">
                <Sparkles size={12} />
                <span>Kendi Kelimen</span>
              </div>
            )}

            {dragOffset > 30 && (
              <span className="absolute top-4 right-4 text-emerald-400 font-extrabold text-sm flex items-center space-x-1">
                <span>BİLİYORUM</span>
                <Check size={18} />
              </span>
            )}
            {dragOffset < -30 && (
              <span className="absolute top-4 left-4 text-rose-400 font-extrabold text-sm flex items-center space-x-1">
                <X size={18} />
                <span>BİLMİYORUM</span>
              </span>
            )}

            {/* Front: ENGLISH ONLY */}
            <div className="text-center space-y-3 py-6 my-auto">
              <div className="flex items-center justify-center space-x-3">
                <h1 className="text-4xl font-black text-white tracking-tight">
                  {currentCandidate.en}
                </h1>
                <AudioButton text={currentCandidate.en} size={28} />
              </div>
              {currentCandidate.ipa && (
                <p className="text-base font-mono text-indigo-400 tracking-wider">
                  {currentCandidate.ipa}
                </p>
              )}
            </div>

            {/* Back: REVEALED ON TAP */}
            {isFlipped ? (
              <div className="space-y-4 pt-4 border-t border-slate-800 animate-fadeIn">
                <div className="bg-slate-950 rounded-2xl p-4 text-center border border-slate-800/80">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                    Türkçe Karşılığı
                  </span>
                  <p className="text-2xl font-black text-emerald-400">
                    {currentCandidate.tr}
                  </p>
                </div>

                {currentCandidate.examples?.[0] && (
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 text-xs space-y-1">
                    <p className="text-slate-200 italic">
                      <HighlightedText text={currentCandidate.examples[0].en} />
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      {currentCandidate.examples[0].tr}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-slate-400 flex items-center justify-center space-x-1.5 opacity-80">
                <Eye size={14} />
                <span>Anlamı görmek için karta dokun</span>
              </div>
            )}
          </div>

          {/* Swipe Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => handleFlashcardChoice(false)}
              className="py-3.5 px-4 bg-slate-900 hover:bg-slate-850 active:scale-95 border border-slate-800 hover:border-rose-500/50 rounded-2xl text-rose-400 font-bold flex items-center justify-center space-x-2 text-sm shadow-sm transition-all"
            >
              <X size={18} />
              <span>Bilmiyorum (Sola)</span>
            </button>

            <button
              onClick={() => handleFlashcardChoice(true)}
              className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 rounded-2xl text-white font-bold flex items-center justify-center space-x-2 text-sm shadow-sm transition-all"
            >
              <span>Biliyorum (Sağa)</span>
              <Check size={18} />
            </button>
          </div>

          {sessionList.length === 0 && unknownBasket.length >= 5 && (
            <div className="text-center pt-2">
              <button
                onClick={() => startStudy(unknownBasket)}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 underline"
              >
                {unknownBasket.length} kelimeyle şimdi öğrenmeye başla ➔
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. AŞAMA: ÇALIŞMA (SÜREKLİ AKTİF ÖĞRENME ALANI)                            */}
      {/* ========================================================================= */}
      {phase === 'study' && currentQuestion && (
        <div className="space-y-4">
          <div
            className={`bg-slate-900 border rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 sm:space-y-5 transition-all relative ${
              inlineFeedback?.status === 'correct'
                ? 'border-emerald-500/70'
                : inlineFeedback?.status === 'wrong'
                ? 'border-rose-500/70'
                : 'border-slate-800'
            }`}
          >
            {/* Header / Word */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold tracking-wide text-slate-400">
                {currentQuestion.isFiller ? (
                  <span className="text-amber-400 flex items-center space-x-1">
                    <RefreshCw size={13} />
                    <span>Ara Pekiştirme Sorusu</span>
                  </span>
                ) : currentQuestion.type === 'typing' ? (
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <Keyboard size={13} />
                    <span>Klavyeyle Türkçe Karşılığını Yaz</span>
                  </span>
                ) : (
                  <span>Bu kelimenin Türkçesi hangisi?</span>
                )}
              </div>

              {(currentQuestion.word.isCustom || currentQuestion.word.categories?.includes('custom') || !!currentQuestion.word.reword) && (
                <div className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[11px] font-bold">
                  <Sparkles size={12} />
                  <span>Kendi Kelimen</span>
                </div>
              )}

              <div className="flex items-center justify-center space-x-2 pt-1">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{currentQuestion.word.en}</h2>
                <AudioButton text={currentQuestion.word.en} size={22} />
              </div>
              {currentQuestion.word.ipa && (
                <p className="text-xs sm:text-sm font-mono text-indigo-400">{currentQuestion.word.ipa}</p>
              )}
            </div>

            {/* Word Hints List (Encounter-gated English hints: Eş/Benzer/Zıt) */}
            <WordHintsList
              hints={currentWordHints}
              revealedCount={hintStats[currentQuestion.word.id]?.revealedCount || 0}
              maxAllowed={getMaxAllowedHints(hintStats[currentQuestion.word.id]?.encounters || 1)}
              onRevealNext={handleRevealNextHint}
              disabled={inlineFeedback !== null}
            />

            {/* A) Multiple Choice Mode with QuizOptionButton */}
            {currentQuestion.type === 'choice' && (
              <div className="space-y-2.5">
                {choiceOptions.map((opt, idx) => {
                  const isSelected = selectedChoice === opt;
                  const isThisCorrect = checkTurkishAnswer(opt, currentQuestion.word.tr);

                  return (
                    <QuizOptionButton
                      key={idx}
                      index={idx}
                      text={opt}
                      isSelected={isSelected}
                      isCorrect={isThisCorrect}
                      hasFeedback={inlineFeedback !== null}
                      disabled={selectedChoice !== null}
                      onSelect={() => handleSelectChoice(opt)}
                    />
                  );
                })}
              </div>
            )}

            {/* B) Typing Mode */}
            {currentQuestion.type === 'typing' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (inlineFeedback?.status === 'wrong') {
                    handleAdvanceManually();
                  } else {
                    handleTypingSubmit(e);
                  }
                }}
                className="space-y-3"
              >
                <input
                  ref={typingInputRef}
                  type="text"
                  autoFocus
                  disabled={inlineFeedback !== null}
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  placeholder="Türkçe anlamını yaz..."
                  className={`w-full py-3 px-3.5 rounded-xl bg-slate-950 border-2 text-white text-center text-lg sm:text-xl font-bold tracking-wide focus:outline-none transition-all ${
                    inlineFeedback?.status === 'wrong'
                      ? 'border-rose-500 bg-rose-950/20 text-rose-200 animate-wrong-shake'
                      : 'border-slate-800 focus:border-indigo-500 shadow-inner'
                  }`}
                />

                {inlineFeedback?.status === 'wrong' ? (
                  <button
                    type="button"
                    autoFocus
                    onClick={handleAdvanceManually}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold rounded-xl shadow-sm text-sm sm:text-base transition-all flex items-center justify-center space-x-2"
                  >
                    <span>Diğer Kelimeye Geç</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!typedInput.trim()}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-40 text-white font-bold rounded-xl shadow-sm text-sm sm:text-base transition-all"
                  >
                    Onayla
                  </button>
                )}
              </form>
            )}

            {/* INLINE WRONG FEEDBACK BANNER */}
            {inlineFeedback?.status === 'wrong' && (
              <div className="pt-1 animate-fadeIn">
                <div className="bg-slate-950 border border-rose-500/40 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-[11px] font-semibold text-rose-400 block">
                      Yanlış Cevap! Doğru Anlam:
                    </span>
                    <span className="text-sm font-bold text-white leading-tight">
                      {inlineFeedback.correctAnswer}
                    </span>
                  </div>

                  <button
                    onClick={handleAdvanceManually}
                    className="shrink-0 flex items-center space-x-1 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition-all active:scale-95"
                  >
                    <span>Geç</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
