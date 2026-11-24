// Demo personas. Every number on the design screens comes from these two people.
// Use them for: the dev "load demo data" switch, Storybook stories, snapshot tests, and screenshot comparisons
// against design/screens/*.png. Amounts are in rupees; "L" = lakh (1,00,000), "Cr" = crore (1,00,00,000).
// Dates in the designs assume "today" = 1 Apr 2028 for Manish and Apr 2028 for Sunita.

export type AssetClass = 'cash' | 'debt' | 'indianEquity' | 'globalEquity' | 'gold' | 'other';
export type Priority = 'must' | 'should' | 'nice';
export type Profile = 'safetyFirst' | 'cautious' | 'balanced' | 'growth' | 'aggressive';

export const manish = {
  name: 'Manish',
  age: 32,
  work: 'salaried' as const,
  dependents: 2,
  stage: 'builder' as const,
  payday: '1st',
  riskProfile: 'balanced' as Profile, // capacity says growth, tolerance says balanced → lower wins
  monthly: 55000,
  yearlyRaisePct: 10,
  netWorth: { assets: 8740000, loans: 310000, total: 8430000 },
  goals: [
    { id: 'safety', name: 'Safety net', kind: 'safetyNet', months: 6, status: 'full' },
    { id: 'trip', name: 'Japan trip', target: 300000, date: '2029-10', range: ['2029-08', '2029-11'], priority: 'nice' as Priority, monthly: 3000, required: 3000, affordability: 'comfortable' },
    { id: 'home', name: 'Home', target: 3000000, date: '2031-09', range: ['2031-06', '2031-12'], priority: 'must' as Priority, monthly: 18000, required: 18000, affordability: 'manageable' },
    { id: 'edu', name: "Child's education", target: 4000000, date: '2044-06', priority: 'must' as Priority, monthly: 12500, required: 16000, affordability: 'stretch',
      bands: { almostSure: 2800000, likely: 3400000, possible: 4300000 }, shortBy: 600000 },
    { id: 'retire', name: 'Retirement', targetMonthly: 120000, retireAge: 58, date: '2054', priority: 'should' as Priority, monthly: 9000, required: 7500, affordability: 'comfortable', couldStopAt: 56 },
  ],
  paydaySplit: [
    { to: 'home', amount: 18000 }, { to: 'ppf', amount: 12500 }, { to: 'edu', amount: 12500 },
    { to: 'retire', amount: 9000 }, { to: 'trip', amount: 3000 },
  ],
  checkInMoves: [
    { holding: 'PPF', amount: 12500 }, { holding: 'Nifty 50 index fund', amount: 12600 },
    { holding: 'Short-term debt fund', amount: 12900 }, { holding: 'Flexi-cap fund', amount: 7500 },
    { holding: 'S&P 500 fund', amount: 4500 }, { holding: 'Gold ETF', amount: 2600 }, { holding: 'Liquid fund', amount: 2400 },
  ],
  holdingsByClass: {
    indianEquity: { value: 4400000, items: ['Nifty 50 index fund', 'Flexi-cap fund', 'Small-cap fund', '9 stocks (1 is 11%)'] },
    globalEquity: { value: 2130000, items: ['S&P 500 fund', '4 US stocks'] },
    debt: { value: 1120000, items: ['PPF', 'EPF', 'Short-term debt fund'] },
    gold: { value: 650000, items: ['Gold ETF', 'SGB 2023'], staleDays: 74 },
    cash: { value: 320000, items: ['Liquid fund (safety net)'] },
    other: { value: 120000, items: ['Crypto'], planned: false },
  },
  mix: { // actual vs target, % of planned money
    indianEquity: [51, 44], globalEquity: [25, 20], debt: [13, 26], gold: [8, 8], cash: [4, 2],
  },
  sharedHolding: { name: 'Nifty 50 index fund', value: 1290000, split: [{ goal: 'home', pct: 40 }, { goal: 'retire', pct: 60 }] },
  loans: [{ name: 'Car loan', rate: 9.2, emi: 14800, balance: 310000, emisLeft: 22, ends: '2030-02' }],
  marketFall: { fromHigh: 1220000, pct: 14, current: 7480000, asOf: '1 Apr' },
  habits: { level: 3, streakMonths: 11, shieldUsed: '2027-09', nextLevelProgress: { paydays: [11, 12], blocker: 'Education needs ₹3,500 more' },
    skin: 'secure', unlockedSkins: ['base', 'steady', 'secure', 'diwali-2027', 'holi-2028'],
    challenges: [{ name: 'No skipped payday this quarter', progress: [2, 3] }, { name: 'Max PPF before 31 March', progress: [12500, 150000] }] },
};

export const sunita = {
  name: 'Sunita',
  age: 64,
  work: 'retired' as const,
  stage: 'retiree' as const,
  riskProfile: 'cautious' as Profile,
  income: { monthly: 90000, pension: 25000, fromSavings: 65000, likelyUntil: 98, almostSureUntil: 91 },
  corpus: 24000000, // ₹2.4 Cr → 3.3% withdrawal rate
  buckets: [
    { id: 'cash', label: 'Cash', value: 1560000, covers: 'Next 2 years of spending' },
    { id: 'income', label: 'Income', value: 3900000, covers: 'Years 3 to 7, low risk' },
    { id: 'growth', label: 'Growth', value: 18500000, covers: 'Year 8 onwards' },
  ],
  yearlyRefill: 780000, // each April, income → cash
};
