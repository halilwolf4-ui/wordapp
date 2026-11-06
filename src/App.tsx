import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, initializeDatabase, deduplicateDatabaseWords, syncYokdilCategoriesToDb, DEFAULT_SETTINGS, DEFAULT_PROFILE, DEFAULT_CATEGORY_NAMES } from './db';
import { Word, Progress, UserSettings, UserProfile, DailyLog } from './types';
import { matchWordCandidate } from './utils/wordMatcher';
import { selectDailyReviewQueue, selectDailyNewWordsQueue, decideReviewAnswer } from './services/srsEngine';
import { getEffectiveDate, daysBetween, addDays } from './services/dateUtils';
import { calculateLevel, getComboMultiplier, checkUnlockedBadges } from './services/gamification';
import { sound } from './services/audio';
import { setSpeechEnabled } from './services/speech';
import { fireLevelUp } from './components/Confetti';

import { Header } from './components/Header';
import { Navbar, NavTab } from './components/Navbar';
import { BackupReminderBanner } from './components/BackupReminderBanner';
import { InstallPromptBanner } from './components/InstallPromptBanner';

import { HomeView } from './views/HomeView';
import { LearnView } from './views/LearnView';
import { ReviewView } from './views/ReviewView';
import { WordListView } from './views/WordListView';
import { StatsView } from './views/StatsView';
import { SettingsView } from './views/SettingsView';
import { SpeedRoundView } from './views/SpeedRoundView';
import { PassaparolaView } from './views/PassaparolaView';
import { SnakeGameView } from './views/SnakeGameView';
import { ClozeTestView } from './views/ClozeTestView';
import { YdsYokdilView } from './views/YdsYokdilView';
import { SecretWordView } from './views/SecretWordView';

export const App: React.FC = () => {
  // Initialization state
  const [isInitializing, setIsInitializing] = useState(true);
  const [initPercent, setInitPercent] = useState(0);
  const [initMessage, setInitMessage] = useState('Veritabanı hazırlanıyor...');

  // Core data states
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [allProgress, setAllProgress] = useState<Progress[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>(DEFAULT_CATEGORY_NAMES);

  // Navigation & overlays
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpeedRoundOpen, setIsSpeedRoundOpen] = useState(false);
  const [isPassaparolaOpen, setIsPassaparolaOpen] = useState(false);
  const [isSnakeGameOpen, setIsSnakeGameOpen] = useState(false);
  const [isClozeTestOpen, setIsClozeTestOpen] = useState(false);
  const [isYdsYokdilOpen, setIsYdsYokdilOpen] = useState(false);
  const [isSecretWordOpen, setIsSecretWordOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [ambiguousSelection, setAmbiguousSelection] = useState<{
    wordData: Omit<Word, 'id'>;
    candidates: Word[];
    silent?: boolean;
  } | null>(null);

  // Keyboard awareness listener with debouncing to prevent frame drops
  useEffect(() => {
    let resizeTimer: any = null;
    let focusTimer: any = null;

    const handleFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        clearTimeout(focusTimer);
        setIsKeyboardVisible(true);
      }
    };

    const handleFocusOut = () => {
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          setIsKeyboardVisible(false);
        }
      }, 120);
    };

    const handleViewportResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (window.visualViewport) {
          const isShrunk = window.visualViewport.height < window.innerHeight * 0.75;
          if (isShrunk) {
            setIsKeyboardVisible(true);
          } else if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            setIsKeyboardVisible(false);
          }
        }
      }, 100);
    };

    window.addEventListener('focusin', handleFocusIn, { passive: true });
    window.addEventListener('focusout', handleFocusOut, { passive: true });
    window.visualViewport?.addEventListener('resize', handleViewportResize, { passive: true } as any);

    return () => {
      clearTimeout(resizeTimer);
      clearTimeout(focusTimer);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);

  // Maps for O(1) lookups
  const wordsMap = useMemo(() => {
    const map = new Map<number, Word>();
    allWords.forEach(w => map.set(w.id, w));
    return map;
  }, [allWords]);

  const progressMap = useMemo(() => {
    const map = new Map<number, Progress>();
    allProgress.forEach(p => map.set(p.wordId, p));
    return map;
  }, [allProgress]);

  // Load category names from words.json on mount
  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL
      : `${import.meta.env.BASE_URL}/`;
    fetch(`${baseUrl}words.json?v=yokdil2`)
      .then(res => res.json())
      .then(data => {
        if (data.categoryNames) {
          setCategoryNames({ ...DEFAULT_CATEGORY_NAMES, ...data.categoryNames });
        }
      })
      .catch(err => console.warn('Category names fetch error:', err));
  }, []);

  // Reload all data from IndexedDB
  const loadData = useCallback(async () => {
    await deduplicateDatabaseWords(db);
    await syncYokdilCategoriesToDb(db);
    const loadedWords = await db.words.toArray();
    const loadedProgress = await db.progress.toArray();

    const loadedSettings = (await db.settings.get(1)) || DEFAULT_SETTINGS;
    const loadedProfile = (await db.profile.get(1)) || DEFAULT_PROFILE;
    const loadedLogs = await db.dailyLogs.toArray();

    // Check & unlock any newly qualified badges from expanded badge list
    const learnedCnt = loadedProgress.filter(p => p.status === 'learning' || p.status === 'mastered').length;
    const masteredCnt = loadedProgress.filter(p => p.status === 'mastered').length;
    const syncedBadges = checkUnlockedBadges({
      currentBadges: loadedProfile.unlockedBadges || [],
      totalLearned: learnedCnt,
      streak: loadedProfile.streak,
      speedScore: loadedProfile.highScoreSpeedRound,
      masteredCount: masteredCnt,
      comboCount: loadedProfile.maxCombo || 0,
      hasCustomWord: loadedWords.some(w => !!w.isCustom),
      highScoreSnake: loadedProfile.highScoreSnake || 0,
      totalSnakeWords: loadedProfile.totalSnakeWords || 0,
      secretWordPuzzlesSolved: loadedProfile.secretWordPuzzlesSolved || 0,
      secretWordNoHintSolves: loadedProfile.secretWordNoHintSolves || 0
    });
    if (syncedBadges.length !== (loadedProfile.unlockedBadges?.length || 0)) {
      loadedProfile.unlockedBadges = syncedBadges;
      await db.profile.put(loadedProfile);
    }

    setAllWords(loadedWords);
    setAllProgress(loadedProgress);
    setSettings(loadedSettings);
    setProfile(loadedProfile);
    setDailyLogs(loadedLogs);

    const isMasterSound = loadedSettings.soundEnabled !== false;
    sound.setPreferences(loadedSettings.soundEffects, loadedSettings.vibration, isMasterSound);
    setSpeechEnabled(isMasterSound);
  }, []);

  // First-time database setup
  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase((pct, msg) => {
          setInitPercent(pct);
          setInitMessage(msg);
        });
        await loadData();
      } catch (err) {
        console.error('Initialization error:', err);
        setInitMessage(`Hata: ${(err as Error).message}`);
      } finally {
        setIsInitializing(false);
      }
    }
    init();
  }, [loadData]);

  // Apply theme & dark mode palette
  useEffect(() => {
    const isDark = settings.theme === 'dark';
    const root = document.documentElement;

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const palette = settings.darkPalette || 'cyber-yellow';
    root.setAttribute('data-palette', palette);

    if (palette === 'custom' && settings.customDarkColor) {
      root.style.setProperty('--brutal-dark-accent', settings.customDarkColor);
      root.style.setProperty('--brutal-dark-shadow', settings.customDarkColor);
    } else {
      root.style.removeProperty('--brutal-dark-accent');
      root.style.removeProperty('--brutal-dark-shadow');
    }
  }, [settings.theme, settings.darkPalette, settings.customDarkColor]);

  const today = getEffectiveDate();

  // Daily queues
  const dueQueue = useMemo(() => {
    return selectDailyReviewQueue(
      allProgress,
      wordsMap,
      settings.dailyReviewLimit,
      settings.prioritizeCustomWords,
      today
    );
  }, [allProgress, wordsMap, settings.dailyReviewLimit, settings.prioritizeCustomWords, today]);

  const newWordsQueue = useMemo(() => {
    const existingIds = new Set(allProgress.map(p => p.wordId));
    return selectDailyNewWordsQueue(
      allWords,
      existingIds,
      settings.enabledCategories,
      Math.max(100, settings.dailyNewTarget * 5),
      settings.prioritizeCustomWords
    );
  }, [allWords, allProgress, settings.enabledCategories, settings.dailyNewTarget, settings.prioritizeCustomWords]);

  // Today log
  const todayLog = useMemo(() => {
    return dailyLogs.find(l => l.date === today) || {
      date: today,
      correctCount: 0,
      wrongCount: 0,
      newLearnedCount: 0,
      reviewsDone: 0,
      xpEarned: 0
    };
  }, [dailyLogs, today]);

  // Streak & Active Day maintenance with Streak Freeze protection
  const updateStreakAndActivity = async (currentProf: UserProfile, dateStr: string): Promise<UserProfile> => {
    let newStreak = currentProf.streak;
    let freezes = currentProf.streakFreezes || 0;
    let frozenDates = [...(currentProf.frozenDates || [])];

    if (!currentProf.lastActiveDate) {
      newStreak = 1;
    } else if (currentProf.lastActiveDate !== dateStr) {
      const diff = daysBetween(currentProf.lastActiveDate, dateStr);
      if (diff === 1) {
        newStreak += 1;
      } else if (diff > 1) {
        // Missed (diff - 1) days
        const missedDays = diff - 1;
        if (freezes > 0 && missedDays <= freezes) {
          // Protected by streak freeze!
          freezes -= missedDays;
          for (let i = 1; i <= missedDays; i++) {
            frozenDates.push(addDays(currentProf.lastActiveDate, i));
          }
          newStreak += 1; // Streak preserved and continued!
        } else {
          newStreak = 1;
        }
      }
    }

    const updated: UserProfile = {
      ...currentProf,
      streak: newStreak,
      lastActiveDate: dateStr,
      streakFreezes: freezes,
      frozenDates: frozenDates
    };
    return updated;
  };

  // 5 consecutive days completed = 1 Streak Freeze (Max 2)
  const handleSessionCompleted = async (): Promise<{ earnedFreeze: boolean }> => {
    let earnedFreeze = false;
    let consecutive = profile.consecutiveCompletedDays || 0;
    let freezes = profile.streakFreezes || 0;

    if (profile.lastCompletedDate !== today) {
      if (!profile.lastCompletedDate) {
        consecutive = 1;
      } else {
        const diff = daysBetween(profile.lastCompletedDate, today);
        if (diff === 1) {
          consecutive += 1;
        } else if (diff === 2 && profile.frozenDates?.includes(addDays(profile.lastCompletedDate, 1))) {
          consecutive += 1;
        } else {
          consecutive = 1;
        }
      }

      if (consecutive >= 5) {
        if (freezes < 2) {
          freezes += 1;
          earnedFreeze = true;
        }
        consecutive = 0; // Reset counter for next 5-day cycle
      }

      const updatedProf: UserProfile = {
        ...profile,
        lastCompletedDate: today,
        consecutiveCompletedDays: consecutive,
        streakFreezes: Math.min(2, freezes) // Strictly maximum 2
      };

      await db.profile.put(updatedProf);
      setProfile(updatedProf);
    }

    return { earnedFreeze };
  };

  // Check and unlock badges
  const checkBadges = (
    currentProf: UserProfile,
    totalLearned: number,
    streak: number,
    isCustomWordCreated: boolean = false,
    speedScore?: number,
    masteredCount?: number,
    comboCount?: number,
    gameStats?: {
      highScoreSnake?: number;
      totalSnakeWords?: number;
      secretWordPuzzlesSolved?: number;
      secretWordNoHintSolves?: number;
    }
  ): string[] => {
    return checkUnlockedBadges({
      currentBadges: currentProf.unlockedBadges || [],
      totalLearned,
      streak,
      speedScore: speedScore ?? currentProf.highScoreSpeedRound,
      masteredCount,
      comboCount: Math.max(comboCount || 0, currentProf.maxCombo || 0),
      hasCustomWord: isCustomWordCreated || allWords.some(w => !!w.isCustom),
      highScoreSnake: gameStats?.highScoreSnake ?? currentProf.highScoreSnake ?? 0,
      totalSnakeWords: gameStats?.totalSnakeWords ?? currentProf.totalSnakeWords ?? 0,
      secretWordPuzzlesSolved: gameStats?.secretWordPuzzlesSolved ?? currentProf.secretWordPuzzlesSolved ?? 0,
      secretWordNoHintSolves: gameStats?.secretWordNoHintSolves ?? currentProf.secretWordNoHintSolves ?? 0
    });
  };

  // Real-time combo update to track highest combo and unlock combo badges immediately
  const handleComboUpdate = async (currentCombo: number) => {
    const prevMax = profile.maxCombo || 0;
    // Only touch the DB on badge milestones / every 5th: a write per tap re-renders the whole app
    if (currentCombo <= prevMax || currentCombo % 5 !== 0) return;
    const nextMax = currentCombo;
    const learnedCnt = allProgress.filter(p => p.status === 'learning' || p.status === 'mastered').length;
    const masteredCnt = allProgress.filter(p => p.status === 'mastered').length;
    const newBadges = checkBadges(
      profile,
      learnedCnt,
      profile.streak,
      false,
      profile.highScoreSpeedRound,
      masteredCnt,
      nextMax
    );

    const hasNewBadge = newBadges.length > (profile.unlockedBadges?.length || 0);
    if (nextMax > prevMax || hasNewBadge) {
      if (hasNewBadge) {
        sound.playLevelUp();
      }
      const updatedProf: UserProfile = {
        ...profile,
        maxCombo: nextMax,
        unlockedBadges: newBadges
      };
      await db.profile.put(updatedProf);
      setProfile(updatedProf);
    }
  };

  // Add XP, check level up & record logs
  const recordAnswerResult = async (
    isCorrect: boolean,
    isNewLearned: boolean = false,
    comboCount: number = 1,
    isMastered: boolean = false,
    isReview: boolean = false
  ) => {
    const xpGain = isCorrect ? Math.round(10 * getComboMultiplier(comboCount)) : 0;
    const nextXp = profile.xp + xpGain;
    const prevLevel = profile.level;
    const nextLevel = calculateLevel(nextXp);

    if (nextLevel > prevLevel) {
      sound.playLevelUp();
      fireLevelUp();
    }

    // Update profile
    let updatedProf = await updateStreakAndActivity(profile, today);
    const learnedCount = allProgress.filter(p => p.status === 'learning' || p.status === 'mastered').length;
    const masteredCountTotal = allProgress.filter(p => p.status === 'mastered').length + (isMastered ? 1 : 0);
    const nextMaxCombo = Math.max(profile.maxCombo || 0, comboCount);
    const newBadges = checkBadges(
      updatedProf,
      learnedCount + (isNewLearned ? 1 : 0),
      updatedProf.streak,
      false,
      updatedProf.highScoreSpeedRound,
      masteredCountTotal,
      nextMaxCombo
    );

    updatedProf = {
      ...updatedProf,
      xp: nextXp,
      level: nextLevel,
      maxCombo: nextMaxCombo,
      unlockedBadges: newBadges
    };
    await db.profile.put(updatedProf);
    setProfile(updatedProf);

    // Update Daily Log
    const currentLog: DailyLog = (await db.dailyLogs.get(today)) || {
      date: today,
      correctCount: 0,
      wrongCount: 0,
      newLearnedCount: 0,
      reviewsDone: 0,
      masteredCount: 0,
      xpEarned: 0
    };

    const nextLog: DailyLog = {
      ...currentLog,
      correctCount: isCorrect ? currentLog.correctCount + 1 : currentLog.correctCount,
      wrongCount: !isCorrect ? currentLog.wrongCount + 1 : currentLog.wrongCount,
      newLearnedCount: isNewLearned ? currentLog.newLearnedCount + 1 : currentLog.newLearnedCount,
      reviewsDone: isReview ? currentLog.reviewsDone + 1 : currentLog.reviewsDone,
      masteredCount: (currentLog.masteredCount || 0) + (isMastered ? 1 : 0),
      xpEarned: currentLog.xpEarned + xpGain
    };

    await db.dailyLogs.put(nextLog);
    setDailyLogs(prev => {
      const idx = prev.findIndex(l => l.date === today);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = nextLog;
        return copy;
      }
      return [...prev, nextLog];
    });
  };

  // Handle Learn mode word completion (passed both multiple choice and typing)
  const handleLearnWordComplete = async (word: Word, isCorrect: boolean, comboCount: number = 1) => {
    const existingProg = await db.progress.get(word.id);
    const isMastered = existingProg?.status === 'mastered';
    const hasStep = (existingProg?.step || 0) > 0;

    // Preserve step/streakDays if word was already mastered or step > 0
    const preservedStep = (isMastered || hasStep) ? existingProg!.step : 0;
    const preservedStreak = (isMastered || hasStep)
      ? existingProg!.streakDays + (isCorrect ? 1 : 0)
      : (isCorrect ? 1 : 0);
    const preservedStatus = isMastered ? 'mastered' : 'learning';
    const preservedDueDate = isMastered
      ? (existingProg?.dueDate || addDays(today, 60))
      : today;

    const nextProgress: Progress = {
      wordId: word.id,
      step: preservedStep,
      streakDays: preservedStreak,
      dueDate: preservedDueDate,
      lastReviewDate: today,
      status: preservedStatus,
      lapses: existingProg ? existingProg.lapses + (isCorrect ? 0 : 1) : 0,
      totalCorrect: (existingProg?.totalCorrect || 0) + (isCorrect ? 1 : 0),
      totalWrong: (existingProg?.totalWrong || 0) + (isCorrect ? 0 : 1),
      updatedAt: Date.now()
    };

    await db.progress.put(nextProgress);
    setAllProgress(prev => {
      const filtered = prev.filter(p => p.wordId !== word.id);
      return [...filtered, nextProgress];
    });

    await recordAnswerResult(isCorrect, !existingProg, comboCount, false, false);
  };

  // Permanently mark word as known when swiped 'Biliyorum' in discovery
  const handleMarkWordKnown = async (word: Word) => {
    const knownProg: Progress = {
      wordId: word.id,
      step: 5,
      streakDays: 5,
      dueDate: addDays(today, 60),
      lastReviewDate: today,
      status: 'mastered',
      lapses: 0,
      totalCorrect: 1,
      totalWrong: 0,
      updatedAt: Date.now()
    };
    await db.progress.put(knownProg);
    setAllProgress(prev => [...prev.filter(p => p.wordId !== word.id), knownProg]);
    await recordAnswerResult(true, false, 1, true, false);
  };

  // Mark word as learning when swiped 'Bilmiyorum' in discovery
  const handleMarkWordLearning = async (word: Word) => {
    const existingProg = await db.progress.get(word.id);
    const isMastered = existingProg?.status === 'mastered';
    const hasStep = (existingProg?.step || 0) > 0;

    // Preserve step/streakDays if word was already mastered or step > 0
    const preservedStep = (isMastered || hasStep) ? existingProg!.step : 0;
    const preservedStreak = (isMastered || hasStep) ? existingProg!.streakDays : 0;
    const preservedStatus = isMastered ? 'mastered' : 'learning';

    const learningProg: Progress = {
      wordId: word.id,
      step: preservedStep,
      streakDays: preservedStreak,
      dueDate: today,
      lastReviewDate: existingProg?.lastReviewDate,
      status: preservedStatus,
      lapses: (existingProg?.lapses || 0) + 1,
      totalCorrect: existingProg?.totalCorrect || 0,
      totalWrong: (existingProg?.totalWrong || 0) + 1,
      updatedAt: Date.now()
    };
    await db.progress.put(learningProg);
    setAllProgress(prev => [...prev.filter(p => p.wordId !== word.id), learningProg]);
  };

  // Handle Review mode word answer
  const handleReviewWordAnswer = async (
    wordId: number,
    isCorrect: boolean,
    isPartial: boolean,
    lastMistake?: string,
    comboCount: number = 1,
    source?: 'game' | 'review'
  ) => {
    const existingProg = await db.progress.get(wordId);
    const decision = decideReviewAnswer(
      existingProg,
      wordId,
      isCorrect,
      isPartial,
      today,
      lastMistake,
      source
    );

    if (decision.shouldSaveProgress && decision.nextProgress) {
      await db.progress.put(decision.nextProgress);
      setAllProgress(prev => {
        const filtered = prev.filter(p => p.wordId !== wordId);
        return [...filtered, decision.nextProgress!];
      });
    }

    if (decision.shouldRecordReview) {
      await recordAnswerResult(isCorrect, false, comboCount, decision.becameMastered, true);
    }
  };

  // Record single last mistake on a word (without bloating DB, only saves the latest one)
  const handleRecordMistake = async (wordId: number, mistake: string) => {
    if (!mistake) return;
    const existingProg = await db.progress.get(wordId);
    if (existingProg) {
      const updated: Progress = {
        ...existingProg,
        lastMistake: mistake.trim(),
        updatedAt: Date.now()
      };
      await db.progress.put(updated);
      setAllProgress(prev => prev.map(p => p.wordId === wordId ? updated : p));
    }
  };

  // Apply upsert for a resolved existing word (dictionary or custom)
  const applyExistingWordUpsert = async (
    targetWord: Word,
    wordData: Omit<Word, 'id'>,
    silent: boolean = false
  ) => {
    const existingProg = allProgress.find(p => p.wordId === targetWord.id);

    // Merge categories with 'custom' and set isCustom: true
    const updatedCategories = Array.from(new Set([...(targetWord.categories || []), 'custom']));
    const updatedWord: Word = {
      ...targetWord,
      isCustom: true,
      categories: updatedCategories,
      tr: wordData.tr ? wordData.tr : targetWord.tr,
      examples: (wordData.examples && wordData.examples.length > 0) ? wordData.examples : targetWord.examples,
      emoji: wordData.emoji || targetWord.emoji,
      ipa: wordData.ipa || targetWord.ipa
    };

    await db.words.put(updatedWord);
    setAllWords(prev => prev.map(w => w.id === targetWord.id ? updatedWord : w));

    // If word already has progress:
    if (existingProg) {
      if (existingProg.status === 'mastered') {
        if (!silent) {
          alert(`"${targetWord.en}" kelimesi zaten 'Öğrenilenler' (Mastered) listenizde kayıtlı! İlerlemeniz korundu.`);
        }
      } else {
        if (!silent) {
          alert(`"${targetWord.en}" kelimesi zaten listenizde kayıtlı, ilerlemeniz korundu.`);
        }
      }
      return;
    }

    // Word exists in dictionary but not yet in learning progress:
    // Create new progress record at step: 0
    const customProgress: Progress = {
      wordId: targetWord.id,
      step: 0,
      streakDays: 0,
      dueDate: today,
      lastReviewDate: undefined,
      status: 'learning',
      lapses: 0,
      totalCorrect: 0,
      totalWrong: 0,
      updatedAt: Date.now()
    };

    await db.progress.put(customProgress);
    setAllProgress(prev => [...prev.filter(p => p.wordId !== targetWord.id), customProgress]);

    const updatedBadges = checkBadges(profile, allProgress.length + 1, profile.streak, true);
    const updatedProf = { ...profile, unlockedBadges: updatedBadges };
    await db.profile.put(updatedProf);
    setProfile(updatedProf);

    if (!silent) {
      alert(`"${targetWord.en}" kelimesi sözlükte bulundu ve 'Öğreniliyor' listenize eklendi!`);
    }
  };

  // Add / Upsert custom word with 4-step matching hierarchy (upsertCustomWord)
  const handleAddCustomWord = async (wordData: Omit<Word, 'id'>, silent: boolean = false) => {
    const cleanEn = (wordData.en || '').trim();
    if (!cleanEn) return;

    const match = matchWordCandidate(cleanEn, wordData.tr || '', allWords, progressMap);

    if (match.type === 'exact' || match.type === 'single_base' || match.type === 'resolved') {
      await applyExistingWordUpsert(match.word, wordData, silent);
      return;
    }

    if (match.type === 'ambiguous') {
      // Prompt user to select which meaning was intended
      setAmbiguousSelection({
        wordData,
        candidates: match.candidates,
        silent
      });
      return;
    }

    // Completely new word (new_word)
    const highestId = allWords.reduce((max, w) => Math.max(max, w.id), 0);
    const newId = Math.max(1000001, highestId + 1);

    const newWord: Word = {
      ...wordData,
      en: cleanEn,
      id: newId,
      categories: Array.from(new Set([...(wordData.categories || []), 'custom'])),
      isCustom: true,
      createdAt: Date.now()
    };

    await db.words.put(newWord);
    setAllWords(prev => [newWord, ...prev]);

    // Directly assign 'learning' progress record
    const customProgress: Progress = {
      wordId: newId,
      step: 0,
      streakDays: 0,
      dueDate: today,
      lastReviewDate: undefined,
      status: 'learning',
      lapses: 0,
      totalCorrect: 0,
      totalWrong: 0,
      updatedAt: Date.now()
    };
    await db.progress.put(customProgress);
    setAllProgress(prev => [...prev.filter(p => p.wordId !== newId), customProgress]);

    // Unlock custom creator badge
    const updatedBadges = checkBadges(profile, allProgress.length + 1, profile.streak, true);
    const updatedProf = { ...profile, unlockedBadges: updatedBadges };
    await db.profile.put(updatedProf);
    setProfile(updatedProf);

    if (!silent) {
      alert(`"${newWord.en}" kelimesi eklendi ve 'Öğreniliyor' olarak sıraya alındı!`);
    }
  };

  // Update Custom Word
  const handleUpdateCustomWord = async (updatedWord: Word) => {
    await db.words.put(updatedWord);
    setAllWords(prev => prev.map(w => w.id === updatedWord.id ? updatedWord : w));
  };

  // Delete Custom Word
  const handleDeleteCustomWord = async (wordId: number) => {
    const wordToDelete = allWords.find(w => w.id === wordId);
    const wordName = wordToDelete?.en || 'Bu kelime';
    if (!window.confirm(`"${wordName}" kelimesini silmek istediğinize emin misiniz?`)) {
      return;
    }
    await db.words.delete(wordId);
    await db.progress.delete(wordId);
    setAllWords(prev => prev.filter(w => w.id !== wordId));
    setAllProgress(prev => prev.filter(p => p.wordId !== wordId));
  };

  // Restore mastered word to review pool
  const handleRestoreMasteredWord = async (wordId: number) => {
    const existing = await db.progress.get(wordId);
    if (!existing) return;

    const restored: Progress = {
      ...existing,
      status: 'learning',
      step: 0,
      streakDays: 0,
      dueDate: today,
      updatedAt: Date.now()
    };

    await db.progress.put(restored);
    setAllProgress(prev => prev.map(p => p.wordId === wordId ? restored : p));
    alert('Kelime tekrar havuzuna geri alındı!');
  };

  // Demote a mastered (6/6) word to 5/6 (step: 4, status: 'learning') when failed in review buffer check
  const handleDemoteMasteredWord = async (wordId: number, mistake?: string) => {
    const existing = await db.progress.get(wordId);
    if (!existing || existing.status !== 'mastered') return;

    const demoted: Progress = {
      ...existing,
      status: 'learning',
      step: 4, // 5/6 seviyesi (0-indexed step 4 -> ADIM 5/6 olarak görünür)
      dueDate: today,
      lastMistake: mistake ? mistake.trim() : existing.lastMistake,
      totalWrong: (existing.totalWrong || 0) + 1,
      lapses: (existing.lapses || 0) + 1,
      updatedAt: Date.now()
    };

    await db.progress.put(demoted);
    setAllProgress(prev => prev.map(p => p.wordId === wordId ? demoted : p));
  };

  // Update Settings
  const handleUpdateSettings = async (patch: Partial<UserSettings>) => {
    const updated = { ...settings, ...patch };
    await db.settings.put(updated);
    setSettings(updated);

    const isMasterSound = updated.soundEnabled !== false;
    sound.setPreferences(updated.soundEffects, updated.vibration, isMasterSound);
    setSpeechEnabled(isMasterSound);
  };

  // Update High Score in Speed Round
  const handleUpdateHighScore = async (score: number) => {
    const newBest = Math.max(profile.highScoreSpeedRound || 0, score);
    const learnedCnt = allProgress.filter(p => p.status === 'learning' || p.status === 'mastered').length;
    const masteredCnt = allProgress.filter(p => p.status === 'mastered').length;
    const updatedBadges = checkBadges(
      profile,
      learnedCnt,
      profile.streak,
      false,
      newBest,
      masteredCnt
    );
    const updatedProf: UserProfile = {
      ...profile,
      highScoreSpeedRound: newBest,
      unlockedBadges: updatedBadges
    };
    await db.profile.put(updatedProf);
    setProfile(updatedProf);
  };

  // Handle Snake Game over
  const handleSnakeGameOver = async (stats: { score: number; wordsCount: number }) => {
    const newBest = Math.max(profile.highScoreSnake || 0, stats.score);
    const newTotalWords = (profile.totalSnakeWords || 0) + stats.wordsCount;
    const learnedCnt = allProgress.filter(p => p.status === 'learning' || p.status === 'mastered').length;
    const masteredCnt = allProgress.filter(p => p.status === 'mastered').length;

    const gameStats = {
      highScoreSnake: newBest,
      totalSnakeWords: newTotalWords,
      secretWordPuzzlesSolved: profile.secretWordPuzzlesSolved || 0,
      secretWordNoHintSolves: profile.secretWordNoHintSolves || 0
    };

    const updatedBadges = checkBadges(
      profile,
      learnedCnt,
      profile.streak,
      false,
      undefined,
      masteredCnt,
      undefined,
      gameStats
    );

    const updatedProf: UserProfile = {
      ...profile,
      highScoreSnake: newBest,
      totalSnakeWords: newTotalWords,
      unlockedBadges: updatedBadges
    };
    await db.profile.put(updatedProf);
    setProfile(updatedProf);
  };

  // Handle Secret Word puzzle solved
  const handleSecretWordPuzzleSolved = async (stats: { isNoHint: boolean }) => {
    const newPuzzles = (profile.secretWordPuzzlesSolved || 0) + 1;
    const newNoHintSolves = (profile.secretWordNoHintSolves || 0) + (stats.isNoHint ? 1 : 0);
    const learnedCnt = allProgress.filter(p => p.status === 'learning' || p.status === 'mastered').length;
    const masteredCnt = allProgress.filter(p => p.status === 'mastered').length;

    const gameStats = {
      highScoreSnake: profile.highScoreSnake || 0,
      totalSnakeWords: profile.totalSnakeWords || 0,
      secretWordPuzzlesSolved: newPuzzles,
      secretWordNoHintSolves: newNoHintSolves
    };

    const updatedBadges = checkBadges(
      profile,
      learnedCnt,
      profile.streak,
      false,
      undefined,
      masteredCnt,
      undefined,
      gameStats
    );

    const updatedProf: UserProfile = {
      ...profile,
      secretWordPuzzlesSolved: newPuzzles,
      secretWordNoHintSolves: newNoHintSolves,
      unlockedBadges: updatedBadges
    };
    await db.profile.put(updatedProf);
    setProfile(updatedProf);
  };

  // Reset all progress (keep word dictionary & custom words)
  const handleResetProgress = async () => {
    await db.progress.clear();
    await db.dailyLogs.clear();
    const freshProf: UserProfile = { ...DEFAULT_PROFILE, id: 1 };
    await db.profile.put(freshProf);
    setProfile(freshProf);
    setDailyLogs([]);
    setAllProgress([]);
    localStorage.removeItem('kelime_avi_active_learn_session');
    localStorage.removeItem('kelime_avi_learn_unknown_basket');
    localStorage.removeItem('kelime_avi_learn_completed_' + today);
    localStorage.removeItem('kelime_avi_review_completed_' + today);
    await loadData();
    setIsSettingsOpen(false);
    setCurrentTab('learn');
  };

  // Counts
  const learningCount = allProgress.filter(p => p.status === 'learning').length;
  const masteredCount = allProgress.filter(p => p.status === 'mastered').length;
  const customWordsCount = allWords.filter(w => !!w.isCustom || w.categories?.includes('custom')).length;

  const isLearnCompletedToday = useMemo(() => {
    return (
      localStorage.getItem('kelime_avi_learn_completed_' + today) === 'true' ||
      (todayLog && todayLog.newLearnedCount >= settings.dailyNewTarget && todayLog.newLearnedCount > 0)
    );
  }, [today, todayLog, settings.dailyNewTarget]);

  const isReviewCompletedToday = useMemo(() => {
    return (
      localStorage.getItem('kelime_avi_review_completed_' + today) === 'true' ||
      (todayLog && todayLog.reviewsDone >= settings.dailyReviewLimit && todayLog.reviewsDone > 0)
    );
  }, [today, todayLog, settings.dailyReviewLimit]);

  const homeNewCount = useMemo(() => {
    let unstudied = 0;
    for (let i = 0; i < allProgress.length; i++) {
      const p = allProgress[i];
      if (p.status === 'learning' && p.totalCorrect === 0 && !p.lastReviewDate) {
        unstudied++;
      }
    }
    return newWordsQueue.length + unstudied;
  }, [newWordsQueue.length, allProgress]);

  // Stable navigation callbacks for React.memo views
  const handleStartReview = useCallback(() => setCurrentTab('review'), []);
  const handleStartLearn = useCallback(() => setCurrentTab('learn'), []);
  const handleStartSpeedRound = useCallback(() => setIsSpeedRoundOpen(true), []);
  const handleStartPassaparola = useCallback(() => setIsPassaparolaOpen(true), []);
  const handleStartSnakeGame = useCallback(() => setIsSnakeGameOpen(true), []);
  const handleStartClozeTest = useCallback(() => setIsClozeTestOpen(true), []);
  const handleStartYdsYokdil = useCallback(() => setIsYdsYokdilOpen(true), []);
  const handleOpenSettings = useCallback(() => setIsSettingsOpen(true), []);
  const handleCloseToHome = useCallback(() => setCurrentTab('home'), []);

  // Loading Screen
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] text-black flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-24 h-24 bg-[#FFE600] text-black border-4 border-black flex items-center justify-center mb-6 shadow-[6px_6px_0px_0px_#000] rotate-[-2deg]">
          <span className="text-4xl font-black tracking-tighter">KA</span>
        </div>
        <h1 className="text-3xl font-black mb-1 uppercase tracking-tight text-black">KELİME AVI</h1>
        <div className="inline-block bg-[#FF69B4] text-black border-2 border-black font-black text-xs px-2.5 py-0.5 mb-6 shadow-[2px_2px_0px_0px_#000]">
          {initMessage}
        </div>

        {/* Brutalist Progress Bar */}
        <div className="w-64 h-4 bg-white border-[3px] border-black overflow-hidden mb-2 shadow-[3px_3px_0px_0px_#000]">
          <div
            className="h-full bg-black transition-all duration-300"
            style={{ width: `${initPercent}%` }}
          />
        </div>
        <span className="text-xs font-black font-mono bg-white border border-black px-2 py-0.5 text-black">%{initPercent}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FDFBF7] text-black flex flex-col selection:bg-[#FFE600] selection:text-black">
      {/* 7-Day Backup Reminder - Only on Home tab, never during active tests */}
      {currentTab === 'home' && !isKeyboardVisible && !isSpeedRoundOpen && !isPassaparolaOpen && !isSnakeGameOpen && !isClozeTestOpen && !isYdsYokdilOpen && (
        <BackupReminderBanner
          lastBackupDate={settings.lastBackupDate}
          onBackupCompleted={loadData}
        />
      )}

      {/* Sticky Top Header - Hidden during active learning, review, overlays, or keyboard typing */}
      {!isKeyboardVisible && currentTab !== 'learn' && currentTab !== 'review' && !isSpeedRoundOpen && !isPassaparolaOpen && !isSnakeGameOpen && !isClozeTestOpen && !isYdsYokdilOpen && (
        <Header
          profile={profile}
          isDark={settings.theme === 'dark'}
          onToggleTheme={() =>
            handleUpdateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
          }
          onOpenSpeedRound={() => setIsSpeedRoundOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Main Container */}
      <main className={`flex-1 max-w-md w-full mx-auto ${
        (currentTab === 'learn' || currentTab === 'review')
          ? 'px-2.5 sm:px-3.5 pt-1 sm:pt-2 pb-2 flex flex-col justify-start'
          : currentTab === 'home' && !isKeyboardVisible ? 'px-3.5 pt-3 pb-24' : 'px-3.5 pt-3 pb-4'
      }`}>
        {/* PWA Install Banner (Tam Ekran Uygulama Olarak Yükle) */}
        {currentTab === 'home' && !isKeyboardVisible && <InstallPromptBanner />}

        {/* OVERLAYS: Settings & Speed Round */}
        {isSettingsOpen ? (
          <SettingsView
            settings={settings}
            categoryNames={categoryNames}
            onUpdateSettings={handleUpdateSettings}
            onReloadData={loadData}
            onResetProgress={handleResetProgress}
            onClose={() => setIsSettingsOpen(false)}
          />
        ) : isSpeedRoundOpen ? (
          <SpeedRoundView
            allWords={allWords}
            highScore={profile.highScoreSpeedRound}
            onUpdateHighScore={handleUpdateHighScore}
            onComboUpdate={handleComboUpdate}
            onClose={() => setIsSpeedRoundOpen(false)}
          />
        ) : isPassaparolaOpen ? (
          <PassaparolaView
            allWords={allWords}
            progressMap={progressMap}
            onAddXp={async (amount) => {
              const newXp = profile.xp + amount;
              const newLevel = calculateLevel(newXp);
              const updatedProf = { ...profile, xp: newXp, level: newLevel };
              await db.profile.put(updatedProf);
              setProfile(updatedProf);
            }}
            onClose={() => setIsPassaparolaOpen(false)}
          />
        ) : isSnakeGameOpen ? (
          <SnakeGameView
            allWords={allWords}
            progressMap={progressMap}
            onAnswerWord={async (wordId, isCorrect, comboCount, userMistake) => {
              // Typed answer without multiple choices: high quality SRS entry
              await handleReviewWordAnswer(wordId, isCorrect, false, userMistake, comboCount, 'game');
            }}
            onGameOver={handleSnakeGameOver}
            onAddXp={async (amount) => {
              const newXp = profile.xp + amount;
              const newLevel = calculateLevel(newXp);
              const updatedProf = { ...profile, xp: newXp, level: newLevel };
              await db.profile.put(updatedProf);
              setProfile(updatedProf);
            }}
            onClose={() => setIsSnakeGameOpen(false)}
          />
        ) : isYdsYokdilOpen ? (
          <YdsYokdilView
            allWords={allWords}
            onAddXp={async (amount) => {
              const newXp = profile.xp + amount;
              const newLevel = calculateLevel(newXp);
              const updatedProf = { ...profile, xp: newXp, level: newLevel };
              await db.profile.put(updatedProf);
              setProfile(updatedProf);
            }}
            onComboUpdate={handleComboUpdate}
            onAddCustomWord={handleAddCustomWord}
            onClose={() => setIsYdsYokdilOpen(false)}
          />
        ) : isClozeTestOpen ? (
          <ClozeTestView
            dueQueue={dueQueue}
            allWordsMap={wordsMap}
            allWords={allWords}
            allProgress={allProgress}
            onReviewAnswer={handleReviewWordAnswer}
            onAddXp={async (amount) => {
              const newXp = profile.xp + amount;
              const newLevel = calculateLevel(newXp);
              const updatedProf = { ...profile, xp: newXp, level: newLevel };
              await db.profile.put(updatedProf);
              setProfile(updatedProf);
            }}
            onComboUpdate={handleComboUpdate}
            onAddCustomWord={handleAddCustomWord}
            onClose={() => setIsClozeTestOpen(false)}
          />
        ) : isSecretWordOpen ? (
          <SecretWordView
            allWords={allWords}
            progressMap={progressMap}
            onReviewAnswer={(wordId, isCorrect, isPartial) =>
              handleReviewWordAnswer(wordId, isCorrect, isPartial, undefined, 1, 'game')
            }
            onPuzzleSolved={handleSecretWordPuzzleSolved}
            onAddXp={async (amount) => {
              const newXp = profile.xp + amount;
              const newLevel = calculateLevel(newXp);
              const updatedProf = { ...profile, xp: newXp, level: newLevel };
              await db.profile.put(updatedProf);
              setProfile(updatedProf);
            }}
            onClose={() => setIsSecretWordOpen(false)}
          />
        ) : (
          /* TAB VIEWS (Kept mounted to preserve learning session state and active questions) */
          <div>
            <div
              className={currentTab === 'home' ? 'block' : 'hidden'}
              style={{ contentVisibility: currentTab === 'home' ? 'visible' : 'hidden' }}
            >
              <HomeView
                todayCorrect={todayLog.correctCount}
                dailyGoal={settings.dailyNewTarget}
                dueCount={dueQueue.length}
                newCount={homeNewCount}
                learningCount={learningCount}
                masteredCount={masteredCount}
                totalWordsCount={allWords.length}
                customWordsCount={customWordsCount}
                profile={profile}
                settings={settings}
                isLearnCompletedToday={isLearnCompletedToday}
                isReviewCompletedToday={isReviewCompletedToday}
                onStartReview={handleStartReview}
                onStartLearn={handleStartLearn}
                onStartSpeedRound={handleStartSpeedRound}
                onStartPassaparola={handleStartPassaparola}
                onStartSnakeGame={handleStartSnakeGame}
                onStartClozeTest={handleStartClozeTest}
                onStartYdsYokdil={handleStartYdsYokdil}
                onStartSecretWord={() => setIsSecretWordOpen(true)}
                onOpenSettings={handleOpenSettings}
              />
            </div>

            <div
              className={currentTab === 'learn' ? 'block' : 'hidden'}
              style={{ contentVisibility: currentTab === 'learn' ? 'visible' : 'hidden' }}
            >
              <LearnView
                wordsQueue={newWordsQueue}
                allWordsMap={wordsMap}
                allProgress={allProgress}
                dailyNewTarget={settings.dailyNewTarget}
                profile={profile}
                dailyLogs={dailyLogs}
                todayStr={today}
                onCompleteWord={handleLearnWordComplete}
                onMarkWordKnown={handleMarkWordKnown}
                onMarkWordLearning={handleMarkWordLearning}
                onRecordMistake={handleRecordMistake}
                onSessionCompleted={handleSessionCompleted}
                onComboUpdate={handleComboUpdate}
                onClose={handleCloseToHome}
                onRefreshBatch={loadData}
              />
            </div>

            <div
              className={currentTab === 'review' ? 'block' : 'hidden'}
              style={{ contentVisibility: currentTab === 'review' ? 'visible' : 'hidden' }}
            >
              <ReviewView
                dueQueue={dueQueue}
                allWordsMap={wordsMap}
                allProgress={allProgress}
                dailyReviewLimit={settings.dailyReviewLimit}
                profile={profile}
                dailyLogs={dailyLogs}
                todayStr={today}
                onReviewAnswer={handleReviewWordAnswer}
                onRecordMistake={handleRecordMistake}
                onDemoteMasteredWord={handleDemoteMasteredWord}
                onSessionCompleted={handleSessionCompleted}
                onComboUpdate={handleComboUpdate}
                onClose={handleCloseToHome}
                onRefreshDue={loadData}
              />
            </div>

            {currentTab === 'words' && (
              <WordListView
                allWords={allWords}
                progressMap={progressMap}
                onAddCustomWord={handleAddCustomWord}
                onUpdateCustomWord={handleUpdateCustomWord}
                onDeleteCustomWord={handleDeleteCustomWord}
                onRestoreMasteredWord={handleRestoreMasteredWord}
              />
            )}

            {currentTab === 'stats' && (
              <StatsView
                profile={profile}
                dailyLogs={dailyLogs}
                totalLearned={learningCount}
                totalMastered={masteredCount}
                allProgress={allProgress}
              />
            )}
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation - Hidden during active learning, review, passaparola, snake game, cloze test, or keyboard typing */}
      {!isSettingsOpen && !isSpeedRoundOpen && !isPassaparolaOpen && !isSnakeGameOpen && !isClozeTestOpen && !isKeyboardVisible && currentTab !== 'learn' && currentTab !== 'review' && (
        <Navbar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setIsSettingsOpen(false);
            setIsYdsYokdilOpen(false);
            setIsSpeedRoundOpen(false);
            setIsPassaparolaOpen(false);
            setIsSnakeGameOpen(false);
            setIsClozeTestOpen(false);
            setCurrentTab(tab);
          }}
          dueCount={dueQueue.length}
          newCount={newWordsQueue.length}
        />
      )}

      {/* Ambiguous Word Selection Modal */}
      {ambiguousSelection && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-sm p-5 space-y-4 shadow-[8px_8px_0px_0px_#000] text-black animate-scaleUp">
            <div className="border-b-2 border-black pb-2">
              <h3 className="text-base font-black uppercase tracking-tight">KELİME SEÇİMİ</h3>
              <p className="text-xs font-bold text-zinc-600 mt-0.5">
                "{ambiguousSelection.wordData.en}" için birden fazla kayıt bulundu. Hangisini kastettin?
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {ambiguousSelection.candidates.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const chosen = c;
                    const data = ambiguousSelection.wordData;
                    const silent = ambiguousSelection.silent;
                    setAmbiguousSelection(null);
                    applyExistingWordUpsert(chosen, data, silent);
                  }}
                  className="w-full text-left p-3 border-2 border-black font-extrabold text-xs bg-[#FDFBF7] hover:bg-[#FFE600] active:translate-x-0.5 active:translate-y-0.5 transition-all shadow-[2px_2px_0px_0px_#000]"
                >
                  <span className="font-black text-sm block">{c.en}</span>
                  <span className="text-zinc-700 block truncate">{c.tr}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAmbiguousSelection(null)}
              className="w-full py-2.5 bg-zinc-200 text-black border-2 border-black font-black uppercase text-xs hover:bg-zinc-300 active:translate-x-0.5 active:translate-y-0.5"
            >
              VAZGEÇ
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
