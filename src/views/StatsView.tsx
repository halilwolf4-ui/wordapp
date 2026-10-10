import React, { useState } from 'react';
import { UserProfile, DailyLog, Progress } from '../types';
import { BADGES, xpForNextLevel } from '../services/gamification';
import { addDays, getEffectiveDate } from '../services/dateUtils';
import { Flame, Award, CheckCircle, BarChart3, Calendar, Lock, Check } from 'lucide-react';

interface Props {
  profile: UserProfile;
  dailyLogs: DailyLog[];
  totalLearned: number;
  totalMastered: number;
  allProgress?: Progress[];
}

function getBadgeProgress(
  badgeId: string,
  profile: UserProfile,
  totalWords: number,
  totalMastered: number
): { current: number; max: number; label: string } | null {
  switch (badgeId) {
    case 'first_word': return { current: Math.min(1, totalWords), max: 1, label: `${Math.min(1, totalWords)}/1` };
    case 'words_25': return { current: Math.min(25, totalWords), max: 25, label: `${Math.min(25, totalWords)}/25` };
    case 'words_100': return { current: Math.min(100, totalWords), max: 100, label: `${Math.min(100, totalWords)}/100` };
    case 'words_250': return { current: Math.min(250, totalWords), max: 250, label: `${Math.min(250, totalWords)}/250` };
    case 'words_500': return { current: Math.min(500, totalWords), max: 500, label: `${Math.min(500, totalWords)}/500` };
    case 'words_1000': return { current: Math.min(1000, totalWords), max: 1000, label: `${Math.min(1000, totalWords)}/1.000` };
    case 'words_2000': return { current: Math.min(2000, totalWords), max: 2000, label: `${Math.min(2000, totalWords)}/2.000` };
    case 'words_3000': return { current: Math.min(3000, totalWords), max: 3000, label: `${Math.min(3000, totalWords)}/3.000` };

    case 'streak_3': return { current: Math.min(3, profile.streak), max: 3, label: `${Math.min(3, profile.streak)}/3 gün` };
    case 'streak_7': return { current: Math.min(7, profile.streak), max: 7, label: `${Math.min(7, profile.streak)}/7 gün` };
    case 'streak_14': return { current: Math.min(14, profile.streak), max: 14, label: `${Math.min(14, profile.streak)}/14 gün` };
    case 'streak_21': return { current: Math.min(21, profile.streak), max: 21, label: `${Math.min(21, profile.streak)}/21 gün` };
    case 'streak_30': return { current: Math.min(30, profile.streak), max: 30, label: `${Math.min(30, profile.streak)}/30 gün` };
    case 'streak_50': return { current: Math.min(50, profile.streak), max: 50, label: `${Math.min(50, profile.streak)}/50 gün` };
    case 'streak_100': return { current: Math.min(100, profile.streak), max: 100, label: `${Math.min(100, profile.streak)}/100 gün` };

    case 'speed_10': return { current: Math.min(10, profile.highScoreSpeedRound || 0), max: 10, label: `${Math.min(10, profile.highScoreSpeedRound || 0)}/10` };
    case 'speed_20': return { current: Math.min(20, profile.highScoreSpeedRound || 0), max: 20, label: `${Math.min(20, profile.highScoreSpeedRound || 0)}/20` };
    case 'speed_30': return { current: Math.min(30, profile.highScoreSpeedRound || 0), max: 30, label: `${Math.min(30, profile.highScoreSpeedRound || 0)}/30` };
    case 'speed_40': return { current: Math.min(40, profile.highScoreSpeedRound || 0), max: 40, label: `${Math.min(40, profile.highScoreSpeedRound || 0)}/40` };
    case 'speed_50': return { current: Math.min(50, profile.highScoreSpeedRound || 0), max: 50, label: `${Math.min(50, profile.highScoreSpeedRound || 0)}/50` };
    case 'speed_100': return { current: Math.min(100, profile.highScoreSpeedRound || 0), max: 100, label: `${Math.min(100, profile.highScoreSpeedRound || 0)}/100` };

    case 'master_50': return { current: Math.min(50, totalMastered), max: 50, label: `${Math.min(50, totalMastered)}/50` };
    case 'master_100': return { current: Math.min(100, totalMastered), max: 100, label: `${Math.min(100, totalMastered)}/100` };
    case 'master_200': return { current: Math.min(200, totalMastered), max: 200, label: `${Math.min(200, totalMastered)}/200` };
    case 'master_500': return { current: Math.min(500, totalMastered), max: 500, label: `${Math.min(500, totalMastered)}/500` };
    case 'master_1000': return { current: Math.min(1000, totalMastered), max: 1000, label: `${Math.min(1000, totalMastered)}/1.000` };
    default: return null;
  }
}

export const StatsView: React.FC<Props> = ({
  profile,
  dailyLogs,
  totalLearned,
  totalMastered,
  allProgress = []
}) => {
  const today = getEffectiveDate();
  const [badgeCategory, setBadgeCategory] = useState<'all' | 'words' | 'streak' | 'speed' | 'master' | 'special'>('all');

  // Map daily logs for fast lookup
  const logsMap = new Map<string, DailyLog>();
  dailyLogs.forEach(l => logsMap.set(l.date, l));

  // Generate last 30 days list for Activity Heatmap
  const last30Days: { date: string; dayNum: number; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dStr = addDays(today, -i);
    const dayDate = new Date(dStr);
    const log = logsMap.get(dStr);
    const count = (log?.newLearnedCount || 0) + (log?.reviewsDone || 0) + (log?.masteredCount || 0) || (log?.correctCount || 0);
    last30Days.push({
      date: dStr,
      dayNum: dayDate.getDate(),
      count
    });
  }

  // Generate last 14 days stacked bar chart data (Öğrenilen, Tekrar, Master)
  interface DayStack {
    date: string;
    dayNum: number;
    learned: number;
    reviewed: number;
    mastered: number;
    total: number;
  }

  const last14Days: DayStack[] = [];
  for (let i = 13; i >= 0; i--) {
    const dStr = addDays(today, -i);
    const dayDate = new Date(dStr);
    const log = logsMap.get(dStr);

    const learned = log?.newLearnedCount || 0;
    let reviewed = log?.reviewsDone || 0;
    // Calculate mastered count from log or fallback to progress records marked mastered on that day
    let mastered = log?.masteredCount ?? allProgress.filter(p => p.status === 'mastered' && p.lastReviewDate === dStr).length;

    // Fallback for older logs created before detailed breakdown
    if (learned === 0 && reviewed === 0 && mastered === 0 && (log?.correctCount || 0) > 0) {
      reviewed = log!.correctCount;
    }

    const total = learned + reviewed + mastered;
    last14Days.push({
      date: dStr,
      dayNum: dayDate.getDate(),
      learned,
      reviewed,
      mastered,
      total
    });
  }

  // Max total in 14 days for bar scaling
  const max14DayTotal = Math.max(1, ...last14Days.map(d => d.total));

  // Selected day for interactive bar inspector (default to today)
  const [selectedDayDate, setSelectedDayDate] = useState<string>(today);
  const selectedDay = last14Days.find(d => d.date === selectedDayDate) || last14Days[last14Days.length - 1];

  // Level progress
  const nextLvlXp = xpForNextLevel(profile.level);
  const prevLvlXp = xpForNextLevel(profile.level - 1);
  const currentLvlProgress = Math.max(0, profile.xp - prevLvlXp);
  const currentLvlNeeded = Math.max(1, nextLvlXp - prevLvlXp);
  const lvlPercent = Math.min(100, Math.round((currentLvlProgress / currentLvlNeeded) * 100));

  // Filter badges
  const filteredBadges = BADGES.filter(b => {
    if (badgeCategory === 'all') return true;
    return b.category === badgeCategory;
  });

  const unlockedCount = profile.unlockedBadges.length;

  return (
    <div className="space-y-4 pb-24 pt-1 select-none">
      <div>
        <h2 className="text-xl font-bold text-white">İstatistik ve Başarılar</h2>
        <p className="text-xs text-slate-400">Öğrenme yolculuğunun detaylı grafikleri</p>
      </div>

      {/* Level & XP Hero Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
              Seviye {profile.level}
            </span>
            <h3 className="text-2xl font-extrabold text-white">
              {profile.xp.toLocaleString()} XP
            </h3>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
            <Award size={30} />
          </div>
        </div>

        {/* Progress to next level */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-300 font-medium">
            <span>Seviye {profile.level + 1} için</span>
            <span>{currentLvlProgress} / {currentLvlNeeded} XP (%{lvlPercent})</span>
          </div>
          <div className="h-2 bg-slate-950 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${lvlPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-center shadow-sm">
          <Flame size={20} className="text-amber-500 mx-auto mb-1 fill-amber-500" />
          <span className="text-lg font-bold text-white">{profile.streak} gün</span>
          <p className="text-[11px] text-slate-400">Aktif Seri</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-center shadow-sm">
          <CheckCircle size={20} className="text-emerald-400 mx-auto mb-1" />
          <span className="text-lg font-bold text-emerald-400">{totalMastered}</span>
          <p className="text-[11px] text-slate-400">Öğrenildi</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 text-center shadow-sm">
          <BarChart3 size={20} className="text-indigo-400 mx-auto mb-1" />
          <span className="text-lg font-bold text-indigo-400">{totalLearned}</span>
          <p className="text-[11px] text-slate-400">Hafızada</p>
        </div>
      </div>

      {/* Streak Freeze Status Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between text-xs shadow-sm">
        <div className="flex items-center space-x-2.5">
          <span className="text-lg">🧊</span>
          <div>
            <span className="font-bold text-white block">Seri Dondurma: {profile.streakFreezes || 0} / 2</span>
            <span className="text-[10px] text-slate-400">
              {(profile.streakFreezes || 0) >= 2
                ? 'Maksimum dondurma hakkı dolu (2/2).'
                : `${5 - (profile.consecutiveCompletedDays || 0)} gün sonra yeni hak verilir.`}
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-slate-850 border border-slate-800 text-sky-400 font-bold text-[10px]">
          {profile.consecutiveCompletedDays || 0}/5 Gün
        </span>
      </div>

      {/* Günlük İstatistik (Stacked 3-Color Bar Chart: Öğrenilen, Tekrar, Master) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <BarChart3 size={17} className="text-emerald-400" />
            <span>Günlük İstatistik</span>
          </h4>
          <span className="text-[11px] text-slate-400 font-medium">Son 14 Gün</span>
        </div>

        {/* Legend & Inspector Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 border-b border-slate-800/80 pb-3 text-xs">
          <div className="flex items-center space-x-3 text-[11px] font-medium text-slate-300">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" />
              <span>Öğrenilen</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block shadow-sm shadow-sky-500/50" />
              <span>Tekrar</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block shadow-sm shadow-purple-500/50" />
              <span>Master</span>
            </span>
          </div>

          {/* Selected day summary pills */}
          <div className="text-[11px] font-mono text-slate-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 flex items-center space-x-1.5">
            <span className="text-slate-400">{selectedDay.date === today ? 'Bugün' : selectedDay.date}:</span>
            <span className="text-emerald-400 font-bold">{selectedDay.learned}</span>
            <span className="text-slate-600">/</span>
            <span className="text-sky-400 font-bold">{selectedDay.reviewed}</span>
            <span className="text-slate-600">/</span>
            <span className="text-purple-400 font-bold">{selectedDay.mastered}</span>
          </div>
        </div>

        {/* 14-Day 3-Color Stacked Chart */}
        <div className="h-36 flex items-end justify-between gap-1.5 pt-2 px-0.5">
          {last14Days.map((d) => {
            const isSelected = d.date === selectedDayDate;
            const barHeightPct = d.total > 0 ? Math.max(12, Math.round((d.total / max14DayTotal) * 100)) : 5;

            const learnedPct = d.total > 0 ? (d.learned / d.total) * 100 : 0;
            const reviewedPct = d.total > 0 ? (d.reviewed / d.total) * 100 : 0;
            const masteredPct = d.total > 0 ? (d.mastered / d.total) * 100 : 0;

            return (
              <div
                key={d.date}
                onClick={() => setSelectedDayDate(d.date)}
                className="flex-1 h-full flex flex-col justify-end items-center space-y-1.5 cursor-pointer group"
                title={`${d.date} Toplam: ${d.total} (Öğrenilen: ${d.learned}, Tekrar: ${d.reviewed}, Master: ${d.mastered})`}
              >
                {/* Stacked Vertical Bar */}
                <div
                  className={`w-full rounded-t-md overflow-hidden flex flex-col justify-end transition-all duration-300 ${
                    isSelected ? 'ring-2 ring-indigo-400 ring-offset-1 ring-offset-slate-900' : 'group-hover:brightness-110'
                  }`}
                  style={{ height: `${barHeightPct}%` }}
                >
                  {d.total > 0 ? (
                    <>
                      {/* Master segment (Purple) - Top */}
                      {masteredPct > 0 && (
                        <div
                          className="w-full bg-purple-500 transition-all duration-300"
                          style={{ height: `${masteredPct}%` }}
                        />
                      )}
                      {/* Tekrar segment (Sky Blue) - Middle */}
                      {reviewedPct > 0 && (
                        <div
                          className="w-full bg-sky-500 transition-all duration-300"
                          style={{ height: `${reviewedPct}%` }}
                        />
                      )}
                      {/* Öğrenilen segment (Emerald Green) - Bottom */}
                      {learnedPct > 0 && (
                        <div
                          className="w-full bg-emerald-500 transition-all duration-300"
                          style={{ height: `${learnedPct}%` }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="w-full h-1 bg-slate-800 rounded-full" />
                  )}
                </div>

                {/* Day label */}
                <span
                  className={`text-[10px] font-mono leading-none transition-colors ${
                    isSelected ? 'text-indigo-400 font-bold' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                >
                  {d.dayNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 30-Day Activity Heatmap */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <Calendar size={16} className="text-indigo-400" />
            <span>Son 30 Gün Takvim Isı Haritası</span>
          </h4>
          <span className="text-xs text-slate-400">30 gün</span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 pt-2">
          {last30Days.map((day) => {
            let bgClass = 'bg-slate-950 border-slate-850 text-slate-600';
            if (day.count > 0 && day.count < 10) bgClass = 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300';
            else if (day.count >= 10 && day.count < 25) bgClass = 'bg-emerald-700 border-emerald-600 text-white font-bold';
            else if (day.count >= 25) bgClass = 'bg-emerald-500 border-emerald-400 text-slate-950 font-black';

            return (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} aktivite`}
                className={`h-11 rounded-xl border flex flex-col items-center justify-center p-1 transition-all ${bgClass}`}
              >
                <span className="text-[11px] leading-tight">{day.dayNum}</span>
                <span className="text-[9px] opacity-80">{day.count > 0 ? `${day.count}` : '-'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Badges Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <Award size={18} className="text-amber-400" />
              <span>Rozetler ({unlockedCount} / {BADGES.length})</span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Hedefleri tamamlayarak yeni rozetler aç</p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
            %{Math.round((unlockedCount / BADGES.length) * 100)}
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
          {[
            { id: 'all', label: `Tümü (${BADGES.length})` },
            { id: 'words', label: 'Kelimeler (8)' },
            { id: 'streak', label: 'Seriler (7)' },
            { id: 'speed', label: 'Hızlı Tur (6)' },
            { id: 'master', label: 'Master (5)' },
            { id: 'special', label: 'Özel (3)' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setBadgeCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all text-[11px] ${
                badgeCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-850'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {filteredBadges.map((b) => {
            const unlocked = profile.unlockedBadges.includes(b.id);
            const totalWords = totalLearned + totalMastered;
            const progress = getBadgeProgress(b.id, profile, totalWords, totalMastered);
            const progressPct = progress ? Math.min(100, Math.round((progress.current / progress.max) * 100)) : 0;

            return (
              <div
                key={b.id}
                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                  unlocked
                    ? 'bg-gradient-to-br from-slate-850 to-slate-900 border-amber-500/40 shadow-sm shadow-amber-500/5'
                    : 'bg-slate-950/60 border-slate-850/80 opacity-75'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                      unlocked
                        ? 'bg-amber-500/10 border border-amber-500/30 shadow-sm shadow-amber-500/20'
                        : 'bg-slate-900 border border-slate-800 text-slate-600 grayscale'
                    }`}
                  >
                    {b.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h5 className={`text-xs font-bold truncate ${unlocked ? 'text-white' : 'text-slate-300'}`}>
                        {b.title}
                      </h5>
                      {unlocked ? (
                        <span className="flex items-center space-x-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20 shrink-0">
                          <Check size={10} />
                          <span>Açıldı</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-0.5 text-[9px] font-medium text-slate-500 shrink-0">
                          <Lock size={10} />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                      {b.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar for locked badges */}
                {!unlocked && progress && (
                  <div className="mt-3 pt-2 border-t border-slate-850 space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>İlerleme</span>
                      <span className="text-indigo-300 font-bold">{progress.label}</span>
                    </div>
                    <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
