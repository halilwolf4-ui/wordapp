import React, { useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { speakEnglish, isSpeechEnabled, subscribeSpeechEnabled } from '../services/speech';

interface Props {
  text: string;
  size?: number;
  className?: string;
  rate?: number;
}

export const AudioButton: React.FC<Props> = React.memo(({
  text,
  size = 20,
  className = 'p-2 bg-white text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:bg-[#FFE600] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all',
  rate = 0.9
}) => {
  const isEnabled = useSyncExternalStore(subscribeSpeechEnabled, isSpeechEnabled, () => true);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEnabled) return;
    speakEnglish(text, rate);
  };

  const Icon = isEnabled ? Volume2 : VolumeX;
  const disabledClasses = !isEnabled
    ? 'opacity-40 cursor-not-allowed hover:bg-white active:translate-x-0 active:translate-y-0 active:shadow-[2px_2px_0px_0px_#000]'
    : '';

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isEnabled ? `Pronounce ${text}` : 'Ses kapalı'}
      className={`inline-flex items-center justify-center ${className} ${disabledClasses}`}
    >
      <Icon size={size} strokeWidth={2.5} />
    </button>
  );
});
