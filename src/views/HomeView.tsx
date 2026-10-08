import React from 'react';
import { Play, Sparkles, Repeat, Award, CheckCircle2, BookOpen } from 'lucide-react';
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
  onStartSpeedRound
}) => {
  // Goal ring percentage
  const goalPercent = Math.min(100, Math.round((todayCorrect / Math.max(1, dailyGoal)) * 100));
  const strokeDashoffset = 283 - (283 * goalPercent) / 100;

  return (
    <div className="space-y-6 pb-20">
      {/* Daily Progress Ring & Large Counter */}
      <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/80 border border-slate-700/60 rounded-3xl p-6 text-center shadow-xl backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative inline-flex items-center justify-center mb-3">
          {/* SVG Circular Ring */}
          <svg className="w-40 h-40 transform -rotate-90">
            <circle
              cx="80"
              cy="80"
              r="45"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-slate-800"
            />
            <circle
              cx="80"
              cy="80"
              r="45"
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray="283"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="text-indigo-500 transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Counter */}
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-4xl font-black tracking-tight text-white">
              {todayCorrect}
            </span>
            <span className="text-xs font-medium text-slate-400">
              / {dailyGoal} hedef
            </span>
          </div>
        </div>

        <h2 className="text-lg font-bold text-slate-100">
          {todayCorrect >= dailyGoal ? '🎉 Günlük Hedef Tamamlandı!' : 'Bugünkü İlerlemen'}
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {goalPercent >= 100 ? 'Harikasın, çalışmaya devam edebilirsin!' : `%${goalPercent} tamamlandı`}
        </p>
      </div>

      {/* Main Action Cards */}
      <div className="grid grid-cols-2 gap-3.5">
        {/* Review Card */}
        <button
          onClick={onStartReview}
          disabled={dueCount === 0}
          className={`flex flex-col justify-between p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
            dueCount > 0
              ? 'bg-gradient-to-br from-indigo-600/30 via-slate-800 to-slate-900 border-indigo-500/40 hover:border-indigo-400 shadow-lg shadow-indigo-950/40'
              : 'bg-slate-800/40 border-slate-700/40 opacity-70 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Repeat size={22} />
            </div>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-indigo-500 text-white">
              {dueCount}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Günlük Tekrar</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {dueCount > 0 ? `${dueCount} kelime seni bekliyor` : 'Bugünkü tekrarlar bitti'}
            </p>
          </div>
        </button>

        {/* Learn Card */}
        <button
          onClick={onStartLearn}
          disabled={newCount === 0}
          className={`flex flex-col justify-between p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
            newCount > 0
              ? 'bg-gradient-to-br from-emerald-600/30 via-slate-800 to-slate-900 border-emerald-500/40 hover:border-emerald-400 shadow-lg shadow-emerald-950/40'
              : 'bg-slate-800/40 border-slate-700/40 opacity-70 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center justify-between w-full mb-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <BookOpen size={22} />
            </div>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500 text-white">
              {newCount}
            </span>
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Yeni Kelimeler</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {newCount > 0 ? `${newCount} yeni kelime öğren` : 'Tüm kelimeler öğrenildi'}
            </p>
          </div>
        </button>
      </div>

      {/* Custom words priority banner */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
            <Sparkles size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Kendi Kelimelerin Öncelikli</h4>
            <p className="text-xs text-slate-400">
              {customWordsCount > 0
                ? `${customWordsCount} özel kelimeniz çalışma sırasında ilk sıraya alınır.`
                : 'Kelimeler sekmesinden kendi kelimelerinizi ekleyebilirsiniz.'}
            </p>
          </div>
        </div>
      </div>

      {/* Global Learning Progress Bar */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">Genel İlerleme Durumu</span>
          <span className="text-slate-400 font-mono">
            {learningCount + masteredCount} / {totalWordsCount}
          </span>
        </div>

        {/* Multi-segment progress bar */}
        <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${(masteredCount / Math.max(1, totalWordsCount)) * 100}%` }}
            title="Öğrenildi (Mastered)"
          />
          <div
            className="bg-indigo-500 h-full transition-all duration-500"
            style={{ width: `${(learningCount / Math.max(1, totalWordsCount)) * 100}%` }}
            title="Öğrenilmekte"
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="bg-slate-900/60 rounded-xl p-2">
            <div className="text-emerald-400 font-bold text-sm flex items-center justify-center space-x-1">
              <CheckCircle2 size={14} />
              <span>{masteredCount}</span>
            </div>
            <div className="text-[10px] text-slate-400">Mastered</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2">
            <div className="text-indigo-400 font-bold text-sm flex items-center justify-center space-x-1">
              <Repeat size={14} />
              <span>{learningCount}</span>
            </div>
            <div className="text-[10px] text-slate-400">Öğrenilmekte</div>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2">
            <div className="text-slate-300 font-bold text-sm flex items-center justify-center space-x-1">
              <BookOpen size={14} />
              <span>{Math.max(0, totalWordsCount - learningCount - masteredCount)}</span>
            </div>
            <div className="text-[10px] text-slate-400">Yeni</div>
          </div>
        </div>
      </div>

      {/* Quick Round Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-amber-600/30 to-orange-600/30 border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-1 text-amber-300 text-xs font-bold uppercase tracking-wider mb-0.5">
            <Award size={14} />
            <span>Mini Oyun</span>
          </div>
          <h4 className="text-base font-extrabold text-white">60 Saniye Hızlı Tur</h4>
          <p className="text-xs text-amber-200/80 mt-0.5">
            Zamana karşı refleks testi! En yüksek rekorun: <span className="font-bold text-white">{profile.highScoreSpeedRound}</span>
          </p>
        </div>
        <button
          onClick={onStartSpeedRound}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-orange-950/50 flex items-center space-x-1.5 transition-all"
        >
          <Play size={14} className="fill-slate-950" />
          <span>Başla</span>
        </button>
      </div>
    </div>
  );
};
