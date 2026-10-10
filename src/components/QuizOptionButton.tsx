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

export const QuizOptionButton: React.FC<QuizOptionButtonProps> = ({
  index,
  text,
  isSelected,
  isCorrect,
  hasFeedback,
  disabled,
  onSelect
}) => {
  const letter = OPTION_LETTERS[index] || String(index + 1);

  // Determine state
  const isSelectedCorrect = hasFeedback && isSelected && isCorrect;
  const isSelectedWrong = hasFeedback && isSelected && !isCorrect;
  const isRevealedCorrect = hasFeedback && !isSelected && isCorrect;
  const isDimmed = hasFeedback && !isCorrect && !isSelected;

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    // If correct, fire micro sparkle at button click coordinates
    if (isCorrect) {
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = (rect.left + rect.width / 2) / window.innerWidth;
      const yRatio = (rect.top + rect.height / 2) / window.innerHeight;
      fireMicroSpark(xRatio, yRatio);
    }
    
    onSelect();
  };

  // Base container styles
  let containerStyle = 'bg-slate-900 border-slate-800/90 text-slate-100 hover:border-slate-700 hover:bg-slate-850/90 shadow-sm';
  let badgeStyle = 'bg-slate-800 text-slate-300 border-slate-700/80';
  let animationClass = '';

  if (isSelectedCorrect) {
    containerStyle = 'bg-emerald-950/40 border-emerald-500 text-emerald-100 ring-2 ring-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]';
    badgeStyle = 'bg-emerald-500 text-white border-emerald-400 font-bold';
    animationClass = 'animate-correct-pop';
  } else if (isSelectedWrong) {
    containerStyle = 'bg-rose-950/40 border-rose-500 text-rose-100 ring-2 ring-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.25)]';
    badgeStyle = 'bg-rose-500 text-white border-rose-400 font-bold';
    animationClass = 'animate-wrong-shake';
  } else if (isRevealedCorrect) {
    containerStyle = 'bg-emerald-950/30 border-emerald-500/80 text-emerald-200 animate-beacon-pulse';
    badgeStyle = 'bg-emerald-500/30 text-emerald-300 border-emerald-500/60 font-bold';
  } else if (isDimmed) {
    containerStyle = 'bg-slate-900/40 border-slate-850 text-slate-500 opacity-40 cursor-default';
    badgeStyle = 'bg-slate-850/50 text-slate-600 border-slate-800';
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`group relative w-full p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all duration-200 select-none flex items-center justify-between gap-3 active:scale-[0.985] ${containerStyle} ${animationClass}`}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Option Letter Pill */}
        <span
          className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border flex items-center justify-center text-xs sm:text-sm font-bold transition-colors ${badgeStyle}`}
        >
          {letter}
        </span>

        {/* Option Text */}
        <span className="font-semibold text-sm sm:text-base leading-snug break-words flex-1">
          {text}
        </span>
      </div>

      {/* Right Feedback Indicator */}
      <div className="shrink-0 flex items-center justify-center pl-1">
        {isSelectedCorrect && (
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md animate-check-bounce">
            <Check size={14} strokeWidth={3} />
          </div>
        )}

        {isSelectedWrong && (
          <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md animate-x-bounce">
            <X size={14} strokeWidth={3} />
          </div>
        )}

        {isRevealedCorrect && (
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center">
            <Check size={14} strokeWidth={2.5} />
          </div>
        )}

        {!hasFeedback && (
          <div className="w-4 h-4 rounded-full border border-slate-700 group-hover:border-slate-500 transition-colors" />
        )}
      </div>
    </button>
  );
};
