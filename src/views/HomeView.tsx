import React from 'react';
import { Play, Sparkles, Repeat, CheckCircle2, BookOpen, Flame, Zap } from 'lucide-react';
import { UserProfile, UserSettings } from '../types';

interface Props {
  todayCorrect: number;
  dailyGoal: number;
  dueCount: number;
  newCount: number;
  learningCount: number;
  masteredCount: number;
  totalWordsCount: number;
  customWordsCount: number;
  profile: UserProfile;
  settings: UserSettings;
  isLearnCompletedToday?: boolean;
  isReviewCompletedToday?: boolean;
  onStartReview: () => void;
  onStartLearn: () => void;
  onStartSpeedRound: () => void;
  onStartPassaparola: () => void;
  onStartClozeTest: () => void;
}

export const HomeView: React.FC<Props> = ({
  todayCorrect,
  dailyGoal,
  dueCount,
  newCount,
  learningCount,
  masteredCount,
  totalWordsCount,
  customWordsCount,
  profile,
  isLearnCompletedToday = false,
  isReviewCompletedToday = false,
  onStartReview,
  onStartLearn,
  onStartSpeedRound,
  onStartPassaparola,
  onStartClozeTest
}) => {
  // Goal ring percentage
  const goalPercent = Math.min(100, Math.round((todayCorrect / Math.max(1, dailyGoal)) * 100));
  // Circle geometry for 72px diameter
  const circumference = 188;
  const strokeDashoffset = circumference - (circumference * goalPercent) / 100;

  return (
    <div className="flex flex-col gap-3.5 select-none pb-2 text-black">
      {/* 1. HERO: Neo-Brutalist Daily Goal */}
      <div className="bg-white border-[3px] border-black p-4 shadow-[5px_5px_0px_0px_#000] flex items-center justify-between">
        {/* Left Side: Stats & Motivation */}
        <div className="space-y-2 flex-1 min-w-0 pr-3">
          <div className="flex items-center space-x-2">
            <span className="bg-[#FFE600] border-2 border-black px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_0px_#000]">
              BUGÜNKÜ HEDEF
            </span>
            <span className="text-black font-black text-xs">•</span>
            <span className="text-xs font-black bg-black text-white px-2 py-0.5 border border-black">
              %{goalPercent}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-black text-black uppercase tracking-tight truncate">
            {todayCorrect >= dailyGoal ? '⚡ HEDEF TAMAMLANDI!' : 'DEVAM ET, HIZ KESME!'}
          </h2>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-[#FF69B4] border-2 border-black text-black text-[11px] font-black shadow-[1.5px_1.5px_0px_0px_#000]">
              <Flame size={13} className="text-[#FF5722] fill-[#FF5722]" />
              <span>{profile.streak} GÜN SERİ</span>
            </div>
            {profile.streakFreezes !== undefined && profile.streakFreezes > 0 && (
              <div
                className="inline-flex items-center space-x-1 px-2 py-1 bg-[#00F0FF] border-2 border-black text-black text-[11px] font-black shadow-[1.5px_1.5px_0px_0px_#000]"
                title={`${profile.streakFreezes} Seri Dondurma Hakkı`}
              >
                <span>🧊</span>
                <span>{profile.streakFreezes} HAK</span>
              </div>
            )}
            {customWordsCount > 0 && (
              <div className="inline-flex items-center space-x-1 px-2 py-1 bg-[#C084FC] border-2 border-black text-black text-[11px] font-black shadow-[1.5px_1.5px_0px_0px_#000]">
                <Sparkles size={12} strokeWidth={2.5} />
                <span>{customWordsCount} ÖZEL</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Brutalist Circular Gauge */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg className="w-[72px] h-[72px] transform -rotate-90">
            <circle
              cx="36"
              cy="36"
              r="30"
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-[#E5E0D8] dark:text-zinc-800"
            />
            <circle
              cx="36"
              cy="36"
              r="30"
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
              className="circular-progress-stroke transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-black text-black dark:text-white leading-tight">
              {todayCorrect}
            </span>
            <span className="text-[10px] font-black text-zinc-600 dark:text-zinc-400">
              /{dailyGoal}
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN ACTIONS: Günlük Tekrar & Yeni Kelimeler */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Tekrar Card */}
        <button
          onClick={onStartReview}
          disabled={!isReviewCompletedToday && dueCount === 0}
          className={`flex flex-col justify-between p-4 border-[3px] border-black text-left transition-all active:translate-x-[2px] active:translate-y-[2px] ${
            isReviewCompletedToday
              ? 'bg-[#DDD6FE] shadow-[4px_4px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] cursor-pointer'
              : dueCount > 0
              ? 'bg-[#C084FC] shadow-[5px_5px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] cursor-pointer'
              : 'bg-zinc-200 opacity-60 cursor-not-allowed shadow-[2px_2px_0px_0px_#000]'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="w-9 h-9 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black flex items-center justify-center font-black">
              {isReviewCompletedToday ? <CheckCircle2 size={19} strokeWidth={2.5} /> : <Repeat size={19} strokeWidth={2.5} />}
            </div>
            <span className="px-2.5 py-0.5 text-xs font-black bg-black text-[#FFE600] border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] uppercase">
              {isReviewCompletedToday ? '✓ TAMAM' : `${dueCount}`}
            </span>
          </div>
          <div>
            <h3 className="font-black text-sm uppercase text-black tracking-tight">GÜNLÜK TEKRAR</h3>
            <p className="text-[11px] font-bold text-zinc-900 mt-0.5 truncate">
              {isReviewCompletedToday
                ? 'ÖZETİ GÖRÜNTÜLE'
                : dueCount > 0
                ? `${dueCount} kelime hazır`
                : 'Tekrarlar bitti'}
            </p>
          </div>
        </button>

        {/* Yeni Kelimeler Card */}
        <button
          onClick={onStartLearn}
          disabled={!isLearnCompletedToday && newCount === 0}
          className={`flex flex-col justify-between p-4 border-[3px] border-black text-left transition-all active:translate-x-[2px] active:translate-y-[2px] ${
            isLearnCompletedToday
              ? 'bg-[#BBF7D0] shadow-[4px_4px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] cursor-pointer'
              : newCount > 0
              ? 'bg-[#86EFAC] shadow-[5px_5px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] cursor-pointer'
              : 'bg-zinc-200 opacity-60 cursor-not-allowed shadow-[2px_2px_0px_0px_#000]'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="w-9 h-9 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black flex items-center justify-center font-black">
              {isLearnCompletedToday ? <CheckCircle2 size={19} strokeWidth={2.5} /> : <BookOpen size={19} strokeWidth={2.5} />}
            </div>
            <span className="px-2.5 py-0.5 text-xs font-black bg-black text-[#86EFAC] border-2 border-black shadow-[1.5px_1.5px_0px_0px_#000] uppercase">
              {isLearnCompletedToday ? '✓ TAMAM' : `${newCount}`}
            </span>
          </div>
          <div>
            <h3 className="font-black text-sm uppercase text-black tracking-tight">YENİ KELİMELER</h3>
            <p className="text-[11px] font-bold text-zinc-900 mt-0.5 truncate">
              {isLearnCompletedToday
                ? 'ÖZETİ GÖRÜNTÜLE'
                : newCount > 0
                ? `${newCount} yeni kelime`
                : 'Hepsi öğrenildi'}
            </p>
          </div>
        </button>
      </div>

      {/* 3. MINI GAMES: Passaparola & Hızlı Tur */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Passaparola Game */}
        <button
          onClick={onStartPassaparola}
          className="bg-[#00F0FF] border-[3px] border-black p-3.5 text-left transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black font-black text-xs">
              P
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 bg-black text-white border border-black uppercase tracking-wider">
              120s
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs sm:text-sm font-black uppercase text-black tracking-tight">PASSAPAROLA</h4>
              <p className="text-[10px] font-bold text-zinc-900 mt-0.5">Kelime Çarkı</p>
            </div>
            <div className="w-7 h-7 bg-white border-2 border-black text-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] group-hover:bg-[#FFE600] transition-colors">
              <Play size={11} className="fill-black ml-0.5" />
            </div>
          </div>
        </button>

        {/* 60s Hızlı Tur Game */}
        <button
          onClick={onStartSpeedRound}
          className="bg-[#FB923C] border-[3px] border-black p-3.5 text-left transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black font-black">
              <Zap size={16} className="fill-black text-black" />
            </div>
            <span className="text-[10px] font-black px-2 py-0.5 bg-black text-[#FFE600] border border-black uppercase tracking-wider">
              60s TUR
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs sm:text-sm font-black uppercase text-black tracking-tight">HIZLI TUR</h4>
              <p className="text-[10px] font-bold text-zinc-900 mt-0.5">
                Rekor: <span className="font-black text-black bg-white px-1 border border-black">{profile.highScoreSpeedRound}</span>
              </p>
            </div>
            <div className="w-7 h-7 bg-white border-2 border-black text-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] group-hover:bg-[#FFE600] transition-colors">
              <Play size={11} className="fill-black ml-0.5" />
            </div>
          </div>
        </button>
      </div>

      {/* Cloze Test Card */}
      <button
        onClick={onStartClozeTest}
        className="bg-[#FFE600] border-[3px] border-black p-3.5 text-left transition-all active:translate-x-[2px] active:translate-y-[2px] shadow-[4px_4px_0px_0px_#000] active:shadow-[1px_1px_0px_0px_#000] group flex items-center justify-between"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center text-black shrink-0">
            <Sparkles size={18} strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="text-xs sm:text-sm font-black uppercase text-black tracking-tight">CLOZE TEST</h4>
              <span className="text-[10px] font-black px-2 py-0.5 bg-black text-white uppercase border border-black tracking-wider">
                BOŞLUK DOLDURMA
              </span>
            </div>
            <p className="text-[11px] font-bold text-zinc-900 mt-0.5 truncate">
              Cümle İçinde Kelime & Edatlar (Prepositions)
            </p>
          </div>
        </div>
        <div className="w-7 h-7 bg-white border-2 border-black text-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] shrink-0 ml-2 group-hover:bg-black group-hover:text-white transition-colors">
          <Play size={11} className="fill-current ml-0.5" />
        </div>
      </button>

      {/* 4. OVERALL PROGRESS BAR & STATS CHIPS */}
      <div className="bg-white border-[3px] border-black p-4 space-y-3.5 shadow-[5px_5px_0px_0px_#000]">
        <div className="flex items-center justify-between text-xs">
          <span className="font-black text-black text-xs uppercase tracking-wider">GENEL İLERLEME</span>
          <span className="text-black font-black font-mono text-xs bg-[#FFE600] border border-black px-2 py-0.5 shadow-[1px_1px_0px_0px_#000]">
            {learningCount + masteredCount} / {totalWordsCount}
          </span>
        </div>

        {/* Multi-segment brutalist progress bar */}
        <div className="h-4 w-full bg-zinc-100 border-2 border-black overflow-hidden flex">
          <div
            className="bg-[#4ADE80] h-full border-r-2 border-black transition-all duration-500"
            style={{ width: `${(masteredCount / Math.max(1, totalWordsCount)) * 100}%` }}
            title="Öğrenildi"
          />
          <div
            className="bg-[#00F0FF] h-full border-r-2 border-black transition-all duration-500"
            style={{ width: `${(learningCount / Math.max(1, totalWordsCount)) * 100}%` }}
            title="Öğrenilmekte"
          />
        </div>

        {/* Inline Chips */}
        <div className="grid grid-cols-3 gap-2 pt-0.5 text-center text-[11px]">
          <div className="bg-[#BBF7D0] py-2 px-1 border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center space-x-1.5 text-black font-black">
            <CheckCircle2 size={13} strokeWidth={2.5} />
            <span>{masteredCount} MASTER</span>
          </div>
          <div className="bg-[#BAE6FD] py-2 px-1 border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center space-x-1.5 text-black font-black">
            <Repeat size={13} strokeWidth={2.5} />
            <span>{learningCount} AKTİF</span>
          </div>
          <div className="bg-[#FEF08A] py-2 px-1 border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center space-x-1.5 text-black font-black">
            <BookOpen size={13} strokeWidth={2.5} />
            <span>{Math.max(0, totalWordsCount - learningCount - masteredCount)} YENİ</span>
          </div>
        </div>
      </div>
    </div>
  );
};
