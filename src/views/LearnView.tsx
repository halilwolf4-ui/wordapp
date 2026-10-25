import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Word } from '../types';
import { AudioButton } from '../components/AudioButton';
import { HighlightedText } from '../components/HighlightedText';
import { sound } from '../services/audio';
import { fireCelebration } from '../components/Confetti';
import { checkTurkishAnswer, checkTurkishAnswerDetailed } from '../utils/turkishMatcher';
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
  RefreshCw,
  AlertCircle,
  Flame
} from 'lucide-react';
import { speakEnglish } from '../services/speech';

import { Progress, UserProfile, DailyLog } from '../types';
import { DailyStreakCompletion } from '../components/DailyStreakCompletion';
import { QuizOptionButton } from '../components/QuizOptionButton';
import { WordHintsList } from '../components/WordHintsList';
import { getWordHints, prefetchHints, getMaxAllowedHints, WordHint } from '../services/hintService';
import { syncAndSelectNextQuestion, PoolQueueItem, MIN_QUESTION_GAP } from '../utils/sessionQueue';
import { getWordEmoji, formatCorrectAnswer } from '../utils/wordEmoji';

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
  onRecordMistake?: (wordId: number, mistake: string) => Promise<void>;
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
  lastAskedStep: number | null;
  lastMistake?: string;
}

interface PersistedState {
  date?: string;
  items: {
    wordId: number;
    choicePassed: boolean;
    typingPassed: boolean;
    choicePassedAtStep: number | null;
    lastAskedStep: number | null;
    lastMistake?: string;
  }[];
  globalStep: number;
  hintStats?: Record<number, { encounters: number; wrongCount: number; revealedCount: number }>;
  poolQueue?: PoolQueueItem[];
}

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
  onRecordMistake,
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
    isNear?: boolean;
    nearExplanation?: string;
  } | null>(null);

  const [combo, setCombo] = useState(0);
  const lastWordIdRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const typingInputRef = useRef<HTMLInputElement>(null);
  const poolQueueRef = useRef<PoolQueueItem[]>([]);
  const bufferLastAskedRef = useRef<Map<number, number>>(new Map());

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
    stats: Record<number, { encounters: number; wrongCount: number; revealedCount: number }> = hintStats,
    queue: PoolQueueItem[] = poolQueueRef.current
  ) => {
    const uncompleted = list.filter(i => !i.typingPassed);
    if (uncompleted.length === 0) {
      localStorage.removeItem(STORAGE_LEARN_SESSION);
      return;
    }
    const data: PersistedState = {
      date: todayStr || new Date().toISOString().split('T')[0],
      items: list.map(i => ({
        wordId: i.word.id,
        choicePassed: i.choicePassed,
        typingPassed: i.typingPassed,
        choicePassedAtStep: i.choicePassedAtStep,
        lastAskedStep: i.lastAskedStep,
        lastMistake: i.lastMistake
      })),
      globalStep: step,
      hintStats: stats,
      poolQueue: queue
    };
    try {
      localStorage.setItem(STORAGE_LEARN_SESSION, JSON.stringify(data));
    } catch {
      // Ignore
    }
  };

  // Aktif kelimede daha önce yapılmış yanlış varsa bul (tek string - hafızayı şişirmez)
  const activeLastMistake = useMemo(() => {
    if (!currentQuestion) return undefined;
    const sessionItem = sessionList.find(i => i.word.id === currentQuestion.word.id);
    if (sessionItem?.lastMistake) return sessionItem.lastMistake;
    const prog = allProgress?.find(p => p.wordId === currentQuestion.word.id);
    return prog?.lastMistake;
  }, [currentQuestion, sessionList, allProgress]);

  // Aktif kelime için semantik / alakalı emoji
  const currentWordEmoji = useMemo(() => {
    return getWordEmoji(currentQuestion?.word);
  }, [currentQuestion?.word]);

  // Helper to persist discovery basket
  const saveBasket = (basket: Word[]) => {
    try {
      localStorage.setItem(STORAGE_BASKET, JSON.stringify(basket.map(w => w.id)));
    } catch {
      // Ignore
    }
  };

  // Tampon / Ara Pekiştirme kelimeleri havuzu:
  // KULLANICI KURALI: Yalnızca kullanıcının halihazırda ÖĞRENDİĞİ (learning veya mastered)
  // ve o oturumda tamamladığı kelimelerden rastgele seçilir. Asla hiç görmediği sözlük kelimesi çıkamaz!
  const getBufferWords = useCallback((): Word[] => {
    const addedIds = new Set<number>();

    // 1. Bu oturumda zaten tamamlanmış kelimeler
    const sessionCompleted: Word[] = [];
    sessionList.forEach(item => {
      if (item.typingPassed && !addedIds.has(item.word.id)) {
        sessionCompleted.push(item.word);
        addedIds.add(item.word.id);
      }
    });

    // 2. Geçmişte öğrenilen ('learning') veya pekişen ('mastered') kelimeler
    const learnedProgressWords: Word[] = [];
    if (allProgress && allProgress.length > 0) {
      allProgress.forEach(p => {
        if ((p.status === 'learning' || p.status === 'mastered') && !addedIds.has(p.wordId)) {
          const w = allWordsMap.get(p.wordId);
          if (w) {
            learnedProgressWords.push(w);
            addedIds.add(w.id);
          }
        }
      });
    }

    // 3. Oturumda şıkkı geçilmiş diğer kelimeler (pekiştirme için)
    const sessionChoicePassed: Word[] = [];
    sessionList.forEach(item => {
      if (item.choicePassed && !addedIds.has(item.word.id)) {
        sessionChoicePassed.push(item.word);
        addedIds.add(item.word.id);
      }
    });

    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

    return [
      ...shuffle(learnedProgressWords),
      ...shuffle(sessionCompleted),
      ...shuffle(sessionChoicePassed)
    ];
  }, [sessionList, allProgress, allWordsMap]);

  // Pick Next Question
  const pickNextQuestion = useCallback(
    (list: WordSessionState[], currentStep: number, excludeWordId: number | null) => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      setInlineFeedback(null);
      setSelectedChoice(null);
      setTypedInput('');

      const uncompleted = list.filter(item => !item.typingPassed);
      const learned = list.filter(item => item.typingPassed).length;

      // 1. Hedef tamamlandıysa veya tüm kelimeler bittiyse oturumu tamamla
      if (learned >= targetWordsCount || uncompleted.length === 0) {
        poolQueueRef.current = [];
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

      // 2. KULLANICI KURALI:
      // Aktif döngüde daima en az 5 kelime bulunur.
      // Sonda 1 kelime kalsa bile araya 4 farklı kelime girer (toplam en az 5 kelime döngüsü).
      // Bir kelime sorulduktan veya yanlış yapıldıktan sonra araya en az 5 soru girmeden tekrar sorulamaz.
      const candidateBuffers = getBufferWords();

      const result = syncAndSelectNextQuestion({
        list,
        currentStep,
        excludeWordId,
        currentQueue: poolQueueRef.current,
        candidateBuffers,
        allWordsMap,
        bufferLastAskedMap: bufferLastAskedRef.current,
        minGap: MIN_QUESTION_GAP
      });

      if (!result) {
        poolQueueRef.current = [];
        localStorage.removeItem(STORAGE_LEARN_SESSION);
        localStorage.removeItem(STORAGE_BASKET);
        setPhase('summary');
        return;
      }

      poolQueueRef.current = result.nextQueue;
      const chosenWord = result.chosenWord;
      const questionType = result.questionType;
      const isFiller = result.isBuffer;

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
    [allWordsMap, onSessionCompleted, targetWordsCount, getBufferWords, todayStr]
  );

  // Start study with given words
  const startStudy = useCallback(
    (words: Word[]) => {
      // Kelimelerin baştan alfabetik / eklenme sırasıyla gelmemesi için karıştır
      const shuffledWords = [...words].sort(() => Math.random() - 0.5);

      const list: WordSessionState[] = shuffledWords.map(w => ({
        word: w,
        choicePassed: false,
        typingPassed: false,
        choicePassedAtStep: null,
        lastAskedStep: null
      }));

      poolQueueRef.current = [];
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
        if (parsed && (!todayStr || !parsed.date || parsed.date === todayStr) && Array.isArray(parsed.items) && parsed.items.length > 0) {
          const restoredList: WordSessionState[] = [];
          for (const item of parsed.items) {
            const word = allWordsMap.get(item.wordId);
            if (word) {
              const prog = allProgress?.find(p => p.wordId === item.wordId);
              restoredList.push({
                word,
                // ÖNEMLİ KURAL: Oturuma yeniden girildiğinde veya uygulama açıldığında,
                // tamamlanmamış hiçbir kelime ASLA doğrudan yazmalı açılmamalıdır!
                // Kullanıcı önce o kelimenin şıkkını görmeli ve çözmeli;
                // ancak şıkkı çözüldükten sonra aralık kuralıyla yazma aşamasına geçmelidir.
                choicePassed: false,
                typingPassed: item.typingPassed,
                choicePassedAtStep: null,
                lastAskedStep: null,
                lastMistake: item.lastMistake || prog?.lastMistake
              });
            }
          }

          const hasUncompleted = restoredList.some(i => !i.typingPassed);
          if (hasUncompleted) {
            setSessionList(restoredList);
            if (parsed.hintStats) {
              setHintStats(parsed.hintStats);
            }
            // Kuyruğu temiz başlat ki şıklı sorular öncelikli dizilsin
            poolQueueRef.current = [];
            prefetchHints(restoredList.map(i => i.word), Array.from(allWordsMap.values()));
            const step = parsed.globalStep || 1;
            setGlobalStep(step);
            setPhase('study');
            pickNextQuestion(restoredList, step, null);
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
    const basketEns = new Set(initialBasket.map(b => (b.en || '').trim().toLowerCase()));
    const learnedEns = new Set(
      allProgress
        ? allProgress.map(p => allWordsMap.get(p.wordId)?.en.trim().toLowerCase()).filter(Boolean)
        : []
    );
    const seenCandidates = new Set<string>();
    const unselectedCandidates = wordsQueue.filter(w => {
      const enKey = (w.en || '').trim().toLowerCase();
      if (!enKey) return false;
      if (initialBasket.some(b => b.id === w.id)) return false;
      if (basketEns.has(enKey) || learnedEns.has(enKey) || seenCandidates.has(enKey)) return false;
      seenCandidates.add(enKey);
      return true;
    });

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
          choicePassedAtStep: null,
          lastAskedStep: null
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
            ? { ...item, choicePassed: true, choicePassedAtStep: globalStep, lastAskedStep: globalStep }
            : item
        );
        setSessionList(updatedList);
        saveSession(updatedList, globalStep + 1);
      } else {
        bufferLastAskedRef.current.set(targetWord.id, globalStep);
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

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);

      const chosenMistake = option.trim();
      let updatedList = sessionList;
      if (!currentQuestion.isFiller) {
        updatedList = sessionList.map(item =>
          item.word.id === targetWord.id
            ? {
                ...item,
                choicePassed: false,
                choicePassedAtStep: null,
                lastAskedStep: globalStep,
                lastMistake: chosenMistake
              }
            : item
        );
        setSessionList(updatedList);
        saveSession(updatedList, nextStep);
        if (onRecordMistake) {
          onRecordMistake(targetWord.id, chosenMistake);
        }
      } else {
        bufferLastAskedRef.current.set(targetWord.id, globalStep);
      }

      setInlineFeedback({ status: 'wrong', correctAnswer: targetWord.tr });

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
    const detailed = checkTurkishAnswerDetailed(typedInput, targetWord.tr);
    const isCorrect = detailed.isCorrect;

    if (isCorrect) {
      sound.playCorrect(combo + 1);
      setCombo(prev => prev + 1);
      fireCelebration();

      // Mark typingPassed = true -> OFFICIALLY LEARNED!
      const updatedList = sessionList.map(item =>
        item.word.id === targetWord.id ? { ...item, typingPassed: true, lastAskedStep: globalStep } : item
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

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);

      const typedMistake = typedInput.trim();
      const updatedList = sessionList.map(item =>
        item.word.id === targetWord.id
          ? {
              ...item,
              choicePassed: false,
              choicePassedAtStep: null,
              lastAskedStep: globalStep,
              lastMistake: typedMistake
            }
          : item
      );
      setSessionList(updatedList);
      saveSession(updatedList, nextStep);

      if (onRecordMistake) {
        onRecordMistake(targetWord.id, typedMistake);
      }

      setInlineFeedback({
        status: 'wrong',
        correctAnswer: targetWord.tr,
        isNear: detailed.isNear,
        nearExplanation: detailed.nearExplanation
      });

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
    const learnedEns = new Set(
      allProgress
        ? allProgress.map(p => allWordsMap.get(p.wordId)?.en.trim().toLowerCase()).filter(Boolean)
        : []
    );
    const seenCandidates = new Set<string>();
    const freshCandidates = wordsQueue.filter(w => {
      const enKey = (w.en || '').trim().toLowerCase();
      if (!enKey || learnedEns.has(enKey) || seenCandidates.has(enKey)) return false;
      seenCandidates.add(enKey);
      return true;
    });
    setCandidateList(freshCandidates);
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
      <div className="space-y-6 pb-20 pt-4 text-center select-none text-black">
        <div className="w-20 h-20 bg-[#4ADE80] text-black border-4 border-black flex items-center justify-center mx-auto mb-2 shadow-[6px_6px_0px_0px_#000] rotate-[-3deg]">
          <CheckCircle2 size={44} strokeWidth={2.5} />
        </div>
        <div className="space-y-2">
          <div className="inline-block bg-[#FFE600] border-2 border-black px-3 py-1 shadow-[3px_3px_0px_0px_#000]">
            <h2 className="text-2xl sm:text-3xl font-black text-black uppercase">{learnedCount} KELİME TAMAMLANDI!</h2>
          </div>
          <p className="text-zinc-800 font-bold text-xs max-w-xs mx-auto">
            Bilmeyip seçtiğin tüm kelimeleri önce şıklarla, ardından klavyeyle yazarak başarıyla öğrendin.
          </p>
        </div>

        <div className="bg-white border-[3px] border-black p-5 max-w-sm mx-auto text-left space-y-2.5 shadow-[5px_5px_0px_0px_#000]">
          <span className="text-xs font-black text-black uppercase tracking-wider block bg-[#FFE600] border border-black px-2 py-0.5 inline-block">
            ÖĞRENİLEN KELİMELER ({learnedCount})
          </span>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1 pt-1">
            {sessionList.filter(i => i.typingPassed).map(i => (
              <span
                key={i.word.id}
                className="px-2.5 py-1 bg-[#BBF7D0] border-2 border-black text-black text-xs font-black shadow-[1.5px_1.5px_0px_0px_#000] uppercase"
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
              className="w-full py-4 bg-black text-[#FFE600] hover:bg-zinc-800 active:translate-x-[2px] active:translate-y-[2px] border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_#FFE600] active:shadow-none flex items-center justify-center space-x-2 transition-all"
            >
              <RotateCcw size={18} strokeWidth={3} />
              <span>YENİ {targetWordsCount} KELİME BUL (FLASH KART)</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-white text-black hover:bg-zinc-100 active:translate-x-[2px] active:translate-y-[2px] border-2 border-black font-black uppercase text-sm shadow-[3px_3px_0px_0px_#000] active:shadow-none transition-all"
          >
            ANA SAYFAYA DÖN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 select-none text-black w-full pb-2">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onClose}
          className="p-1.5 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black hover:bg-[#FFE600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all shrink-0"
          title="Geri"
        >
          <ArrowLeft size={16} strokeWidth={3} />
        </button>

        {profile && profile.streak > 0 && (
          <div className="flex items-center space-x-1 bg-white border-2 border-black px-2 py-0.5 text-black font-black text-xs shadow-[2px_2px_0px_0px_#000] shrink-0">
            <Flame size={12} className="text-[#FF5722] fill-[#FF5722]" />
            <span>{profile.streak} GÜN</span>
          </div>
        )}

        {/* Progress Display */}
        <div className="flex-1 min-w-0">
          {phase === 'discovery' ? (
            <div>
              <div className="flex justify-between text-[11px] mb-0.5 font-black">
                {sessionList.length > 0 ? (
                  <>
                    <span className="text-black uppercase truncate">
                      🎯 HAVUZ ({sessionList.filter(i => !i.typingPassed).length}/5)
                    </span>
                    <span className="text-black font-mono bg-[#FFE600] px-1 border border-black shrink-0">
                      {learnedCount}/{targetWordsCount}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="uppercase text-black truncate">🎯 {targetWordsCount} BİLİNMEYEN TOPLA</span>
                    <span className="font-mono bg-[#FFE600] text-black px-1 border border-black shrink-0">
                      {unknownBasket.length}/{targetWordsCount}
                    </span>
                  </>
                )}
              </div>
              <div className="h-2.5 bg-white border-2 border-black overflow-hidden shadow-[1.5px_1.5px_0px_0px_#000]">
                <div
                  className={`h-full transition-all duration-300 ${
                    sessionList.length > 0 ? 'bg-[#4ADE80]' : 'bg-[#FFE600]'
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
              <div className="flex justify-between text-[11px] mb-0.5 font-black">
                <span className="flex items-center space-x-1 uppercase text-black truncate">
                  <span>
                    {currentQuestion?.isFiller
                      ? '🔄 PEKİŞTİRME'
                      : currentQuestion?.type === 'choice'
                      ? 'ŞIKLI TEST'
                      : 'KLAVYEYLE YAZ'}
                  </span>
                  {currentQuestion?.type === 'typing' && (
                    <Keyboard size={12} strokeWidth={2.5} className="text-black inline" />
                  )}
                </span>
                <span className="font-mono bg-[#4ADE80] text-black px-1 border border-black shrink-0">
                  {learnedCount}/{targetWordsCount}
                </span>
              </div>
              <div className="h-2.5 bg-white border-2 border-black overflow-hidden shadow-[1.5px_1.5px_0px_0px_#000]">
                <div
                  className="h-full bg-black transition-all duration-300"
                  style={{ width: `${Math.min(100, (learnedCount / targetWordsCount) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {combo >= 2 && (
          <div className="flex items-center space-x-1 px-2 py-0.5 bg-[#FF69B4] border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_0px_#000] shrink-0">
            <span>🔥 {combo}X</span>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. AŞAMA: KEŞİF (SADECE BİLİNMEYEN KELİME YOKSA AÇILIR)                     */}
      {/* ========================================================================= */}
      {phase === 'discovery' && currentCandidate && (
        <div className="space-y-2.5">
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => setIsFlipped(prev => !prev)}
            style={{
              transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.08}deg)`,
              transition: dragOffset === 0 ? 'transform 0.25s ease' : 'none'
            }}
            className={`cursor-pointer select-none bg-white border-2 sm:border-[3px] border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] min-h-[250px] sm:min-h-[300px] flex flex-col justify-between relative transition-colors ${
              dragOffset > 30
                ? 'bg-[#BBF7D0]'
                : dragOffset < -30
                ? 'bg-[#FFB1B8]'
                : 'bg-white'
            }`}
          >
            {(currentCandidate.isCustom || currentCandidate.categories?.includes('custom') || !!currentCandidate.reword) && (
              <div className="absolute top-3 left-3 inline-flex items-center space-x-1 px-2 py-0.5 bg-[#C084FC] text-black border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000]">
                <Sparkles size={10} />
                <span>ÖZEL</span>
              </div>
            )}

            {dragOffset > 30 && (
              <span className="absolute top-3 right-3 bg-black text-[#4ADE80] border-2 border-black px-2 py-0.5 font-black text-xs flex items-center space-x-1 shadow-[2px_2px_0px_0px_#000]">
                <span>BİLİYORUM</span>
                <Check size={14} strokeWidth={3} />
              </span>
            )}
            {dragOffset < -30 && (
              <span className="absolute top-3 left-3 bg-black text-[#FF5588] border-2 border-black px-2 py-0.5 font-black text-xs flex items-center space-x-1 shadow-[2px_2px_0px_0px_#000]">
                <X size={14} strokeWidth={3} />
                <span>BİLMİYORUM</span>
              </span>
            )}

            {/* Front: ENGLISH ONLY */}
            <div className="text-center space-y-2 py-4 my-auto">
              <div className="flex items-center justify-center space-x-2.5">
                <h1 className="text-3xl sm:text-4xl font-black text-black dark:text-white uppercase tracking-tight">
                  {currentCandidate.en}
                </h1>
                <AudioButton text={currentCandidate.en} size={22} />
              </div>
              {currentCandidate.ipa && (
                <p className="text-xs font-mono font-bold bg-[#FFE600] text-black inline-block px-1.5 py-0.5 border border-black">
                  {currentCandidate.ipa}
                </p>
              )}
            </div>

            {/* Back: REVEALED ON TAP */}
            {isFlipped ? (
              <div className="space-y-2 pt-3 border-t-2 border-black animate-fadeIn">
                <div className="bg-[#FFE600] border-2 border-black p-2.5 text-center shadow-[2px_2px_0px_0px_#000]">
                  <span className="text-[9px] uppercase font-black tracking-wider text-black block mb-0.5">
                    TÜRKÇE KARŞILIĞI
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-black uppercase">
                    {currentCandidate.tr}
                  </p>
                </div>

                {currentCandidate.examples?.[0] && (
                  <div className="bg-white border-2 border-black p-2 text-xs space-y-0.5 shadow-[2px_2px_0px_0px_#000]">
                    <p className="text-black dark:text-zinc-100 font-semibold text-[11px] sm:text-xs">
                      <HighlightedText text={currentCandidate.examples[0].en} />
                    </p>
                    <p className="text-zinc-700 dark:text-zinc-400 text-[10px] sm:text-[11px] font-bold">
                      {currentCandidate.examples[0].tr}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-1 text-[11px] font-black text-zinc-800 flex items-center justify-center space-x-1.5 uppercase tracking-wide">
                <Eye size={13} strokeWidth={2.5} />
                <span>ANLAMI GÖRMEK İÇİN KARTA DOKUN</span>
              </div>
            )}
          </div>

          {/* Swipe Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            <button
              onClick={() => handleFlashcardChoice(false)}
              className="py-2.5 px-3 bg-[#FF5588] text-black hover:bg-[#ff3b75] active:translate-x-[1px] active:translate-y-[1px] border-2 border-black font-black uppercase flex items-center justify-center space-x-1.5 text-xs sm:text-sm shadow-[3px_3px_0px_0px_#000] active:shadow-none transition-all"
            >
              <X size={16} strokeWidth={3} />
              <span>BİLMİYORUM (SOLA)</span>
            </button>

            <button
              onClick={() => handleFlashcardChoice(true)}
              className="py-2.5 px-3 bg-[#4ADE80] text-black hover:bg-[#34d399] active:translate-x-[1px] active:translate-y-[1px] border-2 border-black font-black uppercase flex items-center justify-center space-x-1.5 text-xs sm:text-sm shadow-[3px_3px_0px_0px_#000] active:shadow-none transition-all"
            >
              <span>BİLİYORUM (SAĞA)</span>
              <Check size={16} strokeWidth={3} />
            </button>
          </div>

          {sessionList.length === 0 && unknownBasket.length >= 5 && (
            <div className="text-center pt-1">
              <button
                onClick={() => startStudy(unknownBasket)}
                className="text-xs font-black text-black bg-[#FFE600] border-2 border-black px-3 py-1 shadow-[2px_2px_0px_0px_#000] uppercase"
              >
                {unknownBasket.length} KELİMEYLE ÇALIŞMAYA BAŞLA ➔
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. AŞAMA: ÇALIŞMA (SÜREKLİ AKTİF ÖĞRENME ALANI)                            */}
      {/* ========================================================================= */}
      {phase === 'study' && currentQuestion && (
        <div className="space-y-2.5">
          <div
            className={`bg-white border-2 sm:border-[3px] border-black ${
              currentQuestion.type === 'typing'
                ? 'p-3 sm:p-4 space-y-2'
                : inlineFeedback?.status === 'wrong'
                ? 'p-3.5 sm:p-4 space-y-2 sm:space-y-2.5'
                : 'p-4 sm:p-5 space-y-3 sm:space-y-4'
            } shadow-[4px_4px_0px_0px_#000] transition-all relative ${
              inlineFeedback?.status === 'correct'
                ? 'bg-[#F0FDF4]'
                : inlineFeedback?.status === 'wrong'
                ? 'bg-[#FFF1F2]'
                : 'bg-white'
            }`}
          >
            {/* Header / Word */}
            <div className="text-center space-y-1.5 sm:space-y-2">
              <div className="flex items-center justify-center gap-1.5 flex-wrap text-xs font-black tracking-wide text-black">
                {currentQuestion.isFiller ? (
                  <span className="bg-[#FFE600] border border-black px-2.5 py-0.5 uppercase flex items-center space-x-1 shadow-[1px_1px_0px_0px_#000]">
                    <RefreshCw size={12} strokeWidth={3} />
                    <span>ARA PEKİŞTİRME</span>
                  </span>
                ) : currentQuestion.type === 'typing' ? (
                  <span className="bg-[#00F0FF] border border-black px-2.5 py-0.5 uppercase flex items-center space-x-1 shadow-[1px_1px_0px_0px_#000]">
                    <Keyboard size={12} strokeWidth={3} />
                    <span>KLAVYEYLE TÜRKÇESİNİ YAZ</span>
                  </span>
                ) : (
                  <span className="bg-[#FFE600] border border-black px-2.5 py-0.5 uppercase shadow-[1px_1px_0px_0px_#000]">
                    DOĞRU TÜRKÇE ANLAMI SEÇ
                  </span>
                )}

                {(currentQuestion.word.isCustom || currentQuestion.word.categories?.includes('custom') || !!currentQuestion.word.reword) && (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-[#C084FC] border border-black text-black uppercase shadow-[1px_1px_0px_0px_#000]">
                    <Sparkles size={11} />
                    <span>KENDİ KELİMEN</span>
                  </span>
                )}
              </div>

              {/* Word & Inline Correct Answer Fusion Block */}
              <div
                className={`transition-all ${
                  inlineFeedback?.status === 'wrong'
                    ? 'border-2 border-black bg-white dark:bg-[#1E1E26] shadow-[3px_3px_0px_0px_#000] overflow-hidden'
                    : ''
                }`}
              >
                {/* English Word */}
                <div className={inlineFeedback?.status === 'wrong' ? 'py-1.5 px-2' : 'pt-0.5'}>
                  <div className="flex items-center justify-center space-x-2.5">
                    <h2 className="text-3xl sm:text-4xl font-black text-black dark:text-white uppercase tracking-tight break-words">
                      {currentQuestion.word.en}
                    </h2>
                    {inlineFeedback?.status === 'wrong' && currentWordEmoji && (
                      <span
                        className="text-2xl sm:text-3xl animate-fadeIn filter drop-shadow-[2px_2px_0px_#000] select-none"
                        title={currentWordEmoji}
                      >
                        {currentWordEmoji}
                      </span>
                    )}
                    <AudioButton text={currentQuestion.word.en} size={22} />
                  </div>
                  {currentQuestion.word.ipa && (
                    <div className="mt-1">
                      <p className="text-xs font-mono font-bold bg-[#E5E0D8] text-black inline-block px-2 py-0.5 border border-black">
                        {currentQuestion.word.ipa}
                      </p>
                    </div>
                  )}
                </div>

                {/* Turkish Meaning - Directly Unified under English Word */}
                {inlineFeedback?.status === 'wrong' && (
                  <div className="bg-[#FF5588] border-t-2 border-black p-2.5 sm:p-3 text-center animate-fadeIn">
                    <span className="text-[10px] font-black uppercase tracking-wider text-black/85 block">
                      {inlineFeedback.isNear ? '⚡ ÇOK YAKLAŞTIN! TAM DOĞRU ANLAM:' : 'DOĞRU TÜRKÇE KARŞILIĞI:'}
                    </span>
                    <span className="text-lg sm:text-xl font-black uppercase tracking-tight text-black block mt-0.5 break-words">
                      {formatCorrectAnswer(inlineFeedback.correctAnswer)}
                    </span>
                    {inlineFeedback.nearExplanation && (
                      <span className="text-xs font-bold mt-1 text-black bg-white px-2 py-0.5 border border-black inline-block">
                        {inlineFeedback.nearExplanation}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Daha önce sandığı kelime / eski hata uyarısı (Ünlem İşaretli) */}
              {activeLastMistake && inlineFeedback?.status !== 'wrong' && (
                <div className="pt-0.5 flex justify-center animate-fadeIn">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-[#FFF1F2] border-2 border-black text-[#BE123C] text-xs font-black shadow-[2px_2px_0px_0px_#000]">
                    <span className="w-4 h-4 bg-[#FF5588] text-white border border-black flex items-center justify-center font-black text-[10px]">
                      <AlertCircle size={11} strokeWidth={3} />
                    </span>
                    <span>
                      Daha önce sandığın: <strong className="underline decoration-2">"{activeLastMistake}"</strong> (Aynı hatayı yapma!)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Word Hints List */}
            <WordHintsList
              hints={currentWordHints}
              revealedCount={hintStats[currentQuestion.word.id]?.revealedCount || 0}
              maxAllowed={getMaxAllowedHints(hintStats[currentQuestion.word.id]?.encounters || 1)}
              onRevealNext={handleRevealNextHint}
              disabled={inlineFeedback !== null}
            />

            {/* A) Multiple Choice Mode with QuizOptionButton */}
            {currentQuestion.type === 'choice' && (
              <div className={inlineFeedback !== null ? "space-y-1.5 sm:space-y-2" : "space-y-2.5 sm:space-y-3"}>
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

                {inlineFeedback?.status === 'wrong' && (
                  <button
                    type="button"
                    autoFocus
                    onClick={handleAdvanceManually}
                    className="w-full py-3 bg-black text-[#FFE600] active:translate-x-[1px] active:translate-y-[1px] border-2 border-black font-black uppercase text-xs sm:text-sm shadow-[3px_3px_0px_0px_#FFE600] active:shadow-none transition-all flex items-center justify-center space-x-2 animate-fadeIn"
                  >
                    <span>DİĞER KELİMEYE GEÇ</span>
                    <ArrowRight size={16} strokeWidth={3} />
                  </button>
                )}
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
                className="space-y-2"
              >
                <input
                  ref={typingInputRef}
                  type="text"
                  autoFocus
                  onFocus={(e) => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}
                  disabled={inlineFeedback !== null}
                  value={typedInput}
                  onChange={(e) => setTypedInput(e.target.value)}
                  placeholder="Türkçe anlamını buraya yaz..."
                  className={`w-full py-2.5 sm:py-3 px-3.5 bg-white dark:bg-[#1E1E26] border-2 border-black text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-center text-base sm:text-lg font-black tracking-wide focus:outline-none focus:bg-[#FFFBEB] dark:focus:bg-[#252530] transition-all shadow-[2px_2px_0px_0px_#000] ${
                    inlineFeedback?.status === 'wrong'
                      ? 'border-[#FF5588] bg-[#FFE4E6] dark:bg-[#3B1520] animate-wrong-shake'
                      : ''
                  }`}
                />

                {inlineFeedback?.status === 'wrong' ? (
                  <button
                    type="button"
                    autoFocus
                    onClick={handleAdvanceManually}
                    className="w-full py-2.5 sm:py-3 bg-black text-[#FFE600] active:translate-x-[1px] active:translate-y-[1px] border-2 border-black font-black uppercase text-xs sm:text-sm shadow-[3px_3px_0px_0px_#FFE600] active:shadow-none transition-all flex items-center justify-center space-x-2"
                  >
                    <span>DİĞER KELİMEYE GEÇ</span>
                    <ArrowRight size={16} strokeWidth={3} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!typedInput.trim()}
                    className="w-full py-2.5 sm:py-3 bg-[#4ADE80] text-black active:translate-x-[1px] active:translate-y-[1px] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed border-2 border-black font-black uppercase text-xs sm:text-sm shadow-[3px_3px_0px_0px_#000] active:shadow-none transition-all"
                  >
                    ONAYLA
                  </button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
