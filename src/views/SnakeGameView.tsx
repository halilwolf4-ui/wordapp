import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Word, Progress } from '../types';
import { sound } from '../services/audio';
import { fireCelebration } from '../components/Confetti';
import {
  SnakeGameConfig,
  DEFAULT_SNAKE_CONFIG
} from '../services/snakeGameConfig';
import {
  getWordLevel,
  buildWordSynonymTrMap,
  checkSnakeAnswer,
  buildSerpentinePathD,
  getSerpentinePointAtTime,
  SnakeQueueManager
} from '../services/snakeGameService';
import {
  ArrowLeft,
  RotateCcw,
  Zap,
  Play,
  Sliders,
  X,
  Clock,
  Flame,
  Award,
  ChevronRight
} from 'lucide-react';

interface Props {
  allWords: Word[];
  progressMap: Map<number, Progress>;
  onAnswerWord: (
    wordId: number,
    isCorrect: boolean,
    combo: number,
    mistake?: string
  ) => Promise<void>;
  onAddXp?: (amount: number) => Promise<void>;
  onClose: () => void;
}

export const SnakeGameView: React.FC<Props> = ({
  allWords,
  progressMap,
  onAnswerWord,
  onAddXp,
  onClose
}) => {
  // Mobile visualViewport height tracker
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      return window.visualViewport.height;
    }
    return typeof window !== 'undefined' ? window.innerHeight : 640;
  });

  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);

  // Config state (allows runtime tweaking in dev / debug drawer)
  const [config, setConfig] = useState<SnakeGameConfig>(DEFAULT_SNAKE_CONFIG);
  const [showDebug, setShowDebug] = useState(false);

  // Game states
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'gameover'>('ready');
  const [displayDistance, setDisplayDistance] = useState(config.initialDistance);
  const [displayElapsedSeconds, setDisplayElapsedSeconds] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(config.initialSpeedMultiplier);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  // Hit & Damage Effects
  const [snakeDamaged, setSnakeDamaged] = useState(false);
  const [scorePop, setScorePop] = useState(false);
  const [floatingDamage, setFloatingDamage] = useState<{ id: number; text: string; x: number; y: number } | null>(null);
  const [isCaughtAnimation, setIsCaughtAnimation] = useState(false);

  // Active question & input
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [reviewState, setReviewState] = useState<{
    type: 'correct' | 'wrong' | 'pass';
    text: string;
    subText?: string;
    targetWord: Word;
    almostCorrect?: boolean;
    rewardSeconds?: number;
    comboBonus?: string;
  } | null>(null);

  // Missed words history for end screen
  const [missedWords, setMissedWords] = useState<
    Array<{ word: Word; userAnswer?: string; isPass?: boolean }>
  >([]);

  // Refs for 60fps physics & game loop
  const speedMultiplierRef = useRef(config.initialSpeedMultiplier);
  const distanceRef = useRef(config.initialDistance);
  const visualDistanceRef = useRef(config.initialDistance);
  const elapsedSecondsRef = useRef(0);
  const lastDisplayDistRef = useRef(config.initialDistance);
  const lastDisplaySecRef = useRef(0);
  const scoreRef = useRef(0);
  const maxComboRef = useRef(0);

  const isPausedRef = useRef(false);
  const lastTimeRef = useRef<number | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const reviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const damageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scorePopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // SVG Direct DOM manipulation refs for 60fps butter-smooth rendering
  const roadPathRef = useRef<SVGPathElement>(null);
  const snakeBodyRef = useRef<SVGPathElement>(null);
  const snakeHeadRef = useRef<SVGGElement>(null);
  const entranceLineRef = useRef<SVGLineElement>(null);
  const pathTotalLengthRef = useRef(2234);

  // Keep refs in sync with state
  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    maxComboRef.current = maxCombo;
  }, [maxCombo]);

  // Pre-generate synonym Turkish mapping for instant lookups
  const synonymTrMap = useMemo(() => {
    return buildWordSynonymTrMap(allWords);
  }, [allWords]);

  // Measure SVG path length on mount & resize
  const measurePathLength = useCallback(() => {
    if (roadPathRef.current) {
      try {
        const len = roadPathRef.current.getTotalLength();
        if (len > 0) pathTotalLengthRef.current = len;
      } catch {
        // Fallback length
      }
    }
  }, []);

  useEffect(() => {
    measurePathLength();
  }, [config.pathRows, measurePathLength]);

  // Queue manager
  const queueManagerRef = useRef<SnakeQueueManager | null>(null);
  if (!queueManagerRef.current) {
    queueManagerRef.current = new SnakeQueueManager(allWords, progressMap, config);
  }

  useEffect(() => {
    queueManagerRef.current?.updateConfig(config);
  }, [config]);

  // Focus input automatically whenever playing or word changes
  const keepInputFocused = useCallback(() => {
    if (gameState === 'playing' && !isPausedRef.current) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [gameState]);

  useEffect(() => {
    keepInputFocused();
  }, [currentWord, keepInputFocused]);

  // Trigger game over with catch constriction animation
  const endGame = useCallback(async () => {
    isPausedRef.current = true;
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    if (reviewTimeoutRef.current) clearTimeout(reviewTimeoutRef.current);

    setIsCaughtAnimation(true);
    sound.playWrong();

    setTimeout(async () => {
      setIsCaughtAnimation(false);
      setGameState('gameover');
      sound.playLevelUp();
      if (scoreRef.current > 5) {
        fireCelebration();
      }

      if (scoreRef.current > 0 && onAddXp) {
        await onAddXp(scoreRef.current * 12 + maxComboRef.current * 4);
      }
    }, 850);
  }, [onAddXp]);

  // Start game
  const startGame = () => {
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    if (reviewTimeoutRef.current) clearTimeout(reviewTimeoutRef.current);
    if (damageTimeoutRef.current) clearTimeout(damageTimeoutRef.current);

    distanceRef.current = config.initialDistance;
    visualDistanceRef.current = config.initialDistance;
    speedMultiplierRef.current = config.initialSpeedMultiplier;
    elapsedSecondsRef.current = 0;
    scoreRef.current = 0;
    maxComboRef.current = 0;
    lastDisplayDistRef.current = config.initialDistance;
    lastDisplaySecRef.current = 0;

    setDisplayDistance(config.initialDistance);
    setDisplayElapsedSeconds(0);
    setSpeedMultiplier(config.initialSpeedMultiplier);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setMissedWords([]);
    setReviewState(null);
    setFloatingDamage(null);
    setSnakeDamaged(false);
    setIsCaughtAnimation(false);
    isPausedRef.current = false;
    lastTimeRef.current = null;

    queueManagerRef.current = new SnakeQueueManager(allWords, progressMap, config);
    const firstWord = queueManagerRef.current.getNextWord();
    setCurrentWord(firstWord);

    setGameState('playing');
  };

  // Main animation frame loop: 60fps native physics and direct SVG DOM manipulation
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      return;
    }

    const loop = (timestamp: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }
      const dt = Math.min(0.05, (timestamp - lastTimeRef.current) / 1000);
      lastTimeRef.current = timestamp;

      // Update actual distance only when not paused
      if (!isPausedRef.current) {
        elapsedSecondsRef.current += dt;

        const currentDist = distanceRef.current;
        const speed = speedMultiplierRef.current;
        const newDist = currentDist - dt * speed;

        if (newDist <= config.minDistance) {
          distanceRef.current = 0;
          setDisplayDistance(0);
          endGame();
          return;
        } else {
          distanceRef.current = newDist;
          const ceilDist = Math.max(0, Math.ceil(newDist));
          if (ceilDist !== lastDisplayDistRef.current) {
            lastDisplayDistRef.current = ceilDist;
            setDisplayDistance(ceilDist);
          }
        }

        const floorSec = Math.floor(elapsedSecondsRef.current);
        if (floorSec !== lastDisplaySecRef.current) {
          lastDisplaySecRef.current = floorSec;
          setDisplayElapsedSeconds(floorSec);
        }
      }

      // Smooth organic lerp of visualDistance toward distanceRef.current
      const diff = distanceRef.current - visualDistanceRef.current;
      const lerpSpeed = 10.0;
      visualDistanceRef.current += diff * Math.min(1, lerpSpeed * dt);
      const vDist = visualDistanceRef.current;

      // Direct DOM update of SVG path and head (zero React re-render overhead!)
      const totalLen = pathTotalLengthRef.current || 2234;
      const progress = Math.max(0, (config.initialDistance - vDist) / config.initialDistance);
      const headDistOnPath = Math.min(totalLen, progress * totalLen);

      if (snakeBodyRef.current) {
        snakeBodyRef.current.setAttribute('stroke-dasharray', `${headDistOnPath} ${totalLen * 2}`);
        snakeBodyRef.current.setAttribute('stroke-dashoffset', '0');
      }

      if (snakeHeadRef.current) {
        if (vDist <= 60 && roadPathRef.current) {
          try {
            const pt = roadPathRef.current.getPointAtLength(headDistOnPath);
            const ptNext = roadPathRef.current.getPointAtLength(Math.min(totalLen, headDistOnPath + 1));
            const angle = Math.atan2(ptNext.y - pt.y, ptNext.x - pt.x) * (180 / Math.PI);
            snakeHeadRef.current.setAttribute(
              'transform',
              `translate(${pt.x}, ${pt.y}) rotate(${angle})`
            );
          } catch {
            // fallback
          }
          if (entranceLineRef.current) {
            entranceLineRef.current.style.display = 'none';
          }
        } else {
          const overflowSec = Math.min(60, vDist - 60);
          const headX = 360 + (overflowSec / 60) * 70;
          snakeHeadRef.current.setAttribute(
            'transform',
            `translate(${headX}, 20) rotate(180)`
          );
          if (entranceLineRef.current) {
            entranceLineRef.current.style.display = 'block';
            entranceLineRef.current.setAttribute('x2', `${headX}`);
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [gameState, config.initialDistance, config.minDistance, endGame]);

  // Advance to next word (keeps review banner visible for its timer)
  const advanceToNextWord = useCallback(() => {
    if (!queueManagerRef.current) return;
    const nextWord = queueManagerRef.current.getNextWord();
    setCurrentWord(nextWord);
    setInputVal('');
    isPausedRef.current = false;
    lastTimeRef.current = performance.now();
    keepInputFocused();
  }, [keepInputFocused]);

  // Handle Answer Submit
  const handleAnswerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentWord || gameState !== 'playing' || isPausedRef.current) return;

    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const oldDist = distanceRef.current;
    const oldScore = score;
    const answerCheck = checkSnakeAnswer(trimmed, currentWord, synonymTrMap);

    if (answerCheck.isCorrect) {
      // 1. DOĞRU
      const lvl = getWordLevel(currentWord);
      const baseReward = config.rewardsByLevel[lvl] || config.rewardsByLevel.default;

      // Combo bonus calculations: 3 in a row -> +20%, 5 in a row -> +40%
      const nextCombo = combo + 1;
      let effectiveReward = baseReward;
      let comboLabel = '';

      if (nextCombo >= config.comboSteps.step2Count) {
        effectiveReward = Math.round(baseReward * (1 + config.comboSteps.step2Bonus));
        comboLabel = `🔥 Serisi 5x (+%${Math.round(config.comboSteps.step2Bonus * 100)})`;
      } else if (nextCombo >= config.comboSteps.step1Count) {
        effectiveReward = Math.round(baseReward * (1 + config.comboSteps.step1Bonus));
        comboLabel = `⚡ Serisi 3x (+%${Math.round(config.comboSteps.step1Bonus * 100)})`;
      }

      const newDist = Math.min(config.maxDistance, distanceRef.current + effectiveReward);
      distanceRef.current = newDist;
      const ceilDist = Math.ceil(newDist);
      lastDisplayDistRef.current = ceilDist;
      setDisplayDistance(ceilDist);

      const newScore = oldScore + 1;
      setCombo(nextCombo);
      setMaxCombo(prev => Math.max(prev, nextCombo));
      setScore(newScore);

      // Play audio & trigger hit damage on snake
      sound.playCorrect(nextCombo);
      setSnakeDamaged(true);
      if (damageTimeoutRef.current) clearTimeout(damageTimeoutRef.current);
      damageTimeoutRef.current = setTimeout(() => setSnakeDamaged(false), 380);

      // Pop score animation
      setScorePop(true);
      if (scorePopTimeoutRef.current) clearTimeout(scorePopTimeoutRef.current);
      scorePopTimeoutRef.current = setTimeout(() => setScorePop(false), 350);

      // Floating text on snake
      const headPt = getSerpentinePointAtTime(visualDistanceRef.current, config);
      setFloatingDamage({
        id: Date.now(),
        text: `-${effectiveReward}s`,
        x: headPt.x,
        y: headPt.y
      });
      setTimeout(() => setFloatingDamage(null), 700);

      // If word was in weak list, mark it resolved
      queueManagerRef.current?.resolveWeakWordIfCorrect(currentWord);

      // SRS integration
      onAnswerWord(currentWord.id, true, nextCombo, undefined);

      // Console log audit as requested
      console.log('[Yılan Savaşı] Doğru Cevap:', {
        girilen: trimmed,
        hedefIngilizce: currentWord.en,
        eslesenAnlam: answerCheck.matchedMeaning,
        sonuc: 'DOĞRU',
        mesafeOnce: oldDist.toFixed(1),
        mesafeSonra: newDist.toFixed(1),
        skorOnce: oldScore,
        skorSonra: newScore,
        kombo: nextCombo,
        odul: effectiveReward
      });

      // Show review banner (lasts correctFlashDurationMs without being wiped)
      setReviewState({
        type: 'correct',
        text: `+${effectiveReward}s`,
        subText: answerCheck.matchedMeaning || currentWord.tr,
        targetWord: currentWord,
        rewardSeconds: effectiveReward,
        comboBonus: comboLabel
      });

      if (reviewTimeoutRef.current) clearTimeout(reviewTimeoutRef.current);
      reviewTimeoutRef.current = setTimeout(() => {
        setReviewState(null);
      }, config.correctFlashDurationMs);

      advanceToNextWord();
    } else {
      // 2. YANLIŞ
      const newDist = Math.max(0, distanceRef.current - config.wrongPenaltyDistance);
      distanceRef.current = newDist;
      const ceilDist = Math.max(0, Math.ceil(newDist));
      lastDisplayDistRef.current = ceilDist;
      setDisplayDistance(ceilDist);

      const newSpeed = Math.min(
        config.maxSpeedMultiplier,
        speedMultiplierRef.current * config.speedMultiplierIncrement
      );
      speedMultiplierRef.current = newSpeed;
      setSpeedMultiplier(newSpeed);

      setCombo(0);
      sound.playWrong();

      // Enqueue for single retry in 6-10 questions if not already asked 2 times
      queueManagerRef.current?.enqueueWeakWord(currentWord);
      setMissedWords(prev => [...prev, { word: currentWord, userAnswer: trimmed }]);

      onAnswerWord(currentWord.id, false, 1, trimmed);

      // Console log audit as requested
      console.log('[Yılan Savaşı] Yanlış Cevap:', {
        girilen: trimmed,
        hedefIngilizce: currentWord.en,
        dogruAnlam: currentWord.tr,
        sonuc: 'YANLIŞ',
        mesafeOnce: oldDist.toFixed(1),
        mesafeSonra: newDist.toFixed(1),
        skor: score,
        sorulmaSayisi: queueManagerRef.current?.getAskedCount(currentWord.id)
      });

      if (newDist <= config.minDistance) {
        endGame();
        return;
      }

      // Show review banner instantly without freezing game or locking input
      setReviewState({
        type: 'wrong',
        text: 'YANLIŞ!',
        subText: `${currentWord.en} = ${currentWord.tr}`,
        targetWord: currentWord,
        almostCorrect: answerCheck.isAlmostCorrect
      });

      if (reviewTimeoutRef.current) clearTimeout(reviewTimeoutRef.current);
      reviewTimeoutRef.current = setTimeout(() => {
        setReviewState(null);
      }, 1800);

      advanceToNextWord();
    }
  };

  // Handle Pass - Instant skip to next word without freezing
  const handlePass = () => {
    if (!currentWord || gameState !== 'playing') return;

    const oldDist = distanceRef.current;
    setCombo(0);

    setMissedWords(prev => [...prev, { word: currentWord, isPass: true }]);

    onAnswerWord(currentWord.id, false, 1, 'PAS');

    console.log('[Yılan Savaşı] Pas Geçildi:', {
      hedefIngilizce: currentWord.en,
      dogruAnlam: currentWord.tr,
      sonuc: 'PAS',
      mesafe: oldDist.toFixed(1),
      skor: score
    });

    // Show brief feedback banner without pausing game
    setReviewState({
      type: 'pass',
      text: 'PAS GEÇİLDİ',
      subText: `${currentWord.en} = ${currentWord.tr}`,
      targetWord: currentWord
    });

    if (reviewTimeoutRef.current) clearTimeout(reviewTimeoutRef.current);
    reviewTimeoutRef.current = setTimeout(() => {
      setReviewState(null);
    }, 1500);

    advanceToNextWord();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAnswerSubmit();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handlePass();
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Serpentine Path Geometry Calculations (ViewBox: 0 0 440 240)
  const numRows = config.pathRows;
  const numTurns = numRows - 1;
  const rowSpacing = 200 / numTurns;
  const R = rowSpacing / 2;

  const serpentinePathD = useMemo(() => {
    return buildSerpentinePathD(numRows, rowSpacing, R);
  }, [numRows, rowSpacing, R]);

  // Initial head position & angle fallback for first render
  const headPoint = useMemo(() => {
    return getSerpentinePointAtTime(config.initialDistance, config);
  }, [config]);

  // Initial body dash fallback for first render (empty on mount)
  const bodyDash = useMemo(() => {
    return {
      dashArray: `0 4500`,
      dashOffset: '0'
    };
  }, []);

  // Red tension vignette glow when distance < 15
  const isDangerZone = displayDistance < 15;
  const tensionAlpha = isDangerZone ? Math.min(0.65, ((15 - displayDistance) / 15) * 0.65) : 0;

  const currentLevel = currentWord ? getWordLevel(currentWord) : 'default';

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 bg-[#0B0F19] text-white flex flex-col select-none overflow-hidden"
      style={{
        height: `${viewportHeight}px`,
        maxHeight: `${viewportHeight}px`,
        boxShadow:
          tensionAlpha > 0
            ? `inset 0 0 ${40 + (15 - displayDistance) * 5}px rgba(239, 68, 68, ${tensionAlpha})`
            : undefined
      }}
    >
      {/* 1. COMPACT TOP STATS BAR */}
      <div className="flex-shrink-0 h-10 px-3 border-b border-white/10 bg-[#121826]/90 backdrop-blur-md flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all"
            aria-label="Geri"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-white" />
          </button>
          <span className="text-xs font-black tracking-wider text-[#4ADE80] uppercase">
            Yılan Savaşı
          </span>
        </div>

        {/* Live Metrics Pills */}
        <div className="flex items-center gap-2 text-xs font-bold">
          <div className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
            <Clock className="w-3 h-3 text-blue-400" />
            <span className="font-mono text-[11px]">{formatTime(displayElapsedSeconds)}</span>
          </div>

          <div
            className={`flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 transition-transform ${
              scorePop ? 'scale-125 bg-amber-500/20 text-amber-300' : ''
            }`}
          >
            <Award className="w-3 h-3 text-amber-400" />
            <span className="text-[11px]">{score}</span>
          </div>

          <div
            className={`flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 ${
              combo >= 3 ? 'text-orange-400 border-orange-500/40 bg-orange-500/15' : ''
            }`}
          >
            <Flame className={`w-3 h-3 ${combo >= 3 ? 'animate-bounce' : 'text-slate-400'}`} />
            <span className="text-[11px]">{combo}x</span>
          </div>

          <div className="hidden xs:flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10 text-emerald-400">
            <Zap className="w-3 h-3" />
            <span className="text-[11px]">{speedMultiplier.toFixed(2)}x</span>
          </div>

          <button
            onClick={() => setShowDebug(prev => !prev)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300"
            title="Ayar / Test Paneli"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* DEBUG PANEL */}
      {showDebug && (
        <div className="absolute top-10 inset-x-0 bg-[#172033] border-b border-emerald-500/30 p-3 z-30 text-xs text-slate-200 shadow-2xl">
          <div className="max-w-md mx-auto space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-400">🔧 Canlı Test & Serpentine Config</span>
              <button onClick={() => setShowDebug(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <label>Mesafe: {displayDistance}s</label>
                <input
                  type="range"
                  min="0"
                  max="120"
                  value={displayDistance}
                  onChange={e => {
                    const val = Number(e.target.value);
                    distanceRef.current = val;
                    visualDistanceRef.current = val;
                    setDisplayDistance(val);
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label>Mesafe Tavanı: {config.maxDistance}s</label>
                <input
                  type="number"
                  min="60"
                  max="180"
                  value={config.maxDistance}
                  onChange={e => setConfig(prev => ({ ...prev, maxDistance: Number(e.target.value) }))}
                  className="w-full bg-black/40 rounded px-1.5 py-0.5"
                />
              </div>
              <div>
                <label>Gövde: {config.snakeBodySec}s</label>
                <input
                  type="range"
                  min="4"
                  max="60"
                  value={config.snakeBodySec}
                  onChange={e => setConfig(prev => ({ ...prev, snakeBodySec: Number(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label>Max Soru / Kelime: {config.maxAsksPerWord}</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={config.maxAsksPerWord}
                  onChange={e => setConfig(prev => ({ ...prev, maxAsksPerWord: Number(e.target.value) }))}
                  className="w-full bg-black/40 rounded px-1.5 py-0.5"
                />
              </div>
              <div>
                <label>Tekrar Aralığı: {config.retryGapMin}-{config.retryGapMax}</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="3"
                    max="15"
                    value={config.retryGapMin}
                    onChange={e => setConfig(prev => ({ ...prev, retryGapMin: Number(e.target.value) }))}
                    className="w-1/2 bg-black/40 rounded px-1 text-[10px]"
                  />
                  <input
                    type="number"
                    min="5"
                    max="20"
                    value={config.retryGapMax}
                    onChange={e => setConfig(prev => ({ ...prev, retryGapMax: Number(e.target.value) }))}
                    className="w-1/2 bg-black/40 rounded px-1 text-[10px]"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setConfig(DEFAULT_SNAKE_CONFIG)}
                  className="w-full py-1 bg-amber-500/20 text-amber-300 rounded text-[10px] font-bold"
                >
                  Varsayılana Sıfırla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. THE SERPENTINE ROAD ARENA (~45% of visible height, min 200px) */}
      <div
        className="relative flex-shrink-0 w-full bg-gradient-to-b from-[#0F1626] to-[#0A0E17] border-b border-white/10 px-2 py-1 flex flex-col justify-between overflow-hidden"
        style={{
          height: '45%',
          minHeight: '200px'
        }}
      >
        {/* Right Corner: Solitary Clear Distance Pill */}
        <div className="absolute top-2 right-3 z-20 flex items-center gap-2">
          {combo >= 3 && (
            <div className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-orange-500/25 text-orange-300 border border-orange-500/40 animate-pulse">
              {combo >= 5 ? '+%40 Kombo!' : '+%20 Kombo!'}
            </div>
          )}

          <div
            className={`px-2.5 py-0.5 rounded-full font-black text-xs tracking-wide shadow-md transition-all ${
              displayDistance > 45
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : displayDistance >= 15
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-red-500/35 text-red-200 border border-red-500/60 animate-bounce'
            }`}
          >
            Mesafe: {Math.max(0, displayDistance)} sn
          </div>
        </div>

        {/* Serpentine SVG Canvas (ViewBox: 0 0 440 240) */}
        <div className="relative w-full h-full flex items-center justify-center">
          <svg
            viewBox="0 0 440 240"
            className="w-full h-full max-h-full drop-shadow-md select-none overflow-visible"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="snakeBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#15803D" />
                <stop offset="50%" stopColor="#22C55E" />
                <stop offset="100%" stopColor="#4ADE80" />
              </linearGradient>

              <linearGradient id="snakeBodyDangerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#991B1B" />
                <stop offset="50%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="#FBBF24" />
              </linearGradient>

              <linearGradient id="snakeDamageGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="50%" stopColor="#EF4444" />
                <stop offset="100%" stopColor="#FFFFFF" />
              </linearGradient>

              <filter id="roadGlow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* A. Visible Top-Right Entrance Track (where snake retreats when distance > 60, up to 120s) */}
            <path
              d="M 440 20 L 360 20"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="22"
              strokeLinecap="round"
              strokeDasharray="4 4"
            />

            {/* Entrance portal ring */}
            <circle cx="430" cy="20" r="11" fill="rgba(34, 197, 94, 0.2)" stroke="rgba(34, 197, 94, 0.4)" strokeWidth="2" />

            {/* B. Base Serpentine Road Track */}
            <path
              d={serpentinePathD}
              fill="none"
              stroke="rgba(255, 255, 255, 0.09)"
              strokeWidth="22"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#roadGlow)"
            />

            <path
              d={serpentinePathD}
              fill="none"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 6"
            />

            {/* C. Measurable Reference Path */}
            <path
              ref={roadPathRef}
              d={serpentinePathD}
              fill="none"
              stroke="transparent"
              strokeWidth="0.1"
            />

            {/* D. Snake Body Path - Controlled directly at 60fps via snakeBodyRef */}
            <path
              ref={snakeBodyRef}
              d={serpentinePathD}
              fill="none"
              stroke={
                snakeDamaged
                  ? 'url(#snakeDamageGrad)'
                  : isDangerZone
                  ? 'url(#snakeBodyDangerGrad)'
                  : 'url(#snakeBodyGrad)'
              }
              strokeWidth={snakeDamaged ? '21' : '18'}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={bodyDash.dashArray}
              strokeDashoffset="0"
            />

            {/* Entrance Line for retreat beyond 60s */}
            <line
              ref={entranceLineRef}
              x1="360"
              y1="20"
              x2="360"
              y2="20"
              stroke={snakeDamaged ? '#FFFFFF' : 'url(#snakeBodyGrad)'}
              strokeWidth="18"
              strokeLinecap="round"
              style={{ display: 'none' }}
            />

            {/* E. Snake Head Figure with Damage Reaction */}
            <g
              ref={snakeHeadRef}
              transform={`translate(${headPoint.x}, ${headPoint.y}) rotate(${headPoint.angle}) ${
                snakeDamaged
                  ? 'scale(1.3) translate(0, -2)'
                  : isDangerZone
                  ? 'scale(1.3)'
                  : 'scale(1.1)'
              }`}
            >
              {/* Skull */}
              <ellipse
                cx="4"
                cy="0"
                rx="11"
                ry="9.5"
                fill={
                  snakeDamaged
                    ? '#FFFFFF'
                    : isDangerZone
                    ? '#B91C1C'
                    : '#15803D'
                }
                stroke={snakeDamaged ? '#EF4444' : isDangerZone ? '#F87171' : '#4ADE80'}
                strokeWidth="2"
              />

              {/* Eyes */}
              <circle cx="6" cy="-4" r="3" fill={snakeDamaged ? '#EF4444' : isDangerZone ? '#EF4444' : '#FFE45E'} />
              <circle cx="6" cy="4" r="3" fill={snakeDamaged ? '#EF4444' : isDangerZone ? '#EF4444' : '#FFE45E'} />
              <circle cx="7.5" cy="-4" r="1.3" fill="#000000" />
              <circle cx="7.5" cy="4" r="1.3" fill="#000000" />

              {/* Tongue */}
              <path
                d="M 13 0 L 20 -4 M 13 0 L 20 4"
                stroke="#EF4444"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </g>

            {/* F. Floating Hit Damage Badge on Snake (-7s) */}
            {floatingDamage && (
              <g transform={`translate(${floatingDamage.x}, ${floatingDamage.y - 18})`} className="animate-bounce">
                <rect x="-20" y="-14" width="40" height="18" rx="9" fill="#EF4444" opacity="0.95" />
                <text x="0" y="0" textAnchor="middle" fontSize="11" fill="#FFFFFF" fontWeight="900">
                  {floatingDamage.text}
                </text>
              </g>
            )}

            {/* G. Player Target at the final road exit (360, 220) */}
            <g transform="translate(365, 220)">
              <circle cx="0" cy="0" r="13" fill="rgba(59, 130, 246, 0.25)" stroke="#60A5FA" strokeWidth="2" />
              <text
                x="0"
                y="5"
                textAnchor="middle"
                fontSize="14"
                className={isDangerZone ? 'animate-bounce' : ''}
              >
                {isDangerZone ? '🏃' : '🧍'}
              </text>
            </g>

            {/* H. Caught Constriction Animation Overlay */}
            {isCaughtAnimation && (
              <g transform="translate(365, 220)" className="animate-in zoom-in-95 duration-150">
                <circle cx="0" cy="0" r="22" fill="none" stroke="#EF4444" strokeWidth="6" strokeDasharray="10 5" className="animate-spin" />
                <circle cx="0" cy="0" r="14" fill="#DC2626" />
                <text x="0" y="4" textAnchor="middle" fontSize="11" fill="#FFFFFF" fontWeight="900">
                  💀
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* 3. CENTER & BOTTOM: COMPACT QUESTION CARD & INPUTS */}
      <div className="flex-1 flex flex-col justify-between p-2.5 max-w-md w-full mx-auto overflow-hidden">
        {gameState === 'ready' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-3 bg-[#151C2C] rounded-2xl border border-white/10 shadow-xl space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#22C55E]/20 text-3xl flex items-center justify-center border border-[#22C55E]/40 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
              🐍
            </div>
            <div>
              <h2 className="text-lg font-black text-white">Yılan Savaşı (Serpentine)</h2>
              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                Ekranda çıkan <strong className="text-white">İngilizce</strong> kelimenin
                <strong className="text-emerald-400"> Türkçe</strong> karşılığını yaz.
                Her doğru cevap yılana hasar vurup geriletir!
              </p>
            </div>
            <button
              onClick={startGame}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              Savaşı Başlat (60s)
            </button>
          </div>
        )}

        {gameState === 'playing' && currentWord && (
          <>
            {/* Feedback / Review Alert Banner (Persists during review without vanishing) */}
            <div className="h-6 flex items-center justify-center flex-shrink-0">
              {reviewState && (
                <div
                  className={`px-2.5 py-0.5 rounded-lg font-bold text-[11px] flex items-center gap-1.5 shadow-md animate-in fade-in slide-in-from-top-1 ${
                    reviewState.type === 'correct'
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                      : reviewState.type === 'wrong'
                      ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                      : 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  <span className="font-black">{reviewState.text}</span>
                  {reviewState.subText && (
                    <span className="font-extrabold text-white">{reviewState.subText}</span>
                  )}
                  {reviewState.comboBonus && (
                    <span className="text-[10px] text-amber-300 font-extrabold ml-1">
                      {reviewState.comboBonus}
                    </span>
                  )}
                  {reviewState.almostCorrect && (
                    <span className="text-[10px] text-amber-300 ml-1">
                      (Neredeyse doğru!)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* COMPACT ENGLISH WORD CARD */}
            <div className="flex-shrink-0 bg-[#151C2C] rounded-xl px-3 py-1.5 sm:py-2 border border-white/10 shadow flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-emerald-400 border border-white/10">
                  {currentLevel !== 'default' ? currentLevel : 'Kelime'}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  {currentWord.en}
                </h2>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">
                +{config.rewardsByLevel[currentLevel] || config.rewardsByLevel.default}s
              </span>
            </div>

            {/* INPUT + PAS + CEVAPLA BUTTONS */}
            <form onSubmit={handleAnswerSubmit} className="flex-shrink-0 space-y-1.5 mt-1">
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Türkçe karşılığını yaz..."
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={isPausedRef.current}
                className="w-full bg-[#151C2C] border-2 border-white/20 focus:border-[#22C55E] focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20 rounded-xl px-3 py-2 text-center text-base font-bold text-white placeholder-slate-500 shadow-md transition-all"
              />

              <div className="flex items-center gap-2 w-full">
                <button
                  type="button"
                  onPointerDown={e => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    handlePass();
                  }}
                  disabled={isPausedRef.current}
                  className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-slate-300 font-bold text-xs border border-white/10 transition-all flex items-center justify-center gap-1"
                >
                  <span>Pas</span>
                  <span className="text-[9px] bg-black/40 px-1 py-0.5 rounded text-slate-400 font-mono hidden sm:inline">
                    Tab
                  </span>
                </button>

                <button
                  type="submit"
                  onPointerDown={e => e.preventDefault()}
                  onClick={(e) => {
                    e.preventDefault();
                    handleAnswerSubmit();
                  }}
                  disabled={isPausedRef.current || !inputVal.trim()}
                  className="flex-[2] py-2 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-extrabold text-xs sm:text-sm shadow-md hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-1"
                >
                  <span>Cevapla</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}

        {/* 4. GAME OVER RESULT SCREEN */}
        {gameState === 'gameover' && (
          <div className="flex-1 bg-[#151C2C] rounded-2xl p-3 border border-white/10 shadow-2xl flex flex-col justify-between items-center text-center space-y-2 overflow-y-auto">
            <div className="w-10 h-10 rounded-full bg-red-500/20 text-xl flex items-center justify-center border border-red-500/40">
              💀
            </div>

            <div>
              <h2 className="text-lg font-black text-white">Yılan Yakaladı!</h2>
              <p className="text-[10px] text-slate-400">Yol bitti ve yılan hedefe ulaştı.</p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 w-full">
              <div className="bg-black/30 rounded-xl p-1.5 border border-white/5">
                <span className="text-[9px] text-slate-400 font-semibold block">Doğru</span>
                <span className="text-base font-black text-emerald-400 block">{score}</span>
              </div>
              <div className="bg-black/30 rounded-xl p-1.5 border border-white/5">
                <span className="text-[9px] text-slate-400 font-semibold block">Süre</span>
                <span className="text-base font-black text-blue-400 block">
                  {formatTime(displayElapsedSeconds)}
                </span>
              </div>
              <div className="bg-black/30 rounded-xl p-1.5 border border-white/5">
                <span className="text-[9px] text-slate-400 font-semibold block">En İyi Seri</span>
                <span className="text-base font-black text-amber-400 block">{maxCombo}x</span>
              </div>
            </div>

            {/* Missed Words */}
            {missedWords.length > 0 && (
              <div className="w-full text-left space-y-1">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-300">
                  <span>Kaçırılan Kelimeler ({missedWords.length})</span>
                  <span className="text-[9px] text-emerald-400">SRS&apos;e Kaydedildi</span>
                </div>
                <div className="max-h-20 overflow-y-auto space-y-1 pr-1">
                  {missedWords.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-black/40 rounded-lg p-1.5 flex items-center justify-between border border-white/5 text-[10px]"
                    >
                      <div>
                        <span className="font-extrabold text-white block">{item.word.en}</span>
                        <span className="text-[9px] text-slate-400 block">{item.word.tr}</span>
                      </div>
                      <div>
                        {item.isPass ? (
                          <span className="text-[8px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded font-bold">
                            PAS
                          </span>
                        ) : (
                          <span className="text-[8px] text-red-400 block">
                            {item.userAnswer || '-'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 w-full pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-slate-300 font-bold text-xs"
              >
                Kapat
              </button>
              <button
                onClick={startGame}
                className="flex-[2] py-2 rounded-xl bg-gradient-to-r from-[#22C55E] to-[#16A34A] text-white font-extrabold text-xs shadow-md active:scale-95 flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Tekrar Oyna
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
