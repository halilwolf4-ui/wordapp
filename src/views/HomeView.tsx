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
  onStartReview: () => void;
  onStartLearn: () => void;
  onStartSpeedRound: () => void;
  onStartPassaparola: () => void;
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
  onStartReview,
  onStartLearn,
  onStartSpeedRound,
  onStartPassaparola
}) => {
  // Goal ring percentage
  const goalPercent = Math.min(100, Math.round((todayCorrect / Math.max(1, dailyGoal)) * 100));
  // Circle geometry for 72px diameter
  const circumference = 176;
  const strokeDashoffset = circumference - (circumference * goalPercent) / 100;

  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 select-none pb-2">
      {/* 1. HERO: Compact Daily Goal & Progress */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-slate-800/80 to-slate-900/90 border border-slate-700/60 rounded-2xl p-3.5 shadow-lg backdrop-blur-md flex items-center justify-between">
        {/* Ambient Glows */}
        <div className="absolute -top-6 -right-6 w-24 h-24 bg-indigo-500/15 rounded-full blur-xl pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-purple-500/15 rounded-full blur-xl pointer-events-none" />

        {/* Left Side: Stats & Motivation */}
        <div className="space-y-1 relative z-10 flex-1 min-w-0 pr-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
              Bugünkü Hedef
            </span>
            <span className="text-slate-600">•</span>
            <span className={`text-[11px] font-bold ${goalPercent >= 100 ? 'text-emerald-400' : 'text-slate-300'}`}>
              %{goalPercent}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-black text-white truncate">
            {todayCorrect >= dailyGoal ? '🎉 Hedefe Ulaşıldı!' : 'Öğrenmeye Devam Et'}
          </h2>

          <div className="flex items-center space-x-2 pt-0.5">
            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[10px] font-bold">
              <Flame size={12} className="text-amber-400 fill-amber-400" />
              <span>{profile.streak} Gün Seri</span>
            </div>
            {(profile.streakFreezes !== undefined && profile.streakFreezes > 0) && (
              <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/25 text-sky-300 text-[10px] font-bold" title={`${profile.streakFreezes} Seri Dondurma Hakkı`}>
                <span>🧊</span>
                <span>{profile.streakFreezes} Hak</span>
              </div>
            )}
            {customWordsCount > 0 && (
              <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-bold">
                <Sparkles size={11} />
                <span>{customWordsCount} Özel</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Circular Gauge */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg className="w-[72px] h-[72px] transform -rotate-90">
            <circle
              cx="36"
              cy="36"
              r="28"
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              className="text-slate-800"
            />
            <circle
              cx="36"
              cy="36"
              r="28"
              stroke="currentColor"
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-indigo-500 transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-black text-white leading-tight">
              {todayCorrect}
            </span>
            <span className="text-[9px] font-bold text-slate-400">
              /{dailyGoal}
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN ACTIONS: Günlük Tekrar & Yeni Kelimeler */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Tekrar Card */}
        <button
          onClick={onStartReview}
          disabled={dueCount === 0}
          className={`flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all active:scale-[0.97] ${
            dueCount > 0
              ? 'bg-gradient-to-br from-indigo-900/40 via-slate-900/90 to-slate-900/90 border-indigo-500/40 hover:border-indigo-400 shadow-md shadow-indigo-950/40'
              : 'bg-slate-900/40 border-slate-800/60 opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Repeat size={18} />
            </div>
            <span className={`px-2 py-0.5 text-[11px] font-black rounded-full ${
              dueCount > 0 ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400'
            }`}>
              {dueCount}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Günlük Tekrar</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {dueCount > 0 ? `${dueCount} kelime bekliyor` : 'Tekrarlar bitti'}
            </p>
          </div>
        </button>

        {/* Yeni Kelimeler Card */}
        <button
          onClick={onStartLearn}
          disabled={newCount === 0}
          className={`flex flex-col justify-between p-3.5 rounded-2xl border text-left transition-all active:scale-[0.97] ${
            newCount > 0
              ? 'bg-gradient-to-br from-emerald-900/40 via-slate-900/90 to-slate-900/90 border-emerald-500/40 hover:border-emerald-400 shadow-md shadow-emerald-950/40'
              : 'bg-slate-900/40 border-slate-800/60 opacity-60 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
            <span className={`px-2 py-0.5 text-[11px] font-black rounded-full ${
              newCount > 0 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-800 text-slate-400'
            }`}>
              {newCount}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Yeni Kelimeler</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {newCount > 0 ? `${newCount} yeni kelime` : 'Hepsi öğrenildi'}
            </p>
          </div>
        </button>
      </div>

      {/* 3. MINI GAMES: Passaparola & Hızlı Tur */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Passaparola Game */}
        <button
          onClick={onStartPassaparola}
          className="group relative overflow-hidden bg-gradient-to-br from-purple-950/50 via-slate-900/90 to-pink-950/30 border border-purple-500/40 hover:border-purple-400/80 rounded-2xl p-3 text-left transition-all active:scale-[0.97] shadow-md shadow-purple-950/30"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black text-xs shadow">
              P
            </div>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              120s
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-white">Passaparola</h4>
              <p className="text-[10px] text-purple-200/70 mt-0.5">Kelime Çarkı</p>
            </div>
            <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <Play size={10} className="fill-current ml-0.5" />
            </div>
          </div>
        </button>

        {/* 60s Hızlı Tur Game */}
        <button
          onClick={onStartSpeedRound}
          className="group relative overflow-hidden bg-gradient-to-br from-amber-950/50 via-slate-900/90 to-orange-950/30 border border-amber-500/40 hover:border-amber-400/80 rounded-2xl p-3 text-left transition-all active:scale-[0.97] shadow-md shadow-amber-950/30"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-slate-950 shadow">
              <Zap size={14} className="fill-slate-950" />
            </div>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              60s Tur
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-white">Hızlı Tur</h4>
              <p className="text-[10px] text-amber-200/70 mt-0.5">
                Rekor: <span className="font-bold text-white">{profile.highScoreSpeedRound}</span>
              </p>
            </div>
            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
              <Play size={10} className="fill-current ml-0.5" />
            </div>
          </div>
        </button>
      </div>

      {/* 4. OVERALL PROGRESS BAR & STATS CHIPS */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 space-y-2 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-300 text-[11px]">Genel İlerleme</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {learningCount + masteredCount} / {totalWordsCount}
          </span>
        </div>

        {/* Multi-segment sleek progress bar */}
        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${(masteredCount / Math.max(1, totalWordsCount)) * 100}%` }}
            title="Öğrenildi"
          />
          <div
            className="bg-indigo-500 h-full transition-all duration-500"
            style={{ width: `${(learningCount / Math.max(1, totalWordsCount)) * 100}%` }}
            title="Öğrenilmekte"
          />
        </div>

        {/* Inline Chips */}
        <div className="grid grid-cols-3 gap-1.5 pt-0.5 text-center text-[10px]">
          <div className="bg-slate-800/60 rounded-xl py-1.5 px-1 border border-slate-700/50 flex items-center justify-center space-x-1 text-emerald-400 font-bold">
            <CheckCircle2 size={12} />
            <span>{masteredCount} Master</span>
          </div>
          <div className="bg-slate-800/60 rounded-xl py-1.5 px-1 border border-slate-700/50 flex items-center justify-center space-x-1 text-indigo-400 font-bold">
            <Repeat size={12} />
            <span>{learningCount} Aktif</span>
          </div>
          <div className="bg-slate-800/60 rounded-xl py-1.5 px-1 border border-slate-700/50 flex items-center justify-center space-x-1 text-slate-300 font-bold">
            <BookOpen size={12} />
            <span>{Math.max(0, totalWordsCount - learningCount - masteredCount)} Yeni</span>
          </div>
        </div>
      </div>
    </div>
  );
};
