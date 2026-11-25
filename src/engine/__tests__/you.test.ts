/**
 * @jest-environment node
 */
import { manishInput } from '../../data/demo';
import { applyPreset, presetOf } from '../assumptions';
import { defaultAssumptions } from '../onboarding';
import { computePlanFast } from '../plan';

test('presets: Base is the default; Cautious lowers returns and raises inflation; switching back finds Base', () => {
  const base = defaultAssumptions(5);
  expect(applyPreset(base, 'default').returnPct).toEqual(base.returnPct);
  const c = applyPreset(base, 'cautious');
  expect(c.returnPct.indianEquity).toBe(10);
  expect(c.inflationPct).toBe(7);
  expect(presetOf(base, c)).toBe('cautious');
  expect(presetOf(base, { ...c, returnPct: { ...c.returnPct, gold: 3 } })).toBe('custom');
});

test('a cautious preset never puts more goals on track than Base', () => {
  const input = manishInput();
  const base = computePlanFast(input).onTrack;
  const cautious = computePlanFast({ ...input, assumptions: applyPreset(input.assumptions, 'cautious') }).onTrack;
  expect(cautious).toBeLessThanOrEqual(base);
});
