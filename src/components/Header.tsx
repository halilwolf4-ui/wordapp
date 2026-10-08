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
    <header className="sticky top-0 z-30 bg-slate-900/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 select-none">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Streak & Level */}
        <div className="flex items-center space-x-3">
          {/* Streak */}
          <div className="flex items-center space-x-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full text-amber-400 font-bold text-xs">
            <Flame size={16} className="text-amber-500 fill-amber-500 animate-pulse" />
            <span>{profile.streak} gün</span>
          </div>

          {/* Level & XP */}
          <div className="flex items-center space-x-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-full text-xs">
            <span className="font-extrabold text-indigo-400">Lv.{profile.level}</span>
            <div className="w-12 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions: Speed Round & Settings */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenSpeedRound}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 active:scale-95 text-xs font-semibold shadow-sm transition-all"
            title="60 sn Hızlı Tur"
          >
            <Zap size={14} className="fill-amber-400" />
            <span>60s Tur</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-95 transition-all"
            title="Ayarlar"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};
