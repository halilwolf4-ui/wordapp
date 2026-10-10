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
    { id: 'home', label: 'Ana Sayfa', icon: <Home size={20} /> },
    { id: 'learn', label: 'Öğren', icon: <BookOpen size={20} />, badge: newCount },
    { id: 'review', label: 'Tekrar', icon: <Repeat size={20} />, badge: dueCount },
    { id: 'words', label: 'Kelimeler', icon: <Bookmark size={20} /> },
    { id: 'stats', label: 'İstatistik', icon: <BarChart2 size={20} /> }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800/90 pb-safe shadow-2xl">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 select-none ${
                isActive
                  ? 'text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                {item.icon}
                {!!item.badge && item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] flex items-center justify-center text-[10px] font-black text-white bg-rose-500 rounded-full px-1 shadow-sm">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
