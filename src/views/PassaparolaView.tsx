import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Word, Progress } from '../types';
import { sound } from '../services/audio';
import { checkTurkishAnswer } from '../utils/turkishMatcher';
import { AudioButton } from '../components/AudioButton';
import { fireCelebration } from '../components/Confetti';
import {
  generatePassaparolaQuestions,
  PassaparolaQuestion
} from '../services/passaparolaService';
import { ArrowLeft, Clock, Award, Play, RotateCcw, Check, X as XIcon, HelpCircle } from 'lucide-react';

interface Props {
  allWords: Word[];
  progressMap: Map<number, Progress>;
  onAddXp?: (amount: number) => Promise<void>;
  onClose: () => void;
}

const PALETTE = [
  'bg-amber-500 text-slate-950',
  'bg-rose-500 text-white',
  'bg-emerald-500 text-white',
  'bg-sky-500 text-white',
  'bg-orange-500 text-white',
  'bg-indigo-500 text-white'
];

export const PassaparolaView: React.FC<Props> = ({
  allWords,
  progressMap,
  onAddXp,
  onClose
}) => {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'gameover'>('ready');
  const [questions, setQuestions] = useState<PassaparolaQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [inputVal, setInputVal] = useState('');
  const [lastFeedback, setLastFeedback] = useState<{ isCorrect: boolean; text: string; correctTr: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Score metrics
  const score = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let pass = 0;

    questions.forEach((q) => {
      if (q.state === 'correct') correct++;
      else if (q.state === 'wrong') wrong++;
      else if (q.state === 'pass') pass++;
    });

    return { correct, wrong, pass };
  }, [questions]);

  // Start new game
  const startGame = () => {
    const newQs = generatePassaparolaQuestions(allWords, progressMap);
    setQuestions(newQs);
    setCurrentIndex(0);
    setTimeLeft(120);
    setInputVal('');
    setLastFeedback(null);
    setGameState('playing');
  };

  // Timer loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // Focus input on playing
  useEffect(() => {
    if (gameState === 'playing') {
      inputRef.current?.focus();
    }
  }, [gameState, currentIndex]);

  const currentQ = questions[currentIndex];

  // Helper to find next target question:
  // First searches for 'unvisited', then loops to 'pass'
  const getNextIndex = (fromIndex: number, currentList: PassaparolaQuestion[]): number | null => {
    const total = currentList.length;
    if (total === 0) return null;

    // 1. Check for unvisited ahead
    for (let i = 1; i <= total; i++) {
      const idx = (fromIndex + i) % total;
      if (currentList[idx].state === 'unvisited') {
        return idx;
      }
    }

    // 2. Check for passed questions (loop back)
    for (let i = 1; i <= total; i++) {
      const idx = (fromIndex + i) % total;
      if (currentList[idx].state === 'pass') {
        return idx;
      }
    }

    // All questions answered!
    return null;
  };

  const endGame = async () => {
    setGameState('gameover');
    sound.playLevelUp();
    fireCelebration();

    // Reward XP for correct answers
    const totalCorrect = questions.filter(q => q.state === 'correct').length;
    if (totalCorrect > 0 && onAddXp) {
      await onAddXp(totalCorrect * 15);
    }
  };

  // Answer submit
  const handleAnswerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentQ || gameState !== 'playing') return;

    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const isCorrect = checkTurkishAnswer(trimmed, currentQ.word.tr);

    if (isCorrect) {
      sound.playCorrect(score.correct + 1);
      setLastFeedback({ isCorrect: true, text: 'Doğru!', correctTr: currentQ.word.tr });
    } else {
      sound.playWrong();
      setLastFeedback({ isCorrect: false, text: 'Yanlış!', correctTr: currentQ.word.tr });
    }

    // Update current question state
    const updated = [...questions];
    updated[currentIndex] = {
      ...currentQ,
      state: isCorrect ? 'correct' : 'wrong',
      userAnswer: trimmed
    };

    setQuestions(updated);
    setInputVal('');

    // Advance to next index
    const nextIdx = getNextIndex(currentIndex, updated);
    if (nextIdx !== null) {
      setCurrentIndex(nextIdx);
    } else {
      endGame();
    }
  };

  // Pass (Skip)
  const handlePass = () => {
    if (!currentQ || gameState !== 'playing') return;

    const updated = [...questions];
    updated[currentIndex] = {
      ...currentQ,
      state: 'pass',
      userAnswer: inputVal.trim() || undefined
    };

    setQuestions(updated);
    setInputVal('');
    setLastFeedback(null);

    const nextIdx = getNextIndex(currentIndex, updated);
    if (nextIdx !== null) {
      setCurrentIndex(nextIdx);
    } else {
      endGame();
    }
  };

  // Calculate circular letter button coordinates
  const circleRadius = 126;
  const centerCoord = 145;

  return (
    <div className="space-y-4 pb-24 pt-1 max-w-md mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="text-center">
          <span className="text-sm font-black bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 bg-clip-text text-transparent">
            PASSAPAROLA
          </span>
          <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            A'dan Z'ye Kelime Çarkı
          </span>
        </div>

        {gameState === 'playing' ? (
          <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-xl">
            <Clock size={14} className="text-amber-400" />
            <span className={`text-xs font-black font-mono ${timeLeft <= 20 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
              {timeLeft}s
            </span>
          </div>
        ) : (
          <div className="w-8" />
        )}
      </div>

      {/* READY SCREEN */}
      {gameState === 'ready' && (
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-6 text-center space-y-6 shadow-2xl">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-500 p-1 shadow-lg shadow-orange-500/20">
            <div className="w-full h-full bg-slate-950 rounded-full flex items-center justify-center">
              <span className="text-4xl font-black text-amber-400">P</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Passaparola Çarkı</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              120 saniyede A'dan Z'ye İngilizce kelimelerin Türkçe karşılıklarını yaz!
            </p>
            <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="block text-emerald-400 font-bold text-sm">Doğru</span>
                <span className="text-[11px] text-slate-400">Yeşil yanar</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="block text-rose-400 font-bold text-sm">Yanlış</span>
                <span className="text-[11px] text-slate-400">Kırmızı yanar</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                <span className="block text-amber-400 font-bold text-sm">Pas</span>
                <span className="text-[11px] text-slate-400">Sona kalır</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-3 text-[11px] text-indigo-300">
            💡 <strong>Önemli:</strong> Fiiller "to" olmadan sorulur (örn: <em>associate</em>). Çalıştığın kelimeler önceliklidir!
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:opacity-95 active:scale-[0.98] text-slate-950 font-black text-base rounded-2xl shadow-xl shadow-orange-950/50 transition-all flex items-center justify-center space-x-2"
          >
            <Play size={18} className="fill-slate-950" />
            <span>Çarkı Döndür (120s)</span>
          </button>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === 'playing' && currentQ && (
        <div className="space-y-4">
          {/* Live Score Strip */}
          <div className="flex items-center justify-around bg-slate-800/80 border border-slate-700/80 rounded-2xl py-2 px-3 text-xs font-black">
            <span className="text-emerald-400">{score.correct} Doğru</span>
            <span className="text-slate-600">•</span>
            <span className="text-rose-400">{score.wrong} Yanlış</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400">{score.pass} Pas</span>
          </div>

          {/* PASSAPAROLA CIRCULAR WHEEL */}
          <div className="relative w-[290px] h-[290px] mx-auto select-none">
            {/* SVG backdrop for ring */}
            <svg className="w-full h-full pointer-events-none absolute inset-0">
              <circle
                cx={centerCoord}
                cy={centerCoord}
                r={circleRadius}
                fill="none"
                stroke="rgba(51, 65, 85, 0.4)"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
            </svg>

            {/* Letter nodes in the circle */}
            {questions.map((q, idx) => {
              const count = questions.length;
              const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
              const x = centerCoord + circleRadius * Math.cos(angle);
              const y = centerCoord + circleRadius * Math.sin(angle);
              const isCurrent = idx === currentIndex;

              // Letter styling based on state
              let nodeStyle = PALETTE[idx % PALETTE.length];
              if (q.state === 'correct') {
                nodeStyle = 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50';
              } else if (q.state === 'wrong') {
                nodeStyle = 'bg-rose-500 text-white shadow-lg shadow-rose-500/50';
              } else if (q.state === 'pass') {
                nodeStyle = 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-400/50';
              }

              return (
                <div
                  key={q.letter}
                  style={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${nodeStyle} ${
                    isCurrent
                      ? 'ring-4 ring-yellow-300 ring-offset-2 ring-offset-slate-950 scale-125 z-30 animate-pulse font-extrabold'
                      : 'opacity-90'
                  }`}
                >
                  {q.letter}
                </div>
              );
            })}

            {/* Center Area: Big Letter & English Word */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 mb-1 animate-scaleUp">
                <span className="text-3xl font-black text-slate-950">{currentQ.letter}</span>
              </div>

              <div className="flex items-center space-x-1.5 mt-1">
                <span className="text-xl font-black text-white tracking-wide">
                  {currentQ.displayWord}
                </span>
                <AudioButton text={currentQ.displayWord} size={16} />
              </div>

              {currentQ.word.ipa && (
                <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {currentQ.word.ipa}
                </span>
              )}
            </div>
          </div>

          {/* Feedback Toast if wrong/correct */}
          {lastFeedback && (
            <div
              className={`p-2.5 rounded-2xl text-xs text-center border animate-fadeIn ${
                lastFeedback.isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <span className="font-bold">{lastFeedback.text} </span>
              {!lastFeedback.isCorrect && (
                <span className="text-slate-300 font-normal">
                  (Cevap: <strong className="text-white">{lastFeedback.correctTr}</strong>)
                </span>
              )}
            </div>
          )}

          {/* Input & Action Form */}
          <form onSubmit={handleAnswerSubmit} className="space-y-2.5">
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Türkçe karşılığını yaz..."
              className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 focus:border-amber-400 rounded-2xl text-white placeholder-slate-500 text-center font-bold text-sm focus:outline-none transition-all shadow-inner"
            />

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handlePass}
                className="flex-1 py-3 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 border border-amber-500/40 font-black text-xs rounded-xl transition-all"
              >
                PAS GEÇ
              </button>

              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="flex-[2] py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:opacity-95 active:scale-95 disabled:opacity-40 text-slate-950 font-black text-xs rounded-xl shadow-lg transition-all"
              >
                CEVAPLA
              </button>
            </div>
          </form>
        </div>
      )}

      {/* GAME OVER SUMMARY SCREEN */}
      {gameState === 'gameover' && (
        <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 space-y-5 shadow-2xl animate-scaleUp">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <Award size={36} />
            </div>
            <h3 className="text-xl font-black text-white">Tur Tamamlandı!</h3>
            <p className="text-xs text-slate-400">
              Passaparola turunda sergilediğin performans:
            </p>
          </div>

          {/* Scoreboard Cards */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3">
              <span className="block text-2xl font-black text-emerald-400">{score.correct}</span>
              <span className="text-[10px] font-bold text-emerald-300/80 uppercase">Doğru</span>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3">
              <span className="block text-2xl font-black text-rose-400">{score.wrong}</span>
              <span className="text-[10px] font-bold text-rose-300/80 uppercase">Yanlış</span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3">
              <span className="block text-2xl font-black text-amber-400">{score.pass}</span>
              <span className="text-[10px] font-bold text-amber-300/80 uppercase">Pas</span>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-2xl p-3 text-center border border-slate-700 text-xs">
            <span className="text-slate-400">Kazanılan XP: </span>
            <span className="font-black text-amber-400">+{score.correct * 15} XP</span>
          </div>

          {/* Question List Review */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 no-scrollbar">
            <span className="text-xs font-bold text-slate-300 block mb-1">
              Kelimeler ve Yanıtların:
            </span>
            {questions.map((q) => (
              <div
                key={q.letter}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-lg bg-slate-700 font-bold text-center flex items-center justify-center text-[11px] text-white shrink-0">
                    {q.letter}
                  </span>
                  <div>
                    <span className="font-bold text-white">{q.displayWord}</span>
                    <span className="text-slate-400 block text-[10px] truncate max-w-[150px]">
                      {q.word.tr}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {q.state === 'correct' ? (
                    <span className="text-emerald-400 font-bold flex items-center space-x-1">
                      <Check size={14} />
                      <span className="text-[11px]">Doğru</span>
                    </span>
                  ) : q.state === 'wrong' ? (
                    <span className="text-rose-400 font-bold flex items-center space-x-1">
                      <XIcon size={14} />
                      <span className="text-[11px]">Yanlış</span>
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold flex items-center space-x-1">
                      <HelpCircle size={14} />
                      <span className="text-[11px]">Pas</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
            >
              Kapat
            </button>
            <button
              onClick={startGame}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center space-x-1.5"
            >
              <RotateCcw size={14} />
              <span>Tekrar Oyna</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
