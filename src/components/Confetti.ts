import confetti from 'canvas-confetti';

export function fireCelebration(): void {
  try {
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981']
    });
  } catch {
    // Ignore if canvas-confetti is not loaded
  }
}

export function fireLevelUp(): void {
  try {
    const duration = 2 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#6366f1', '#f59e0b', '#10b981']
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ec4899', '#3b82f6', '#8b5cf6']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  } catch {
    // Ignore
  }
}
