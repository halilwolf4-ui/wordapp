import React from 'react';
import { Home, Repeat, Bookmark, Trophy } from 'lucide-react';

export type NavTab = 'home' | 'learn' | 'review' | 'words' | 'stats';

interface Props {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  dueCount: number;
  newCount: number;
}

export const Navbar: React.FC<Props> = ({
  currentTab,
  onTabChange,
  dueCount,
  newCount
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#151C2C] pb-safe rounded-t-[30px] shadow-[0_-10px_35px_rgba(17,24,39,0.06)] border-t border-slate-100/80 dark:border-white/5">
      <div className="max-w-md mx-auto grid grid-cols-5 items-center px-3 py-2">
        {/* 1. Ana Sayfa */}
        <button
          onClick={() => onTabChange('home')}
          className="flex flex-col items-center justify-center py-1 select-none"
        >
          <div
            className={`w-10 h-8 rounded-2xl flex items-center justify-center transition-colors ${
              currentTab === 'home'
                ? 'bg-[#FFF0EF] dark:bg-rose-950/60 text-[#FF5E5B]'
                : 'text-[#6B7280] dark:text-slate-400'
            }`}
          >
            <Home size={20} strokeWidth={2.2} />
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
              currentTab === 'home'
                ? 'font-extrabold text-[#FF5E5B]'
                : 'font-semibold text-[#6B7280] dark:text-slate-400'
            }`}
          >
            Ana Sayfa
          </span>
        </button>

        {/* 2. Tekrar */}
        <button
          onClick={() => onTabChange('review')}
          className="flex flex-col items-center justify-center py-1 select-none"
        >
          <div
            className={`relative w-10 h-8 rounded-2xl flex items-center justify-center transition-colors ${
              currentTab === 'review'
                ? 'bg-[#FFF0EF] dark:bg-rose-950/60 text-[#FF5E5B]'
                : 'text-[#6B7280] dark:text-slate-400'
            }`}
          >
            <Repeat size={20} strokeWidth={2.2} />
            {dueCount > 0 && (
              <span className="absolute -top-1 -right-1.5 min-w-[16px] h-[16px] rounded-full bg-[#FF9209] text-white text-[9px] font-extrabold flex items-center justify-center px-1 border-2 border-white dark:border-[#151C2C]">
                {dueCount > 99 ? '99+' : dueCount}
              </span>
            )}
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
              currentTab === 'review'
                ? 'font-extrabold text-[#FF5E5B]'
                : 'font-semibold text-[#6B7280] dark:text-slate-400'
            }`}
          >
            Tekrar
          </span>
        </button>

        {/* 3. CENTER ELEVATED PLAY BUTTON -> Öğren (Exact Glowing Coral Center Circle from Image 4!) */}
        <div className="flex flex-col items-center justify-center">
          <button
            onClick={() => onTabChange('learn')}
            className="relative w-14 h-14 -mt-6 rounded-full bg-gradient-to-tr from-[#FF5E5B] to-[#FF8563] text-white flex items-center justify-center shadow-[0_10px_25px_rgba(255,94,91,0.5)] ring-4 ring-white dark:ring-[#151C2C]"
            title="Yeni Kelimeler Öğren"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current ml-0.5">
              <path d="M6 4.5v15l13-7.5L6 4.5z" />
            </svg>
            {newCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-[#6C8EFF] text-white text-[9px] font-extrabold flex items-center justify-center px-1 border-2 border-white dark:border-[#151C2C]">
                {newCount > 99 ? '99+' : newCount}
              </span>
            )}
          </button>
          <span
            className={`text-[10px] mt-1 tracking-tight ${
              currentTab === 'learn'
                ? 'font-extrabold text-[#FF5E5B]'
                : 'font-semibold text-[#6B7280] dark:text-slate-400'
            }`}
          >
            Öğren
          </span>
        </div>

        {/* 4. Sözlük */}
        <button
          onClick={() => onTabChange('words')}
          className="flex flex-col items-center justify-center py-1 select-none"
        >
          <div
            className={`w-10 h-8 rounded-2xl flex items-center justify-center transition-colors ${
              currentTab === 'words'
                ? 'bg-[#FFF0EF] dark:bg-rose-950/60 text-[#FF5E5B]'
                : 'text-[#6B7280] dark:text-slate-400'
            }`}
          >
            <Bookmark size={20} strokeWidth={2.2} />
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
              currentTab === 'words'
                ? 'font-extrabold text-[#FF5E5B]'
                : 'font-semibold text-[#6B7280] dark:text-slate-400'
            }`}
          >
            Sözlük
          </span>
        </button>

        {/* 5. Ödüller (Stats & Badges) */}
        <button
          onClick={() => onTabChange('stats')}
          className="flex flex-col items-center justify-center py-1 select-none"
        >
          <div
            className={`w-10 h-8 rounded-2xl flex items-center justify-center transition-colors ${
              currentTab === 'stats'
                ? 'bg-[#FFF0EF] dark:bg-rose-950/60 text-[#FF5E5B]'
                : 'text-[#6B7280] dark:text-slate-400'
            }`}
          >
            <Trophy size={20} strokeWidth={2.2} />
          </div>
          <span
            className={`text-[10px] mt-0.5 tracking-tight ${
              currentTab === 'stats'
                ? 'font-extrabold text-[#FF5E5B]'
                : 'font-semibold text-[#6B7280] dark:text-slate-400'
            }`}
          >
            Ödüller
          </span>
        </button>
      </div>
    </nav>
  );
};
