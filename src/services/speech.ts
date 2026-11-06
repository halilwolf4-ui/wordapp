/**
 * Web Speech API wrapper for offline English pronunciation.
 * Does not require internet or external mp3 files.
 */

let speechEnabled = true;
const speechListeners = new Set<(enabled: boolean) => void>();

export function isSpeechEnabled(): boolean {
  return speechEnabled;
}

export function subscribeSpeechEnabled(listener: (enabled: boolean) => void): () => void {
  speechListeners.add(listener);
  return () => {
    speechListeners.delete(listener);
  };
}

export function setSpeechEnabled(enabled: boolean): void {
  speechEnabled = enabled;
  if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
  speechListeners.forEach(fn => fn(enabled));
}

export function speakEnglish(text: string, rate: number = 0.9): void {
  if (!speechEnabled) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
    return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  try {
    window.speechSynthesis.cancel(); // Stop ongoing speech

    // Clean any leading "to " if user prefers or keep it
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = Math.max(0.5, Math.min(1.5, rate));

    // Try finding native English voice if available
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith('en-US')) ||
                    voices.find(v => v.lang.startsWith('en'));
    if (enVoice) {
      utterance.voice = enVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Speech synthesis error:', err);
  }
}
