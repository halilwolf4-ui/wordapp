import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Word, Progress } from '../types';
import { AudioButton } from '../components/AudioButton';
import { sound } from '../services/audio';
import { fireCelebration } from '../components/Confetti';
import { checkTurkishAnswer } from '../utils/turkishMatcher';
import { getSmartDistractors } from '../utils/distractorHelper';
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Keyboard,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { speakEnglish } from '../services/speech';

import { UserProfile, DailyLog } from '../types';
import { DailyStreakCompletion } from '../components/DailyStreakCompletion';
import { QuizOptionButton } from '../components/QuizOptionButton';

interface Props {
  dueQueue: Progress[];
  allWordsMap: Map<number, Word>;
  allProgress?: Progress[];
  dailyReviewLimit?: number;
  profile?: UserProfile;
  dailyLogs?: DailyLog[];
  todayStr?: string;
  onReviewAnswer: (wordId: number, isCorrect: boolean, isPartial: boolean) => Promise<void>;
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
}

const MIN_QUESTION_GAP = 5; // En az 5 soru aralık kuralı

export const ReviewView: React.FC<Props> = ({
  dueQueue,
  allWordsMap,
  allProgress,
  dailyReviewLimit = 40,
  profile,
  dailyLogs,
  todayStr,
  onReviewAnswer,
  onSessionCompleted,
  onClose,
  onRefreshDue
}) => {
  const [earnedFreeze, setEarnedFreeze] = useState(false);
  const [sessionList, setSessionList] = useState<ReviewSessionState[]>([]);
  const [sessionTarget, setSessionTarget] = useState(1);
  const [globalStep, setGlobalStep] = useState(0);

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

  // Inline feedback (NO gigantic full-screen card!)
  const [inlineFeedback, setInlineFeedback] = useState<{
    status: 'correct' | 'wrong';
    correctAnswer: string;
  } | null>(null);

  const [combo, setCombo] = useState(0);
  const lastWordIdRef = useRef<number | null>(null);
  const lastWasRefresherRef = useRef(false);
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

  // Önceki tekrar edilmiş veya öğrenilmiş kelimeleri topla
  const getPreviouslyReviewedWords = useCallback((): Word[] => {
    const result: Word[] = [];
    const addedIds = new Set<number>();

    // 1. Bu oturumda zaten tamamlanmış kelimeler
    sessionList.forEach(item => {
      if (item.typingPassed && !addedIds.has(item.word.id)) {
        result.push(item.word);
        addedIds.add(item.word.id);
      }
    });

    // 2. Geçmişte tekrar edilmiş veya pekişmiş (mastered) kelimeler
    if (allProgress && allProgress.length > 0) {
      allProgress.forEach(p => {
        if ((!!p.lastReviewDate || p.status === 'mastered' || p.step > 0) && !addedIds.has(p.wordId)) {
          const w = allWordsMap.get(p.wordId);
          if (w) {
            result.push(w);
            addedIds.add(w.id);
          }
        }
      });
    }

    // 3. Yedek havuz: en az bir kere doğru bilinmiş öğrenme aşamasındaki kelimeler
    if (result.length < 5 && allProgress) {
      allProgress.forEach(p => {
        if (p.totalCorrect > 0 && !addedIds.has(p.wordId)) {
          const w = allWordsMap.get(p.wordId);
          if (w) {
            result.push(w);
            addedIds.add(w.id);
          }
        }
      });
    }

    return result;
  }, [sessionList, allProgress, allWordsMap]);

  // Pick Next Question with 5-question cooldown
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

      // Hedef sayıya ulaşıldıysa veya tüm kelimeler bittiyse tamamla
      if (fullyReviewed >= targetCount || uncompleted.length === 0) {
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

      // Kalan uncompleted olmayan önceki kelimeler havuzu
      const uncompletedIds = new Set(uncompleted.map(i => i.word.id));
      const prevWords = getPreviouslyReviewedWords().filter(
        w => !uncompletedIds.has(w.id) && w.id !== excludeWordId
      );

      let chosenWord: Word;
      let questionType: 'choice' | 'typing';
      let isFiller = false;
      let isRefresher = false;

      // Son 4 kelime kaldıysa veya bekleme süresine girildiyse önceki tekrar edilen kelimeleri araya sok:
      // "4 tane kaldıysa tekrar önceki tekrar ettiklerini edebilir ama öğrenme sayısından düşmesin ki tekrar daha kolay"
      const cooldownBlocked = availableChoice.length === 0 && availableTyping.length === 0;
      const shouldInjectRefresher =
        uncompleted.length <= 4 &&
        prevWords.length > 0 &&
        (!lastWasRefresherRef.current || cooldownBlocked) &&
        (Math.random() < 0.45 || cooldownBlocked);

      if (shouldInjectRefresher) {
        chosenWord = prevWords[Math.floor(Math.random() * prevWords.length)];
        questionType = 'choice';
        isRefresher = true;
        lastWasRefresherRef.current = true;
      } else if (availableTyping.length > 0 && (availableChoice.length === 0 || Math.random() < 0.45)) {
        const picked = availableTyping[Math.floor(Math.random() * availableTyping.length)];
        chosenWord = picked.word;
        questionType = 'typing';
        lastWasRefresherRef.current = false;
      } else if (availableChoice.length > 0) {
        const picked = availableChoice[Math.floor(Math.random() * availableChoice.length)];
        chosenWord = picked.word;
        questionType = 'choice';
        lastWasRefresherRef.current = false;
      } else if (prevWords.length > 0) {
        // Bekleme aralığında rastgele sözlük kelimesi yerine bildiği önceki tekrar kelimesi sor
        chosenWord = prevWords[Math.floor(Math.random() * prevWords.length)];
        questionType = 'choice';
        isRefresher = true;
        lastWasRefresherRef.current = true;
      } else {
        // Sözlükten fallback soru
        const allWordsArr = Array.from(allWordsMap.values());
        const nonActiveWords = allWordsArr.filter(
          w => !uncompleted.some(u => u.word.id === w.id) && w.id !== excludeWordId
        );
        chosenWord =
          nonActiveWords[Math.floor(Math.random() * nonActiveWords.length)] ||
          allWordsArr[Math.floor(Math.random() * allWordsArr.length)];
        questionType = 'choice';
        isFiller = true;
        lastWasRefresherRef.current = false;
      }

      lastWordIdRef.current = chosenWord.id;
      setCurrentQuestion({ word: chosenWord, type: questionType, isFiller, isRefresher });

      if (questionType === 'choice') {
        const allWordsArr = Array.from(allWordsMap.values());
        const correctTr = chosenWord.tr.split(/[,;/]+/)[0].trim();
        const sessionWords = list.map(i => i.word);
        const smartDistractors = getSmartDistractors(chosenWord, allWordsArr, 3, sessionWords);
        const opts = [correctTr, ...smartDistractors].sort(() => Math.random() - 0.5);
        setChoiceOptions(opts);
      }
    },
    [allWordsMap, getPreviouslyReviewedWords, onSessionCompleted, sessionTarget]
  );

  // Initialize
  useEffect(() => {
    if (!initializedRef.current && dueQueue.length > 0) {
      initializedRef.current = true;
      const items: ReviewSessionState[] = [];
      const limit = Math.max(1, dailyReviewLimit || 40);
      const slice = dueQueue.slice(0, limit);

      slice.forEach((prog) => {
        const w = allWordsMap.get(prog.wordId);
        if (w) {
          items.push({
            progress: prog,
            word: w,
            choicePassed: false,
            typingPassed: false,
            failedAny: false,
            choicePassedAtStep: null
          });
        }
      });

      setSessionTarget(items.length);
      setSessionList(items);
      setPhase('study');
      setCombo(0);
      setGlobalStep(1);
      lastWordIdRef.current = null;
      if (items.length > 0) {
        pickNextQuestion(items, 1, null, items.length);
      }
    }
  }, [dueQueue, allWordsMap, dailyReviewLimit, pickNextQuestion]);

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
            ? { ...item, choicePassed: true, choicePassedAtStep: globalStep }
            : item
        );
        setSessionList(updatedList);
      }

      setInlineFeedback({ status: 'correct', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);
      feedbackTimerRef.current = setTimeout(() => {
        pickNextQuestion(updatedList, nextStep, targetWord.id, sessionTarget);
      }, 350);
    } else {
      sound.playWrong();
      setCombo(0);

      if (!isRefresherOrFiller) {
        const updatedList = sessionList.map(item =>
          item.word.id === targetWord.id ? { ...item, failedAny: true } : item
        );
        setSessionList(updatedList);
      }

      setInlineFeedback({ status: 'wrong', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);
      // Kullanıcı "Geç" butonuna basınca ilerler
    }
  };

  // Typing Answer
  const handleTypingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedInput.trim() || !currentQuestion) return;

    const targetWord = currentQuestion.word;
    const isCorrect = checkTurkishAnswer(typedInput, targetWord.tr);

    if (isCorrect) {
      sound.playCorrect(combo + 1);
      setCombo(prev => prev + 1);
      fireCelebration();

      const targetItem = sessionList.find(i => i.word.id === targetWord.id);
      const hadFailed = targetItem?.failedAny ?? false;

      const updatedList = sessionList.map(item =>
        item.word.id === targetWord.id ? { ...item, typingPassed: true } : item
      );
      setSessionList(updatedList);

      await onReviewAnswer(targetWord.id, !hadFailed, false);

      setInlineFeedback({ status: 'correct', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);
      feedbackTimerRef.current = setTimeout(() => {
        pickNextQuestion(updatedList, nextStep, targetWord.id, sessionTarget);
      }, 350);
    } else {
      sound.playWrong();
      setCombo(0);

      const updatedList = sessionList.map(item =>
        item.word.id === targetWord.id ? { ...item, failedAny: true } : item
      );
      setSessionList(updatedList);

      setInlineFeedback({ status: 'wrong', correctAnswer: targetWord.tr });

      const nextStep = globalStep + 1;
      setGlobalStep(nextStep);
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
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl"
        >
          Ana Sayfaya Dön
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
      <div className="space-y-6 pb-20 pt-4 text-center">
        <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-2 animate-bounce">
          <CheckCircle2 size={44} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-white">{sessionTarget} Tekrar Tamamlandı!</h2>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            Günün tekrarlarını önce şıklarla, ardından klavyeyle yazarak başarıyla tazeledin.
          </p>
        </div>

        <div className="space-y-3 pt-2 max-w-sm mx-auto">
          <button
            onClick={() => onRefreshDue()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold rounded-2xl shadow-xl flex items-center justify-center space-x-2 text-base"
          >
            <RotateCcw size={18} />
            <span>Bir Tur Daha Tekrar Et</span>
          </button>
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

        <div className="flex-1 mx-3">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center space-x-1">
              <span>
                {currentQuestion?.isRefresher
                  ? '🔄 Hızlı Tekrar'
                  : currentQuestion?.isFiller
                  ? '🔄 Ara Pekiştirme'
                  : currentQuestion?.type === 'choice'
                  ? 'Şıklı Tekrar'
                  : 'Klavyeyle Yazma'}
              </span>
              {currentQuestion?.type === 'typing' && (
                <Keyboard size={12} className="text-indigo-400 inline" />
              )}
            </span>
            <span className="font-bold text-indigo-400 font-mono">
              {fullyReviewedCount} / {sessionTarget} Tamamlandı
            </span>
          </div>
          <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (fullyReviewedCount / Math.max(1, sessionTarget)) * 100)}%` }}
            />
          </div>
        </div>

        {combo >= 2 && (
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black animate-bounce">
            <span>🔥 {combo}x</span>
          </div>
        )}
      </div>

      {/* QUESTION CARD */}
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
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold tracking-wide text-slate-400">
                {currentQuestion.isRefresher ? (
                  <span className="text-amber-400 flex items-center space-x-1">
                    <RotateCcw size={13} />
                    <span>Kolay Hatırlatma (Önceki Tekrar)</span>
                  </span>
                ) : currentQuestion.isFiller ? (
                  <span className="text-amber-400 flex items-center space-x-1">
                    <RefreshCw size={13} />
                    <span>Ara Pekiştirme Sorusu</span>
                  </span>
                ) : currentQuestion.type === 'typing' ? (
                  <span className="text-indigo-400 flex items-center space-x-1">
                    <Keyboard size={13} />
                    <span>Klavyeyle Türkçe Karşılığını Yaz</span>
                  </span>
                ) : (
                  <span>Bu kelimenin Türkçesi hangisi?</span>
                )}
              </div>

              <div className="flex items-center justify-center space-x-2 pt-1">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">{currentQuestion.word.en}</h2>
                <AudioButton text={currentQuestion.word.en} size={22} />
              </div>
              {currentQuestion.word.ipa && (
                <p className="text-xs sm:text-sm font-mono text-indigo-400">{currentQuestion.word.ipa}</p>
              )}
            </div>

            {/* A) Choice Mode with QuizOptionButton */}
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
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 text-white font-bold rounded-xl shadow-sm text-sm sm:text-base transition-all"
                  >
                    Onayla
                  </button>
                )}
              </form>
            )}

            {/* INLINE SLEEK WRONG FEEDBACK */}
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
