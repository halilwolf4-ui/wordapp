import React, { useState, useEffect } from 'react';
import { Word } from '../types';
import { sound } from '../services/audio';
import { fireCelebration } from '../components/Confetti';
import { Zap, Clock, Award, RotateCcw, ArrowLeft } from 'lucide-react';

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
  const [isNewRecord, setIsNewRecord] = useState(false);

  // Pick new question
  const nextQuestion = () => {
    if (allWords.length === 0) return;
    const target = allWords[Math.floor(Math.random() * allWords.length)];
    const correctTr = target.tr.split(',')[0].trim();
    const opts = [correctTr];

    while (opts.length < 4 && allWords.length > 4) {
      const rand = allWords[Math.floor(Math.random() * allWords.length)];
      const randTr = rand.tr.split(',')[0].trim();
      if (!opts.includes(randTr) && randTr !== correctTr) {
        opts.push(randTr);
      }
    }
    opts.sort(() => Math.random() - 0.5);

    setCurrentWord(target);
    setOptions(opts);
  };

  // Start game
  const startGame = () => {
    setScore(0);
    setCombo(0);
    setTimeLeft(60);
    setIsNewRecord(false);
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
  }, [gameState, score]);

  const endGame = async () => {
    setGameState('gameover');
    sound.playLevelUp();

    if (score > highScore) {
      setIsNewRecord(true);
      await onUpdateHighScore(score);
      fireCelebration();
    }
  };

  const handleSelectOption = (option: string) => {
    if (!currentWord || gameState !== 'playing') return;

    const correctTr = currentWord.tr.split(',')[0].trim();
    const isCorrect = option.trim().toLowerCase() === correctTr.toLowerCase();

    if (isCorrect) {
      const nextCombo = combo + 1;
      const nextScore = score + 1;
      setScore(nextScore);
      setCombo(nextCombo);
      sound.playCorrect(nextCombo);
    } else {
      setCombo(0);
      sound.playWrong();
    }

    nextQuestion();
  };

  return (
    <div className="space-y-6 pb-24 pt-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="text-sm font-extrabold text-amber-400 flex items-center space-x-1">
          <Zap size={16} className="fill-amber-400" />
          <span>60 Saniye Hızlı Tur</span>
        </span>
        <div className="w-8" />
      </div>

      {/* READY SCREEN */}
      {gameState === 'ready' && (
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-6 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <Zap size={40} className="fill-amber-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Reflekslerini Sına!</h2>
            <p className="text-sm text-slate-400">
              60 saniye içinde bilebildiğin kadar çok kelime bil. Yanlışlar tekrar havuzunu etkilemez!
            </p>
          </div>

          <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 inline-block w-full">
            <span className="text-xs uppercase font-bold text-slate-400 block">Mevcut Rekor</span>
            <span className="text-3xl font-black text-amber-400">{highScore} doğru</span>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] text-slate-950 font-black text-lg rounded-2xl shadow-xl shadow-amber-950/50"
          >
            Hemen Başla (60s)
          </button>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === 'playing' && currentWord && (
        <div className="space-y-5">
          {/* Top Indicators */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center space-x-1">
                <Clock size={16} className="text-amber-400" />
                <span>Kalan Süre</span>
              </span>
              <span className={`text-2xl font-black font-mono ${timeLeft <= 10 ? 'text-rose-500 animate-ping' : 'text-white'}`}>
                {timeLeft}s
              </span>
            </div>

            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-3 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center space-x-1">
                <Award size={16} className="text-indigo-400" />
                <span>Doğru</span>
              </span>
              <span className="text-2xl font-black text-indigo-400 font-mono">
                {score}
              </span>
            </div>
          </div>

          {/* Flash Word Card */}
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-6 text-center space-y-6 shadow-2xl">
            <div className="py-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                İngilizce
              </span>
              <h2 className="text-4xl font-black text-white tracking-tight">
                {currentWord.en}
              </h2>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {options.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectOption(opt)}
                  className="w-full p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-lg text-left transition-all active:scale-95"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER SCREEN */}
      {gameState === 'gameover' && (
        <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-3xl p-6 text-center space-y-6 shadow-2xl">
          <div className="w-20 h-20 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mx-auto">
            <Award size={40} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-white">Süre Doldu!</h2>
            {isNewRecord ? (
              <p className="text-emerald-400 font-bold text-base animate-bounce">
                🎉 Yeni Rekor Kırdın!
              </p>
            ) : (
              <p className="text-slate-400 text-sm">
                Güzel deneme! Reflekslerin gittikçe hızlanıyor.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Bu Tur Skorun</span>
              <span className="text-3xl font-black text-white">{score}</span>
            </div>
            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">En İyi Skorun</span>
              <span className="text-3xl font-black text-amber-400">{Math.max(score, highScore)}</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              onClick={startGame}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] text-slate-950 font-black text-base rounded-2xl shadow-xl flex items-center justify-center space-x-2"
            >
              <RotateCcw size={18} />
              <span>Tekrar Oyna</span>
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-2xl"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
