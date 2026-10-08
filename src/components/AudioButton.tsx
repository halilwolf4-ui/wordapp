import React from 'react';
import { Volume2 } from 'lucide-react';
import { speakEnglish } from '../services/speech';

interface Props {
  text: string;
  size?: number;
  className?: string;
  rate?: number;
}

export const AudioButton: React.FC<Props> = ({
  text,
  size = 22,
  className = 'p-2 rounded-full bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 active:scale-95 transition-all',
  rate = 0.9
}) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    speakEnglish(text, rate);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Pronounce ${text}`}
      className={`inline-flex items-center justify-center ${className}`}
    >
      <Volume2 size={size} />
    </button>
  );
};
