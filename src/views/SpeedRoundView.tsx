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
          className="p-2.5 bg-white border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center space-x-1"
        >
          <ArrowLeft size={18} strokeWidth={2.5} />
          <span>GERİ</span>
        </button>
        <span className="text-xs font-black uppercase tracking-wider bg-[#FFE600] text-black px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center space-x-1.5">
          <Zap size={16} className="fill-black text-black" />
          <span>60S HIZLI TUR</span>
        </span>
        <div className="w-10" />
      </div>

      {/* READY SCREEN */}
      {gameState === 'ready' && (
        <div className="bg-white border-3 border-black p-6 text-center space-y-6 shadow-[5px_5px_0px_0px_#000]">
          <div className="w-20 h-20 bg-[#FFE600] border-3 border-black text-black flex items-center justify-center mx-auto shadow-[4px_4px_0px_0px_#000]">
            <Zap size={44} className="fill-black" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
              REFLEKSLERİNİ SINA!
            </h2>
            <p className="text-xs sm:text-sm font-bold text-zinc-700 leading-relaxed max-w-xs mx-auto border-y-2 border-dashed border-black py-2">
              60 saniyede en çok kelimeyi bil. Doğru cevaplar <span className="bg-[#4ADE80] text-black px-1 border border-black font-black">+1 sn</span> kazandırır, yanlışlar <span className="bg-[#FF5588] text-white px-1 border border-black font-black">-1 sn</span> götürür!
            </p>
          </div>

          <div className="bg-[#00F0FF] p-4 border-3 border-black inline-block w-full shadow-[3px_3px_0px_0px_#000]">
            <span className="text-xs uppercase font-black text-black block tracking-wider">MEVCUT REKOR</span>
            <span className="text-4xl font-black text-black font-mono">{highScore} DOĞRU</span>
          </div>

          <button
            onClick={startGame}
            className="w-full py-4 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black text-base uppercase tracking-wider border-3 border-black shadow-[4px_4px_0px_0px_#000] transition-all"
          >
            ⚡ HEMEN BAŞLA (60S)
          </button>
        </div>
      )}

      {/* PLAYING SCREEN */}
      {gameState === 'playing' && currentWord && (
        <div className="space-y-4">
          {/* Top Indicators */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`border-3 border-black p-3.5 flex items-center justify-between relative overflow-hidden shadow-[3px_3px_0px_0px_#000] transition-colors ${
              timeLeft <= 10 ? 'bg-[#FF5588] text-white animate-pulse' : 'bg-[#FFE600] text-black'
            }`}>
              <span className="text-xs font-black uppercase flex items-center space-x-1.5">
                <Clock size={16} strokeWidth={2.5} />
                <span>SÜRE</span>
              </span>
              <div className="flex items-center space-x-1.5">
                {timeDelta && (
                  <span
                    key={timeDelta.id}
                    className={`text-xs font-black px-1 border border-black ${
                      timeDelta.val > 0 ? 'bg-[#4ADE80] text-black' : 'bg-black text-white'
                    }`}
                  >
                    {timeDelta.val > 0 ? '+1s' : '-1s'}
                  </span>
                )}
                <span className="text-2xl font-black font-mono">
                  {timeLeft}s
                </span>
              </div>
            </div>

            <div className="bg-[#00F0FF] border-3 border-black p-3.5 flex items-center justify-between shadow-[3px_3px_0px_0px_#000]">
              <span className="text-xs text-black font-black uppercase flex items-center space-x-1.5">
                <Award size={16} strokeWidth={2.5} />
                <span>DOĞRU</span>
              </span>
              <span className="text-2xl font-black text-black font-mono">
                {score}
              </span>
            </div>
          </div>

          {/* Flash Word Card */}
          <div className="bg-white border-3 border-black p-5 sm:p-6 text-center space-y-5 shadow-[5px_5px_0px_0px_#000]">
            <div className="py-2 border-b-3 border-black pb-4">
              <span className="text-[11px] font-black text-black bg-[#FFE600] px-2 py-0.5 border border-black uppercase tracking-wider inline-block mb-2 shadow-[1px_1px_0px_0px_#000]">
                İNGİLİZCE KELİME
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-black tracking-tight uppercase">
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
        <div className="bg-white border-3 border-black p-6 text-center space-y-6 shadow-[5px_5px_0px_0px_#000]">
          <div className="w-20 h-20 bg-[#FFE600] border-3 border-black text-black flex items-center justify-center mx-auto shadow-[4px_4px_0px_0px_#000]">
            <Award size={44} strokeWidth={2.5} />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-3xl font-black uppercase text-black">SÜRE DOLDU!</h2>
            {isNewRecord ? (
              <p className="bg-[#4ADE80] text-black font-black uppercase text-xs sm:text-sm py-1.5 px-3 border-2 border-black inline-block shadow-[2px_2px_0px_0px_#000]">
                🎉 YENİ REKOR KIRDIN!
              </p>
            ) : (
              <p className="text-zinc-600 font-bold text-xs uppercase">
                Güzel tur! Reflekslerin her gün daha da gelişiyor.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#FDFBF7] p-4 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[11px] font-black uppercase text-zinc-600 block mb-1">BU TUR SKORUN</span>
              <span className="text-4xl font-black text-black font-mono">{score}</span>
            </div>
            <div className="bg-[#FFE600] p-4 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[11px] font-black uppercase text-black block mb-1">EN İYİ SKORUN</span>
              <span className="text-4xl font-black text-black font-mono">{Math.max(score, highScore)}</span>
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <button
              onClick={startGame}
              className="w-full py-4 bg-[#FFE600] hover:bg-[#FFD600] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-black font-black text-sm uppercase tracking-wider border-3 border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center space-x-2 transition-all"
            >
              <RotateCcw size={18} strokeWidth={2.5} />
              <span>TEKRAR OYNA</span>
            </button>
            <button
              onClick={onClose}
              className="w-full py-3 bg-white hover:bg-zinc-100 active:translate-x-[1px] active:translate-y-[1px] active:shadow-none border-2 border-black text-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_#000] transition-all"
            >
              KAPAT
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
