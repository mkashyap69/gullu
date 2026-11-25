/**
 * Demo data: Manish (32) and Sunita (64), built from seed/fixtures/personas.ts.
 * "Today" is 1 Apr 2028 for both. Holding names are the user's own holdings in the designs;
 * the app never names a fund or stock the user didn't add, so individual stocks are "Stock A" etc.
 */
import { ym } from '../engine/dates';
import type { Assumptions, FlowRule, Goal, Holding, HoldingGoal, Loan, PlanInput, Profile } from '../engine/types';
import { DEFAULT_SETTINGS, type AppData, type HabitEvent, type Payday } from './repo';

export const DEMO_TODAY = ym(2028, 4);

export const defaultAssumptions = (): Assumptions => ({
  returnPct: { cash: 5.5, debt: 7, indianEquity: 12, globalEquity: 11, gold: 8, other: 0 },
  volatilityPct: { cash: 0.5, debt: 2.5, indianEquity: 15, globalEquity: 14, gold: 12, other: 0 },
  inflationPct: 6,
  stepUpPct: 10,
  retirementRealReturnPct: 2.5,
  showTodayRupees: true,
  preset: 'default',
});

const T = DEMO_TODAY;

function h(
  id: string,
  name: string,
  type: Holding['type'],
  assetClass: Holding['assetClass'],
  value: number,
  extra: Partial<Holding> = {},
): Holding {
  return { id, name, type, assetClass, isStock: type === 'stock', planned: assetClass !== 'other', value, valueAt: T, createdAt: T - 24, ...extra };
}

export function manishInput(): PlanInput {
  const profile: Profile = {
    name: 'Manish',
    age: 32,
    ageAt: T,
    work: 'salaried',
    dependents: 2,
    paydayDay: 1,
    stage: 'builder',
    riskCapacity: 'growth', // capacity says growth, tolerance says balanced → lower wins
    riskTolerance: 'balanced',
    riskOverride: null,
    riskCheckedAt: T - 3,
    monthlyExpenses: 50000,
    monthly: 55000,
  };
  const goals: Goal[] = [
    { id: 'safety', name: 'Safety net', template: 'safetyNet', targetToday: 300000, inflationPct: 6, date: T, priority: 'must', monthly: 0, isSafetyNet: true, isRetirement: false, safetyMonths: 6, status: 'active', createdAt: T - 24 },
    { id: 'home', name: 'Home', template: 'home', targetToday: 3000000, inflationPct: 6, date: ym(2031, 12), priority: 'must', monthly: 18000, isSafetyNet: false, isRetirement: false, status: 'active', createdAt: T - 24 },
    { id: 'edu', name: "Child's education", template: 'education', targetToday: 4000000, inflationPct: 10, date: ym(2044, 6), priority: 'must', monthly: 12500, isSafetyNet: false, isRetirement: false, status: 'active', createdAt: T - 24 },
    { id: 'retire', name: 'Retirement', template: 'retirement', targetToday: 0, inflationPct: 6, date: ym(2054, 4), priority: 'should', monthly: 9000, isSafetyNet: false, isRetirement: true, retirement: { targetMonthly: 120000, retireAge: 58, untilAge: 85 }, status: 'active', createdAt: T - 24 },
    { id: 'trip', name: 'Japan trip', template: 'travel', targetToday: 300000, inflationPct: 6, date: ym(2029, 10), priority: 'nice', monthly: 3000, isSafetyNet: false, isRetirement: false, status: 'active', createdAt: T - 6 },
  ];
  const holdings: Holding[] = [
    h('nifty', 'Nifty 50 index fund', 'indexFund', 'indianEquity', 1290000),
    h('flexi', 'Flexi-cap fund', 'mutualFund', 'indianEquity', 940000),
    h('small', 'Small-cap fund', 'mutualFund', 'indianEquity', 390000),
    h('stockA', 'Stock A', 'stock', 'indianEquity', 920000),
    h('stocks8', '8 other stocks', 'stock', 'indianEquity', 860000, { group: true }),
    h('sp500', 'S&P 500 fund', 'indexFund', 'globalEquity', 1480000),
    h('usStocks', '4 US stocks', 'stock', 'globalEquity', 650000, { group: true }),
    h('ppf', 'PPF', 'ppf', 'debt', 460000),
    h('epf', 'EPF', 'epf', 'debt', 340000, { autoMonthly: 7200 }),
    h('stDebt', 'Short-term debt fund', 'mutualFund', 'debt', 320000),
    h('goldEtf', 'Gold ETF', 'etf', 'gold', 360000, { valueAt: T - 3 }), // 74 days old on 1 Apr
    h('sgb', 'SGB 2023', 'sgb', 'gold', 290000),
    h('liquid', 'Liquid fund', 'mutualFund', 'cash', 320000),
    h('crypto', 'Crypto', 'crypto', 'other', 120000, { planned: false }),
  ];
  const holdingGoals: HoldingGoal[] = [
    { holdingId: 'nifty', goalId: 'home', pct: 40 },
    { holdingId: 'nifty', goalId: 'retire', pct: 60 },
    { holdingId: 'flexi', goalId: 'home', pct: 100 },
    { holdingId: 'small', goalId: 'edu', pct: 100 },
    { holdingId: 'stDebt', goalId: 'home', pct: 22 },
    { holdingId: 'stDebt', goalId: 'trip', pct: 78 },
    { holdingId: 'sgb', goalId: 'home', pct: 100 },
    { holdingId: 'usStocks', goalId: 'edu', pct: 100 },
    { holdingId: 'liquid', goalId: 'safety', pct: 94 },
    { holdingId: 'liquid', goalId: 'home', pct: 6 },
    // Everything else (Stock A, 8 other stocks, S&P 500, PPF, EPF, Gold ETF) is unassigned → Retirement.
  ];
  const flowRules: FlowRule[] = [
    { id: 'r1', order: 1, enabled: true, type: 'safetyNet' },
    { id: 'r2', order: 2, enabled: true, type: 'costlyDebt', thresholdPct: 12 },
    { id: 'r3', order: 3, enabled: true, type: 'commitment', instrument: 'PPF', holdingId: 'ppf', yearlyCap: 150000, paidThisYear: 0 },
    { id: 'r4', order: 4, enabled: true, type: 'goals' },
  ];
  const loans: Loan[] = [{ id: 'car', name: 'Car loan', ratePct: 9.2, emi: 14800, balance: 310000, endDate: ym(2030, 2) }];
  return { today: T, profile, assumptions: defaultAssumptions(), goals, holdings, holdingGoals, flowRules, loans };
}

export function sunitaInput(): PlanInput {
  const profile: Profile = {
    name: 'Sunita',
    age: 64,
    ageAt: T,
    work: 'retired',
    dependents: 0,
    paydayDay: 1,
    stage: 'retiree',
    riskCapacity: 'cautious',
    riskTolerance: 'cautious',
    riskOverride: null,
    riskCheckedAt: T - 2,
    monthlyExpenses: 90000,
    monthly: 0,
  };
  const goals: Goal[] = [
    { id: 'safety', name: 'Safety net', template: 'safetyNet', targetToday: 0, inflationPct: 6, date: T, priority: 'must', monthly: 0, isSafetyNet: true, isRetirement: false, safetyMonths: 0, status: 'active', createdAt: T - 60 },
    { id: 'income', name: 'Monthly income', template: 'retirement', targetToday: 0, inflationPct: 6, date: T, priority: 'must', monthly: 0, isSafetyNet: false, isRetirement: true, retirement: { targetMonthly: 90000, retireAge: 64, untilAge: 98, pensionMonthly: 25000 }, status: 'active', createdAt: T - 60 },
  ];
  const holdings: Holding[] = [
    h('liquid', 'Liquid fund', 'mutualFund', 'cash', 1560000),
    h('fd', 'Bank FDs', 'fd', 'debt', 2400000),
    h('scss', 'Senior citizen savings', 'bond', 'debt', 1500000),
    h('hybrid', 'Index fund', 'indexFund', 'indianEquity', 12000000),
    h('debtfund', 'Debt fund', 'mutualFund', 'debt', 4500000),
    h('gold', 'Gold ETF', 'etf', 'gold', 2000000),
  ];
  return {
    today: T,
    profile,
    assumptions: defaultAssumptions(),
    goals,
    holdings,
    holdingGoals: holdings.map((x) => ({ holdingId: x.id, goalId: 'income', pct: 100 })),
    flowRules: [{ id: 'r1', order: 1, enabled: true, type: 'safetyNet' }],
    loans: [],
  };
}

/** Sunita's three buckets (07 Retiree screens). */
export const sunitaBuckets = { cash: 1560000, income: 3900000, growth: 18500000 };

/** Sunita's withdrawal plan: tuned so money likely lasts until 98 and almost surely until 91 (7.1). */
export const sunitaWithdrawalSpec = () => ({
  buckets: { ...sunitaBuckets },
  spendMonthly: 90000,
  pensionMonthly: 25000,
  inflationPct: 6,
  returnPct: { cash: 5.5, income: 7, growth: 8.8 },
  volatilityPct: { cash: 0.5, income: 2.5, growth: 6 },
  startAge: 64,
  startMonth: 3, // April
  maxAge: 110,
  cashYears: 2,
  incomeYears: 5,
});

// ---------- Full app data for the dev "Load demo data" switch ----------

function manishPaydays(): Payday[] {
  // 11-month streak to March 2028 with the shield covering Sep 2027; April's ₹55,000 has landed, not placed yet.
  const out: Payday[] = [];
  for (let m = ym(2027, 5); m <= ym(2028, 3); m++) {
    if (m === ym(2027, 9)) continue;
    out.push({ month: m, amount: 55000, kind: 'same', placedAt: m });
  }
  out.push({ month: DEMO_TODAY, amount: 55000, kind: 'same', placedAt: null });
  return out;
}

function manishHabits(): HabitEvent[] {
  return [
    { kind: 'moment', data: { key: 'safety-full' }, at: ym(2027, 11) },
    { kind: 'moment', data: { key: 'paydays-6' }, at: ym(2027, 11) },
    { kind: 'level', data: { level: 1 }, at: ym(2027, 5) },
    { kind: 'level', data: { level: 2 }, at: ym(2027, 7) },
    { kind: 'level', data: { level: 3 }, at: ym(2027, 12) },
    { kind: 'skin', data: { skin: 'base', label: 'Starter' }, at: ym(2027, 5) },
    { kind: 'skin', data: { skin: 'steady', label: 'Steady' }, at: ym(2027, 7) },
    { kind: 'skin', data: { skin: 'secure', label: 'Secure' }, at: ym(2027, 12) },
    { kind: 'skin', data: { skin: 'diwali', label: 'Diwali 2027' }, at: ym(2027, 10) },
    { kind: 'skin', data: { skin: 'holi', label: 'Holi 2028' }, at: ym(2028, 3) },
    { kind: 'wear', data: { skin: 'secure' }, at: ym(2027, 12) },
    { kind: 'shield', data: { month: ym(2027, 9), used: true }, at: ym(2027, 9) },
    { kind: 'challenge', data: { id: 'noSkipQuarter', name: 'No skipped payday this quarter', target: 3, progress: 2, done: false }, at: ym(2028, 1) },
    { kind: 'challenge', data: { id: 'maxPpf', name: 'Max PPF before 31 March', target: 150000, progress: 12500, done: false }, at: ym(2028, 4) },
  ];
}

export function demoAppData(who: 'manish' | 'sunita'): AppData {
  const input = who === 'manish' ? manishInput() : sunitaInput();
  const { today: _today, ...rest } = input;
  const snapshots: AppData['snapshots'] = input.holdings.map((h) => ({ date: h.valueAt, holdingId: h.id, assetClass: h.assetClass, value: h.value }));
  if (who === 'manish') {
    // Totals the user confirmed at check-in: the recorded high (₹87.0 L, Jan) and the 1 Apr value
    // (₹74.8 L) behind the market-fall moment (2.2).
    snapshots.unshift({ date: ym(2028, 1), holdingId: null, assetClass: null, value: 8700000 });
    snapshots.push({ date: DEMO_TODAY, holdingId: null, assetClass: null, value: 7480000 });
  }
  return {
    input: rest,
    settings: { ...DEFAULT_SETTINGS },
    paydays: who === 'manish' ? manishPaydays() : [],
    habits: who === 'manish' ? manishHabits() : [],
    snapshots,
    today: DEMO_TODAY,
  };
}
