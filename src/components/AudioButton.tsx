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
  size = 20,
  className = 'p-2 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#FFE600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all',
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
      <Volume2 size={size} strokeWidth={2.5} />
    </button>
  );
};
