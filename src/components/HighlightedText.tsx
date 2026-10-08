import React from 'react';

interface Props {
  text: string;
  className?: string;
  highlightClass?: string;
}

/**
 * Highlights text wrapped inside #...# delimiters.
 * Removes '#' characters and applies styling to the highlighted word.
 */
export const HighlightedText: React.FC<Props> = ({
  text,
  className = 'text-slate-300',
  highlightClass = 'font-bold text-amber-400 bg-amber-400/10 px-1 py-0.5 rounded'
}) => {
  if (!text) return null;

  // Split by #...#
  const parts = text.split(/(#[^#]+#)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('#') && part.endsWith('#')) {
          const cleanWord = part.slice(1, -1);
          return (
            <span key={index} className={highlightClass}>
              {cleanWord}
            </span>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};
