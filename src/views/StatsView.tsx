import React from 'react';
import { UserProfile, DailyLog } from '../types';
import { BADGES, xpForNextLevel } from '../services/gamification';
import { addDays, getEffectiveDate } from '../services/dateUtils';
import { Flame, Award, CheckCircle, BarChart3, Calendar } from 'lucide-react';

interface Props {
  profile: UserProfile;
  dailyLogs: DailyLog[];
  totalLearned: number;
  totalMastered: number;
}

export const StatsView: React.FC<Props> = ({
  profile,
  dailyLogs,
  totalLearned,
  totalMastered
}) => {
  const today = getEffectiveDate();

  // Map daily logs for fast lookup
  const logsMap = new Map<string, DailyLog>();
  dailyLogs.forEach(l => logsMap.set(l.date, l));

  // Generate last 30 days list
  const last30Days: { date: string; dayNum: number; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const dStr = addDays(today, -i);
    const dayDate = new Date(dStr);
    const count = logsMap.get(dStr)?.correctCount || 0;
    last30Days.push({
      date: dStr,
      dayNum: dayDate.getDate(),
      count
    });
  }

  // Max count in 30 days for bar scaling
  const maxDaily = Math.max(1, ...last30Days.map(d => d.count));

  // Level progress
  const nextLvlXp = xpForNextLevel(profile.level);
  const prevLvlXp = xpForNextLevel(profile.level - 1);
  const currentLvlProgress = Math.max(0, profile.xp - prevLvlXp);
  const currentLvlNeeded = Math.max(1, nextLvlXp - prevLvlXp);
  const lvlPercent = Math.min(100, Math.round((currentLvlProgress / currentLvlNeeded) * 100));

  return (
    <div className="space-y-6 pb-24 pt-1">
      <div>
        <h2 className="text-xl font-black text-white">İstatistik ve Başarılar</h2>
        <p className="text-xs text-slate-400">Öğrenme yolculuğunun detaylı grafikleri</p>
      </div>

      {/* Level & XP Hero Card */}
      <div className="bg-gradient-to-br from-indigo-900/60 via-slate-800 to-purple-900/60 border border-indigo-500/30 rounded-3xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
              Seviye {profile.level}
            </span>
            <h3 className="text-2xl font-black text-white">
              {profile.xp.toLocaleString()} XP
            </h3>
          </div>
          <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/30">
            <Award size={32} />
          </div>
        </div>

        {/* Progress to next level */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Seviye {profile.level + 1} için</span>
            <span>{currentLvlProgress} / {currentLvlNeeded} XP (%{lvlPercent})</span>
          </div>
          <div className="h-2.5 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
              style={{ width: `${lvlPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quick Summary Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 text-center">
          <Flame size={20} className="text-amber-400 mx-auto mb-1 fill-amber-400 animate-pulse" />
          <span className="text-lg font-black text-white">{profile.streak} gün</span>
          <p className="text-[10px] text-slate-400">Aktif Seri</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 text-center">
          <CheckCircle size={20} className="text-emerald-400 mx-auto mb-1" />
          <span className="text-lg font-black text-emerald-400">{totalMastered}</span>
          <p className="text-[10px] text-slate-400">Mastered</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-3 text-center">
          <BarChart3 size={20} className="text-indigo-400 mx-auto mb-1" />
          <span className="text-lg font-black text-indigo-400">{totalLearned}</span>
          <p className="text-[10px] text-slate-400">Hafızada</p>
        </div>
      </div>

      {/* Streak Freeze Status Banner */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3 flex items-center justify-between text-xs">
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
        <span className="px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-sky-300 font-bold text-[10px]">
          {profile.consecutiveCompletedDays || 0}/5 Gün
        </span>
      </div>

      {/* 30-Day Activity Heatmap */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <Calendar size={16} className="text-indigo-400" />
            <span>Son 30 Gün Takvim Isı Haritası</span>
          </h4>
          <span className="text-xs text-slate-400">Geçmiş 30 gün</span>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 pt-2">
          {last30Days.map((day) => {
            let bgClass = 'bg-slate-900/80 border-slate-800 text-slate-600';
            if (day.count > 0 && day.count < 10) bgClass = 'bg-emerald-950 border-emerald-800 text-emerald-300';
            else if (day.count >= 10 && day.count < 25) bgClass = 'bg-emerald-800 border-emerald-600 text-emerald-100 font-bold';
            else if (day.count >= 25) bgClass = 'bg-emerald-500 border-emerald-400 text-slate-950 font-black';

            return (
              <div
                key={day.date}
                title={`${day.date}: ${day.count} kelime`}
                className={`h-11 rounded-xl border flex flex-col items-center justify-center p-1 transition-all ${bgClass}`}
              >
                <span className="text-[11px] leading-tight">{day.dayNum}</span>
                <span className="text-[9px] opacity-80">{day.count > 0 ? `${day.count}` : '-'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Correct Bar Chart (Last 14 Days) */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 space-y-3">
        <h4 className="text-sm font-bold text-white flex items-center space-x-2">
          <BarChart3 size={16} className="text-emerald-400" />
          <span>Günlük Doğru Sayısı Grafiği</span>
        </h4>

        <div className="h-32 flex items-end justify-between gap-1 pt-4 px-1">
          {last30Days.slice(-14).map((d) => {
            const barHeightPct = Math.max(8, Math.round((d.count / maxDaily) * 100));
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center space-y-1">
                <div
                  className="w-full bg-gradient-to-t from-indigo-600 to-emerald-400 rounded-t-md transition-all duration-500 min-h-[4px]"
                  style={{ height: `${d.count > 0 ? barHeightPct : 4}%` }}
                  title={`${d.date}: ${d.count} doğru`}
                />
                <span className="text-[9px] text-slate-400 font-mono">
                  {d.dayNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badges Section */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center space-x-2">
            <Award size={16} className="text-amber-400" />
            <span>Rozetler ({profile.unlockedBadges.length} / {BADGES.length})</span>
          </h4>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {BADGES.map((b) => {
            const unlocked = profile.unlockedBadges.includes(b.id);
            return (
              <div
                key={b.id}
                className={`p-3 rounded-2xl border flex items-center space-x-3 transition-all ${
                  unlocked
                    ? 'bg-slate-800 border-amber-500/30'
                    : 'bg-slate-900/40 border-slate-800 opacity-50 grayscale'
                }`}
              >
                <div className="text-2xl">{b.icon}</div>
                <div>
                  <h5 className="text-xs font-bold text-white">{b.title}</h5>
                  <p className="text-[10px] text-slate-400">{b.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
