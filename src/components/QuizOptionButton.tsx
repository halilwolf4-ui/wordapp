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
  let containerStyle = 'bg-white border-[3px] border-black text-black shadow-[4px_4px_0px_0px_#000] hover:bg-[#FFFBEB] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_0px_#000]';
  let badgeStyle = 'bg-[#FFE600] text-black border-2 border-black font-black shadow-[1.5px_1.5px_0px_0px_#000]';
  let animationClass = '';

  if (isSelectedCorrect) {
    containerStyle = 'bg-[#4ADE80] border-[3px] border-black text-black shadow-[4px_4px_0px_0px_#000]';
    badgeStyle = 'bg-black text-[#4ADE80] border-2 border-black font-black';
    animationClass = 'animate-correct-pop';
  } else if (isSelectedWrong) {
    containerStyle = 'bg-[#FF5588] border-[3px] border-black text-black shadow-[4px_4px_0px_0px_#000]';
    badgeStyle = 'bg-black text-[#FF5588] border-2 border-black font-black';
    animationClass = 'animate-wrong-shake';
  } else if (isRevealedCorrect) {
    containerStyle = 'bg-[#BBF7D0] border-[3px] border-black text-black shadow-[4px_4px_0px_0px_#000] ring-2 ring-black';
    badgeStyle = 'bg-black text-white border-2 border-black font-black';
  } else if (isDimmed) {
    containerStyle = 'bg-zinc-200 border-[3px] border-zinc-400 text-zinc-500 opacity-40 cursor-default shadow-none';
    badgeStyle = 'bg-zinc-300 text-zinc-500 border-2 border-zinc-400 font-bold';
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={`group relative w-full p-3.5 sm:p-4 border text-left transition-all duration-100 select-none flex items-center justify-between gap-3 ${containerStyle} ${animationClass}`}
    >
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        {/* Option Letter Pill */}
        <span
          className={`shrink-0 w-8 h-8 flex items-center justify-center text-xs sm:text-sm font-black transition-colors ${badgeStyle}`}
        >
          {letter}
        </span>

        {/* Option Text */}
        <span className="font-extrabold text-sm sm:text-base leading-snug break-words flex-1 tracking-tight">
          {text}
        </span>
      </div>

      {/* Right Feedback Indicator */}
      <div className="shrink-0 flex items-center justify-center pl-1">
        {isSelectedCorrect && (
          <div className="w-7 h-7 bg-black text-[#4ADE80] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] animate-check-bounce">
            <Check size={16} strokeWidth={3.5} />
          </div>
        )}

        {isSelectedWrong && (
          <div className="w-7 h-7 bg-black text-[#FF5588] border-2 border-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000] animate-x-bounce">
            <X size={16} strokeWidth={3.5} />
          </div>
        )}

        {isRevealedCorrect && (
          <div className="w-7 h-7 bg-white border-2 border-black text-black flex items-center justify-center shadow-[1.5px_1.5px_0px_0px_#000]">
            <Check size={16} strokeWidth={3} />
          </div>
        )}

        {!hasFeedback && (
          <div className="w-4 h-4 border-2 border-black bg-white group-hover:bg-[#FFE600] transition-colors" />
        )}
      </div>
    </button>
  );
};
