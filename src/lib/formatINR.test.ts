import { formatINR, groupIndian, HIDDEN_AMOUNT } from './formatINR';

describe('formatINR', () => {
  it('formats full Indian grouping', () => {
    expect(formatINR(15584513)).toBe('₹1,55,84,513');
    expect(formatINR(55000)).toBe('₹55,000');
    expect(formatINR(999)).toBe('₹999');
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(1000)).toBe('₹1,000');
    expect(formatINR(100000)).toBe('₹1,00,000');
    expect(formatINR(240000000)).toBe('₹24,00,00,000');
  });
  it('formats compact lakh and crore', () => {
    expect(formatINR(8430000, { compact: true })).toBe('₹84.3 L');
    expect(formatINR(24000000, { compact: true })).toBe('₹2.4 Cr');
    expect(formatINR(3000000, { compact: true })).toBe('₹30 L');
    expect(formatINR(10000000, { compact: true })).toBe('₹1 Cr');
    expect(formatINR(600000, { compact: true })).toBe('₹6 L');
    expect(formatINR(1220000, { compact: true })).toBe('₹12.2 L');
    expect(formatINR(55000, { compact: true })).toBe('₹55,000');
    expect(formatINR(9996000, { compact: true })).toBe('₹1 Cr');
  });
  it('signs and hides', () => {
    expect(formatINR(-1220000, { compact: true })).toBe('−₹12.2 L');
    expect(formatINR(3500, { signed: true })).toBe('+₹3,500');
    expect(formatINR(-0.2)).toBe('₹0');
    expect(formatINR(55000, { hidden: true })).toBe(HIDDEN_AMOUNT);
  });
  it('groups', () => {
    expect(groupIndian(12345678)).toBe('1,23,45,678');
  });
});
