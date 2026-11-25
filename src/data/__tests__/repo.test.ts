/**
 * @jest-environment node
 */
import { computePlanFast } from '../../engine/plan';
import { demoAppData, DEMO_TODAY, manishInput } from '../demo';
import { MIGRATIONS, migrate } from '../migrations';
import { clearAll, exportGoalsCsv, exportHoldingsCsv, exportJson, loadAll, replaceAll } from '../repo';
import { applyAppData, hydrate, loadDemo, useGoalsStore, useProfileStore, useSettingsStore } from '../../state/stores';
import { setDb } from '../../state/dbHolder';
import { memoryDb } from './nodeSqlite';

test('migrations run once and are idempotent', async () => {
  const db = memoryDb();
  expect(await migrate(db)).toBe(MIGRATIONS.length);
  expect(await migrate(db)).toBe(MIGRATIONS.length);
});

test('Manish round-trips through SQLite and gives the same plan', async () => {
  const db = memoryDb();
  await migrate(db);
  await replaceAll(db, demoAppData('manish'));
  const back = await loadAll(db);
  expect(back).not.toBeNull();
  const original = manishInput();
  expect(back!.input.goals).toEqual(original.goals);
  expect(back!.input.holdings).toEqual(original.holdings);
  expect(back!.input.flowRules).toEqual(original.flowRules);
  const plan = computePlanFast({ ...back!.input, today: DEMO_TODAY });
  expect(plan.goals.map((g) => g.requiredMonthly)).toEqual(computePlanFast(original).goals.map((g) => g.requiredMonthly));
  expect(back!.paydays.filter((p) => p.placedAt != null)).toHaveLength(10);
  expect(JSON.parse(await exportJson(db)).input.profile.name).toBe('Manish');
});

test('stores hydrate, write through, and switch demo personas', async () => {
  const db = memoryDb();
  await migrate(db);
  setDb(db);
  await loadDemo(demoAppData('manish'));
  expect(useProfileStore.getState().profile?.name).toBe('Manish');
  await useSettingsStore.getState().update({ hideAmounts: true });
  const g = useGoalsStore.getState().goals.find((x) => x.id === 'edu')!;
  await useGoalsStore.getState().upsertGoal({ ...g, monthly: 16000 });
  applyAppData(null);
  await hydrate();
  expect(useSettingsStore.getState().hideAmounts).toBe(true);
  expect(useGoalsStore.getState().goals.find((x) => x.id === 'edu')?.monthly).toBe(16000);
  await loadDemo(demoAppData('sunita'));
  expect(useProfileStore.getState().profile?.name).toBe('Sunita');
  expect(useSettingsStore.getState().hideAmounts).toBe(false);
});

test('export: CSV of holdings and goals; delete everything leaves nothing to load', async () => {
  const db = memoryDb();
  await migrate(db);
  await replaceAll(db, demoAppData('manish'));
  const goals = (await exportGoalsCsv(db)).split('\n');
  expect(goals[0]).toBe('name,priority,targetToday,date,monthly,status');
  expect(goals).toContain('"Home",must,3000000,2031-12,18000,active');
  expect((await exportHoldingsCsv(db)).split('\n')[1]).toMatch(/^".+",\w+,\w+,\d+,\d{4}-\d{2}$/);
  await clearAll(db);
  expect(await loadAll(db)).toBeNull();
});
