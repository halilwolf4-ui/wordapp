import confetti from 'canvas-confetti';
import { isLowPerformanceDevice } from '../services/performance';

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
    const isLow = isLowPerformanceDevice();
    confetti({
      particleCount: isLow ? 12 : 28,
      spread: isLow ? 45 : 60,
      origin: { x: 0.5, y: 0.65 },
      startVelocity: isLow ? 24 : 30,
      colors: VIBRANT_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 0.9,
      ticks: isLow ? 45 : 72, // ~1.2s duration (shorter on low-end)
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
    const isLow = isLowPerformanceDevice();
    confetti({
      particleCount: isLow ? 16 : 38,
      spread: isLow ? 55 : 75,
      origin: { x: 0.5, y: 0.6 },
      startVelocity: isLow ? 26 : 32,
      ticks: isLow ? 50 : 80,
      zIndex: 9999,
      colors: VIBRANT_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 0.95
    });
  } catch {}
}

/**
 * Golden Star Streak Celebration
 */
export function fireStreakCelebration(): void {
  try {
    const isLow = isLowPerformanceDevice();
    confetti({
      particleCount: isLow ? 14 : 30,
      spread: isLow ? 50 : 65,
      origin: { x: 0.5, y: 0.7 },
      colors: GOLD_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 0.95,
      startVelocity: isLow ? 24 : 30,
      ticks: isLow ? 45 : 72,
      zIndex: 9999
    });
  } catch {}
}

/**
 * Sparkle burst at the exact position of the tapped correct option
 */
export function fireMicroSpark(xRatio: number = 0.5, yRatio: number = 0.5): void {
  try {
    if (isLowPerformanceDevice()) return; // Skip micro-sparks on low-end hardware
    confetti({
      particleCount: 12,
      spread: 45,
      origin: { x: xRatio, y: yRatio },
      startVelocity: 20,
      colors: VIBRANT_PALETTE,
      shapes: ['circle', 'square'],
      scalar: 0.75,
      ticks: 50,
      gravity: 1.2,
      zIndex: 9999
    });
  } catch {}
}
