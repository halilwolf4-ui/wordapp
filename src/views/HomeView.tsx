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
  onStartPassaparola
}) => {
  // Goal ring percentage
  const goalPercent = Math.min(100, Math.round((todayCorrect / Math.max(1, dailyGoal)) * 100));
  // Circle geometry for 68px diameter
  const circumference = 176;
  const strokeDashoffset = circumference - (circumference * goalPercent) / 100;

  return (
    <div className="flex flex-col gap-3 select-none pb-2">
      {/* 1. HERO: Clean Daily Goal & Progress */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        {/* Left Side: Stats & Motivation */}
        <div className="space-y-1.5 flex-1 min-w-0 pr-3">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
              Bugünkü Hedef
            </span>
            <span className="text-slate-600">•</span>
            <span className={`text-[11px] font-bold ${goalPercent >= 100 ? 'text-emerald-400' : 'text-slate-300'}`}>
              %{goalPercent}
            </span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-white truncate">
            {todayCorrect >= dailyGoal ? '🎉 Hedef Tamamlandı!' : 'Öğrenmeye Devam Et'}
          </h2>

          <div className="flex items-center space-x-2 pt-0.5">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-850 border border-slate-800 text-amber-400 text-[11px] font-semibold">
              <Flame size={13} className="text-amber-500 fill-amber-500" />
              <span>{profile.streak} Gün Seri</span>
            </div>
            {profile.streakFreezes !== undefined && profile.streakFreezes > 0 && (
              <div
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-850 border border-slate-800 text-sky-400 text-[11px] font-semibold"
                title={`${profile.streakFreezes} Seri Dondurma Hakkı`}
              >
                <span>🧊</span>
                <span>{profile.streakFreezes} Hak</span>
              </div>
            )}
            {customWordsCount > 0 && (
              <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-slate-850 border border-slate-800 text-purple-300 text-[11px] font-semibold">
                <Sparkles size={12} />
                <span>{customWordsCount} Özel</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Circular Gauge */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg className="w-[68px] h-[68px] transform -rotate-90">
            <circle
              cx="34"
              cy="34"
              r="28"
              stroke="currentColor"
              strokeWidth="5"
              fill="transparent"
              className="text-slate-800"
            />
            <circle
              cx="34"
              cy="34"
              r="28"
              stroke="currentColor"
              strokeWidth="5"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-indigo-500 transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-base font-bold text-white leading-tight">
              {todayCorrect}
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              /{dailyGoal}
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN ACTIONS: Günlük Tekrar & Yeni Kelimeler */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tekrar Card */}
        <button
          onClick={onStartReview}
          disabled={!isReviewCompletedToday && dueCount === 0}
          className={`flex flex-col justify-between p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
            isReviewCompletedToday
              ? 'bg-slate-900 hover:bg-slate-850 border-indigo-500/40 shadow-sm cursor-pointer'
              : dueCount > 0
              ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-indigo-500/50 shadow-sm cursor-pointer'
              : 'bg-slate-900/50 border-slate-850 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              isReviewCompletedToday
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
            }`}>
              {isReviewCompletedToday ? <CheckCircle2 size={18} /> : <Repeat size={18} />}
            </div>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-lg ${
                isReviewCompletedToday
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : dueCount > 0
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isReviewCompletedToday ? '✓ Tamam' : dueCount}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Günlük Tekrar</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {isReviewCompletedToday
                ? 'Bugün bitti (Özeti Gör)'
                : dueCount > 0
                ? `${dueCount} kelime bekliyor`
                : 'Tekrarlar bitti'}
            </p>
          </div>
        </button>

        {/* Yeni Kelimeler Card */}
        <button
          onClick={onStartLearn}
          disabled={!isLearnCompletedToday && newCount === 0}
          className={`flex flex-col justify-between p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
            isLearnCompletedToday
              ? 'bg-slate-900 hover:bg-slate-850 border-emerald-500/40 shadow-sm cursor-pointer'
              : newCount > 0
              ? 'bg-slate-900 hover:bg-slate-850 border-slate-800 hover:border-emerald-500/50 shadow-sm cursor-pointer'
              : 'bg-slate-900/50 border-slate-850 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              {isLearnCompletedToday ? <CheckCircle2 size={18} /> : <BookOpen size={18} />}
            </div>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-lg ${
                isLearnCompletedToday
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : newCount > 0
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isLearnCompletedToday ? '✓ Tamam' : newCount}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Yeni Kelimeler</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              {isLearnCompletedToday
                ? 'Bugün bitti (Özeti Gör)'
                : newCount > 0
                ? `${newCount} yeni kelime`
                : 'Hepsi öğrenildi'}
            </p>
          </div>
        </button>
      </div>

      {/* 3. MINI GAMES: Passaparola & Hızlı Tur */}
      <div className="grid grid-cols-2 gap-3">
        {/* Passaparola Game */}
        <button
          onClick={onStartPassaparola}
          className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-purple-500/50 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] shadow-sm group"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-black text-xs">
              P
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-850 border border-slate-800 text-purple-300">
              120s
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">Passaparola</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Kelime Çarkı</p>
            </div>
            <div className="w-6 h-6 rounded-lg bg-slate-850 border border-slate-800 text-slate-400 flex items-center justify-center group-hover:text-white transition-colors">
              <Play size={10} className="fill-current ml-0.5" />
            </div>
          </div>
        </button>

        {/* 60s Hızlı Tur Game */}
        <button
          onClick={onStartSpeedRound}
          className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] shadow-sm group"
        >
          <div className="flex items-center justify-between mb-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Zap size={15} className="fill-amber-400" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-850 border border-slate-800 text-amber-400">
              60s Tur
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">Hızlı Tur</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Rekor: <span className="font-semibold text-white">{profile.highScoreSpeedRound}</span>
              </p>
            </div>
            <div className="w-6 h-6 rounded-lg bg-slate-850 border border-slate-800 text-slate-400 flex items-center justify-center group-hover:text-white transition-colors">
              <Play size={10} className="fill-current ml-0.5" />
            </div>
          </div>
        </button>
      </div>

      {/* 4. OVERALL PROGRESS BAR & STATS CHIPS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-white text-[12px]">Genel İlerleme</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {learningCount + masteredCount} / {totalWordsCount}
          </span>
        </div>

        {/* Multi-segment clean progress bar */}
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
        <div className="grid grid-cols-3 gap-2 pt-0.5 text-center text-[11px]">
          <div className="bg-slate-850 rounded-xl py-2 px-1 border border-slate-800 flex items-center justify-center space-x-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 size={13} />
            <span>{masteredCount} Master</span>
          </div>
          <div className="bg-slate-850 rounded-xl py-2 px-1 border border-slate-800 flex items-center justify-center space-x-1.5 text-indigo-400 font-semibold">
            <Repeat size={13} />
            <span>{learningCount} Aktif</span>
          </div>
          <div className="bg-slate-850 rounded-xl py-2 px-1 border border-slate-800 flex items-center justify-center space-x-1.5 text-slate-300 font-semibold">
            <BookOpen size={13} />
            <span>{Math.max(0, totalWordsCount - learningCount - masteredCount)} Yeni</span>
          </div>
        </div>
      </div>
    </div>
  );
};
