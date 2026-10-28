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
      {/* Revealed hints displayed as compact, high-contrast pills */}
      {visibleHints.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {visibleHints.map((hint, idx) => {
            const isSynonym = hint.relation === 'synonym';
            const isAntonym = hint.relation === 'antonym';

            const containerStyle = isSynonym
              ? 'bg-[#BBF7D0] text-[#064E3B]'
              : isAntonym
              ? 'bg-[#FECDD3] text-[#881337]'
              : 'bg-[#FEF08A] text-[#0F172A]';

            const relationLabel = isSynonym
              ? 'EŞ ANLAM'
              : isAntonym
              ? 'ZIT ANLAM'
              : 'BENZER';

            return (
              <div
                key={idx}
                data-light-pill="true"
                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full shadow-sm transition-all animate-fadeIn ${containerStyle}`}
              >
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-black/10 text-[#0F172A] shrink-0">
                  {relationLabel}
                </span>
                <span className="text-xs font-extrabold text-[#0F172A] tracking-wide uppercase">
                  {hint.word}
                </span>
                <AudioButton
                  text={hint.word}
                  size={12}
                  className="p-0.5 bg-white/80 rounded-full text-[#0F172A] hover:bg-white active:scale-95"
                />
              </div>
            );
          })}
        </div>
      )}

      {/* High-contrast tactile hint trigger pill */}
      {canRevealNext && !disabled && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            disabled={disabled}
            onClick={onRevealNext}
            data-light-pill="true"
            className="py-1.5 px-4 bg-[#FDE047] hover:bg-[#FACC15] rounded-full text-[#0F172A] font-extrabold text-[11px] flex items-center justify-center space-x-1.5 shadow-sm transition-all uppercase tracking-wide disabled:opacity-50 disabled:pointer-events-none"
          >
            <Lightbulb size={13} strokeWidth={2.8} className="text-[#0F172A] shrink-0" />
            <span className="text-[#0F172A]">
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
