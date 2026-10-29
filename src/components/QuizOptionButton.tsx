import React from 'react';
import { Check, X } from 'lucide-react';
import { fireMicroSpark } from './Confetti';

interface QuizOptionButtonProps {
  index: number;
  text: string;
  isSelected: boolean;
  isCorrect: boolean;
  hasFeedback: boolean;
  disabled: boolean;
  onSelect: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const BADGE_COLORS = [
  'bg-[#FFF0EF] text-[#FF5E5B]',
  'bg-[#EDF2FF] text-[#5B8DEF]',
  'bg-[#FFF8E1] text-[#F59E0B]',
  'bg-[#E6FCF5] text-[#12B886]',
];

export const QuizOptionButton: React.FC<QuizOptionButtonProps> = React.memo(({
  index,
  text,
  isSelected,
  isCorrect,
  hasFeedback,
  disabled,
  onSelect
}) => {
  const letter = OPTION_LETTERS[index] || String(index + 1);

  const isSelectedCorrect = hasFeedback && isSelected && isCorrect;
  const isSelectedWrong = hasFeedback && isSelected && !isCorrect;
  const isRevealedCorrect = hasFeedback && !isSelected && isCorrect;
  const isDimmed = hasFeedback && !isCorrect && !isSelected;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (isCorrect) {
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = (rect.left + rect.width / 2) / window.innerWidth;
      const yRatio = (rect.top + rect.height / 2) / window.innerHeight;
      fireMicroSpark(xRatio, yRatio);
    }
    onSelect();
  };

  let containerStyle =
    'bg-white dark:bg-[#151C2C] border border-slate-100/90 dark:border-white/5 text-[#111827] dark:text-slate-100 shadow-[0_6px_20px_rgba(17,24,39,0.04)] hover:shadow-[0_8px_24px_rgba(17,24,39,0.07)]';
  let badgeStyle = BADGE_COLORS[index % BADGE_COLORS.length];
  let animationClass = '';

  if (isSelectedCorrect) {
    containerStyle =
      'bg-[#E6FCF5] dark:bg-emerald-950/80 border-2 border-[#38D399] text-[#065F46] dark:text-emerald-100 shadow-[0_10px_24px_rgba(18,184,134,0.18)]';
    badgeStyle = 'bg-[#12B886] text-white';
    animationClass = 'animate-correct-pop';
  } else if (isSelectedWrong) {
    containerStyle =
      'bg-[#FFF0EF] dark:bg-rose-950/80 border-2 border-[#FF7875] text-[#9F1239] dark:text-rose-100 shadow-[0_10px_24px_rgba(255,94,91,0.18)]';
    badgeStyle = 'bg-[#FF5E5B] text-white';
    animationClass = 'animate-wrong-shake';
  } else if (isRevealedCorrect) {
    containerStyle =
      'bg-[#E6FCF5] dark:bg-emerald-950/70 border-2 border-[#38D399] text-[#065F46] dark:text-emerald-100';
    badgeStyle = 'bg-[#12B886] text-white';
  } else if (isDimmed) {
    containerStyle =
      'bg-slate-50/90 dark:bg-[#1A2336] border border-slate-200/70 dark:border-white/10 text-slate-500 dark:text-slate-300 opacity-75 cursor-default shadow-none';
    badgeStyle = 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200';
  }

  const paddingClass = hasFeedback
    ? 'py-2.5 px-3.5 min-h-[46px]'
    : 'py-3.5 px-4 min-h-[54px]';

  const pillClass = hasFeedback
    ? 'w-8 h-8 text-xs'
    : 'w-9 h-9 text-xs sm:text-sm';

  const textClass = hasFeedback
    ? 'text-xs sm:text-sm font-bold'
    : 'text-sm sm:text-[15px] font-bold';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`group relative w-full rounded-[22px] text-left transition-colors duration-150 select-none flex items-center justify-between gap-3 ${paddingClass} ${containerStyle} ${animationClass}`}
    >
      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
        <span
          className={`shrink-0 rounded-full flex items-center justify-center font-extrabold transition-colors ${pillClass} ${badgeStyle}`}
        >
          {letter}
        </span>

        <span className={`leading-snug break-words flex-1 tracking-tight ${textClass}`}>
          {text}
        </span>
      </div>

      <div className="shrink-0 flex items-center justify-center pl-1">
        {isSelectedCorrect && (
          <div className="w-7 h-7 rounded-full bg-[#12B886] text-white flex items-center justify-center shadow-sm animate-check-bounce">
            <Check size={15} strokeWidth={3} />
          </div>
        )}

        {isSelectedWrong && (
          <div className="w-7 h-7 rounded-full bg-[#FF5E5B] text-white flex items-center justify-center shadow-sm animate-x-bounce">
            <X size={15} strokeWidth={3} />
          </div>
        )}

        {isRevealedCorrect && (
          <div className="w-7 h-7 rounded-full bg-[#12B886] text-white flex items-center justify-center shadow-sm">
            <Check size={15} strokeWidth={3} />
          </div>
        )}

        {!hasFeedback && (
          <div className="w-5 h-5 rounded-full border-2 border-slate-200/80 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 group-hover:border-[#FF5E5B] group-hover:bg-[#FFF0EF] transition-colors" />
        )}
      </div>
    </button>
  );
});
