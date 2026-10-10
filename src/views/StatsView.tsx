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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-sm">
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
                  className="w-full bg-indigo-500 hover:bg-indigo-400 rounded-t-md transition-all duration-300 min-h-[4px]"
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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
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
                    ? 'bg-slate-850 border-amber-500/30'
                    : 'bg-slate-950/60 border-slate-850 opacity-40 grayscale'
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
