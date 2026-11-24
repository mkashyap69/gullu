/**
 * The one Indian-number formatter. Every rupee figure in the app goes through here.
 *   formatINR(15584513)                 → "₹1,55,84,513"
 *   formatINR(8430000, { compact: true }) → "₹84.3 L"
 *   formatINR(24000000, { compact: true }) → "₹2.4 Cr"
 * Compact: ≥ ₹1 L shows as L, ≥ ₹1 Cr as Cr, one decimal unless the value is whole.
 * Negative values use a true minus sign: "−₹12.2 L".
 * Marked 'worklet' so count-ups can format on the UI thread.
 */
export const HIDDEN_AMOUNT = '₹ ••••••';
const LAKH = 1_00_000;
const CRORE = 1_00_00_000;
const MINUS = '−';

export type FormatINROptions = {
  compact?: boolean;
  /** Show a leading "+" on positive values (before → after deltas). */
  signed?: boolean;
  /** Hide amounts mode: returns the masked string. */
  hidden?: boolean;
};

export function groupIndian(n: number): string {
  'worklet';
  const s = Math.round(Math.abs(n)).toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

function oneDecimal(v: number): string {
  'worklet';
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1);
}

export function formatINR(value: number, opts: FormatINROptions = {}): string {
  'worklet';
  if (opts.hidden) return HIDDEN_AMOUNT;
  const abs = Math.abs(value);
  const sign = value < 0 && Math.round(abs) !== 0 ? MINUS : opts.signed && value > 0 ? '+' : '';
  let body: string;
  if (opts.compact && Math.round(abs) >= CRORE) body = `${oneDecimal(abs / CRORE)} Cr`;
  else if (opts.compact && Math.round(abs) >= LAKH) {
    const l = oneDecimal(abs / LAKH);
    // 99.96 L rounds to "100 L": show it as crore instead.
    body = l === '100' ? '1 Cr' : `${l} L`;
  } else body = groupIndian(abs);
  return `${sign}₹${body}`;
}
