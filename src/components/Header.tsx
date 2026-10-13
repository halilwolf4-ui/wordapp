import React from 'react';
import { Flame, Zap, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { UserProfile } from '../types';
import { xpForNextLevel } from '../services/gamification';

interface Props {
  profile: UserProfile;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onOpenSpeedRound: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<Props> = ({
  profile,
  isDark = false,
  onToggleTheme,
  onOpenSpeedRound,
  onOpenSettings
}) => {
  const nextLvlXp = xpForNextLevel(profile.level);
  const prevLvlXp = xpForNextLevel(profile.level - 1);
  const currentLvlProgress = Math.max(0, profile.xp - prevLvlXp);
  const currentLvlNeeded = Math.max(1, nextLvlXp - prevLvlXp);
  const progressPct = Math.min(100, Math.round((currentLvlProgress / currentLvlNeeded) * 100));

  return (
    <header className="sticky top-0 z-30 bg-[#FFE600] border-b-[3px] border-black px-3.5 py-2 select-none shadow-[0_3px_0px_0px_#000]">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        {/* Streak & Level */}
        <div className="flex items-center space-x-2">
          {/* Streak Badge */}
          <div className="header-pill flex items-center space-x-1.5 bg-white border-2 border-black px-2.5 py-1 text-black font-black text-xs shadow-[2px_2px_0px_0px_#000]">
            <Flame size={14} className="text-[#FF5722] fill-[#FF5722] flame-icon" />
            <span>{profile.streak} GÜN</span>
          </div>

          {/* Streak Freeze Badge */}
          {profile.streakFreezes !== undefined && profile.streakFreezes > 0 && (
            <div
              className="flex items-center space-x-1 bg-[#00F0FF] border-2 border-black px-2 py-1 text-black font-black text-xs shadow-[2px_2px_0px_0px_#000]"
              title={`${profile.streakFreezes} Seri Dondurma Hakkı`}
            >
              <span className="text-xs">🧊</span>
              <span>{profile.streakFreezes}</span>
            </div>
          )}

          {/* Level & XP */}
          <div className="header-pill flex items-center space-x-2 bg-white border-2 border-black px-2.5 py-1 text-xs shadow-[2px_2px_0px_0px_#000]">
            <span className="font-black text-black tracking-tight">LV.{profile.level}</span>
            <div className="w-12 h-2.5 bg-zinc-200 border border-black overflow-hidden relative level-bar-track">
              <div
                className="h-full bg-black level-bar-fill transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Actions: Theme Toggle, Speed Round & Settings */}
        <div className="flex items-center space-x-1.5 sm:space-x-2">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="header-pill w-8 h-8 bg-white hover:bg-zinc-100 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              title={isDark ? 'Gündüz Moduna Geç' : 'Gece Moduna Geç'}
            >
              {isDark ? (
                <Sun size={16} strokeWidth={2.5} className="text-[#FFE600] fill-[#FFE600]" data-sun-icon="true" />
              ) : (
                <Moon size={16} strokeWidth={2.5} className="text-black" />
              )}
            </button>
          )}

          <button
            onClick={onOpenSpeedRound}
            className="flex items-center space-x-1 px-2 py-1 bg-[#FF69B4] hover:bg-[#ff52a8] border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            title="60 sn Hızlı Tur"
          >
            <Zap size={14} className="fill-black text-black" />
            <span className="tracking-wide">60s</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="header-pill w-8 h-8 bg-white hover:bg-zinc-100 border-2 border-black flex items-center justify-center text-black shadow-[2px_2px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            title="Ayarlar"
          >
            <SettingsIcon size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </header>
  );
};
