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

  // Focus input on playing & re-focus when currentIndex changes
  useEffect(() => {
    if (gameState === 'playing') {
      inputRef.current?.focus();
    }
  }, [gameState, currentIndex]);

  const currentQ = questions[currentIndex];

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

    const totalCorrect = questions.filter(q => q.state === 'correct').length;
    if (totalCorrect > 0 && onAddXp) {
      await onAddXp(totalCorrect * 15);
    }
  };

  const handleAnswerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentQ || gameState !== 'playing') return;

    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const isCorrect = checkTurkishAnswer(trimmed, currentQ.word.tr);

    if (isCorrect) {
      sound.playCorrect(score.correct + 1);
      setLastFeedback({ isCorrect: true, text: 'DOĞRU!', correctTr: currentQ.word.tr });
    } else {
      sound.playWrong();
      setLastFeedback({ isCorrect: false, text: 'YANLIŞ!', correctTr: currentQ.word.tr });
    }

    const updated = [...questions];
    updated[currentIndex] = {
      ...currentQ,
      state: isCorrect ? 'correct' : 'wrong',
      userAnswer: trimmed
    };

    setQuestions(updated);
    setInputVal('');

    const nextIdx = getNextIndex(currentIndex, updated);
    if (nextIdx !== null) {
      setCurrentIndex(nextIdx);
    } else {
      endGame();
    }
  };

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

  // Circular letter wheel geometry
  const centerCoord = 115;
  const circleRadius = 94;

  return (
    <div className="flex flex-col justify-between max-w-md mx-auto select-none min-h-[calc(100dvh-5rem)]">
      {/* Top Header */}
      <div className="flex items-center justify-between py-2 px-1 border-b-3 border-black mb-3">
        <button
          onClick={onClose}
          className="p-1.5 bg-white border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center space-x-1"
          title="Çıkış"
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
          <span>GERİ</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs font-black uppercase tracking-wider bg-[#FFE600] text-black px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            PASSAPAROLA
          </span>
          {gameState === 'playing' && (
            <div className={`flex items-center space-x-1 border-2 border-black px-2 py-0.5 text-xs font-mono font-black shadow-[2px_2px_0px_0px_#000] ${
              timeLeft <= 20 ? 'bg-[#FF5588] text-white animate-pulse' : 'bg-white text-black'
            }`}>
              <Clock size={12} strokeWidth={2.5} />
              <span>{timeLeft}s</span>
            </div>
          )}
        </div>

        {gameState === 'playing' ? (
          <div className="flex items-center space-x-1.5 text-[11px] font-black">
            <span className="bg-[#4ADE80] text-black px-1.5 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000] flex items-center space-x-0.5">
              <Check size={12} strokeWidth={3} />
              <span>{score.correct}</span>
            </span>
            <span className="bg-[#FF5588] text-white px-1.5 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000] flex items-center space-x-0.5">
              <XIcon size={12} strokeWidth={3} />
              <span>{score.wrong}</span>
            </span>
            <span className="bg-[#00F0FF] text-black px-1.5 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000] flex items-center space-x-0.5">
              <HelpCircle size={12} strokeWidth={3} />
              <span>{score.pass}</span>
            </span>
          </div>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* 1. READY SCREEN */}
      {gameState === 'ready' && (
        <div className="my-auto bg-white border-3 border-black p-5 text-center space-y-4 shadow-[5px_5px_0px_0px_#000]">
          <div className="w-20 h-20 mx-auto bg-[#FFE600] border-3 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
            <span className="text-4xl font-black text-black">P</span>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-black uppercase text-black">PASSAPAROLA ÇARKI</h2>
            <p className="text-xs font-bold text-zinc-700 leading-relaxed border-y-2 border-dashed border-black py-2">
              120 saniyede A'dan Z'ye kelimelerin Türkçesini yaz!
            </p>

            {/* Color Rules Legend */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
              <div className="bg-[#4ADE80] p-2 border-2 border-black text-center shadow-[2px_2px_0px_0px_#000]">
                <span className="block text-black font-black text-xs uppercase">DOĞRU</span>
                <span className="text-[10px] font-bold text-black">Yeşil</span>
              </div>
              <div className="bg-[#FF5588] p-2 border-2 border-black text-center text-white shadow-[2px_2px_0px_0px_#000]">
                <span className="block font-black text-xs uppercase">YANLIŞ</span>
                <span className="text-[10px] font-bold">Kırmızı</span>
              </div>
              <div className="bg-[#00F0FF] p-2 border-2 border-black text-center shadow-[2px_2px_0px_0px_#000]">
                <span className="block text-black font-black text-xs uppercase">PAS</span>
                <span className="text-[10px] font-bold text-black">Mavi</span>
              </div>
            </div>
          </div>

          <div className="bg-[#FFE600] border-2 border-black p-2.5 text-[11px] font-black uppercase text-black shadow-[2px_2px_0px_0px_#000]">
            💡 İPUCU: "to ..." fiilleri kök harfinde sorulur (örn: to accelerate -&gt; A). Pas geçtiklerine çark tekrar döner!
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black text-sm uppercase tracking-wider border-3 border-black shadow-[4px_4px_0px_0px_#000] transition-all flex items-center justify-center space-x-2"
          >
            <Play size={18} className="fill-black" />
            <span>ÇARKI BAŞLAT (120S)</span>
          </button>
        </div>
      )}

      {/* 2. PLAYING SCREEN */}
      {gameState === 'playing' && currentQ && (
        <div className="flex-1 flex flex-col justify-between space-y-2 py-1">
          {/* Circular Wheel */}
          <div className="relative w-[230px] h-[230px] mx-auto select-none shrink-0 my-auto bg-white border-3 border-black rounded-full shadow-[5px_5px_0px_0px_#000]">
            {/* SVG backdrop for ring */}
            <svg className="w-full h-full pointer-events-none absolute inset-0">
              <circle
                cx={centerCoord}
                cy={centerCoord}
                r={circleRadius}
                fill="none"
                stroke="#000"
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

              let nodeStyle = 'bg-white text-black border-2 border-black shadow-[1px_1px_0px_0px_#000]';
              if (q.state === 'correct') {
                nodeStyle = 'bg-[#4ADE80] text-black font-black border-2 border-black shadow-[1px_1px_0px_0px_#000]';
              } else if (q.state === 'wrong') {
                nodeStyle = 'bg-[#FF5588] text-white font-black border-2 border-black shadow-[1px_1px_0px_0px_#000]';
              } else if (q.state === 'pass') {
                nodeStyle = 'bg-[#00F0FF] text-black font-black border-2 border-black shadow-[1px_1px_0px_0px_#000]';
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
                  className={`w-6 h-6 rounded-none flex items-center justify-center font-black text-[11px] transition-all duration-200 ${nodeStyle} ${
                    isCurrent
                      ? 'bg-[#FFE600] text-black border-3 border-black scale-125 z-30 shadow-[2px_2px_0px_0px_#000]'
                      : ''
                  }`}
                >
                  {q.letter}
                </div>
              );
            })}

            {/* Center Area: Big Letter & English Word */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-auto px-4">
              <div className="w-10 h-10 bg-[#FFE600] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] mb-0.5">
                <span className="text-xl font-black text-black">{currentQ.letter}</span>
              </div>

              <div className="flex items-center justify-center space-x-1 mt-0.5 max-w-[170px]">
                <span className={`font-black text-black uppercase tracking-wide truncate ${
                  currentQ.displayWord.length > 13 ? 'text-sm' : 'text-base sm:text-lg'
                }`}>
                  {currentQ.displayWord}
                </span>
                <AudioButton text={currentQ.displayWord} size={15} />
              </div>

              {currentQ.word.ipa && (
                <span className="text-[10px] text-zinc-600 font-mono font-bold">
                  {currentQ.word.ipa}
                </span>
              )}

              {/* Feedback inline under word */}
              {lastFeedback && (
                <div
                  className={`mt-1 px-2 py-0.5 text-[10px] font-black uppercase border-2 border-black max-w-[170px] truncate shadow-[2px_2px_0px_0px_#000] ${
                    lastFeedback.isCorrect
                      ? 'bg-[#4ADE80] text-black'
                      : 'bg-[#FF5588] text-white'
                  }`}
                >
                  {lastFeedback.isCorrect ? 'DOĞRU! 🎉' : `CEVAP: ${lastFeedback.correctTr}`}
                </div>
              )}
            </div>
          </div>

          {/* Input & Action Form */}
          <form onSubmit={handleAnswerSubmit} className="space-y-2 pt-1">
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Türkçe karşılığını yaz..."
              className="w-full px-3 py-2.5 bg-white border-3 border-black text-black placeholder-zinc-400 text-center font-black text-sm uppercase focus:outline-none shadow-[3px_3px_0px_0px_#000]"
            />

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handlePass}
                className="flex-1 py-3 bg-white hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-black border-2 border-black font-black uppercase text-xs shadow-[3px_3px_0px_0px_#000] transition-all"
              >
                PAS GEÇ
              </button>

              <button
                type="submit"
                disabled={!inputVal.trim()}
                className="flex-[2] py-3 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:opacity-40 text-black font-black uppercase text-xs border-3 border-black shadow-[3px_3px_0px_0px_#000] transition-all"
              >
                CEVAPLA
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. GAME OVER SUMMARY SCREEN */}
      {gameState === 'gameover' && (
        <div className="my-auto bg-white border-3 border-black p-5 space-y-4 shadow-[5px_5px_0px_0px_#000]">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 bg-[#FFE600] border-2 border-black text-black mx-auto flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
              <Award size={30} strokeWidth={2.5} />
            </div>
            <h3 className="text-xl font-black uppercase text-black">TUR TAMAMLANDI!</h3>
            <p className="text-xs font-bold text-zinc-600 uppercase">
              Passaparola turu başarıyla bitti:
            </p>
          </div>

          {/* Scoreboard Cards */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#4ADE80] border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_#000]">
              <span className="block text-2xl font-black text-black font-mono">{score.correct}</span>
              <span className="text-[10px] font-black text-black uppercase">DOĞRU</span>
            </div>
            <div className="bg-[#FF5588] border-2 border-black p-2.5 text-white shadow-[2px_2px_0px_0px_#000]">
              <span className="block text-2xl font-black font-mono">{score.wrong}</span>
              <span className="text-[10px] font-black uppercase">YANLIŞ</span>
            </div>
            <div className="bg-[#00F0FF] border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_#000]">
              <span className="block text-2xl font-black text-black font-mono">{score.pass}</span>
              <span className="text-[10px] font-black text-black uppercase">PAS</span>
            </div>
          </div>

          <div className="bg-[#FFE600] p-2 text-center border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000]">
            <span>KAZANILAN ÖDÜL: </span>
            <span className="text-black underline">+{score.correct * 15} XP</span>
          </div>

          {/* Question List Review */}
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1 no-scrollbar border-y-2 border-black py-2">
            {questions.map((q) => (
              <div
                key={q.letter}
                className="flex items-center justify-between p-2 bg-[#FDFBF7] border-2 border-black text-xs shadow-[1px_1px_0px_0px_#000]"
              >
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 bg-black font-black text-center flex items-center justify-center text-[10px] text-[#FFE600] shrink-0 border border-black">
                    {q.letter}
                  </span>
                  <div>
                    <span className="font-black text-black text-[11px] uppercase">{q.displayWord}</span>
                    <span className="text-zinc-600 block text-[10px] font-bold truncate max-w-[140px]">
                      {q.word.tr}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  {q.state === 'correct' ? (
                    <span className="bg-[#4ADE80] text-black font-black px-1.5 py-0.5 border border-black text-[10px] flex items-center space-x-1">
                      <Check size={12} strokeWidth={3} />
                      <span>DOĞRU</span>
                    </span>
                  ) : q.state === 'wrong' ? (
                    <span className="bg-[#FF5588] text-white font-black px-1.5 py-0.5 border border-black text-[10px] flex items-center space-x-1">
                      <XIcon size={12} strokeWidth={3} />
                      <span>YANLIŞ</span>
                    </span>
                  ) : (
                    <span className="bg-[#00F0FF] text-black font-black px-1.5 py-0.5 border border-black text-[10px] flex items-center space-x-1">
                      <HelpCircle size={12} strokeWidth={3} />
                      <span>PAS</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-white hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-black font-black uppercase text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all"
            >
              KAPAT
            </button>
            <button
              onClick={startGame}
              className="flex-1 py-3 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none text-black font-black uppercase text-xs border-3 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center space-x-1.5 transition-all"
            >
              <RotateCcw size={14} strokeWidth={2.5} />
              <span>TEKRAR OYNA</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
