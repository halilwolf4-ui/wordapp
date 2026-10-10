import React, { useState, useEffect } from 'react';
import { UserProfile, DailyLog } from '../types';
import { Check, Gift, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { parseDate, formatDate } from '../services/dateUtils';
import { fireStreakCelebration } from './Confetti';

interface Props {
  profile: UserProfile;
  dailyLogs: DailyLog[];
  todayStr: string;
  earnedFreeze?: boolean;
  onClose: () => void;
}

const STREAK_BADGES = [
  { days: 3, title: 'Yıldız', icon: '⭐', desc: '3 gün kesintisiz seri' },
  { days: 5, title: 'Süperstar', icon: '🌟', desc: '5 gün dondurma ödülü' },
  { days: 7, title: 'Şampiyon', icon: '🏆', desc: '1 hafta şampiyon' },
  { days: 31, title: 'İkon', icon: '🎖️', desc: '1 ay kesintisiz azim' },
  { days: 50, title: 'Onur Listesi', icon: '🎗️', desc: '50 gün onur listesi' },
  { days: 100, title: 'Yenilmez', icon: '🛡️', desc: '100 gün efsanesi' },
  { days: 150, title: 'Efsane', icon: '⚔️', desc: '150 gün savaşçısı' },
  { days: 200, title: 'Altın', icon: '👑', desc: '200 gün altın seri' }
];

export const DailyStreakCompletion: React.FC<Props> = ({
  profile,
  dailyLogs,
  todayStr,
  earnedFreeze,
  onClose
}) => {
  const [badgePage, setBadgePage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(STREAK_BADGES.length / itemsPerPage);

  // Calculate 7-day week dates starting from Sunday (Pz) to Saturday (Cts)
  const currentMidday = parseDate(todayStr);
  const dayOfWeek = currentMidday.getDay(); // 0 is Sunday
  const sundayDate = new Date(currentMidday.getTime());
  sundayDate.setDate(sundayDate.getDate() - dayOfWeek);

  const weekDays = [
    { label: 'Pz', full: 'Pazar' },
    { label: 'Pzt', full: 'Pazartesi' },
    { label: 'S', full: 'Salı' },
    { label: 'Ça', full: 'Çarşamba' },
    { label: 'Pr', full: 'Perşembe' },
    { label: 'Cu', full: 'Cuma' },
    { label: 'Cts', full: 'Cumartesi' }
  ];

  const weekInfo = weekDays.map((day, idx) => {
    const d = new Date(sundayDate.getTime());
    d.setDate(d.getDate() + idx);
    const dateStr = formatDate(d);

    const isToday = dateStr === todayStr;
    const isPast = dateStr <= todayStr;
    const isFrozen = (profile.frozenDates || []).includes(dateStr);

    // Active log for this day
    const log = dailyLogs.find(l => l.date === dateStr);
    const hasActivity = (log && (log.correctCount > 0 || log.newLearnedCount > 0 || log.reviewsDone > 0)) || isToday;

    // Completed if has activity or was frozen
    const isCompleted = isPast && (hasActivity || isFrozen);

    return {
      ...day,
      dateStr,
      isToday,
      isPast,
      isFrozen,
      isCompleted
    };
  });

  const streakFreezes = Math.min(2, profile.streakFreezes || 0);
  const consecutiveDays = profile.consecutiveCompletedDays || 0;
  const daysUntilNextFreeze = Math.max(0, 5 - consecutiveDays);

  const displayedBadges = STREAK_BADGES.slice(
    badgePage * itemsPerPage,
    (badgePage + 1) * itemsPerPage
  );

  useEffect(() => {
    fireStreakCelebration();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-sm text-slate-100 max-w-md mx-auto animate-scaleUp relative">
      {/* Top Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title="Kapat"
      >
        <X size={18} />
      </button>

      {/* 1. Header: Streak Counter */}
      <div className="pt-2 text-center space-y-1">
        <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center justify-center space-x-2">
          <span>{profile.streak} günlük seri</span>
          <span className="text-amber-500 inline-block animate-bounce">🔥</span>
        </h2>
        <p className="text-xs text-slate-400">
          Tebrikler! Bugünkü çalışmanı başarıyla tamamladın.
        </p>
      </div>

      {/* 2. Weekly Calendar Timeline */}
      <div className="relative py-2 px-1">
        {/* Background Connecting Line */}
        <div className="absolute top-[34px] left-6 right-6 h-1 bg-slate-800 -z-0" />

        {/* Days Row */}
        <div className="grid grid-cols-7 gap-1 text-center relative z-10">
          {weekInfo.map((item, idx) => {
            const isMilestone = idx === 5; // Friday / 5th day gift highlight

            return (
              <div key={item.dateStr} className="flex flex-col items-center space-y-1.5">
                <span className={`text-[11px] font-bold ${item.isToday ? 'text-amber-400 font-black' : 'text-slate-400'}`}>
                  {item.label}
                </span>

                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    item.isFrozen
                      ? 'bg-sky-400 text-slate-950 shadow-md shadow-sky-400/50 ring-2 ring-sky-300'
                      : item.isCompleted
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/40 ring-2 ring-amber-300 font-black'
                      : item.isToday
                      ? 'bg-amber-500/20 text-amber-300 border-2 border-amber-400 animate-pulse'
                      : 'bg-slate-800 border border-slate-700/80 text-slate-600'
                  }`}
                  title={`${item.full} - ${item.dateStr}`}
                >
                  {item.isFrozen ? (
                    <span className="text-xs font-black">🧊</span>
                  ) : item.isCompleted ? (
                    <Check size={16} strokeWidth={3} />
                  ) : isMilestone ? (
                    <Gift size={14} className="text-amber-400/60" />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Freeze Award / Milestone Announcement Card */}
      {earnedFreeze ? (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-rose-500/20 border-2 border-amber-400/60 rounded-2xl p-4 shadow-lg flex items-center space-x-3.5 animate-pulseGlow">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 shrink-0 shadow-md">
            <Gift size={24} className="fill-slate-950" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-amber-300">Tebrikler! 5 Günlük Seri</h4>
            <p className="text-xs text-slate-200 mt-0.5">
              5 gün aralıksız çalıştın ve <strong>+1 Seri Dondurma</strong> hakkı kazandın!
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 text-base">
              🧊
            </div>
            <div>
              <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                <span>{streakFreezes} Seri Dondurma Hakkı</span>
                <span className="text-[10px] text-slate-400 font-normal">({streakFreezes}/2)</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {streakFreezes >= 2
                  ? 'Maksimum dondurma hakkı dolu (2/2)!'
                  : `${daysUntilNextFreeze} gün sonra yeni dondurma hakkı kazanırsın.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Rozetler / Badges Carousel (Matching screenshot) */}
      <div className="space-y-2 pt-1 border-t border-slate-800">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold text-white text-sm">Rozetler</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setBadgePage(prev => Math.max(0, prev - 1))}
              disabled={badgePage === 0}
              className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setBadgePage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={badgePage >= totalPages - 1}
              className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Badges Grid */}
        <div className="grid grid-cols-4 gap-2">
          {displayedBadges.map((badge) => {
            const isUnlocked = profile.streak >= badge.days;

            return (
              <div
                key={badge.days}
                className={`p-2 rounded-2xl border text-center transition-all flex flex-col items-center justify-between ${
                  isUnlocked
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-slate-800/40 border-slate-800 text-slate-500 opacity-60'
                }`}
              >
                <span className="text-2xl my-1">{badge.icon}</span>
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-white">{badge.days} gün</span>
                  <span className="block text-[10px] text-slate-400 truncate max-w-[65px]">
                    {badge.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dots indicator */}
        <div className="flex items-center justify-center space-x-1.5 pt-1">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setBadgePage(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                badgePage === idx ? 'w-4 bg-amber-400' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 5. Action Button */}
      <div className="pt-2">
        <button
          onClick={onClose}
          className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold text-sm rounded-2xl shadow-sm transition-all flex items-center justify-center space-x-2"
        >
          <span>Devam Et</span>
        </button>
      </div>
    </div>
  );
};
