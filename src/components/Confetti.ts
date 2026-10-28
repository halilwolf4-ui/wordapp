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
 * Celebration confetti (fires on typing correct answers and round completions)
 */
export function fireCelebration(): void {
  try {
    confetti({
      particleCount: 45,
      spread: 70,
      origin: { x: 0.5, y: 0.65 },
      startVelocity: 35,
      colors: VIBRANT_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 0.95,
      ticks: 120,
      zIndex: 9999
    });
  } catch {
    // Graceful fallback
  }
}

/**
 * Level-up & milestone celebration
 */
export function fireLevelUp(): void {
  try {
    confetti({
      particleCount: 65,
      spread: 85,
      origin: { x: 0.5, y: 0.6 },
      startVelocity: 38,
      ticks: 130,
      zIndex: 9999,
      colors: VIBRANT_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 1
    });
  } catch {}
}

/**
 * Golden Star Streak Celebration
 */
export function fireStreakCelebration(): void {
  try {
    confetti({
      particleCount: 50,
      spread: 75,
      origin: { x: 0.5, y: 0.7 },
      colors: GOLD_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 1,
      startVelocity: 35,
      ticks: 120,
      zIndex: 9999
    });
  } catch {}
}

/**
 * Sparkle burst at the exact position of the tapped correct option
 */
export function fireMicroSpark(xRatio: number = 0.5, yRatio: number = 0.5): void {
  try {
    confetti({
      particleCount: 18,
      spread: 55,
      origin: { x: xRatio, y: yRatio },
      startVelocity: 22,
      colors: VIBRANT_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 0.8,
      ticks: 70,
      gravity: 1.1,
      zIndex: 9999
    });
  } catch {}
}
