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
 * Spectacular multi-stage celebration confetti
 * Left + Right cannon crossfire followed by center starburst cascade
 */
export function fireCelebration(): void {
  try {
    // 1. Left Cannon
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 65,
      origin: { x: 0.05, y: 0.8 },
      startVelocity: 55,
      colors: VIBRANT_PALETTE,
      shapes: ['star', 'circle'],
      scalar: 1.15,
      ticks: 240,
      zIndex: 9999
    });

    // 2. Right Cannon
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 65,
      origin: { x: 0.95, y: 0.8 },
      startVelocity: 55,
      colors: VIBRANT_PALETTE,
      shapes: ['star', 'circle'],
      scalar: 1.15,
      ticks: 240,
      zIndex: 9999
    });

    // 3. Center starburst explosion (delayed 180ms for layered feel)
    setTimeout(() => {
      try {
        confetti({
          particleCount: 70,
          spread: 100,
          origin: { x: 0.5, y: 0.55 },
          startVelocity: 40,
          gravity: 0.85,
          decay: 0.92,
          colors: VIBRANT_PALETTE,
          shapes: ['star', 'circle', 'square'],
          scalar: 1.25,
          ticks: 260,
          zIndex: 9999
        });
      } catch {}
    }, 180);
  } catch {
    // Graceful fallback
  }
}

/**
 * Grand level-up & milestone celebration with simulated fireworks
 */
export function fireLevelUp(): void {
  try {
    const duration = 2400;
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 35,
      spread: 360,
      ticks: 120,
      zIndex: 9999,
      colors: VIBRANT_PALETTE,
      shapes: ['star', 'circle'] as ('star' | 'circle')[],
      scalar: 1.1
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 28 * (timeLeft / duration);
      // Burst fireworks at random coordinates
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.15, 0.45), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.55, 0.85), y: Math.random() - 0.2 }
      });
    }, 280);
  } catch {}
}

/**
 * Golden Star Streak Celebration
 */
export function fireStreakCelebration(): void {
  try {
    confetti({
      particleCount: 60,
      spread: 80,
      origin: { x: 0.5, y: 0.7 },
      colors: GOLD_PALETTE,
      shapes: ['star'],
      scalar: 1.35,
      startVelocity: 45,
      ticks: 220,
      zIndex: 9999
    });
  } catch {}
}

/**
 * Instant micro-sparkle burst for correct question answers
 */
export function fireMicroSpark(xRatio?: number, yRatio?: number): void {
  try {
    confetti({
      particleCount: 16,
      spread: 55,
      origin: {
        x: xRatio !== undefined ? Math.max(0.1, Math.min(0.9, xRatio)) : 0.5,
        y: yRatio !== undefined ? Math.max(0.1, Math.min(0.9, yRatio)) : 0.65
      },
      colors: ['#10b981', '#34d399', '#6ee7b7', '#fef08a', '#6366f1'],
      shapes: ['star', 'circle'],
      scalar: 0.85,
      startVelocity: 22,
      gravity: 0.7,
      ticks: 75,
      decay: 0.91,
      zIndex: 9999
    });
  } catch {}
}
