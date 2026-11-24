/**
 * @jest-environment node
 */
import { manishInput } from '../../data/demo';
import { labelWithRange, ym } from '../dates';
import { makeRng, simulateDeterministic, simulateMonteCarlo } from '../core';
import { CHOL, goalSpec } from '../plan';
import { replayRows } from '../replay';

test('seeded RNG is stable', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  expect([a(), a(), a()]).toEqual([b(), b(), b()]);
});

test('Monte Carlo is deterministic for a seed and its percentiles are ordered', () => {
  const inp = manishInput();
  const spec = goalSpec(inp, inp.goals.find((g) => g.id === 'trip')!);
  const r1 = simulateMonteCarlo(spec, 300, 1, CHOL);
  const r2 = simulateMonteCarlo(spec, 300, 1, CHOL);
  expect(r1.atDateToday).toEqual(r2.atDateToday);
  expect(r1.atDateToday[0]).toBeLessThanOrEqual(r1.atDateToday[1]);
  expect(r1.atDateToday[1]).toBeLessThanOrEqual(r1.atDateToday[2]);
  expect(r1.p10.length).toBe(r1.sampleMonths.length);
});

test('Replay 2008 leaves the education goal lower than the expected path', () => {
  const inp = manishInput();
  const g = inp.goals.find((x) => x.id === 'edu')!;
  const base = simulateDeterministic(goalSpec(inp, g)).final;
  const replay = simulateDeterministic(goalSpec(inp, g, { replay: replayRows(2008) })).final;
  expect(replay).toBeLessThan(base);
});

test('date range label', () => {
  expect(labelWithRange(ym(2031, 9), [ym(2031, 6), ym(2031, 12)])).toBe('Sep 2031 (Jun–Dec)');
});
