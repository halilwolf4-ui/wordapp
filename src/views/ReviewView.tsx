import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Word, Progress } from '../types';
import { AudioButton } from '../components/AudioButton';
import { sound } from '../services/audio';
import { fireCelebration } from '../components/Confetti';
import { checkTurkishAnswer, checkTurkishAnswerDetailed } from '../utils/turkishMatcher';
import { getSmartDistractors } from '../utils/distractorHelper';
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Keyboard,
  CheckCircle2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { speakEnglish } from '../services/speech';

import { UserProfile, DailyLog } from '../types';
import { DailyStreakCompletion } from '../components/DailyStreakCompletion';
import { QuizOptionButton } from '../components/QuizOptionButton';
import { WordHintsList } from '../components/WordHintsList';
import { getWordHints, prefetchHints, getMaxAllowedHints, WordHint } from '../services/hintService';
import { syncAndSelectNextQuestion, PoolQueueItem, MIN_QUESTION_GAP } from '../utils/sessionQueue';

interface Props {
  dueQueue: Progress[];
  allWordsMap: Map<number, Word>;
  allProgress?: Progress[];
  dailyReviewLimit?: number;
  profile?: UserProfile;
  dailyLogs?: DailyLog[];
  todayStr?: string;
  onReviewAnswer: (wordId: number, isCorrect: boolean, isPartial: boolean, lastMistake?: string) => Promise<void>;
  onRecordMistake?: (wordId: number, mistake: string) => Promise<void>;
  onSessionCompleted?: () => Promise<{ earnedFreeze: boolean }>;
  onClose: () => void;
  onRefreshDue: () => void;
}

interface ReviewSessionState {
  progress: Progress;
  word: Word;
  choicePassed: boolean;
  typingPassed: boolean;
  failedAny: boolean;
  choicePassedAtStep: number | null;
  lastAskedStep: number | null;
  lastMistake?: string;
}

interface PersistedReviewState {
  date: string;
  targetCount: number;
  items: {
    wordId: number;
    choicePassed: boolean;
    typingPassed: boolean;
    failedAny: boolean;
    choicePassedAtStep: number | null;
    lastAskedStep: number | null;
    lastMistake?: string;
  }[];
  globalStep: number;
  hintStats?: Record<number, { encounters: number; wrongCount: number; revealedCount: number }>;
  poolQueue?: PoolQueueItem[];
}

const STORAGE_REVIEW_SESSION = 'kelime_avi_active_review_session';

export const ReviewView: React.FC<Props> = ({
  dueQueue,
  allWordsMap,
  allProgress,
  dailyReviewLimit = 40,
  profile,
  dailyLogs,
  todayStr,
  onReviewAnswer,
  onRecordMistake,
  onSessionCompleted,
  onClose,
  onRefreshDue
}) => {
  const [earnedFreeze, setEarnedFreeze] = useState(false);
  const [sessionList, setSessionList] = useState<ReviewSessionState[]>([]);
  const [sessionTarget, setSessionTarget] = useState(1);
  const [globalStep, setGlobalStep] = useState(0);

  // Encounter-based Hints state
  const [hintStats, setHintStats] = useState<Record<number, { encounters: number; wrongCount: number; revealedCount: number }>>({});
  const [currentWordHints, setCurrentWordHints] = useState<WordHint[]>([]);

  const [currentQuestion, setCurrentQuestion] = useState<{
    word: Word;
    type: 'choice' | 'typing';
    isFiller?: boolean;
    isRefresher?: boolean;
  } | null>(null);

  const [phase, setPhase] = useState<'study' | 'summary'>('study');
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

  // Helper to persist active review session to localStorage
  const saveReviewSession = (
    list: ReviewSessionState[],
    step: number,
    stats: Record<number, { encounters: number; wrongCount: number; revealedCount: number }> = hintStats,
    queue: PoolQueueItem[] = poolQueueRef.current,
    target: number = sessionTarget
  ) => {
    const uncompleted = list.filter(i => !i.typingPassed);
    const fullyReviewed = list.filter(i => i.typingPassed).length;
    if (fullyReviewed >= target || uncompleted.length === 0) {
      localStorage.removeItem(STORAGE_REVIEW_SESSION);
      return;
    }
    const data: PersistedReviewState = {
      date: todayStr || new Date().toISOString().split('T')[0],
      targetCount: target,
      items: list.map(i => ({
        wordId: i.word.id,
        choicePassed: i.choicePassed,
        typingPassed: i.typingPassed,
        failedAny: i.failedAny,
        choicePassedAtStep: i.choicePassedAtStep,
        lastAskedStep: i.lastAskedStep,
        lastMistake: i.lastMistake
      })),
      globalStep: step,
      hintStats: stats,
      poolQueue: queue
    };
    try {
      localStorage.setItem(STORAGE_REVIEW_SESSION, JSON.stringify(data));
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

  // Önceki tekrar edilmiş veya öğrenilmiş kelimeleri topla (Tampon / Ara Pekiştirme havuzu)
  // KULLANICI KURALI: Yalnızca kullanıcının halihazırda ÖĞRENDİĞİ (learning veya mastered)
  // ve o oturumda tamamladığı kelimelerden rastgele seçilir. Asla hiç görmediği sözlük kelimesi çıkamaz!
  const getPreviouslyReviewedWords = useCallback((): Word[] => {
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

    const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

    return [
      ...shuffle(learnedProgressWords),
      ...shuffle(sessionCompleted)
    ];
  }, [sessionList, allProgress, allWordsMap]);

  // Pick Next Question
  const pickNextQuestion = useCallback(
    (
      list: ReviewSessionState[],
      currentStep: number,
      excludeWordId: number | null,
      targetCount: number = sessionTarget
    ) => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      setInlineFeedback(null);
      setSelectedChoice(null);
      setTypedInput('');

      const uncompleted = list.filter(item => !item.typingPassed);
      const fullyReviewed = list.filter(item => item.typingPassed).length;

      // 1. Hedef sayıya ulaşıldıysa veya tüm kelimeler bittiyse oturumu tamamla
      if (fullyReviewed >= targetCount || uncompleted.length === 0) {
        poolQueueRef.current = [];
        localStorage.removeItem(STORAGE_REVIEW_SESSION);
        if (todayStr) {
          localStorage.setItem('kelime_avi_review_completed_' + todayStr, 'true');
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
      const candidateBuffers = getPreviouslyReviewedWords();

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
        localStorage.removeItem(STORAGE_REVIEW_SESSION);
        setPhase('summary');
        return;
      }

      poolQueueRef.current = result.nextQueue;
      const chosenWord = result.chosenWord;
      const questionType = result.questionType;
      const isRefresher = false;
      const isFiller = result.isBuffer;

      lastWordIdRef.current = chosenWord.id;
      setCurrentQuestion({ word: chosenWord, type: questionType, isFiller, isRefresher });

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
        saveReviewSession(list, currentStep, updated, poolQueueRef.current, targetCount);
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
    [allWordsMap, getPreviouslyReviewedWords, onSessionCompleted, sessionTarget, todayStr]
  );

  // Initialize or resume review session
  useEffect(() => {
    if (!initializedRef.current) {
      if (!allWordsMap || allWordsMap.size === 0) return;

      // 0. Gün tamamlandı mı kontrolü ("gün sıfırlanmadan o ekran kalacak")
      const isCompletedToday =
        (todayStr && localStorage.getItem('kelime_avi_review_completed_' + todayStr) === 'true') ||
        (dailyLogs && todayStr && (dailyLogs.find(l => l.date === todayStr)?.reviewsDone || 0) >= (dailyReviewLimit || 40) && (dailyLogs.find(l => l.date === todayStr)?.reviewsDone || 0) > 0);

      if (isCompletedToday) {
        initializedRef.current = true;
        setPhase('summary');
        return;
      }

      // 1. Önce aktif kaydedilmiş yarım kalmış oturumu kontrol et (19'da veya 29'da çıkıp geri dönüldüğünde devam etmek için)
      const savedReviewRaw = localStorage.getItem(STORAGE_REVIEW_SESSION);
      if (savedReviewRaw) {
        try {
          const parsed: PersistedReviewState = JSON.parse(savedReviewRaw);
          if (parsed && (!todayStr || parsed.date === todayStr) && Array.isArray(parsed.items) && parsed.items.length > 0) {
            const restoredList: ReviewSessionState[] = [];
            for (const item of parsed.items) {
              const word = allWordsMap.get(item.wordId);
              if (word) {
                const prog = allProgress?.find(p => p.wordId === item.wordId) || {
                  wordId: word.id,
                  step: 0,
                  streakDays: 0,
                  dueDate: todayStr || '',
                  status: 'learning' as const,
                  lapses: 0,
                  totalCorrect: 0,
                  totalWrong: 0,
                  updatedAt: Date.now(),
                  lastMistake: item.lastMistake
                };
                restoredList.push({
                  progress: prog,
                  word,
                  // ÖNEMLİ KURAL: Oturuma yeniden girildiğinde veya uygulama açıldığında,
                  // tamamlanmamış hiçbir kelime ASLA doğrudan yazmalı açılmamalıdır!
                  // Kullanıcı önce o kelimenin şıkkını görmeli ve çözmeli;
                  // ancak şıkkı çözüldükten sonra aralık kuralıyla yazma aşamasına geçmelidir.
                  choicePassed: false,
                  typingPassed: item.typingPassed,
                  failedAny: item.failedAny ?? false,
                  choicePassedAtStep: null,
                  lastAskedStep: null,
                  lastMistake: item.lastMistake || prog.lastMistake
                });
              }
            }

            const hasUncompleted = restoredList.some(i => !i.typingPassed);
            if (hasUncompleted) {
              initializedRef.current = true;
              const target = parsed.targetCount || restoredList.length;
              setSessionTarget(target);
              setSessionList(restoredList);
              if (parsed.hintStats) {
                setHintStats(parsed.hintStats);
              }
              // Kuyruğu temiz başlat ki şıklı sorular öncelikli dizilsin
              poolQueueRef.current = [];
              const step = parsed.globalStep || 1;
              setGlobalStep(step);
              setPhase('study');
              setCombo(0);
              lastWordIdRef.current = null;
              prefetchHints(restoredList.map(i => i.word), Array.from(allWordsMap.values()));
              pickNextQuestion(restoredList, step, null, target);
              return;
            }
          }
        } catch (e) {
          console.warn('Error reading persisted review session:', e);
        }
      }

      // 2. Aktif oturum yoksa: dueQueue'dan yeni oturum başlat
      if (dueQueue.length > 0) {
        initializedRef.current = true;
        const items: ReviewSessionState[] = [];
        const limit = Math.max(1, dailyReviewLimit || 40);
        // Tekrar kelimelerinin her gün aynı alfabetik/tarih sırasıyla gelmemesi için karıştır
        const slice = [...dueQueue.slice(0, limit)].sort(() => Math.random() - 0.5);

        slice.forEach((prog) => {
          const w = allWordsMap.get(prog.wordId);
          if (w) {
            items.push({
              progress: prog,
              word: w,
              choicePassed: false,
              typingPassed: false,
              failedAny: false,
              choicePassedAtStep: null,
              lastAskedStep: null,
              lastMistake: prog.lastMistake
            });
          }
        });

        const target = items.length;
        setSessionTarget(target);
        setSessionList(items);
        setPhase('study');
        setCombo(0);
        setGlobalStep(1);
        lastWordIdRef.current = null;
        saveReviewSession(items, 1, {}, [], target);
        prefetchHints(items.map(i => i.word), Array.from(allWordsMap.values()));
        if (items.length > 0) {
          pickNextQuestion(items, 1, null, target);
        }
      }
    }
  }, [dueQueue, allWordsMap, allProgress, dailyReviewLimit, pickNextQuestion, todayStr, dailyLogs]);

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
      saveReviewSession(sessionList, globalStep, updated);
      return updated;
    });
  };

  // Auto pronounce
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

  // Choice Answer
  const handleSelectChoice = (option: string) => {
    if (selectedChoice !== null || !currentQuestion) return;

    setSelectedChoice(option);
    const targetWord = currentQuestion.word;
    const isCorrect = checkTurkishAnswer(option, targetWord.tr);
    const isRefresherOrFiller = currentQuestion.isRefresher || currentQuestion.isFiller;

    if (isCorrect) {
      sound.playCorrect(combo + 1);
      setCombo(prev => prev + 1);

      let updatedList = sessionList;
      if (!isRefresherOrFiller) {
        updatedList = sessionList.map(item =>
          item.word.id === targetWord.id
            ? { ...item, choicePassed: true, choicePassedAtStep: globalStep, lastAskedStep: globalStep }
            : item
        );
        setSessionList(updatedList);
      } else {
        bufferLastAskedRef.current.set(targetWord.id, globalStep);
      }

      setInlineFeedback({ status: 'correct', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);
      saveReviewSession(updatedList, nextStep);

      feedbackTimerRef.current = setTimeout(() => {
        pickNextQuestion(updatedList, nextStep, targetWord.id, sessionTarget);
      }, 350);
    } else {
      sound.playWrong();
      setCombo(0);

      const chosenMistake = option.trim();
      let updatedList = sessionList;
      if (!isRefresherOrFiller) {
        updatedList = sessionList.map(item =>
          item.word.id === targetWord.id
            ? {
                ...item,
                failedAny: true,
                choicePassed: false,
                choicePassedAtStep: null,
                lastAskedStep: globalStep,
                lastMistake: chosenMistake // Kullanıcının o an sandığı yanlış anlamı kaydet
              }
            : item
        );
        setSessionList(updatedList);
        if (onRecordMistake) {
          onRecordMistake(targetWord.id, chosenMistake);
        }
      } else {
        bufferLastAskedRef.current.set(targetWord.id, globalStep);
      }

      // Increment wrong count for hints logic
      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);

      setHintStats(prev => {
        const existing = prev[targetWord.id] || { encounters: 1, wrongCount: 0, revealedCount: 0 };
        const updated = {
          ...prev,
          [targetWord.id]: {
            ...existing,
            wrongCount: existing.wrongCount + 1
          }
        };
        saveReviewSession(updatedList, nextStep, updated);
        return updated;
      });

      setInlineFeedback({ status: 'wrong', correctAnswer: targetWord.tr });
      // Kullanıcı "Geç" butonuna basınca ilerler
    }
  };

  // Typing Answer
  const handleTypingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim() || !currentQuestion) return;
    // Ara pekiştirme kelimeleri asla SRS aşamasını (0/6 sayacı) değiştiremez
    if (currentQuestion.isFiller || currentQuestion.isRefresher) return;

    const targetWord = currentQuestion.word;
    const detailed = checkTurkishAnswerDetailed(typedInput, targetWord.tr);
    const isCorrect = detailed.isCorrect;

    if (isCorrect) {
      sound.playCorrect(combo + 1);
      setCombo(prev => prev + 1);
      fireCelebration();

      const targetItem = sessionList.find(i => i.word.id === targetWord.id);
      const hadFailed = targetItem?.failedAny ?? false;

      const updatedList = sessionList.map(item =>
        item.word.id === targetWord.id ? { ...item, typingPassed: true, lastAskedStep: globalStep } : item
      );
      setSessionList(updatedList);

      await onReviewAnswer(targetWord.id, !hadFailed, false);

      setInlineFeedback({ status: 'correct', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);
      saveReviewSession(updatedList, nextStep);

      feedbackTimerRef.current = setTimeout(() => {
        pickNextQuestion(updatedList, nextStep, targetWord.id, sessionTarget);
      }, 350);
    } else {
      sound.playWrong();
      setCombo(0);

      const typedMistake = typedInput.trim();
      const updatedList = sessionList.map(item =>
        item.word.id === targetWord.id
          ? {
              ...item,
              failedAny: true,
              choicePassed: false,
              choicePassedAtStep: null,
              lastAskedStep: globalStep,
              lastMistake: typedMistake // Bir önceki yanlış kelimeyi kaydet (hafıza şişmez)
            }
          : item
      );
      setSessionList(updatedList);

      if (onRecordMistake) {
        onRecordMistake(targetWord.id, typedMistake);
      }

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
        saveReviewSession(updatedList, nextStep, updated);
        return updated;
      });

      setInlineFeedback({
        status: 'wrong',
        correctAnswer: targetWord.tr,
        isNear: detailed.isNear,
        nearExplanation: detailed.nearExplanation
      });
      // Kullanıcı "Geç" butonuna basınca ilerler
    }
  };

  const handleAdvanceManually = () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    pickNextQuestion(sessionList, globalStep, currentQuestion?.word.id ?? null, sessionTarget);
  };

  const fullyReviewedCount = sessionList.filter(i => i.typingPassed).length;

  if (sessionList.length === 0 && phase !== 'summary') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Sparkles size={48} className="text-emerald-400 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold text-white mb-2">Harika İş!</h3>
        <p className="text-slate-400 text-sm mb-6">
          Şu an tekrar edilecek bekleyen kelimen bulunmuyor.
        </p>
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-black text-[#FFE600] font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#FFE600] active:translate-x-0.5 active:translate-y-0.5"
        >
          ANA SAYFAYA DÖN
        </button>
      </div>
    );
  }

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
        <div className="w-20 h-20 bg-[#4ADE80] text-black border-4 border-black flex items-center justify-center mx-auto mb-2 shadow-[6px_6px_0px_0px_#000] rotate-[-2deg]">
          <CheckCircle2 size={44} strokeWidth={2.5} />
        </div>
        <div className="space-y-2">
          <div className="inline-block bg-[#FFE600] border-2 border-black px-3 py-1 shadow-[3px_3px_0px_0px_#000]">
            <h2 className="text-2xl sm:text-3xl font-black text-black uppercase">{sessionTarget} TEKRAR TAMAMLANDI!</h2>
          </div>
          <p className="text-zinc-800 font-bold text-xs max-w-xs mx-auto">
            Günün tekrarlarını önce şıklarla, ardından klavyeyle yazarak başarıyla tazeledin.
          </p>
        </div>

        <div className="space-y-3 pt-2 max-w-sm mx-auto">
          {!(todayStr && localStorage.getItem('kelime_avi_review_completed_' + todayStr) === 'true') && (
            <button
              onClick={() => {
                initializedRef.current = false;
                poolQueueRef.current = [];
                onRefreshDue();
              }}
              className="w-full py-4 bg-black text-[#FFE600] hover:bg-zinc-800 active:translate-x-[2px] active:translate-y-[2px] border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_#FFE600] active:shadow-none flex items-center justify-center space-x-2 transition-all"
            >
              <RotateCcw size={18} strokeWidth={3} />
              <span>BİR TUR DAHA TEKRAR ET</span>
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

  const uncompletedCount = sessionList.filter(i => !i.typingPassed).length;

  return (
    <div className="space-y-4 pb-24 pt-2 select-none text-black">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black hover:bg-[#FFE600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
          title="Geri"
        >
          <ArrowLeft size={18} strokeWidth={3} />
        </button>

        <div className="flex-1 mx-3">
          <div className="flex justify-between items-center text-xs mb-1 font-black">
            <span className="flex items-center space-x-1.5 flex-wrap">
              <span className="uppercase text-black">
                {currentQuestion?.isRefresher
                  ? '🔄 KOLAY TEKRAR'
                  : currentQuestion?.isFiller
                  ? '🔄 ARA PEKİŞTİRME'
                  : currentQuestion?.type === 'choice'
                  ? 'ŞIKLI TEKRAR'
                  : 'KLAVYEYLE YAZ'}
              </span>
              {currentQuestion?.type === 'typing' && (
                <Keyboard size={13} strokeWidth={2.5} className="text-black inline" />
              )}
              {uncompletedCount <= 4 && uncompletedCount > 0 && (
                <span className="text-[10px] bg-[#FFE600] text-black font-black px-1.5 py-0.5 border border-black">
                  🎯 {uncompletedCount} KALDI
                </span>
              )}
            </span>
            <span className="font-mono bg-[#C084FC] text-black px-1 border border-black">
              {fullyReviewedCount}/{sessionTarget}
            </span>
          </div>
          <div className="h-3.5 bg-white border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_#000]">
            <div
              className="h-full bg-black transition-all duration-300"
              style={{ width: `${Math.min(100, (fullyReviewedCount / Math.max(1, sessionTarget)) * 100)}%` }}
            />
          </div>
        </div>

        {combo >= 2 && (
          <div className="flex items-center space-x-1 px-2.5 py-1 bg-[#FF69B4] border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_0px_#000]">
            <span>🔥 {combo}X</span>
          </div>
        )}
      </div>

      {/* QUESTION CARD */}
      {phase === 'study' && currentQuestion && (
        <div className="space-y-4">
          <div
            className={`bg-white border-4 border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 sm:space-y-5 transition-all relative ${
              inlineFeedback?.status === 'correct'
                ? 'bg-[#F0FDF4]'
                : inlineFeedback?.status === 'wrong'
                ? 'bg-[#FFF1F2]'
                : 'bg-white'
            }`}
          >
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-1.5 text-xs font-black tracking-wide text-black">
                {currentQuestion.isRefresher ? (
                  <span className="bg-[#FEF08A] border border-black px-2 py-0.5 uppercase flex items-center space-x-1">
                    <RotateCcw size={12} strokeWidth={3} />
                    <span>KOLAY HATIRLATMA</span>
                  </span>
                ) : currentQuestion.isFiller ? (
                  <span className="bg-[#FFE600] border border-black px-2 py-0.5 uppercase flex items-center space-x-1">
                    <RefreshCw size={12} strokeWidth={3} />
                    <span>ARA PEKİŞTİRME</span>
                  </span>
                ) : currentQuestion.type === 'typing' ? (
                  <span className="bg-[#00F0FF] border border-black px-2 py-0.5 uppercase flex items-center space-x-1">
                    <Keyboard size={12} strokeWidth={3} />
                    <span>KLAVYEYLE TÜRKÇESİNİ YAZ</span>
                  </span>
                ) : (
                  <span className="bg-[#FFE600] border border-black px-2 py-0.5 uppercase">
                    DOĞRU TÜRKÇE ANLAMI SEÇ
                  </span>
                )}
              </div>

              <div className="flex items-center justify-center space-x-2.5 pt-1">
                <h2 className="text-3xl sm:text-4xl font-black text-black dark:text-white uppercase tracking-tight">{currentQuestion.word.en}</h2>
                <AudioButton text={currentQuestion.word.en} size={22} />
              </div>
              {currentQuestion.word.ipa && (
                <p className="text-xs sm:text-sm font-mono font-bold bg-[#E5E0D8] text-black inline-block px-2 py-0.5 border border-black">
                  {currentQuestion.word.ipa}
                </p>
              )}

              {/* Daha önce sandığı kelime / eski hata uyarısı (Ünlem İşaretli) */}
              {activeLastMistake && (
                <div className="pt-1 flex justify-center animate-fadeIn">
                  <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-[#FFF1F2] border-2 border-black text-[#BE123C] text-xs font-black shadow-[2px_2px_0px_0px_#000]">
                    <span className="w-5 h-5 bg-[#FF5588] text-white border border-black flex items-center justify-center font-black text-xs">
                      <AlertCircle size={13} strokeWidth={3} />
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

            {/* A) Choice Mode with QuizOptionButton */}
            {currentQuestion.type === 'choice' && (
              <div className="space-y-3">
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
                  placeholder="Türkçe anlamını buraya yaz..."
                  className={`w-full py-3.5 px-4 bg-white dark:bg-[#1E1E26] border-[3px] border-black text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-center text-lg sm:text-xl font-black tracking-wide focus:outline-none focus:bg-[#FFFBEB] dark:focus:bg-[#252530] transition-all shadow-[3px_3px_0px_0px_#000] ${
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
                    className="w-full py-3.5 bg-black text-[#FFE600] active:translate-x-[2px] active:translate-y-[2px] border-2 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_#FFE600] active:shadow-none transition-all flex items-center justify-center space-x-2"
                  >
                    <span>DİĞER KELİMEYE GEÇ</span>
                    <ArrowRight size={18} strokeWidth={3} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!typedInput.trim()}
                    className="w-full py-3.5 bg-[#4ADE80] text-black active:translate-x-[2px] active:translate-y-[2px] disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 dark:disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed border-[3px] border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_#000] active:shadow-none transition-all"
                  >
                    ONAYLA
                  </button>
                )}
              </form>
            )}

            {/* INLINE WRONG FEEDBACK BANNER */}
            {inlineFeedback?.status === 'wrong' && (
              <div className="pt-1 animate-fadeIn">
                <div className="bg-[#FF5588] border-3 border-black p-3.5 flex items-center justify-between text-black shadow-[3px_3px_0px_0px_#000]">
                  <div className="space-y-0.5 pr-2">
                    <span className="text-[10px] font-black uppercase tracking-wider block">
                      {inlineFeedback.isNear ? '⚡ ÇOK YAKLAŞTIN! TAM DOĞRU ANLAM:' : 'YANLIŞ! DOĞRU ANLAM:'}
                    </span>
                    <span className="text-base font-black uppercase leading-tight">
                      {inlineFeedback.correctAnswer}
                    </span>
                    {inlineFeedback.nearExplanation && (
                      <span className="text-xs font-bold block mt-1 text-black bg-white/90 px-1.5 py-0.5 border border-black inline-block">
                        {inlineFeedback.nearExplanation}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleAdvanceManually}
                    className="shrink-0 flex items-center space-x-1 bg-black text-white font-black text-xs px-3.5 py-2 border-2 border-black shadow-[2px_2px_0px_0px_#FFE600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none uppercase"
                  >
                    <span>GEÇ</span>
                    <ArrowRight size={14} strokeWidth={3} />
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
