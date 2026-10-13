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
    <div className="space-y-4 pb-24 pt-1 select-none text-black">
      <div>
        <h2 className="text-xl font-black text-black uppercase tracking-tight">İSTATİSTİK VE BAŞARILAR</h2>
        <p className="text-xs font-bold text-zinc-700">Öğrenme yolculuğunun detaylı grafikleri</p>
      </div>

      {/* Level & XP Hero Card */}
      <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-3.5 text-black">
        <div className="flex items-center justify-between">
          <div>
            <span className="bg-[#FFE600] border-2 border-black px-2 py-0.5 text-xs font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_0px_#000]">
              SEVİYE {profile.level}
            </span>
            <h3 className="text-3xl font-black text-black mt-1 uppercase tracking-tight">
              {profile.xp.toLocaleString()} XP
            </h3>
          </div>
          <div className="w-12 h-12 bg-[#00F0FF] border-2 border-black flex items-center justify-center text-black shadow-[3px_3px_0px_0px_#000]">
            <Award size={28} strokeWidth={2.5} />
          </div>
        </div>

        {/* Progress to next level */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-black font-black">
            <span>SEVİYE {profile.level + 1} İÇİN</span>
            <span className="font-mono">{currentLvlProgress} / {currentLvlNeeded} XP (%{lvlPercent})</span>
          </div>
          <div className="h-3.5 bg-zinc-100 border-2 border-black overflow-hidden shadow-[2px_2px_0px_0px_#000]">
            <div
              className="h-full bg-black transition-all duration-500"
              style={{ width: `${lvlPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-[#FF69B4] border-[3px] border-black p-3 text-center shadow-[4px_4px_0px_0px_#000] text-black">
          <Flame size={20} className="text-[#FF5722] fill-[#FF5722] mx-auto mb-1" />
          <span className="text-base sm:text-lg font-black block">{profile.streak} GÜN</span>
          <p className="text-[10px] font-black uppercase tracking-wide">AKTİF SERİ</p>
        </div>

        <div className="bg-[#4ADE80] border-[3px] border-black p-3 text-center shadow-[4px_4px_0px_0px_#000] text-black">
          <CheckCircle size={20} strokeWidth={2.5} className="text-black mx-auto mb-1" />
          <span className="text-base sm:text-lg font-black block">{totalMastered}</span>
          <p className="text-[10px] font-black uppercase tracking-wide">ÖĞRENİLDİ</p>
        </div>

        <div className="bg-[#00F0FF] border-[3px] border-black p-3 text-center shadow-[4px_4px_0px_0px_#000] text-black">
          <BarChart3 size={20} strokeWidth={2.5} className="text-black mx-auto mb-1" />
          <span className="text-base sm:text-lg font-black block">{totalLearned}</span>
          <p className="text-[10px] font-black uppercase tracking-wide">HAFIZADA</p>
        </div>
      </div>

      {/* Streak Freeze Status Banner */}
      <div className="bg-[#BAE6FD] border-[3px] border-black p-3.5 flex items-center justify-between text-xs shadow-[4px_4px_0px_0px_#000] text-black">
        <div className="flex items-center space-x-2.5">
          <span className="text-xl">🧊</span>
          <div>
            <span className="font-black text-black block uppercase text-xs">
              SERİ DONDURMA: {profile.streakFreezes || 0} / 2
            </span>
            <span className="text-[10px] font-bold text-zinc-800">
              {(profile.streakFreezes || 0) >= 2
                ? 'Maksimum dondurma hakkı dolu (2/2).'
                : `${5 - (profile.consecutiveCompletedDays || 0)} gün sonra yeni hak verilir.`}
            </span>
          </div>
        </div>
        <span className="px-2 py-1 bg-white border border-black text-black font-black text-[10px] shadow-[1px_1px_0px_0px_#000]">
          {profile.consecutiveCompletedDays || 0}/5 GÜN
        </span>
      </div>

      {/* Günlük İstatistik (Stacked 3-Color Bar Chart) */}
      <div className="bg-white border-4 border-black p-5 space-y-3.5 shadow-[6px_6px_0px_0px_#000] text-black">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-black uppercase flex items-center space-x-2 tracking-tight">
            <BarChart3 size={17} strokeWidth={2.5} className="text-black" />
            <span>GÜNLÜK İSTATİSTİK</span>
          </h4>
          <span className="text-[11px] font-black bg-[#FFE600] border border-black px-1.5 py-0.5">SON 14 GÜN</span>
        </div>

        {/* Legend & Inspector Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 border-b-2 border-black pb-3 text-xs">
          <div className="flex items-center space-x-3 text-[11px] font-black text-black uppercase">
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 bg-[#4ADE80] border border-black inline-block" />
              <span>Öğrenilen</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 bg-[#00F0FF] border border-black inline-block" />
              <span>Tekrar</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 bg-[#C084FC] border border-black inline-block" />
              <span>Master</span>
            </span>
          </div>

          {/* Selected day summary pills */}
          <div className="text-[11px] font-mono font-black text-black bg-[#FDFBF7] px-2.5 py-1 border-2 border-black flex items-center space-x-1.5 shadow-[1.5px_1.5px_0px_0px_#000]">
            <span>{selectedDay.date === today ? 'BUGÜN' : selectedDay.date}:</span>
            <span className="bg-[#4ADE80] px-1 border border-black">{selectedDay.learned}</span>
            <span>/</span>
            <span className="bg-[#00F0FF] px-1 border border-black">{selectedDay.reviewed}</span>
            <span>/</span>
            <span className="bg-[#C084FC] px-1 border border-black">{selectedDay.mastered}</span>
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
                title={`${d.date} Toplam: ${d.total}`}
              >
                {/* Stacked Vertical Bar */}
                <div
                  className={`w-full border-2 border-black overflow-hidden flex flex-col justify-end transition-all ${
                    isSelected ? 'ring-2 ring-black scale-105 shadow-[2px_2px_0px_0px_#000]' : ''
                  }`}
                  style={{ height: `${barHeightPct}%` }}
                >
                  {d.total > 0 ? (
                    <>
                      {masteredPct > 0 && (
                        <div
                          className="w-full bg-[#C084FC] border-b border-black"
                          style={{ height: `${masteredPct}%` }}
                        />
                      )}
                      {reviewedPct > 0 && (
                        <div
                          className="w-full bg-[#00F0FF] border-b border-black"
                          style={{ height: `${reviewedPct}%` }}
                        />
                      )}
                      {learnedPct > 0 && (
                        <div
                          className="w-full bg-[#4ADE80]"
                          style={{ height: `${learnedPct}%` }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="w-full h-1 bg-zinc-300" />
                  )}
                </div>

                {/* Day label */}
                <span
                  className={`text-[10px] font-mono leading-none font-black ${
                    isSelected ? 'text-black bg-[#FFE600] px-0.5 border border-black' : 'text-zinc-600'
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
      <div className="bg-white border-4 border-black p-5 space-y-3 shadow-[6px_6px_0px_0px_#000] text-black">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-black uppercase flex items-center space-x-2 tracking-tight">
            <Calendar size={16} strokeWidth={2.5} className="text-black" />
            <span>30 GÜNLÜK ISI HARİTASI</span>
          </h4>
          <span className="text-xs font-black bg-[#FFE600] border border-black px-1.5 py-0.5">30 GÜN</span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 pt-2">
          {last30Days.map((day) => {
            let bgClass = 'bg-[#FDFBF7] text-zinc-400';
            if (day.count > 0 && day.count < 10) bgClass = 'bg-[#BBF7D0] text-black font-black';
            else if (day.count >= 10 && day.count < 25) bgClass = 'bg-[#4ADE80] text-black font-black';
            else if (day.count >= 25) bgClass = 'bg-[#FFE600] text-black font-black';

            return (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} aktivite`}
                className={`h-11 border-2 border-black flex flex-col items-center justify-center p-1 transition-all shadow-[1.5px_1.5px_0px_0px_#000] ${bgClass}`}
              >
                <span className="text-[11px] font-black leading-tight">{day.dayNum}</span>
                <span className="text-[9px] font-bold">{day.count > 0 ? `${day.count}` : '-'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Badges Section */}
      <div className="bg-white border-4 border-black p-5 space-y-4 shadow-[6px_6px_0px_0px_#000] text-black">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black text-black uppercase flex items-center space-x-2 tracking-tight">
              <Award size={18} strokeWidth={2.5} className="text-black" />
              <span>ROZETLER ({unlockedCount} / {BADGES.length})</span>
            </h4>
            <p className="text-[11px] font-bold text-zinc-700 mt-0.5">Hedefleri tamamlayarak yeni rozetler aç</p>
          </div>
          <span className="text-xs px-2.5 py-1 bg-[#FFE600] text-black border-2 border-black font-black shadow-[2px_2px_0px_0px_#000]">
            %{Math.round((unlockedCount / BADGES.length) * 100)}
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs scrollbar-none font-black">
          {[
            { id: 'all', label: `TÜMÜ (${BADGES.length})` },
            { id: 'words', label: 'KELİMELER (8)' },
            { id: 'streak', label: 'SERİLER (7)' },
            { id: 'speed', label: 'HIZLI TUR (6)' },
            { id: 'master', label: 'MASTER (5)' },
            { id: 'special', label: 'ÖZEL (3)' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setBadgeCategory(cat.id as any)}
              className={`px-3 py-1.5 border-2 border-black uppercase whitespace-nowrap transition-all text-[11px] ${
                badgeCategory === cat.id
                  ? 'bg-black text-[#FFE600] shadow-[2px_2px_0px_0px_#FFE600] -translate-y-0.5'
                  : 'bg-white text-black hover:bg-zinc-100'
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
                className={`p-3.5 border-2 border-black transition-all flex flex-col justify-between ${
                  unlocked
                    ? 'bg-[#FEF08A] text-black shadow-[3px_3px_0px_0px_#000]'
                    : 'bg-zinc-100 text-zinc-500 opacity-70'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-11 h-11 border-2 border-black flex items-center justify-center text-2xl shrink-0 shadow-[2px_2px_0px_0px_#000] ${
                      unlocked
                        ? 'bg-white text-black'
                        : 'bg-zinc-200 text-zinc-400 grayscale'
                    }`}
                  >
                    {b.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h5 className="text-xs font-black uppercase truncate text-black">
                        {b.title}
                      </h5>
                      {unlocked ? (
                        <span className="flex items-center space-x-0.5 text-[9px] font-black text-black bg-[#4ADE80] border border-black px-1.5 py-0.5 uppercase shrink-0">
                          <Check size={10} strokeWidth={3} />
                          <span>AÇILDI</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-0.5 text-[9px] font-black text-zinc-600 shrink-0">
                          <Lock size={10} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-zinc-800 line-clamp-2 mt-0.5 leading-snug">
                      {b.description}
                    </p>
                  </div>
                </div>

                {/* Progress bar for locked badges */}
                {!unlocked && progress && (
                  <div className="mt-3 pt-2 border-t border-black space-y-1">
                    <div className="flex justify-between text-[10px] text-black font-black font-mono">
                      <span>İLERLEME</span>
                      <span className="bg-black text-white px-1">{progress.label}</span>
                    </div>
                    <div className="h-2 bg-white border border-black overflow-hidden">
                      <div
                        className="h-full bg-black transition-all duration-300"
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
