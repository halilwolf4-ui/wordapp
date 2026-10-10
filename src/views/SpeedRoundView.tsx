import React, { useState, useEffect, useRef } from 'react';
import { Word } from '../types';
import { sound } from '../services/audio';
import { fireCelebration } from '../components/Confetti';
import { ArrowLeft, Clock, Award, Zap, RotateCcw } from 'lucide-react';
import { QuizOptionButton } from '../components/QuizOptionButton';

interface Props {
  allWords: Word[];
  highScore: number;
  onUpdateHighScore: (score: number) => Promise<void>;
  onClose: () => void;
}

export const SpeedRoundView: React.FC<Props> = ({
  allWords,
  highScore,
  onUpdateHighScore,
  onClose
}) => {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'gameover'>('ready');
  const [timeLeft, setTimeLeft] = useState(60);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ option: string; isCorrect: boolean } | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [timeDelta, setTimeDelta] = useState<{ val: number; id: number } | null>(null);

  const nextQuestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pick Next Question
  const nextQuestion = () => {
    if (allWords.length === 0) return;
    setSelectedOption(null);
    setFeedback(null);

    const randWord = allWords[Math.floor(Math.random() * allWords.length)];
    setCurrentWord(randWord);

    const correctTr = randWord.tr.split(',')[0].trim();
    const opts = [correctTr];

    let safety = 0;
    while (opts.length < 4 && allWords.length > 4 && safety < 100) {
      safety++;
      const randOther = allWords[Math.floor(Math.random() * allWords.length)];
      const randTr = randOther.tr.split(',')[0].trim();
      if (!opts.includes(randTr) && randTr !== correctTr) {
        opts.push(randTr);
      }
    }

    opts.sort(() => Math.random() - 0.5);
    setOptions(opts);
  };

  const startGame = () => {
    if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current);
    setScore(0);
    setCombo(0);
    setTimeLeft(60);
    setIsNewRecord(false);
    setSelectedOption(null);
    setFeedback(null);
    setGameState('playing');
    nextQuestion();
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
  }, [gameState, score, highScore]);

  const endGame = async () => {
    if (nextQuestionTimerRef.current) clearTimeout(nextQuestionTimerRef.current);
    setGameState('gameover');
    sound.playLevelUp();

    if (score > highScore) {
      setIsNewRecord(true);
      await onUpdateHighScore(score);
      fireCelebration();
    }
  };

  const handleSelectOption = (option: string) => {
    if (!currentWord || gameState !== 'playing' || selectedOption !== null) return;

    const correctTr = currentWord.tr.split(',')[0].trim();
    const isCorrect = option.trim().toLowerCase() === correctTr.toLowerCase();

    setSelectedOption(option);
    setFeedback({ option, isCorrect });

    if (isCorrect) {
      const nextCombo = combo + 1;
      const nextScore = score + 1;
      setScore(nextScore);
      setCombo(nextCombo);
      sound.playCorrect(nextCombo);

      // +1 second bonus
      setTimeDelta({ val: 1, id: Date.now() });
      setTimeLeft((prev) => Math.min(prev + 1, 999));
    } else {
      setCombo(0);
      sound.playWrong();

      // -1 second penalty
      setTimeDelta({ val: -1, id: Date.now() });
      setTimeLeft((prev) => {
        const next = Math.max(prev - 1, 0);
        if (next === 0) {
          endGame();
        }
        return next;
      });
    }

    // Advance quickly with satisfying transition
    nextQuestionTimerRef.current = setTimeout(() => {
      nextQuestion();
    }, 380);
  };

  return (
    <div className="space-y-5 pb-24 pt-2 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-bold text-amber-400 flex items-center space-x-1.5">
          <Zap size={16} className="fill-amber-400 text-amber-400" />
          <span>60 Saniye Hızlı Tur</span>
        </span>
        <div className="w-8" />
      </div>

      {/* READY SCREEN */}
      {gameState === 'ready' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-sm">
          <div className="w-18 h-18 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto p-4">
            <Zap size={36} className="fill-amber-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Reflekslerini Sına!</h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs mx-auto">
              60 saniyede en çok kelimeyi bil. Doğru cevaplar <span className="text-emerald-400 font-bold">+1 sn</span> kazandırır, yanlışlar <span className="text-rose-400 font-bold">-1 sn</span> götürür!
            </p>
          </div>

          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800/80 inline-block w-full">
            <span className="text-xs uppercase font-semibold text-slate-400 block">Mevcut Rekor</span>
            <span className="text-3xl font-extrabold text-amber-400">{highScore} doğru</span>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-base rounded-2xl shadow-sm transition-all"
          >
            Hemen Başla (60s)
          </button>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === 'playing' && currentWord && (
        <div className="space-y-4">
          {/* Top Indicators */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between relative overflow-hidden shadow-sm">
              <span className="text-xs text-slate-400 font-medium flex items-center space-x-1.5">
                <Clock size={16} className="text-amber-400" />
                <span>Kalan Süre</span>
              </span>
              <div className="flex items-center space-x-1.5">
                {timeDelta && (
                  <span
                    key={timeDelta.id}
                    className={`text-xs font-bold animate-bounce ${
                      timeDelta.val > 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {timeDelta.val > 0 ? '+1s' : '-1s'}
                  </span>
                )}
                <span className={`text-2xl font-bold font-mono ${timeLeft <= 10 ? 'text-rose-400 animate-pulse' : 'text-white'}`}>
                  {timeLeft}s
                </span>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
              <span className="text-xs text-slate-400 font-medium flex items-center space-x-1.5">
                <Award size={16} className="text-indigo-400" />
                <span>Doğru</span>
              </span>
              <span className="text-2xl font-bold text-indigo-400 font-mono">
                {score}
              </span>
            </div>
          </div>

          {/* Flash Word Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 text-center space-y-5 shadow-sm">
            <div className="py-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                İngilizce
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {currentWord.en}
              </h2>
            </div>

            {/* Options with QuizOptionButton */}
            <div className="space-y-2.5">
              {options.map((opt, idx) => {
                const correctTr = currentWord.tr.split(',')[0].trim();
                const isThisCorrect = opt.trim().toLowerCase() === correctTr.toLowerCase();
                const isSelected = selectedOption === opt;

                return (
                  <QuizOptionButton
                    key={idx}
                    index={idx}
                    text={opt}
                    isSelected={isSelected}
                    isCorrect={isThisCorrect}
                    hasFeedback={feedback !== null}
                    disabled={selectedOption !== null}
                    onSelect={() => handleSelectOption(opt)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === 'gameover' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-sm">
          <div className="w-18 h-18 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto p-4">
            <Award size={36} />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-white">Süre Doldu!</h2>
            {isNewRecord ? (
              <p className="text-emerald-400 font-bold text-sm">
                🎉 Yeni Rekor Kırdın!
              </p>
            ) : (
              <p className="text-slate-400 text-xs">
                Güzel tur! Reflekslerin her gün daha da gelişiyor.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Bu Tur Skorun</span>
              <span className="text-3xl font-extrabold text-white">{score}</span>
            </div>
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">En İyi Skorun</span>
              <span className="text-3xl font-extrabold text-amber-400">{Math.max(score, highScore)}</span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={startGame}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-base rounded-2xl shadow-sm flex items-center justify-center space-x-2 transition-all"
            >
              <RotateCcw size={18} />
              <span>Tekrar Oyna</span>
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-semibold rounded-2xl transition-all"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
