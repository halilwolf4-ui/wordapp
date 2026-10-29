import React from 'react';

interface Props {
  text: string;
  className?: string;
}

/**
 * Renders text and highlights segments enclosed in #...#
 * Guaranteed high-contrast in both Light and Dark mode.
 */
export const HighlightedText: React.FC<Props> = React.memo(({ text, className = '' }) => {
  if (!text) return null;

  const parts = text.split(/(#[^#]+#)/g);

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.startsWith('#') && part.endsWith('#')) {
          const cleanWord = part.slice(1, -1);
          return (
            <span
              key={idx}
              data-light-pill="true"
              className="font-extrabold text-[#0F172A] bg-[#FDE047] px-1.5 py-0.5 rounded-md mx-0.5 inline-block shadow-sm"
            >
              {cleanWord}
            </span>
          );
        }
        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
});
