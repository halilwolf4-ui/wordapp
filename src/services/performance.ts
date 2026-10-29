const LOW_PERF_KEY = 'kelime_avi_low_performance_mode';

/**
 * Checks whether low-performance / battery-saver mode is active.
 * Either explicitly set by user ('true' / 'false') or auto-detected on low-end hardware.
 */
export function isLowPerformanceDevice(): boolean {
  try {
    const saved = localStorage.getItem(LOW_PERF_KEY);
    if (saved !== null) {
      return saved === 'true';
    }

    // Auto-detection rules:
    // 1. Reduced motion preference
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return true;
    }

    // 2. Low CPU cores (4 cores or less)
    if (typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4) {
      return true;
    }

    // 3. Low RAM (4 GB or less, Chrome/Android deviceMemory API)
    if (typeof navigator !== 'undefined') {
      const deviceMemory = (navigator as any).deviceMemory;
      if (typeof deviceMemory === 'number' && deviceMemory <= 4) {
        return true;
      }
    }
  } catch {
    // Ignore and fallback
  }

  return false;
}

export function setLowPerformanceMode(enabled: boolean): void {
  try {
    localStorage.setItem(LOW_PERF_KEY, String(enabled));
    applyPerformanceClass();
  } catch {}
}

export function getLowPerformanceSetting(): { enabled: boolean; isManual: boolean } {
  try {
    const saved = localStorage.getItem(LOW_PERF_KEY);
    if (saved !== null) {
      return { enabled: saved === 'true', isManual: true };
    }
  } catch {}
  return { enabled: isLowPerformanceDevice(), isManual: false };
}

export function applyPerformanceClass(): void {
  if (typeof document === 'undefined') return;
  const isLow = isLowPerformanceDevice();
  if (isLow) {
    document.documentElement.classList.add('low-perf');
  } else {
    document.documentElement.classList.remove('low-perf');
  }
}

