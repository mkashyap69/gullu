/**
 * Repository: maps engine types to the encrypted SQLite tables and back.
 * Every write goes through here; stores call it and then update their state (write-through).
 */
import type {
  AssetClass,
  Assumptions,
  FlowRule,
  Goal,
  Holding,
  HoldingGoal,
  Loan,
  PlanInput,
  Profile,
  RiskProfile,
} from '../engine/types';
import { ALL_CLASSES } from '../engine/types';
import { effectiveRisk } from '../engine/plan';
import type { SqlDb, SqlValue } from './sql';

export type Settings = {
  hideAmounts: boolean;
  appLock: boolean;
  reduceMotion: boolean;
  haptics: boolean;
  notifications: boolean;
  /** Dev: show the FPS overlay. */
  fpsOverlay: boolean;
  /** The user reordered goals by hand (3.1); otherwise they're listed soonest first. */
  customGoalOrder: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  hideAmounts: false,
  appLock: false,
  reduceMotion: false,
  haptics: true,
  notifications: true,
  fpsOverlay: false,
  customGoalOrder: false,
};

export type Payday = { month: number; amount: number; kind: 'same' | 'less' | 'bonus'; placedAt: number | null };

/** A check-in move (4.4): planned amount, what the user actually put in, ticked or not. */
export type CheckMove = {
  month: number;
  key: string;
  holdingId: string;
  assetClass: string;
  planned: number;
  actual: number;
  done: boolean;
  parts: { lineId: string; amount: number }[];
};
export type HabitEvent =
  | { kind: 'level'; data: { level: number }; at: number }
  | { kind: 'skin'; data: { skin: string; label: string }; at: number }
  | { kind: 'wear'; data: { skin: string }; at: number }
  | { kind: 'shield'; data: { month: number; used: boolean }; at: number }
  | { kind: 'challenge'; data: { id: string; name: string; target: number; progress: number; done: boolean }; at: number }
  | { kind: 'minute'; data: { card: number; correct: boolean }; at: number }
  /** A one-time moment that has been shown (market fall per high, milestone, goal day). */
  | { kind: 'moment'; data: { key: string }; at: number };

export type ValueSnapshot = { date: number; holdingId: string | null; assetClass: AssetClass | null; value: number };

export type AppData = {
  input: Omit<PlanInput, 'today'>;
  settings: Settings;
  paydays: Payday[];
  moves?: CheckMove[];
  habits: HabitEvent[];
  snapshots: ValueSnapshot[];
  /** Preferred holding per goal and class (4.3). */
  prefs?: Record<string, string>;
  /** Pinned "today" (demo personas only); real plans use the current month. */
  today?: number;
};

const b = (v: boolean) => (v ? 1 : 0);

// ---------- writes ----------

export async function saveProfile(db: SqlDb, p: Profile): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO profile (id, name, age, ageAt, work, dependents, paydayDay, stage, riskCapacity, riskTolerance, riskProfile, riskOverride, riskCheckedAt, monthlyExpenses, monthly, monthlyIncome, incomeVaries)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.name, p.age, p.ageAt, p.work, p.dependents, p.paydayDay, p.stage, p.riskCapacity, p.riskTolerance, effectiveRisk(p), p.riskOverride, p.riskCheckedAt, p.monthlyExpenses, p.monthly, p.monthlyIncome ?? null, b(!!p.incomeVaries)],
  );
}

export async function saveAssumptions(db: SqlDb, a: Assumptions): Promise<void> {
  for (const c of ALL_CLASSES) {
    await db.runAsync('INSERT OR REPLACE INTO assumptions (class, returnPct, volatilityPct) VALUES (?, ?, ?)', [c, a.returnPct[c], a.volatilityPct[c]]);
  }
  await saveSettingValues(db, {
    'assumptions.inflationPct': a.inflationPct,
    'assumptions.stepUpPct': a.stepUpPct,
    'assumptions.retirementRealReturnPct': a.retirementRealReturnPct,
    'assumptions.showTodayRupees': a.showTodayRupees,
    'assumptions.preset': a.preset,
  });
}

export async function saveGoal(db: SqlDb, g: Goal, sortOrder = 0): Promise<void> {
  const config = { retirement: g.retirement, safetyMonths: g.safetyMonths };
  await db.runAsync(
    `INSERT OR REPLACE INTO goal (id, name, template, targetToday, inflationPct, date, priority, monthly, isSafetyNet, isRetirement, config_json, status, sortOrder, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [g.id, g.name, g.template, g.targetToday, g.inflationPct, g.date, g.priority, g.monthly, b(g.isSafetyNet), b(g.isRetirement), JSON.stringify(config), g.status, sortOrder, g.createdAt],
  );
}

export async function deleteGoal(db: SqlDb, id: string): Promise<void> {
  await db.runAsync('DELETE FROM goal WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM holdingGoal WHERE goalId = ?', [id]);
}

export async function saveHolding(db: SqlDb, h: Holding, sortOrder = 0): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO holding (id, name, type, assetClass, isStock, planned, value, valueAt, autoMonthly, sortOrder, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [h.id, h.name, h.type, h.assetClass, b(h.isStock), b(h.planned), h.value, h.valueAt, h.autoMonthly ?? null, sortOrder, h.createdAt],
  );
}

export async function saveHoldingSplit(db: SqlDb, holdingId: string, split: HoldingGoal[]): Promise<void> {
  await db.runAsync('DELETE FROM holdingGoal WHERE holdingId = ?', [holdingId]);
  for (const s of split) await db.runAsync('INSERT INTO holdingGoal (holdingId, goalId, pct) VALUES (?, ?, ?)', [holdingId, s.goalId, s.pct]);
}

export async function saveFlowRule(db: SqlDb, r: FlowRule): Promise<void> {
  const { id, order, type, enabled, ...config } = r;
  await db.runAsync('INSERT OR REPLACE INTO flowRule (id, "order", type, config_json, enabled) VALUES (?, ?, ?, ?, ?)', [id, order, type, JSON.stringify(config), b(enabled)]);
}

export async function saveLoan(db: SqlDb, l: Loan): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO loan (id, name, ratePct, emi, balance, endDate) VALUES (?, ?, ?, ?, ?, ?)', [l.id, l.name, l.ratePct, l.emi, l.balance, l.endDate]);
}

export async function savePayday(db: SqlDb, p: Payday): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO payday (month, amount, kind, placedAt) VALUES (?, ?, ?, ?)', [p.month, p.amount, p.kind, p.placedAt]);
}

export async function saveMoves(db: SqlDb, month: number, moves: CheckMove[]): Promise<void> {
  await db.runAsync('DELETE FROM move WHERE paydayId = ?', [month]);
  for (const m of moves) {
    await db.runAsync('INSERT INTO move (paydayId, holdingId, goalId, planned, actual, doneAt, moveKey, assetClass, parts_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
      month,
      m.holdingId || null,
      null,
      m.planned,
      m.actual,
      m.done ? month : null,
      m.key,
      m.assetClass,
      JSON.stringify(m.parts),
    ]);
  }
}

export async function addHabit(db: SqlDb, e: HabitEvent): Promise<void> {
  await db.runAsync('INSERT INTO habit (kind, data_json, at) VALUES (?, ?, ?)', [e.kind, JSON.stringify(e.data), e.at]);
}

export async function addSnapshot(db: SqlDb, s: ValueSnapshot): Promise<void> {
  await db.runAsync('INSERT INTO valueSnapshot (date, holdingId, assetClass, value) VALUES (?, ?, ?, ?)', [s.date, s.holdingId, s.assetClass, s.value]);
}

export async function saveSettingValues(db: SqlDb, values: Record<string, string | number | boolean>): Promise<void> {
  for (const [k, v] of Object.entries(values)) {
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [k, JSON.stringify(v)]);
  }
}

export async function saveSettings(db: SqlDb, s: Partial<Settings>): Promise<void> {
  await saveSettingValues(db, Object.fromEntries(Object.entries(s).map(([k, v]) => [`app.${k}`, v as boolean])));
}

const TABLES = ['profile', 'assumptions', 'goal', 'flowRule', 'holding', 'holdingGoal', 'loan', 'valueSnapshot', 'payday', 'move', 'scenario', 'habit', 'settings'];

/** Wipes every table (used by the demo switch and by "Delete everything"). */
export async function clearAll(db: SqlDb): Promise<void> {
  await db.execAsync(`BEGIN; ${TABLES.map((t) => `DELETE FROM ${t};`).join(' ')} COMMIT;`);
}

/** Replaces all data with `data` in one go. */
export async function replaceAll(db: SqlDb, data: AppData): Promise<void> {
  await clearAll(db);
  await db.execAsync('BEGIN');
  try {
    const i = data.input;
    await saveProfile(db, i.profile);
    await saveAssumptions(db, i.assumptions);
    for (const [k, g] of i.goals.entries()) await saveGoal(db, g, k);
    for (const [k, h] of i.holdings.entries()) await saveHolding(db, h, k);
    for (const hg of i.holdingGoals) await db.runAsync('INSERT INTO holdingGoal (holdingId, goalId, pct) VALUES (?, ?, ?)', [hg.holdingId, hg.goalId, hg.pct]);
    for (const r of i.flowRules) await saveFlowRule(db, r);
    for (const l of i.loans) await saveLoan(db, l);
    for (const p of data.paydays) await savePayday(db, p);
    for (const month of new Set((data.moves ?? []).map((m) => m.month))) await saveMoves(db, month, (data.moves ?? []).filter((m) => m.month === month));
    for (const e of data.habits) await addHabit(db, e);
    for (const s of data.snapshots) await addSnapshot(db, s);
    await saveSettings(db, data.settings);
    if (data.today != null) await saveSettingValues(db, { 'plan.today': data.today });
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

// ---------- reads ----------

type Row = Record<string, SqlValue>;
const num = (v: SqlValue) => Number(v);
const str = (v: SqlValue) => String(v);

export async function loadAll(db: SqlDb): Promise<AppData | null> {
  const p = await db.getFirstAsync<Row>('SELECT * FROM profile WHERE id = 1', []);
  if (!p) return null;
  const profile: Profile = {
    name: str(p.name),
    age: num(p.age),
    ageAt: num(p.ageAt),
    work: str(p.work) as Profile['work'],
    dependents: num(p.dependents),
    paydayDay: num(p.paydayDay),
    stage: str(p.stage) as Profile['stage'],
    riskCapacity: str(p.riskCapacity) as RiskProfile,
    riskTolerance: str(p.riskTolerance) as RiskProfile,
    riskOverride: p.riskOverride == null ? null : (str(p.riskOverride) as RiskProfile),
    riskCheckedAt: p.riskCheckedAt == null ? null : num(p.riskCheckedAt),
    monthlyExpenses: num(p.monthlyExpenses),
    monthly: num(p.monthly),
    ...(p.monthlyIncome != null ? { monthlyIncome: num(p.monthlyIncome) } : {}),
    ...(num(p.incomeVaries) === 1 ? { incomeVaries: true } : {}),
  };
  const settingRows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings', []);
  const kv = new Map(settingRows.map((r) => [r.key, JSON.parse(r.value) as string | number | boolean]));
  const aRows = await db.getAllAsync<Row>('SELECT * FROM assumptions', []);
  const returnPct = {} as Record<AssetClass, number>;
  const volatilityPct = {} as Record<AssetClass, number>;
  for (const r of aRows) {
    returnPct[str(r.class) as AssetClass] = num(r.returnPct);
    volatilityPct[str(r.class) as AssetClass] = num(r.volatilityPct);
  }
  const assumptions: Assumptions = {
    returnPct,
    volatilityPct,
    inflationPct: Number(kv.get('assumptions.inflationPct') ?? 6),
    stepUpPct: Number(kv.get('assumptions.stepUpPct') ?? 0),
    retirementRealReturnPct: Number(kv.get('assumptions.retirementRealReturnPct') ?? 2.5),
    showTodayRupees: Boolean(kv.get('assumptions.showTodayRupees') ?? true),
    preset: (kv.get('assumptions.preset') as Assumptions['preset']) ?? 'default',
  };
  const goals: Goal[] = (await db.getAllAsync<Row>('SELECT * FROM goal ORDER BY sortOrder, createdAt', [])).map((r) => {
    const config = r.config_json ? (JSON.parse(str(r.config_json)) as Pick<Goal, 'retirement' | 'safetyMonths'>) : {};
    return {
      id: str(r.id),
      name: str(r.name),
      template: str(r.template) as Goal['template'],
      targetToday: num(r.targetToday),
      inflationPct: num(r.inflationPct),
      date: num(r.date),
      priority: str(r.priority) as Goal['priority'],
      monthly: num(r.monthly),
      isSafetyNet: num(r.isSafetyNet) === 1,
      isRetirement: num(r.isRetirement) === 1,
      ...config,
      status: str(r.status) as Goal['status'],
      createdAt: num(r.createdAt),
    };
  });
  const holdings: Holding[] = (await db.getAllAsync<Row>('SELECT * FROM holding ORDER BY sortOrder, createdAt', [])).map((r) => ({
    id: str(r.id),
    name: str(r.name),
    type: str(r.type) as Holding['type'],
    assetClass: str(r.assetClass) as AssetClass,
    isStock: num(r.isStock) === 1,
    planned: num(r.planned) === 1,
    value: num(r.value),
    valueAt: num(r.valueAt),
    ...(r.autoMonthly != null ? { autoMonthly: num(r.autoMonthly) } : {}),
    createdAt: num(r.createdAt),
  }));
  const holdingGoals = (await db.getAllAsync<Row>('SELECT * FROM holdingGoal', [])).map((r) => ({ holdingId: str(r.holdingId), goalId: str(r.goalId), pct: num(r.pct) }));
  const flowRules = (await db.getAllAsync<Row>('SELECT * FROM flowRule ORDER BY "order"', [])).map(
    (r) => ({ id: str(r.id), order: num(r.order), type: str(r.type), enabled: num(r.enabled) === 1, ...JSON.parse(str(r.config_json)) }) as FlowRule,
  );
  const loans: Loan[] = (await db.getAllAsync<Row>('SELECT * FROM loan', [])).map((r) => ({
    id: str(r.id),
    name: str(r.name),
    ratePct: num(r.ratePct),
    emi: num(r.emi),
    balance: num(r.balance),
    endDate: num(r.endDate),
  }));
  const paydays: Payday[] = (await db.getAllAsync<Row>('SELECT * FROM payday ORDER BY month', [])).map((r) => ({
    month: num(r.month),
    amount: num(r.amount),
    kind: str(r.kind) as Payday['kind'],
    placedAt: r.placedAt == null ? null : num(r.placedAt),
  }));
  const moves: CheckMove[] = (await db.getAllAsync<Row>('SELECT * FROM move ORDER BY id', [])).map((r) => ({
    month: num(r.paydayId),
    key: str(r.moveKey ?? r.holdingId ?? ''),
    holdingId: r.holdingId == null ? '' : str(r.holdingId),
    assetClass: str(r.assetClass ?? ''),
    planned: num(r.planned),
    actual: r.actual == null ? num(r.planned) : num(r.actual),
    done: r.doneAt != null,
    parts: r.parts_json ? JSON.parse(str(r.parts_json)) : [],
  }));
  const habits: HabitEvent[] = (await db.getAllAsync<Row>('SELECT * FROM habit ORDER BY id', [])).map(
    (r) => ({ kind: str(r.kind), data: JSON.parse(str(r.data_json)), at: num(r.at) }) as HabitEvent,
  );
  const snapshots: ValueSnapshot[] = (await db.getAllAsync<Row>('SELECT * FROM valueSnapshot ORDER BY date, id', [])).map((r) => ({
    date: num(r.date),
    holdingId: r.holdingId == null ? null : str(r.holdingId),
    assetClass: r.assetClass == null ? null : (str(r.assetClass) as AssetClass),
    value: num(r.value),
  }));
  const settings = { ...DEFAULT_SETTINGS };
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const v = kv.get(`app.${k}`);
    if (typeof v === 'boolean') settings[k] = v;
  }
  const pinned = kv.get('plan.today');
  const prefsRaw = kv.get('payday.prefs');
  const prefs = typeof prefsRaw === 'string' ? (JSON.parse(prefsRaw) as Record<string, string>) : {};
  return { input: { profile, assumptions, goals, holdings, holdingGoals, flowRules, loans }, settings, paydays, moves, prefs, habits, snapshots, ...(typeof pinned === 'number' ? { today: pinned } : {}) };
}

/** Everything as plain JSON for export (Privacy screen). */
export async function exportJson(db: SqlDb): Promise<string> {
  return JSON.stringify(await loadAll(db), null, 2);
}

/** Holdings as CSV for export. */
export async function exportHoldingsCsv(db: SqlDb): Promise<string> {
  const data = await loadAll(db);
  const rows = [['name', 'type', 'assetClass', 'value', 'valueAt'].join(',')];
  for (const h of data?.input.holdings ?? []) rows.push([JSON.stringify(h.name), h.type, h.assetClass, h.value, h.valueAt].join(','));
  return rows.join('\n');
}
