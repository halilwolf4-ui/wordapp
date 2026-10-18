import React from 'react';
import { WordHint } from '../services/hintService';
import { AudioButton } from './AudioButton';
import { Lightbulb } from 'lucide-react';

interface WordHintsListProps {
  hints: WordHint[];
  revealedCount: number;
  maxAllowed: number;
  onRevealNext: () => void;
  disabled?: boolean;
}

export const WordHintsList: React.FC<WordHintsListProps> = ({
  hints,
  revealedCount,
  maxAllowed,
  onRevealNext,
  disabled = false
}) => {
  const visibleHints = hints.slice(0, revealedCount);
  const canRevealNext = revealedCount < maxAllowed && revealedCount < hints.length;

  if (visibleHints.length === 0 && !canRevealNext) {
    return null;
  }

  return (
    <div className="w-full max-w-xs sm:max-w-sm mx-auto space-y-1.5 my-2 animate-fadeIn select-none">
      {/* Revealed hints stacked vertically */}
      {visibleHints.length > 0 && (
        <div className="space-y-1.5">
          {visibleHints.map((hint, idx) => {
            const isSynonym = hint.relation === 'synonym';
            const isAntonym = hint.relation === 'antonym';

            // High-voltage Neo-Brutalist styling based on relation:
            const containerStyle = isSynonym
              ? 'bg-[#BBF7D0] border-2 border-black text-black shadow-[2px_2px_0px_0px_#000]'
              : isAntonym
              ? 'bg-[#FF69B4] border-2 border-black text-black shadow-[2px_2px_0px_0px_#000]'
              : 'bg-[#FEF08A] border-2 border-black text-black shadow-[2px_2px_0px_0px_#000]';

            const badgeStyle = 'bg-black text-white border border-black';

            const relationLabel = isSynonym
              ? 'EŞ ANLAMLI'
              : isAntonym
              ? 'ZIT ANLAMLI'
              : 'BENZER ANLAM';

            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-3 py-1.5 transition-all animate-fadeIn ${containerStyle}`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 shrink-0 ${badgeStyle}`}
                  >
                    {relationLabel}
                  </span>
                  <span className="text-xs font-black text-black truncate tracking-wide uppercase">
                    {hint.word}
                  </span>
                </div>

                <div className="shrink-0 pl-1.5">
                  <AudioButton
                    text={hint.word}
                    size={13}
                    className="p-1 bg-white border border-black text-black hover:bg-[#FFE600] active:scale-95"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Neo-brutalist hint trigger button */}
      {canRevealNext && !disabled && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={onRevealNext}
            className="py-1 px-3.5 bg-[#FFE600] hover:bg-[#ffd700] active:translate-x-[1px] active:translate-y-[1px] border-2 border-black text-black font-black text-[11px] flex items-center justify-center space-x-1.5 shadow-[2px_2px_0px_0px_#000] active:shadow-none transition-all uppercase tracking-wide disabled:opacity-50 disabled:pointer-events-none"
          >
            <Lightbulb size={13} strokeWidth={3} className="text-black shrink-0" />
            <span>
              {revealedCount === 0
                ? 'İPUCU AL'
                : `${revealedCount + 1}. İPUCU AL`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
