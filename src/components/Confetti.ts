import confetti from 'canvas-confetti';

const VIBRANT_PALETTE = [
  '#6366f1', // Indigo
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
];

const GOLD_PALETTE = [
  '#fbbf24', // Amber 400
  '#f59e0b', // Amber 500
  '#fef08a', // Yellow 200
  '#d97706', // Amber 600
  '#ffffff', // Sparkle white
];

/**
 * Lightweight, mobile-friendly celebration confetti
 */
export function fireCelebration(): void {
  try {
    confetti({
      particleCount: 28,
      spread: 70,
      origin: { x: 0.5, y: 0.65 },
      startVelocity: 35,
      colors: VIBRANT_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 0.95,
      ticks: 110,
      disableForReducedMotion: true,
      zIndex: 9999
    });
  } catch {
    // Graceful fallback
  }
}

/**
 * Lightweight level-up & milestone celebration
 */
export function fireLevelUp(): void {
  try {
    confetti({
      particleCount: 35,
      spread: 85,
      origin: { x: 0.5, y: 0.6 },
      startVelocity: 38,
      ticks: 120,
      zIndex: 9999,
      colors: VIBRANT_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 1,
      disableForReducedMotion: true
    });
  } catch {}
}

/**
 * Golden Star Streak Celebration
 */
export function fireStreakCelebration(): void {
  try {
    confetti({
      particleCount: 30,
      spread: 75,
      origin: { x: 0.5, y: 0.7 },
      colors: GOLD_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 1,
      startVelocity: 35,
      ticks: 110,
      disableForReducedMotion: true,
      zIndex: 9999
    });
  } catch {}
}

/**
 * No-op on per-question taps to prevent 2D canvas frame drops on mobile devices.
 * CSS hardware-accelerated transforms provide instant tactile feedback instead.
 */
export function fireMicroSpark(_xRatio?: number, _yRatio?: number): void {
  // Intentionally disabled for mobile 60fps performance
}
