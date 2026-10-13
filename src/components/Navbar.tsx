import React from 'react';
import { Home, BookOpen, Repeat, Bookmark, BarChart2 } from 'lucide-react';

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
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'home', label: 'Ana Sayfa', icon: <Home size={19} strokeWidth={2.5} /> },
    { id: 'learn', label: 'Öğren', icon: <BookOpen size={19} strokeWidth={2.5} />, badge: newCount },
    { id: 'review', label: 'Tekrar', icon: <Repeat size={19} strokeWidth={2.5} />, badge: dueCount },
    { id: 'words', label: 'Kelimeler', icon: <Bookmark size={19} strokeWidth={2.5} /> },
    { id: 'stats', label: 'İstatistik', icon: <BarChart2 size={19} strokeWidth={2.5} /> }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-[3px] border-black pb-safe shadow-[0_-3px_0px_0px_#000]">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2.5 transition-all duration-100 select-none ${
                isActive
                  ? 'nav-active-tab bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_0px_#000] text-black font-black -translate-y-1'
                  : 'text-zinc-700 dark:text-zinc-300 font-bold hover:text-black dark:hover:text-white border-2 border-transparent'
              }`}
            >
              <div className="relative">
                {item.icon}
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-2.5 -right-3 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-black text-black bg-[#FF69B4] border border-black shadow-[1px_1px_0px_0px_#000] px-1">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wide mt-1 font-black">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
