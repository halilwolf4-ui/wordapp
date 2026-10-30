import React, { useState, useEffect } from 'react';
import { UserProfile, DailyLog } from '../types';
import { Check, Gift, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';
import { parseDate, formatDate } from '../services/dateUtils';
import { fireStreakCelebration } from './Confetti';

interface Props {
  profile: UserProfile;
  dailyLogs: DailyLog[];
  todayStr: string;
  earnedFreeze?: boolean;
  onClose: () => void;
  onStartExtraReview?: () => void;
  isExtraCompleted?: boolean;
  onStartExtraLearn?: () => void;
  isExtraLearnCompleted?: boolean;
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
  onClose,
  onStartExtraReview,
  isExtraCompleted,
  onStartExtraLearn,
  isExtraLearnCompleted
}) => {
  const [badgePage, setBadgePage] = useState(0);
  const itemsPerPage = 4;
  const totalPages = Math.ceil(STREAK_BADGES.length / itemsPerPage);

  const currentMidday = parseDate(todayStr);
  const dayOfWeek = currentMidday.getDay();
  const sundayDate = new Date(currentMidday.getTime());
  sundayDate.setDate(sundayDate.getDate() - dayOfWeek);

  const weekDays = [
    { label: 'PZ', full: 'Pazar' },
    { label: 'PZT', full: 'Pazartesi' },
    { label: 'S', full: 'Salı' },
    { label: 'ÇA', full: 'Çarşamba' },
    { label: 'PR', full: 'Perşembe' },
    { label: 'CU', full: 'Cuma' },
    { label: 'CTS', full: 'Cumartesi' }
  ];

  const weekInfo = weekDays.map((day, idx) => {
    const d = new Date(sundayDate.getTime());
    d.setDate(d.getDate() + idx);
    const dateStr = formatDate(d);

    const isToday = dateStr === todayStr;
    const isPast = dateStr <= todayStr;
    const isFrozen = (profile.frozenDates || []).includes(dateStr);

    const log = dailyLogs.find(l => l.date === dateStr);
    const hasActivity = (log && (log.correctCount > 0 || log.newLearnedCount > 0 || log.reviewsDone > 0)) || isToday;
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
    <div className="bg-white border-4 border-black p-5 sm:p-6 space-y-5 shadow-[8px_8px_0px_0px_#000] text-black max-w-md mx-auto animate-scaleUp relative select-none">
      {/* Top Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-8 h-8 bg-black text-white border-2 border-black flex items-center justify-center hover:bg-zinc-800 transition-colors shadow-[2px_2px_0px_0px_#FFE600] active:translate-x-0.5 active:translate-y-0.5"
        title="Kapat"
      >
        <X size={18} strokeWidth={3} />
      </button>

      {/* 1. Header: Streak Counter */}
      <div className="pt-2 text-center space-y-1.5">
        <div className={`inline-block border-2 border-black px-4 py-1.5 shadow-[3px_3px_0px_0px_#000] rotate-[-1deg] ${
          isExtraCompleted ? 'bg-[#00F0FF]' : 'bg-[#FFE600]'
        }`}>
          <h2 className="text-2xl sm:text-3xl font-black text-black flex items-center justify-center space-x-2 uppercase tracking-tight">
            <span>{isExtraCompleted ? 'EKSTRA TEKRAR BİTTİ!' : `${profile.streak} GÜNLÜK SERİ!`}</span>
            <span className="text-xl">{isExtraCompleted ? '⚡' : '🔥'}</span>
          </h2>
        </div>
        <p className="text-xs font-bold text-zinc-800 uppercase tracking-wide">
          {isExtraCompleted
            ? 'ÖĞRENDİĞİN TÜM KELİMELERİ PEKİŞTİRDİN. SERİN VE AŞAMALARIN KORUNDU!'
            : isExtraLearnCompleted
            ? 'HARİKA! HEDEFİNİN ÜZERİNDE FAZLADAN KELİMELER ÖĞRENDİN.'
            : 'TEBRİKLER! BUGÜNKÜ GÖREVİNİ BAŞARIYLA TAMAMLADIN.'}
        </p>
      </div>

      {/* 2. Weekly Calendar Timeline */}
      <div className="relative py-2 px-1 bg-[#FDFBF7] border-2 border-black p-3 shadow-[3px_3px_0px_0px_#000]">
        {/* Background Connecting Line */}
        <div className="absolute top-[40px] left-6 right-6 h-1 bg-black -z-0" />

        {/* Days Row */}
        <div className="grid grid-cols-7 gap-1 text-center relative z-10">
          {weekInfo.map((item, idx) => {
            const isMilestone = idx === 5;

            return (
              <div key={item.dateStr} className="flex flex-col items-center space-y-1.5">
                <span className={`text-[10px] font-black ${item.isToday ? 'text-black bg-[#FFE600] border border-black px-1' : 'text-zinc-600'}`}>
                  {item.label}
                </span>

                <div
                  className={`w-8 h-8 border-2 border-black flex items-center justify-center transition-all ${
                    item.isFrozen
                      ? 'bg-[#00F0FF] text-black shadow-[2px_2px_0px_0px_#000]'
                      : item.isCompleted
                      ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000] font-black'
                      : item.isToday
                      ? 'bg-white text-black border-dashed'
                      : 'bg-zinc-200 text-zinc-400'
                  }`}
                  title={`${item.full} - ${item.dateStr}`}
                >
                  {item.isFrozen ? (
                    <span className="text-xs font-black">🧊</span>
                  ) : item.isCompleted ? (
                    <Check size={16} strokeWidth={3.5} />
                  ) : isMilestone ? (
                    <Gift size={14} strokeWidth={2.5} className="text-black" />
                  ) : (
                    <span className="w-1.5 h-1.5 bg-zinc-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Freeze Award / Milestone Announcement Card */}
      {earnedFreeze ? (
        <div className="bg-[#BBF7D0] border-3 border-black p-3.5 shadow-[4px_4px_0px_0px_#000] flex items-center space-x-3.5">
          <div className="w-11 h-11 bg-black border-2 border-black flex items-center justify-center text-[#FFE600] shrink-0 shadow-[2px_2px_0px_0px_#FFE600]">
            <Gift size={22} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-black uppercase tracking-tight">ÖDÜL: 5 GÜNLÜK SERİ KAZANDIN!</h4>
            <p className="text-[11px] font-bold text-zinc-900 mt-0.5">
              5 gün aralıksız çalıştın ve <strong>+1 Seri Dondurma</strong> hakkı kazandın!
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-[#BAE6FD] border-2 border-black p-3 flex items-center justify-between shadow-[3px_3px_0px_0px_#000]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-white border-2 border-black flex items-center justify-center text-sm shadow-[1.5px_1.5px_0px_0px_#000]">
              🧊
            </div>
            <div>
              <h4 className="text-xs font-black text-black uppercase">
                {streakFreezes} SERİ DONDURMA HAKKI ({streakFreezes}/2)
              </h4>
              <p className="text-[10px] font-bold text-zinc-800 mt-0.5">
                {streakFreezes >= 2
                  ? 'Maksimum dondurma hakkı dolu (2/2)!'
                  : `${daysUntilNextFreeze} gün sonra yeni dondurma hakkı kazanırsın.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Rozetler / Badges Carousel */}
      <div className="space-y-2 pt-1 border-t-2 border-black">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-black text-black text-xs uppercase tracking-wider">SERİ ROZETLERİ</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setBadgePage(prev => Math.max(0, prev - 1))}
              disabled={badgePage === 0}
              className="w-6 h-6 bg-white border border-black flex items-center justify-center text-black hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} strokeWidth={3} />
            </button>
            <button
              onClick={() => setBadgePage(prev => Math.min(totalPages - 1, prev + 1))}
              disabled={badgePage >= totalPages - 1}
              className="w-6 h-6 bg-white border border-black flex items-center justify-center text-black hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} strokeWidth={3} />
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
                className={`p-2 border-2 border-black text-center transition-all flex flex-col items-center justify-between ${
                  isUnlocked
                    ? 'bg-[#FEF08A] text-black shadow-[2px_2px_0px_0px_#000]'
                    : 'bg-zinc-200 text-zinc-400 opacity-60'
                }`}
              >
                <span className="text-xl my-1">{badge.icon}</span>
                <div className="space-y-0.5">
                  <span className="block text-xs font-black text-black">{badge.days} GÜN</span>
                  <span className="block text-[9px] font-black uppercase text-zinc-800 truncate max-w-[65px]">
                    {badge.title}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Action Buttons */}
      <div className="pt-2 space-y-2.5">
        {onStartExtraLearn && (
          <button
            onClick={onStartExtraLearn}
            className="w-full py-3.5 bg-[#FFE600] hover:bg-[#ffd700] text-black active:translate-x-[2px] active:translate-y-[2px] font-black uppercase tracking-wider text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] active:shadow-none transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles size={18} strokeWidth={2.5} />
            <span>{isExtraLearnCompleted ? 'YİNE DE FAZLADAN ÖĞRENMEYE DEVAM ET' : 'FAZLADAN ÖĞRENMEYE DEVAM ET'}</span>
          </button>
        )}
        {onStartExtraReview && (
          <button
            onClick={onStartExtraReview}
            className="w-full py-3.5 bg-[#00F0FF] hover:bg-[#5ce1e6] text-black active:translate-x-[2px] active:translate-y-[2px] font-black uppercase tracking-wider text-sm border-2 border-black shadow-[4px_4px_0px_0px_#000] active:shadow-none transition-all flex items-center justify-center space-x-2"
          >
            <Sparkles size={18} strokeWidth={2.5} />
            <span>{isExtraCompleted ? 'YENİDEN EKSTRA TEKRAR YAP' : 'EKSTRA TEKRAR YAP'}</span>
          </button>
        )}
        <button
          onClick={onClose}
          className="w-full py-3 bg-black text-[#FFE600] hover:bg-zinc-900 active:translate-x-[2px] active:translate-y-[2px] font-black uppercase tracking-wider text-xs border-2 border-black shadow-[3px_3px_0px_0px_#FFE600] active:shadow-none transition-all flex items-center justify-center space-x-2"
        >
          <span>{onStartExtraReview || onStartExtraLearn ? 'ANA SAYFAYA DÖN' : 'DEVAM ET'}</span>
        </button>
      </div>
    </div>
  );
};
