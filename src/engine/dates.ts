// Month arithmetic and labels. A YM is `year * 12 + monthIndex` (monthIndex 0 = Jan).
import type { YM } from './types';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const ym = (year: number, month1to12: number): YM => year * 12 + (month1to12 - 1);
export const ymYear = (v: YM) => Math.floor(v / 12);
export const ymMonth = (v: YM) => v % 12; // 0 = Jan
export const addMonths = (v: YM, n: number): YM => v + n;

/** "2031-09" → YM */
export function parseYM(s: string): YM {
  const [y, m] = s.split('-').map(Number);
  return ym(y, m || 1);
}
export const formatYMKey = (v: YM) => `${ymYear(v)}-${String(ymMonth(v) + 1).padStart(2, '0')}`;

/** "Sep 2031" */
export const labelYM = (v: YM) => `${MONTHS[ymMonth(v)]} ${ymYear(v)}`;

/** "Sep 2031 (Jun–Dec)" — the likely month with the possible–almost sure range (research change 6). */
export function labelWithRange(likely: YM, range: [YM, YM] | null): string {
  if (!range) return labelYM(likely);
  const [a, b] = range;
  const sameYear = ymYear(a) === ymYear(b);
  const inner = sameYear ? `${MONTHS[ymMonth(a)]}–${MONTHS[ymMonth(b)]}` : `${labelYM(a)} – ${labelYM(b)}`;
  return `${labelYM(likely)} (${inner})`;
}

/** Whole months between two YMs. */
export const monthsBetween = (from: YM, to: YM) => to - from;
