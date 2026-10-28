import React from 'react';
import { Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import { UserProfile } from '../types';
import { CharacterIllustration, getStageForLevel, useCharacterGender } from './CharacterAvatar';

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
  onOpenSettings
}) => {
  const [gender, setGender] = useCharacterGender();
  const stageInfo = getStageForLevel(profile.level);

  return (
    <header className="sticky top-0 z-30 bg-[#F7F8FC]/90 dark:bg-[#0B0F19]/90 backdrop-blur-xl px-4 pt-3.5 pb-2.5 select-none">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2.5">
        {/* Left: Evolving Character Avatar & Greeting */}
        <div className="flex items-center space-x-3 min-w-0">
          <button
            type="button"
            onClick={() => setGender(gender === 'male' ? 'female' : 'male')}
            title="Cinsiyeti değiştirmek için dokun (Erkek / Kadın)"
            className="relative shrink-0 w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#FF5E5B] via-[#FF8A65] to-[#FFD166] shadow-[0_6px_16px_rgba(255,94,91,0.28)]"
          >
            <div className="w-full h-full rounded-full bg-[#FFF0E5] overflow-hidden flex items-center justify-center">
              <CharacterIllustration
                level={profile.level}
                gender={gender}
                variant="avatar"
                className="w-11 h-11"
              />
            </div>
            <span
              data-light-pill="true"
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white text-[#0F172A] text-[10px] font-black flex items-center justify-center shadow-md border border-slate-200"
            >
              {gender === 'female' ? '♀' : '♂'}
            </span>
          </button>

          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h1 className="text-[17px] sm:text-[18px] font-extrabold text-[#111827] dark:text-white leading-tight tracking-tight truncate">
                Hey, {stageInfo.title}!
              </h1>
              <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0">
                <path
                  d="M18.5 11.5c0-3.5-2.5-6.5-6-6.5S6.5 8 6.5 11.5c0 4 2.5 7 6 7s6-3 6-7z"
                  fill="#FFD166"
                />
                <path
                  d="M12 3.5v4M8.5 5l2 3.5M15.5 5l-2 3.5"
                  stroke="#F59E0B"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-[11px] font-semibold text-[#6B7280] dark:text-slate-400 truncate mt-0.5">
              Seviye {profile.level} • {gender === 'female' ? 'Kadın Karakter' : 'Erkek Karakter'}
            </p>
          </div>
        </div>

        {/* Right: 3D Flame Streak Pill + Theme & Settings */}
        <div className="flex items-center space-x-2 shrink-0">
          <div
            className="flex items-center space-x-1.5 bg-[#FFF3E0] dark:bg-orange-950/60 px-3.5 py-1.5 rounded-full shadow-[0_4px_12px_rgba(255,138,0,0.12)]"
            title={`${profile.streak} Günlük Seri`}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0">
              <defs>
                <linearGradient id="flameOuter" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF9F1C" />
                  <stop offset="100%" stopColor="#FF5400" />
                </linearGradient>
              </defs>
              <path
                d="M12 2C9.5 6 6 8.5 6 13.5C6 17.6 8.7 21 12 21C15.3 21 18 17.6 18 13.5C18 10 15.8 7.5 14.5 5.5C14.2 7.5 13 8.5 12 8.5C12.8 6 12.8 4 12 2Z"
                fill="url(#flameOuter)"
              />
              <path
                d="M12 11C10.5 13 9.5 14.2 9.5 16.2C9.5 18.2 10.6 19.5 12 19.5C13.4 19.5 14.5 18.2 14.5 16.2C14.5 14.5 13.5 13 12 11Z"
                fill="#FFE66D"
              />
            </svg>
            <span className="text-[13px] font-extrabold text-[#FF6D00] dark:text-orange-300 tabular-nums">
              {profile.streak}
            </span>
          </div>

          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="w-10 h-10 rounded-full bg-white dark:bg-[#151C2C] flex items-center justify-center text-slate-600 dark:text-slate-200 shadow-[0_4px_14px_rgba(17,24,39,0.05)] border border-slate-100 dark:border-white/5"
              title={isDark ? 'Gündüz Moduna Geç' : 'Gece Moduna Geç'}
            >
              {isDark ? (
                <Sun size={18} strokeWidth={2.2} className="text-[#FBBF24] fill-[#FBBF24]" />
              ) : (
                <Moon size={18} strokeWidth={2.2} className="text-slate-600" />
              )}
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#151C2C] flex items-center justify-center text-slate-600 dark:text-slate-200 shadow-[0_4px_14px_rgba(17,24,39,0.05)] border border-slate-100 dark:border-white/5"
            title="Ayarlar"
          >
            <SettingsIcon size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </header>
  );
};
