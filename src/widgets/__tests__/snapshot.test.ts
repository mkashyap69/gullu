/**
 * @jest-environment node
 */
import { manishInput } from '../../data/demo';
import { computePlan } from '../../engine/plan';
import { buildWidgetSnapshot } from '../snapshot';

const input = manishInput();
const plan = computePlan(input, 300);
const moves = [
  { name: 'S&P 500 fund', amount: 4500, done: false },
  { name: 'Liquid fund', amount: 300, done: true },
];

test('widgets: "3 of 4 goals on track", Education short, April moves with the next one', () => {
  const s = buildWidgetSnapshot({ input, plan, hidden: false, due: 55000, moves, progress: '11 of 12', skin: 'secure' });
  expect(s.headline).toBe('3 of 4 goals on track');
  expect(s.goals.find((g) => g.name === 'Education')!.status).toMatch(/^₹\d+ L short$/);
  expect(s.payday).toEqual({ due: true, amount: '₹55,000' });
  expect(s.moves).toEqual({ month: 'April', done: 1, total: 2, next: 'S&P 500 fund · ₹4,500' });
});

test('Hide amounts: no rupee figure anywhere in the snapshot', () => {
  const s = buildWidgetSnapshot({ input, plan, hidden: true, due: 55000, moves, progress: '11 of 12', skin: 'secure' });
  expect(JSON.stringify(s)).not.toMatch(/₹\s?\d/);
  expect(s.payday.amount).toBe('₹ ••••••');
});
