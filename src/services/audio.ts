/**
 * Synthesizes sound effects using Web Audio API (0 KB audio assets, 100% offline).
 * Also controls mobile device vibration.
 */

class SoundService {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private vibrationEnabled: boolean = true;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  public setPreferences(sound: boolean, vibration: boolean) {
    this.soundEnabled = sound;
    this.vibrationEnabled = vibration;
  }

  private getContext(): AudioContext | null {
    if (!this.soundEnabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Pleasant ascending bell chime for correct answer
   */
  public playCorrect(combo: number = 1): void {
    const ctx = this.getContext();
    this.vibrate(40);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pitch scales slightly with combo (base 523Hz C5 up to ~880Hz A5)
      const baseFreq = 523.25;
      const multiplier = Math.min(1 + (combo - 1) * 0.08, 1.8);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * multiplier, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * multiplier * 1.5, now + 0.15);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore audio glitches
    }
  }

  /**
   * Gentle, non-punishing low buzz for wrong answer
   */
  public playWrong(): void {
    const ctx = this.getContext();
    this.vibrate([60, 50, 60]);
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.2);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // Ignore audio glitches
    }
  }

  /**
   * Fanfare melody for level up or round completion
   */
  public playLevelUp(): void {
    const ctx = this.getContext();
    this.vibrate([80, 50, 80, 50, 150]);
    if (!ctx) return;

    try {
      const notes = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
      notes.forEach((freq, idx) => {
        const now = ctx.currentTime + idx * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
      });
    } catch {
      // Ignore
    }
  }

  /**
   * Trigger haptic vibration if enabled
   */
  public vibrate(pattern: number | number[]): void {
    if (!this.vibrationEnabled) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore
      }
    }
  }
}

export const sound = new SoundService();
