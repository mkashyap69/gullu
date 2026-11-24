/**
 * @jest-environment node
 */
import { ym } from '../dates';
import { buildPlanInput, capacityScore, defaultGoals, retireeWithdrawalSpec, scoreRisk, toleranceScore, type OnboardingAnswers } from '../onboarding';
import { withdrawalLikely } from '../withdrawal';
import { maxForGoal, setGoalAmount, suggestSplit, toHoldingGoals } from '../suggestSplit';
import { computePlan, safetyNet } from '../plan';

const T = ym(2028, 4);
/** Manish's inputs as a user would type them into onboarding (personas.ts). */
export function manishAnswers(): OnboardingAnswers {
  const goals = defaultGoals({ today: T, age: 32, work: 'salaried', monthlyExpenses: 50000 })
    .filter((g) => g.ticked)
    .map((g) => (g.template === 'travel' ? { ...g, name: 'Japan trip', date: ym(2029, 10) } : g));
  return {
    today: T,
    age: 32,
    work: 'salaried',
    dependents: 2,
    payday: 1,
    monthlyIncome: 160000,
    monthlyExpenses: 50000,
    risk: { stability: 0, savings: 2, fall: 2, choice: 1, experience: 1 },
    goals,
    holdings: [
      { id: 'mf', name: 'Mutual funds', type: 'mutualFund', assetClass: 'indianEquity', value: 3050000 },
      { id: 'in-stocks', name: 'Indian stocks', type: 'stock', assetClass: 'indianEquity', value: 1690000 },
      { id: 'us-stocks', name: 'US stocks', type: 'stock', assetClass: 'globalEquity', value: 550000 },
      { id: 'ppf', name: 'PPF', type: 'ppf', assetClass: 'debt', value: 470000 },
      { id: 'epf', name: 'EPF', type: 'epf', assetClass: 'debt', value: 450000 },
      { id: 'gold', name: 'Gold and SGBs', type: 'etf', assetClass: 'gold', value: 650000 },
      { id: 'cash', name: 'Cash and liquid funds', type: 'cash', assetClass: 'cash', value: 320000 },
      { id: 'debtf', name: 'Debt funds', type: 'mutualFund', assetClass: 'debt', value: 200000 },
    ],
    loans: [{ id: 'car', name: 'Car loan', ratePct: 9.2, emi: 14800, balance: 310000, endDate: ym(2030, 2) }],
    monthly: 55000,
    raisePct: 10,
    incomeVaries: false,
  };
}

test('risk: Manish scores capacity Growth, tolerance Balanced → Balanced', () => {
  const r = { age: 32, dependents: 2, monthlyIncome: 160000, emis: 14800, answers: manishAnswers().risk };
  expect(capacityScore(r)).toBe(86);
  expect(toleranceScore(r)).toBe(55);
  expect(scoreRisk(r)).toEqual({ capacity: 'growth', tolerance: 'balanced', profile: 'balanced' });
});

test('builder stage pre-ticks safety net, home, education, retirement, travel', () => {
  const g = defaultGoals({ today: T, age: 32, work: 'salaried', monthlyExpenses: 50000 });
  expect(g.filter((x) => x.ticked).map((x) => x.template)).toEqual(['safety', 'home', 'education', 'retirement', 'travel']);
  expect(g.find((x) => x.template === 'education')?.detail).toBe('College in 2044');
  expect(g.find((x) => x.template === 'retirement')?.detail).toBe('Stop working at 58');
});

test('onboarding builds a plan: safety net full, split adds up, holdings assigned', () => {
  const input = buildPlanInput(manishAnswers(), { capacity: 'growth', tolerance: 'balanced' });
  expect(safetyNet(input)?.full).toBe(true);
  const goalsMonthly = input.goals.reduce((a, g) => a + g.monthly, 0);
  expect(goalsMonthly + 12500).toBe(55000);
  const sug = suggestSplit(input);
  const split = toHoldingGoals(input, sug);
  for (const h of input.holdings) {
    const sum = split.filter((x) => x.holdingId === h.id).reduce((acc, x) => acc + x.pct, 0);
    expect(sum).toBeLessThanOrEqual(100.1);
  }
  const by = Object.fromEntries(sug.goals.map((g) => [g.name, g]));
  // Existing money lowers what the plan needs each month (from ~₹1.04 L to about ₹43,400).
  const without = sug.goals.reduce((a, g) => a + g.requiredWithout, 0);
  expect(sug.required).toBeLessThan(without / 2);
  expect(by['Safety net'].amount).toBe(300000);
  expect(by['Japan trip'].reason).toBe('lowers');
  expect(by['Home'].requiredWith).toBeLessThan(by['Home'].requiredWithout);
  // Home is under 5 years away, so it can only take as much as the safe money allows (40% equity cap);
  // Education is 16 years away and takes equity. PPF and EPF stay with Retirement.
  expect(by['Home'].amount).toBeLessThan(1100000);
  expect(by["Child's education"].reason).toBe('covers');
  expect(split.some((x) => x.holdingId === 'ppf' || x.holdingId === 'epf')).toBe(false);
  // Mid goals keep equity within their horizon cap (Home, under 5 years: 40%).
  const home = sug.split[input.goals.find((g) => g.name === 'Home')!.id];
  expect((home[2] + home[3]) / home.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(0.4001);
  // Short goals hold no equity.
  expect(sug.split[input.goals.find((g) => g.name === 'Japan trip')!.id].slice(2, 4)).toEqual([0, 0]);
  // Safe money is the limit: the plan needs a little more than ₹42,500, and the nice-to-have trip
  // is the one left short (must goals are funded first).
  const plan = computePlan(input, 300);
  expect(plan.onTrack).toBe(3);
  expect(plan.goals.find((g) => !g.onTrack)?.name).toBe('Japan trip');
  expect(input.goals.reduce((x, g) => x + g.monthly, 0)).toBe(42500);
  expect(plan.total).toBe(4);
});

test('retiree: no goals step, income goal, three buckets last into the 90s', () => {
  const a: OnboardingAnswers = {
    ...manishAnswers(),
    age: 64,
    work: 'retired',
    dependents: 0,
    monthlyIncome: 0,
    monthlyExpenses: 90000,
    goals: defaultGoals({ today: T, age: 64, work: 'retired', monthlyExpenses: 90000 }).filter((g) => g.ticked),
    holdings: [
      { id: 'cash', name: 'Liquid fund', type: 'cash', assetClass: 'cash', value: 1560000 },
      { id: 'fd', name: 'FDs', type: 'fd', assetClass: 'debt', value: 3900000 },
      { id: 'mf', name: 'Equity funds', type: 'mutualFund', assetClass: 'indianEquity', value: 18500000 },
    ],
    loans: [],
    monthly: 0,
    needMonthly: 90000,
    pensionMonthly: 25000,
  };
  expect(a.goals.map((g) => g.template)).toEqual(['income', 'health']);
  const input = buildPlanInput(a, { capacity: 'cautious', tolerance: 'cautious' });
  expect(input.profile.monthly).toBe(0);
  const spec = retireeWithdrawalSpec(input);
  expect(spec.buckets.cash).toBe(1560000);
  expect(withdrawalLikely(spec).lastsUntil).toBeGreaterThanOrEqual(90);
});

test('allocateMonthly: safety net first, then must goals nearest-date first, nice last', () => {
  const a = manishAnswers();
  const input = buildPlanInput({ ...a, holdings: [], loans: [], monthly: 60000 }, { capacity: 'growth', tolerance: 'balanced' });
  const byName = Object.fromEntries(input.goals.map((g) => [g.name, g.monthly]));
  expect(byName['Safety net']).toBe(25000); // ₹3 L gap spread over 12 months
  expect(byName['Home']).toBe(35000); // the nearest must goal takes the rest
  expect(byName['Japan trip']).toBe(0);
  expect(input.goals.reduce((x, g) => x + g.monthly, 0)).toBe(60000);
});

test('the user can change a goal\'s share; the rest rebalances to Retirement', () => {
  const input = buildPlanInput(manishAnswers(), { capacity: 'growth', tolerance: 'balanced' });
  const sug = suggestSplit(input);
  const edu = input.goals.find((g) => g.name === "Child's education")!;
  const before = sug.goals.find((g) => g.goalId === edu.id)!.amount;
  const less = setGoalAmount(input, sug, edu.id, 1200000);
  const e = less.goals.find((g) => g.goalId === edu.id)!;
  expect(Math.round(e.amount)).toBe(1200000);
  expect(e.requiredWith).toBeGreaterThan(0); // now it needs new money again
  const retireBefore = sug.goals.find((g) => g.reason === 'rest')!.amount;
  const retireAfter = less.goals.find((g) => g.reason === 'rest')!.amount;
  expect(Math.round(retireAfter - retireBefore)).toBe(Math.round(before - 1200000));
  expect(maxForGoal(input, less, edu.id)).toBeGreaterThan(1200000);
  const more = setGoalAmount(input, less, edu.id, 2000000);
  expect(Math.round(more.goals.find((g) => g.goalId === edu.id)!.amount)).toBe(2000000);
  const back = setGoalAmount(input, more, edu.id, 0);
  expect(back.goals.find((g) => g.goalId === edu.id)!.amount).toBe(0);
});
