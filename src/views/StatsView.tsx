import React, { useState } from 'react';
import { DailyLog, UserProfile, Progress } from '../types';
import { BADGES, xpForNextLevel } from '../services/gamification';
import { addDays, getEffectiveDate } from '../services/dateUtils';

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
  const maxCombo = profile.maxCombo || 0;
  switch (badgeId) {
    // Words
    case 'first_word': return { current: Math.min(1, totalWords), max: 1, label: `${Math.min(1, totalWords)}/1` };
    case 'words_25': return { current: Math.min(25, totalWords), max: 25, label: `${Math.min(25, totalWords)}/25` };
    case 'words_100': return { current: Math.min(100, totalWords), max: 100, label: `${Math.min(100, totalWords)}/100` };
    case 'words_250': return { current: Math.min(250, totalWords), max: 250, label: `${Math.min(250, totalWords)}/250` };
    case 'words_500': return { current: Math.min(500, totalWords), max: 500, label: `${Math.min(500, totalWords)}/500` };
    case 'words_1000': return { current: Math.min(1000, totalWords), max: 1000, label: `${Math.min(1000, totalWords)}/1000` };
    case 'words_2000': return { current: Math.min(2000, totalWords), max: 2000, label: `${Math.min(2000, totalWords)}/2000` };
    case 'words_3000': return { current: Math.min(3000, totalWords), max: 3000, label: `${Math.min(3000, totalWords)}/3000` };

    // Streaks
    case 'streak_3': return { current: Math.min(3, profile.streak), max: 3, label: `${Math.min(3, profile.streak)}/3` };
    case 'streak_7': return { current: Math.min(7, profile.streak), max: 7, label: `${Math.min(7, profile.streak)}/7` };
    case 'streak_14': return { current: Math.min(14, profile.streak), max: 14, label: `${Math.min(14, profile.streak)}/14` };
    case 'streak_21': return { current: Math.min(21, profile.streak), max: 21, label: `${Math.min(21, profile.streak)}/21` };
    case 'streak_30': return { current: Math.min(30, profile.streak), max: 30, label: `${Math.min(30, profile.streak)}/30` };
    case 'streak_50': return { current: Math.min(50, profile.streak), max: 50, label: `${Math.min(50, profile.streak)}/50` };
    case 'streak_100': return { current: Math.min(100, profile.streak), max: 100, label: `${Math.min(100, profile.streak)}/100` };

    // Speed Round
    case 'speed_10': return { current: Math.min(10, profile.highScoreSpeedRound), max: 10, label: `${Math.min(10, profile.highScoreSpeedRound)}/10` };
    case 'speed_20': return { current: Math.min(20, profile.highScoreSpeedRound), max: 20, label: `${Math.min(20, profile.highScoreSpeedRound)}/20` };
    case 'speed_30': return { current: Math.min(30, profile.highScoreSpeedRound), max: 30, label: `${Math.min(30, profile.highScoreSpeedRound)}/30` };
    case 'speed_40': return { current: Math.min(40, profile.highScoreSpeedRound), max: 40, label: `${Math.min(40, profile.highScoreSpeedRound)}/40` };
    case 'speed_50': return { current: Math.min(50, profile.highScoreSpeedRound), max: 50, label: `${Math.min(50, profile.highScoreSpeedRound)}/50` };
    case 'speed_100': return { current: Math.min(100, profile.highScoreSpeedRound), max: 100, label: `${Math.min(100, profile.highScoreSpeedRound)}/100` };

    // Mastered Words
    case 'master_50': return { current: Math.min(50, totalMastered), max: 50, label: `${Math.min(50, totalMastered)}/50` };
    case 'master_100': return { current: Math.min(100, totalMastered), max: 100, label: `${Math.min(100, totalMastered)}/100` };
    case 'master_200': return { current: Math.min(200, totalMastered), max: 200, label: `${Math.min(200, totalMastered)}/200` };
    case 'master_500': return { current: Math.min(500, totalMastered), max: 500, label: `${Math.min(500, totalMastered)}/500` };
    case 'master_1000': return { current: Math.min(1000, totalMastered), max: 1000, label: `${Math.min(1000, totalMastered)}/1000` };

    // Combos
    case 'combo_10': return { current: Math.min(10, maxCombo), max: 10, label: `${Math.min(10, maxCombo)}/10` };
    case 'combo_25': return { current: Math.min(25, maxCombo), max: 25, label: `${Math.min(25, maxCombo)}/25` };
    case 'combo_50': return { current: Math.min(50, maxCombo), max: 50, label: `${Math.min(50, maxCombo)}/50` };
    case 'combo_100': return { current: Math.min(100, maxCombo), max: 100, label: `${Math.min(100, maxCombo)}/100` };

    // Custom Word Creator
    case 'custom_creator': {
      const has = profile.unlockedBadges.includes('custom_creator') ? 1 : 0;
      return { current: has, max: 1, label: `${has}/1` };
    }

    default: return null;
  }
}

/* Liquid water colors per badge category when filling up */
const CATEGORY_LIQUID: Record<
  string,
  { waveFill: string; barGradient: string; pillText: string }
> = {
  words: {
    waveFill: '#38BDF8',
    barGradient: 'from-[#38BDF8] to-[#2563EB]',
    pillText: 'text-[#0284C7] dark:text-[#38BDF8]'
  },
  streak: {
    waveFill: '#FB923C',
    barGradient: 'from-[#FB923C] to-[#F97316]',
    pillText: 'text-[#EA580C] dark:text-[#FB923C]'
  },
  speed: {
    waveFill: '#A78BFA',
    barGradient: 'from-[#A78BFA] to-[#7C3AED]',
    pillText: 'text-[#7C3AED] dark:text-[#A78BFA]'
  },
  master: {
    waveFill: '#34D399',
    barGradient: 'from-[#34D399] to-[#10B981]',
    pillText: 'text-[#059669] dark:text-[#34D399]'
  },
  special: {
    waveFill: '#F472B6',
    barGradient: 'from-[#F472B6] to-[#EC4899]',
    pillText: 'text-[#DB2777] dark:text-[#F472B6]'
  }
};

interface BadgeItemProps {
  badge: (typeof BADGES)[number];
  unlocked: boolean;
  rawPct: number;
  progress: ReturnType<typeof getBadgeProgress>;
  liq: { waveFill: string; barGradient: string; pillText: string };
}

const BadgeCardItem: React.FC<BadgeItemProps> = React.memo(({ badge: b, unlocked, rawPct, progress, liq }) => {
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = React.useState(false);

  React.useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      { rootMargin: '40px 0px', threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (unlocked) {
    return (
      <div
        ref={cardRef}
        title={b.description}
        data-light-pill="true"
        className={`rounded-[24px] p-3 flex flex-col items-center justify-between text-center min-h-[154px] relative overflow-hidden bg-gradient-to-br from-[#FFF6B7] via-[#FFD84D] to-[#F59E0B] border-2 border-[#FBBF24] shadow-[0_10px_24px_-6px_rgba(245,158,11,0.5)] ${
          isInView ? 'animate-gold-shimmer' : ''
        }`}
      >
        <div className="w-full flex items-center justify-between text-[9px] font-black text-[#78350F] px-0.5">
          <span>★ ALTIN</span>
          <span>%100</span>
        </div>

        <div className="w-14 h-14 rounded-[20px] bg-gradient-to-b from-[#FFFBEB] via-[#FDE047] to-[#D97706] border-2 border-white/80 shadow-[inset_0_2px_4px_rgba(255,255,255,0.9),0_6px_12px_rgba(180,83,9,0.3)] flex items-center justify-center my-1 relative">
          <span className="text-[26px] leading-none select-none drop-shadow-[0_2px_3px_rgba(120,53,15,0.25)]">
            {b.icon}
          </span>
        </div>

        <div className="w-full mt-0.5">
          <h5 className="text-[11px] font-extrabold text-[#451A03] leading-tight line-clamp-1">
            {b.title}
          </h5>
          <p className="text-[9px] font-bold text-[#78350F]/90 line-clamp-1 mt-0.5">
            {b.description}
          </p>
        </div>

        <div className="w-full mt-1.5 space-y-0.5">
          <div className="h-2 w-full bg-[#78350F]/20 rounded-full overflow-hidden p-[1px]">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-[#78350F] to-[#92400E]" />
          </div>
          <span className="text-[9px] font-black text-[#451A03] uppercase tracking-wider block">
            ✓ KAZANILDI
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      title={b.description}
      className="rounded-[24px] p-3 flex flex-col items-center justify-between text-center min-h-[154px] bg-white dark:bg-[#151C2C] border border-slate-200/80 dark:border-white/10 shadow-[0_8px_20px_-6px_rgba(17,24,39,0.05)] transition-all"
    >
      <div className="w-full flex items-center justify-between text-[9px] font-extrabold text-slate-400 dark:text-slate-400 px-0.5">
        <span>{rawPct > 0 ? 'DOLUYOR' : 'KİLİTLİ'}</span>
        <span className={`tabular-nums font-black ${rawPct > 0 ? liq.pillText : ''}`}>
          %{rawPct}
        </span>
      </div>

      <div className="w-14 h-14 rounded-[20px] relative overflow-hidden bg-slate-100 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700 flex items-center justify-center my-1 shadow-inner">
        {rawPct > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out"
            style={{
              height: `${Math.max(14, rawPct)}%`,
              backgroundColor: liq.waveFill,
              opacity: 0.35
            }}
          >
            <svg
              viewBox="0 0 120 14"
              preserveAspectRatio="none"
              className={`w-[200%] h-2.5 absolute -top-2 left-0 ${isInView ? 'animate-liquid-wave' : ''}`}
            >
              <path
                d="M0 7 Q 15 0, 30 7 T 60 7 T 90 7 T 120 7 L 120 14 L 0 14 Z"
                fill={liq.waveFill}
              />
            </svg>
          </div>
        )}

        <span
          className={`text-[25px] leading-none relative z-10 select-none transition-all ${
            rawPct > 0 ? 'opacity-95 scale-100' : 'opacity-45 grayscale'
          }`}
        >
          {b.icon}
        </span>
      </div>

      <div className="w-full mt-0.5">
        <h5 className="text-[11px] font-extrabold text-[#111827] dark:text-white leading-tight line-clamp-1">
          {b.title}
        </h5>
        <p className="text-[9px] font-medium text-slate-400 dark:text-slate-400 line-clamp-1 mt-0.5">
          {b.description}
        </p>
      </div>

      <div className="w-full mt-1.5 space-y-1">
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${liq.barGradient} transition-all duration-500`}
            style={{ width: `${rawPct > 0 ? Math.max(8, rawPct) : 0}%` }}
          />
        </div>
        <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-300 tabular-nums block">
          {progress ? progress.label : 'Özel Görev'}
        </span>
      </div>
    </div>
  );
});

export const StatsView: React.FC<Props> = React.memo(({
  profile,
  dailyLogs,
  totalLearned,
  totalMastered,
  allProgress = []
}) => {
  const today = getEffectiveDate();
  const [badgeCategory, setBadgeCategory] = useState<'all' | 'words' | 'streak' | 'speed' | 'master' | 'special'>('all');

  const logsMap = new Map<string, DailyLog>();
  dailyLogs.forEach(l => logsMap.set(l.date, l));

  interface DayStack {
    date: string;
    dayNum: number;
    dayName: string;
    learned: number;
    reviewed: number;
    mastered: number;
    total: number;
  }

  const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

  const last7Days: DayStack[] = [];
  for (let i = 6; i >= 0; i--) {
    const dStr = addDays(today, -i);
    const dayDate = new Date(dStr);
    const log = logsMap.get(dStr);

    const learned = log?.newLearnedCount || 0;
    let reviewed = log?.reviewsDone || 0;
    const mastered = log?.masteredCount ?? allProgress.filter(p => p.status === 'mastered' && p.lastReviewDate === dStr).length;

    if (learned === 0 && reviewed === 0 && mastered === 0 && (log?.correctCount || 0) > 0) {
      reviewed = log!.correctCount;
    }

    const total = learned + reviewed + mastered;
    last7Days.push({
      date: dStr,
      dayNum: dayDate.getDate(),
      dayName: TR_DAYS[dayDate.getDay()] || '',
      learned,
      reviewed,
      mastered,
      total
    });
  }

  const max7DayTotal = Math.max(5, ...last7Days.map(d => d.total));
  const weekTotalWords = last7Days.reduce((acc, d) => acc + d.total, 0);
  const [selectedDayDate, setSelectedDayDate] = useState<string>(today);
  const selectedDay = last7Days.find(d => d.date === selectedDayDate) || last7Days[last7Days.length - 1];

  const nextLvlXp = xpForNextLevel(profile.level);
  const prevLvlXp = xpForNextLevel(profile.level - 1);
  const currentLvlProgress = Math.max(0, profile.xp - prevLvlXp);
  const currentLvlNeeded = Math.max(1, nextLvlXp - prevLvlXp);
  const lvlPercent = Math.min(100, Math.round((currentLvlProgress / currentLvlNeeded) * 100));

  const filteredBadges = BADGES.filter(b => {
    if (badgeCategory === 'all') return true;
    return b.category === badgeCategory;
  });

  const unlockedCount = profile.unlockedBadges.length;

  return (
    <div className="space-y-5 pb-28 pt-1 select-none text-[#111827] dark:text-white">
      {/* 1. HEADER */}
      <div className="flex items-center justify-between px-0.5">
        <div>
          <h2 className="text-[24px] font-extrabold text-[#111827] dark:text-white tracking-tight leading-tight">
            Ödüller & Başarılar
          </h2>
          <p className="text-xs font-medium text-[#6B7280] dark:text-slate-400">
            Rozetlerin su gibi dolar, tamamlananlar saf altına dönüşür!
          </p>
        </div>

        <div className="flex items-center space-x-1.5 bg-[#FFF0ED] dark:bg-rose-950/60 px-3.5 py-2 rounded-full shadow-sm">
          <svg viewBox="0 0 24 24" className="w-4 h-4">
            <path
              d="M12 2C9.5 6 6 8.5 6 13.5C6 17.6 8.7 21 12 21C15.3 21 18 17.6 18 13.5C18 10 15.8 7.5 14.5 5.5C14.2 7.5 13 8.5 12 8.5C12.8 6 12.8 4 12 2Z"
              fill="#FF6B5B"
            />
          </svg>
          <span className="text-xs font-extrabold text-[#FF5E5B]">
            {profile.streak} Gün Seri
          </span>
        </div>
      </div>

      {/* 2. TOP SUMMARY KPI CARDS (3 Clean Tactile Stat Boxes) */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-[22px] bg-white dark:bg-[#151C2C] p-3.5 border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col items-center text-center">
          <span className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-500 flex items-center justify-center text-sm mb-1.5">
            📘
          </span>
          <span className="text-lg font-extrabold text-[#111827] dark:text-white leading-none tabular-nums">
            {totalLearned + totalMastered}
          </span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">
            Aktif Kelime
          </span>
        </div>

        <div className="rounded-[22px] bg-white dark:bg-[#151C2C] p-3.5 border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col items-center text-center">
          <span className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-sm mb-1.5">
            👑
          </span>
          <span className="text-lg font-extrabold text-[#111827] dark:text-white leading-none tabular-nums">
            {totalMastered}
          </span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">
            Master (6/6)
          </span>
        </div>

        <div className="rounded-[22px] bg-white dark:bg-[#151C2C] p-3.5 border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col items-center text-center">
          <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center text-sm mb-1.5">
            ⚡
          </span>
          <span className="text-lg font-extrabold text-[#111827] dark:text-white leading-none tabular-nums">
            {profile.highScoreSpeedRound}
          </span>
          <span className="text-[10px] font-bold text-slate-400 mt-1">
            Hızlı Tur Rekor
          </span>
        </div>
      </div>

      {/* 3. CLEAN & MODERN 7-DAY PERFORMANCE ANALYTICS CARD */}
      <div className="rounded-[28px] bg-white dark:bg-[#151C2C] p-5 border border-slate-200/80 dark:border-white/10 shadow-[0_14px_32px_-10px_rgba(17,24,39,0.06)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FF6B5B] block">
              HAFTALIK ANALİZ • TOPLAM {weekTotalWords} İŞLEM
            </span>
            <h3 className="text-[20px] font-extrabold text-[#111827] dark:text-white tracking-tight leading-tight mt-0.5">
              Son 7 Günlük Performans
            </h3>
          </div>

          <div
            data-light-pill="true"
            className="px-3 py-1.5 rounded-2xl bg-[#FFF4BD] text-[#0F172A] text-xs font-black tabular-nums shadow-sm"
          >
            Lv.{profile.level} • %{lvlPercent}
          </div>
        </div>

        {/* 7 Interactive Gradient Columns with Always-Readable Top Value Badges */}
        <div className="h-40 flex items-end justify-between gap-2 pt-7 px-1 bg-slate-50/80 dark:bg-slate-900/60 rounded-[22px] p-3 border border-slate-100 dark:border-white/5">
          {last7Days.map((d) => {
            const isSelected = d.date === selectedDayDate;
            const barHeightPct = d.total > 0 ? Math.max(20, Math.round((d.total / max7DayTotal) * 100)) : 10;

            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelectedDayDate(d.date)}
                className="flex-1 h-full flex flex-col justify-end items-center group focus:outline-none"
              >
                {/* Count label above bar */}
                <span
                  data-light-pill={isSelected ? 'true' : undefined}
                  className={`text-[10px] font-extrabold mb-1.5 px-2 py-0.5 rounded-full tabular-nums transition-all ${
                    isSelected
                      ? 'bg-[#FFE45E] text-[#0F172A] shadow-sm scale-105'
                      : d.total > 0
                      ? 'text-[#111827] dark:text-slate-200'
                      : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {d.total}
                </span>

                {/* Vertical Track & Fill */}
                <div className="w-full flex-1 flex items-end justify-center">
                  <div
                    className={`w-full max-w-[28px] rounded-[12px] transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-t from-[#FF5E5B] via-[#FF7B54] to-[#FFB703] shadow-[0_6px_16px_rgba(255,94,91,0.4)] ring-2 ring-[#FF5E5B]/40'
                        : d.total > 0
                        ? 'bg-gradient-to-t from-[#3B82F6] to-[#60A5FA] opacity-85 group-hover:opacity-100'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>

                {/* Day Name & Date Number */}
                <div className="mt-2 flex flex-col items-center leading-none">
                  <span
                    className={`text-[10px] font-extrabold ${
                      isSelected ? 'text-[#FF5E5B]' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {d.dayName}
                  </span>
                  <span
                    className={`text-[9px] font-bold mt-0.5 tabular-nums ${
                      isSelected ? 'text-[#111827] dark:text-white font-black' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {d.dayNum}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Day Breakdown Pills */}
        <div className="grid grid-cols-3 gap-2 pt-0.5">
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-300">Yeni</span>
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-200 tabular-nums">
              {selectedDay.learned}
            </span>
          </div>

          <div className="rounded-2xl bg-sky-500/10 border border-sky-500/20 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-300">Tekrar</span>
            <span className="text-xs font-black text-sky-700 dark:text-sky-200 tabular-nums">
              {selectedDay.reviewed}
            </span>
          </div>

          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-300">Master</span>
            <span className="text-xs font-black text-amber-700 dark:text-amber-200 tabular-nums">
              {selectedDay.mastered}
            </span>
          </div>
        </div>
      </div>

      {/* 4. BADGE COLLECTION — UNIQUE ICONS, LIQUID WATER-FILL & SOLID GOLD UNLOCKED */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-[17px] font-extrabold text-[#111827] dark:text-white tracking-tight">
              Rozet Koleksiyonun
            </h3>
            <p className="text-[11px] font-medium text-[#6B7280] dark:text-slate-400">
              İlerledikçe rozetler su gibi dolar, %100 olunca katı altın olur
            </p>
          </div>
          <span className="text-xs font-extrabold text-[#D97706] dark:text-[#FBBF24] bg-[#FEF3C7] dark:bg-amber-950/70 px-3 py-1 rounded-full border border-amber-300/60 dark:border-amber-700/50">
            🏆 {unlockedCount} / {BADGES.length}
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'all', label: 'Tümü' },
            { id: 'words', label: '📘 Kelimeler' },
            { id: 'streak', label: '🔥 Seriler' },
            { id: 'speed', label: '⚡ Hızlı Tur' },
            { id: 'master', label: '👑 Master' },
            { id: 'special', label: '✨ Özel' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setBadgeCategory(cat.id as any)}
              className={`px-4 py-1.5 rounded-full font-bold whitespace-nowrap transition-all text-xs ${
                badgeCategory === cat.id
                  ? 'bg-[#FF6B5B] text-white shadow-[0_6px_14px_-3px_rgba(255,107,91,0.45)]'
                  : 'bg-white dark:bg-[#151C2C] text-[#6B7280] dark:text-slate-300 border border-slate-200/80 dark:border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 3-Column Liquid-Fill & Solid-Gold Badge Grid */}
        <div className="grid grid-cols-3 gap-3 pt-1">
          {filteredBadges.map((b) => {
            const unlocked = profile.unlockedBadges.includes(b.id);
            const totalWords = totalLearned + totalMastered;
            const progress = getBadgeProgress(b.id, profile, totalWords, totalMastered);
            const rawPct = unlocked
              ? 100
              : progress
              ? Math.min(99, Math.max(0, Math.round((progress.current / Math.max(1, progress.max)) * 100)))
              : 0;
            const liq = CATEGORY_LIQUID[b.category || 'words'] || CATEGORY_LIQUID.words;

            return (
              <BadgeCardItem
                key={b.id}
                badge={b}
                unlocked={unlocked}
                rawPct={rawPct}
                progress={progress}
                liq={liq}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
