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

  // If encounter 1 (maxAllowed === 0) and no hints revealed, render nothing
  if (visibleHints.length === 0 && !canRevealNext) {
    return null;
  }

  return (
    <div className="w-full max-w-xs sm:max-w-sm mx-auto space-y-1.5 my-1.5 animate-fadeIn">
      {/* Revealed hints stacked vertically in ultra-compact slim badges */}
      {visibleHints.length > 0 && (
        <div className="space-y-1">
          {visibleHints.map((hint, idx) => {
            const isSynonym = hint.relation === 'synonym';
            const isAntonym = hint.relation === 'antonym';

            // Compact styling based on relation:
            // - Eş anlamlı: YEŞİL (emerald)
            // - Zıt anlamlı: KIRMIZI (rose)
            // - Benzer anlamlı: SARI (amber)
            const containerStyle = isSynonym
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
              : isAntonym
              ? 'bg-rose-950/30 border-rose-500/30 text-rose-200'
              : 'bg-amber-950/30 border-amber-500/30 text-amber-200';

            const badgeStyle = isSynonym
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
              : isAntonym
              ? 'bg-rose-500/20 border-rose-500/30 text-rose-300'
              : 'bg-amber-500/20 border-amber-500/30 text-amber-300';

            const relationLabel = isSynonym
              ? 'Eş Anlamlı'
              : isAntonym
              ? 'Zıt Anlamlı'
              : 'Benzer Anlam';

            return (
              <div
                key={idx}
                className={`flex items-center justify-between px-2.5 py-1 rounded-xl border backdrop-blur-xs transition-all duration-200 animate-fadeIn ${containerStyle}`}
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <span
                    className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${badgeStyle}`}
                  >
                    {relationLabel}
                  </span>
                  <span className="text-xs font-bold text-white truncate tracking-wide">
                    {hint.word}
                  </span>
                </div>

                <div className="shrink-0 pl-1.5">
                  <AudioButton
                    text={hint.word}
                    size={13}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ultra-compact hint trigger button */}
      {canRevealNext && (
        <div className="flex justify-center pt-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={onRevealNext}
            className="py-1 px-3 bg-amber-500/10 hover:bg-amber-500/20 active:scale-95 border border-amber-500/30 text-amber-300 font-bold text-[11px] rounded-xl flex items-center justify-center space-x-1.5 transition-all shadow-xs disabled:opacity-50 disabled:pointer-events-none"
          >
            <Lightbulb size={12} className="text-amber-400 shrink-0" />
            <span>
              {revealedCount === 0
                ? 'İpucu Al'
                : `${revealedCount + 1}. İpucu Al`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
