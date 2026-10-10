import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db, initializeDatabase, DEFAULT_SETTINGS, DEFAULT_PROFILE } from './db';
import { Word, Progress, UserSettings, UserProfile, DailyLog } from './types';
import { selectDailyReviewQueue, selectDailyNewWordsQueue, calculateNextProgress } from './services/srsEngine';
import { getEffectiveDate, daysBetween, addDays } from './services/dateUtils';
import { calculateLevel, getComboMultiplier, checkUnlockedBadges } from './services/gamification';
import { sound } from './services/audio';
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
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});

  // Navigation & overlays
  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpeedRoundOpen, setIsSpeedRoundOpen] = useState(false);
  const [isPassaparolaOpen, setIsPassaparolaOpen] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Keyboard awareness listener
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        setIsKeyboardVisible(true);
      }
    };
    const handleFocusOut = () => {
      // Delay slightly to handle transitions between inputs
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          setIsKeyboardVisible(false);
        }
      }, 100);
    };

    const handleViewportResize = () => {
      if (window.visualViewport) {
        const isShrunk = window.visualViewport.height < window.innerHeight * 0.75;
        if (isShrunk) {
          setIsKeyboardVisible(true);
        } else if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setIsKeyboardVisible(false);
        }
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    window.visualViewport?.addEventListener('resize', handleViewportResize);

    return () => {
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
    fetch('/words.json')
      .then(res => res.json())
      .then(data => {
        if (data.categoryNames) {
          setCategoryNames(data.categoryNames);
        }
      })
      .catch(err => console.warn('Category names fetch error:', err));
  }, []);

  // Reload all data from IndexedDB
  const loadData = useCallback(async () => {
    const loadedWords = await db.words.toArray();
    let loadedProgress = await db.progress.toArray();

    // If there are unreviewed pre-seeded records (never actually reviewed in app),
    // remove them from progress so user's own words appear in "Öğren" with top priority!
    const unreviewedSeeded = loadedProgress.filter(
      p => p.lastReviewDate === undefined && p.totalWrong === 0 && p.lapses === 0
    );
    if (unreviewedSeeded.length > 0) {
      await db.progress.bulkDelete(unreviewedSeeded.map(p => p.wordId));
      loadedProgress = await db.progress.toArray();
    }

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
      hasCustomWord: loadedWords.some(w => !!w.isCustom)
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

    sound.setPreferences(loadedSettings.soundEffects, loadedSettings.vibration);
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
    comboCount?: number
  ): string[] => {
    return checkUnlockedBadges({
      currentBadges: currentProf.unlockedBadges || [],
      totalLearned,
      streak,
      speedScore: speedScore ?? currentProf.highScoreSpeedRound,
      masteredCount,
      comboCount,
      hasCustomWord: isCustomWordCreated || allWords.some(w => !!w.isCustom)
    });
  };

  // Add XP, check level up & record logs
  const recordAnswerResult = async (
    isCorrect: boolean,
    isNewLearned: boolean = false,
    comboCount: number = 1,
    isMastered: boolean = false
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
    const newBadges = checkBadges(
      updatedProf,
      learnedCount + (isNewLearned ? 1 : 0),
      updatedProf.streak,
      false,
      updatedProf.highScoreSpeedRound,
      masteredCountTotal,
      comboCount
    );

    updatedProf = {
      ...updatedProf,
      xp: nextXp,
      level: nextLevel,
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
      reviewsDone: !isNewLearned ? currentLog.reviewsDone + 1 : currentLog.reviewsDone,
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
  const handleLearnWordComplete = async (word: Word, isCorrect: boolean) => {
    const existingProg = await db.progress.get(word.id);
    // Enters the 21-day repetition queue with dueDate = today so it is immediately reviewable today!
    const nextProgress: Progress = {
      wordId: word.id,
      step: 0,
      streakDays: isCorrect ? 1 : 0,
      dueDate: today,
      lastReviewDate: today,
      status: 'learning',
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

    await recordAnswerResult(isCorrect, true);
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
    await recordAnswerResult(true, true, 1, true);
  };

  // Mark word as learning when swiped 'Bilmiyorum' in discovery
  const handleMarkWordLearning = async (word: Word) => {
    const existingProg = await db.progress.get(word.id);
    const learningProg: Progress = {
      wordId: word.id,
      step: 0,
      streakDays: 0,
      dueDate: today,
      lastReviewDate: undefined,
      status: 'learning',
      lapses: (existingProg?.lapses || 0) + 1,
      totalCorrect: existingProg?.totalCorrect || 0,
      totalWrong: (existingProg?.totalWrong || 0) + 1,
      updatedAt: Date.now()
    };
    await db.progress.put(learningProg);
    setAllProgress(prev => [...prev.filter(p => p.wordId !== word.id), learningProg]);
  };

  // Handle Review mode word answer
  const handleReviewWordAnswer = async (wordId: number, isCorrect: boolean, isPartial: boolean) => {
    const existingProg = await db.progress.get(wordId);
    const { nextProgress } = calculateNextProgress(existingProg || null, wordId, isCorrect, today);

    // If partial (hint used), grant partial interval step
    if (isPartial && isCorrect && nextProgress.step > 1) {
      nextProgress.step -= 1; // don't jump full ladder if hint was used
    }
    const becameMastered = isCorrect && nextProgress.status === 'mastered' && !isPartial;

    await db.progress.put(nextProgress);
    setAllProgress(prev => {
      const filtered = prev.filter(p => p.wordId !== wordId);
      return [...filtered, nextProgress];
    });

    await recordAnswerResult(isCorrect, false, 1, becameMastered);
  };

  // Add custom word (directly assigned to 'learning' queue)
  const handleAddCustomWord = async (wordData: Omit<Word, 'id'>) => {
    // Generate unique ID >= 1000000
    const highestId = allWords.reduce((max, w) => Math.max(max, w.id), 0);
    const newId = Math.max(1000001, highestId + 1);

    const newWord: Word = {
      ...wordData,
      id: newId,
      categories: ['custom'],
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

    alert(`"${newWord.en}" kelimesi eklendi ve 'Öğreniliyor' olarak sıraya alındı!`);
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

  // Update Settings
  const handleUpdateSettings = async (patch: Partial<UserSettings>) => {
    const updated = { ...settings, ...patch };
    await db.settings.put(updated);
    setSettings(updated);
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

  // Loading Screen
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-20 h-20 bg-indigo-600/20 text-indigo-400 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/30 animate-pulse">
          <span className="text-3xl font-black">KA</span>
        </div>
        <h1 className="text-2xl font-black mb-2 tracking-tight">Kelime Avı</h1>
        <p className="text-slate-400 text-sm mb-6 max-w-xs">{initMessage}</p>

        {/* Progress Bar */}
        <div className="w-64 h-2.5 bg-slate-900 rounded-full border border-slate-800 overflow-hidden mb-3">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${initPercent}%` }}
          />
        </div>
        <span className="text-xs font-mono text-slate-500">%{initPercent}</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 7-Day Backup Reminder */}
      <BackupReminderBanner
        lastBackupDate={settings.lastBackupDate}
        onBackupCompleted={loadData}
      />

      {/* Sticky Top Header */}
      {!isKeyboardVisible && (
        <Header
          profile={profile}
          onOpenSpeedRound={() => setIsSpeedRoundOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* Main Container */}
      <main className={`flex-1 max-w-md w-full mx-auto px-3.5 pt-2 ${
        currentTab === 'home' && !isKeyboardVisible ? 'pb-20' : 'pb-2'
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
        ) : (
          /* TAB VIEWS (Kept mounted to preserve learning session state and active questions) */
          <div>
            <div className={currentTab === 'home' ? 'block' : 'hidden'}>
              <HomeView
                todayCorrect={todayLog.correctCount}
                dailyGoal={settings.dailyNewTarget}
                dueCount={dueQueue.length}
                newCount={newWordsQueue.length + allProgress.filter(p => p.status === 'learning' && p.totalCorrect === 0 && !p.lastReviewDate).length}
                learningCount={learningCount}
                masteredCount={masteredCount}
                totalWordsCount={allWords.length}
                customWordsCount={customWordsCount}
                profile={profile}
                settings={settings}
                isLearnCompletedToday={isLearnCompletedToday}
                isReviewCompletedToday={isReviewCompletedToday}
                onStartReview={() => setCurrentTab('review')}
                onStartLearn={() => setCurrentTab('learn')}
                onStartSpeedRound={() => setIsSpeedRoundOpen(true)}
                onStartPassaparola={() => setIsPassaparolaOpen(true)}
              />
            </div>

            <div className={currentTab === 'learn' ? 'block' : 'hidden'}>
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
                onSessionCompleted={handleSessionCompleted}
                onClose={() => setCurrentTab('home')}
                onRefreshBatch={loadData}
              />
            </div>

            <div className={currentTab === 'review' ? 'block' : 'hidden'}>
              <ReviewView
                dueQueue={dueQueue}
                allWordsMap={wordsMap}
                allProgress={allProgress}
                dailyReviewLimit={settings.dailyReviewLimit}
                profile={profile}
                dailyLogs={dailyLogs}
                todayStr={today}
                onReviewAnswer={handleReviewWordAnswer}
                onSessionCompleted={handleSessionCompleted}
                onClose={() => setCurrentTab('home')}
                onRefreshDue={loadData}
              />
            </div>

            <div className={currentTab === 'words' ? 'block' : 'hidden'}>
              <WordListView
                allWords={allWords}
                progressMap={progressMap}
                onAddCustomWord={handleAddCustomWord}
                onRestoreMasteredWord={handleRestoreMasteredWord}
              />
            </div>

            <div className={currentTab === 'stats' ? 'block' : 'hidden'}>
              <StatsView
                profile={profile}
                dailyLogs={dailyLogs}
                totalLearned={learningCount}
                totalMastered={masteredCount}
                allProgress={allProgress}
              />
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Navigation - Hidden during active learning, review, passaparola, or keyboard typing */}
      {!isSettingsOpen && !isSpeedRoundOpen && !isPassaparolaOpen && !isKeyboardVisible && currentTab !== 'learn' && currentTab !== 'review' && (
        <Navbar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          dueCount={dueQueue.length}
          newCount={newWordsQueue.length}
        />
      )}
    </div>
  );
};

export default App;
