/**
 * @jest-environment node
 */
import { manishInput } from '../../data/demo';
import { applicableChanges, compareScenario, describeChanges, fixChanges, scenarioHeadline, scenarioResult } from '../scenario';
import { concentration, emisLeft, mixCheck, netWorth, prepayOrInvest, projectByClass, pushShares } from '../wealth';

test('net worth: own ₹87.4 L, owe ₹3.1 L, ₹84.3 L', () => {
  expect(netWorth(manishInput())).toEqual({ own: 8740000, owe: 310000, total: 8430000 });
});

test('mix check: equity over target, fixed with new money, Indian equity 51%', () => {
  const m = mixCheck(manishInput());
  expect(Math.round(m.rows.find((r) => r.cls === 'indianEquity')!.actual * 100)).toBe(51);
  expect(Math.round(m.equityActual * 100)).toBe(76);
  expect(m.drift).toBeGreaterThan(5);
  expect(m.monthsToFix).toBeGreaterThan(0);
});

test('concentration: Stock A is 11% of investing; groups and index funds are never flagged', () => {
  const c = concentration(manishInput());
  expect(c.map((x) => x.name)).toEqual(['Stock A']);
  expect(Math.round(c[0].share * 100)).toBe(11);
});

test('car loan: 22 EMIs left; prepay vs invest both come out positive', () => {
  const input = manishInput();
  const loan = input.loans[0];
  expect(emisLeft(loan, input.today)).toBe(22); // its own end date, Feb 2030
  expect(emisLeft({ ...loan, endDate: undefined })).toBe(23); // amortised at 9.2% and ₹14,800
  const r = prepayOrInvest(input, loan);
  // With under 2 years left the invested ₹1 L would sit mostly in debt, so for Manish prepaying
  // honestly saves more than investing likely earns (the design shows the reverse).
  expect(r.saved).toBe(16000);
  expect(r.likely).toBeGreaterThan(10000);
  expect(r.months).toBe(22);
});

test('timeline projection grows and keeps every class', () => {
  const p = projectByClass(manishInput(), 60);
  const total = (i: number) => p[i].byClass.reduce((a, b) => a + b, 0);
  expect(total(60)).toBeGreaterThan(total(0));
  expect(p[0].byClass.every((v) => v >= 0)).toBe(true);
});

test('what if: 6 months without income, covered by the safety net; Replay 2008 makes goals slip', () => {
  const input = manishInput();
  const six = compareScenario(input, { noIncomeMonths: 6 });
  expect(six.drawFromInvestments).toBe(0); // ₹3 L safety net covers 6 × ₹50,000
  expect(six.outcomes.some((o) => o.worse)).toBe(true);
  const r08 = compareScenario(input, { replay: 2008 });
  expect(scenarioHeadline(r08.outcomes)).toMatch(/slip|help/);
});

test('fix chip raises Education to ₹16,000 and applies as one change', () => {
  const input = manishInput();
  const c = fixChanges(input);
  expect(c.monthlyByGoal).toEqual({ edu: 16000 });
  expect(applicableChanges(input, c)).toEqual([{ goalId: 'edu', label: "Child's education", field: 'Monthly amount', from: 12500, to: 16000 }]);
  const res = compareScenario(input, c);
  expect(res.outcomes.find((o) => o.goalId === 'edu')!.afterR.onTrack).toBe(true);
});

test('holding split: dragging one share pushes the others, never past 100%', () => {
  expect(pushShares({ home: 40, edu: 40 }, 'home', 80)).toEqual({ home: 80, edu: 20 });
  expect(pushShares({ home: 40, edu: 20 }, 'home', 50)).toEqual({ home: 50, edu: 20 });
  expect(pushShares({ home: 40 }, 'home', 100)).toEqual({ home: 100 });
});

test('scenario cards describe the change and the outcome in one line each', () => {
  const input = manishInput();
  expect(describeChanges(input, { noIncomeMonths: 6 })).toBe('No income for 6 months');
  expect(describeChanges(input, { retireAge: 55 })).toMatch(/years earlier/);
  const fix = fixChanges(input);
  expect(scenarioResult(input, fix, compareScenario(input, fix).outcomes)).toBe('All goals still reached');
  const early = { retireAge: 50 };
  expect(scenarioResult(input, early, compareScenario(input, early).outcomes)).toMatch(/more a month|help|Retirement/);
});

test('6.1 design case: six months without income, most goals slip a little and none break', () => {
  const input = manishInput();
  const r = compareScenario(input, { noIncomeMonths: 6 });
  expect(scenarioHeadline(r.outcomes)).toBe('Most goals slip a little. None break.');
  expect(r.outcomes.find((o) => o.goalId === 'home')!.after).toBe('Mar 2032');
  const early = compareScenario(input, { retireAge: 55 });
  expect(scenarioResult(input, { retireAge: 55 }, early.outcomes)).toMatch(/^Needs ₹[\d,]+ more a month$/);
});
