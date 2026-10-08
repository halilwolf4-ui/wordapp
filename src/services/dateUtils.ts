/**
 * Date utility with 04:00 AM day boundary logic.
 * A day runs from 04:00 AM to 03:59 AM the next day.
 */

export function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // midday to avoid daylight saving issues
}

export function getEffectiveDate(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  // If before 04:00 AM, shift by -1 day
  if (d.getHours() < 4) {
    d.setDate(d.getDate() - 1);
  }
  return formatDate(d);
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function daysBetween(dateStrA: string, dateStrB: string): number {
  const dA = parseDate(dateStrA);
  const dB = parseDate(dateStrB);
  const diffTime = dB.getTime() - dA.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}
