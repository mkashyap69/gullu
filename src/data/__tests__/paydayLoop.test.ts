/**
 * @jest-environment node
 */
import { demoAppData } from '../demo';
import { migrate } from '../migrations';
import { setDb } from '../../state/dbHolder';
import { confirmValues, placePayday, startPayday } from '../../state/payday';
import { loadDemo, useGoalsStore, useHabitsStore, useHoldingsStore, usePaydayStore } from '../../state/stores';
import { memoryDb } from './nodeSqlite';
import { ym } from '../../engine/dates';

test('Manish places April: holdings grow by what went in, PPF counts, streak 12, values confirmed', async () => {
  const db = memoryDb();
  await migrate(db);
  setDb(db);
  await loadDemo(demoAppData('manish'));
  const before = useHoldingsStore.getState().holdings.reduce((a, h) => a + h.value, 0);
  await startPayday(55000);
  const april = ym(2028, 4);
  const moves = usePaydayStore.getState().moves.filter((m) => m.month === april);
  expect(moves.reduce((a, m) => a + m.planned, 0)).toBe(55000);
  for (const m of moves) await usePaydayStore.getState().updateMove(april, m.key, { done: true });
  // One move went in at a different amount.
  await usePaydayStore.getState().updateMove(april, moves[1].key, { actual: moves[1].planned - 1000 });
  const r = await placePayday(april);
  expect(r.streak).toBe(12);
  const after = useHoldingsStore.getState().holdings.reduce((a, h) => a + h.value, 0);
  expect(after - before).toBe(54000);
  const ppf = useGoalsStore.getState().flowRules.find((x) => x.type === 'commitment');
  expect(ppf && ppf.type === 'commitment' && ppf.paidThisYear).toBe(12500);
  expect(usePaydayStore.getState().paydays.find((p) => p.month === april)?.placedAt).toBe(april);
  expect(r.levels).toEqual([]); // Builder still waits on Education
  await confirmValues(april, { gold: 700000 });
  const gold = useHoldingsStore.getState().holdings.filter((h) => h.assetClass === 'gold').reduce((a, h) => a + h.value, 0);
  expect(Math.abs(gold - 700000)).toBeLessThanOrEqual(2);
  expect(useHoldingsStore.getState().snapshots.at(-1)?.holdingId).toBeNull();
  expect(useHabitsStore.getState().events.some((e) => e.kind === 'level' && e.data.level === 4)).toBe(false);
});
