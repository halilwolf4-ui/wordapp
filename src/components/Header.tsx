import React from 'react';
import { Flame, Zap, Settings as SettingsIcon } from 'lucide-react';
import { UserProfile } from '../types';
import { xpForNextLevel } from '../services/gamification';

interface Props {
  profile: UserProfile;
  onOpenSpeedRound: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<Props> = ({
  profile,
  onOpenSpeedRound,
  onOpenSettings
}) => {
  const nextLvlXp = xpForNextLevel(profile.level);
  const prevLvlXp = xpForNextLevel(profile.level - 1);
  const currentLvlProgress = Math.max(0, profile.xp - prevLvlXp);
  const currentLvlNeeded = Math.max(1, nextLvlXp - prevLvlXp);
  const progressPct = Math.min(100, Math.round((currentLvlProgress / currentLvlNeeded) * 100));

  return (
    <header className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800/80 px-4 py-2.5 select-none">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Streak & Level */}
        <div className="flex items-center space-x-2">
          {/* Streak */}
          <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-amber-400 font-bold text-xs shadow-sm">
            <Flame size={15} className="text-amber-500 fill-amber-500" />
            <span>{profile.streak} gün</span>
          </div>

          {/* Streak Freeze Badge */}
          {profile.streakFreezes !== undefined && profile.streakFreezes > 0 && (
            <div
              className="flex items-center space-x-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl text-sky-400 font-bold text-xs shadow-sm"
              title={`${profile.streakFreezes} Seri Dondurma Hakkı`}
            >
              <span className="text-xs">🧊</span>
              <span>{profile.streakFreezes}</span>
            </div>
          )}

          {/* Level & XP */}
          <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-xl text-xs shadow-sm">
            <span className="font-extrabold text-indigo-400">Lv.{profile.level}</span>
            <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions: Speed Round & Settings */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenSpeedRound}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 active:scale-95 border border-slate-800 hover:border-slate-700 text-amber-400 text-xs font-bold shadow-sm transition-all"
            title="60 sn Hızlı Tur"
          >
            <Zap size={14} className="fill-amber-400 text-amber-400" />
            <span>60s Tur</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-850 active:scale-95 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-100 transition-all shadow-sm"
            title="Ayarlar"
          >
            <SettingsIcon size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};
