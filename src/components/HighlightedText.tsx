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
  className = 'text-black font-semibold',
  highlightClass = 'font-black text-black bg-[#FFE600] border border-black px-1.5 py-0.5 shadow-[1.5px_1.5px_0px_0px_#000]'
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
