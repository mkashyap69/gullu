/**
 * Versioned migrations (05-ENGINE.md data model). Append only: never edit a shipped migration.
 * Each entry runs once, in order, inside a transaction; `schema_version` records the last applied.
 */
import type { SqlDb } from './sql';

export const MIGRATIONS: string[] = [
  // 1 · initial schema
  `
  CREATE TABLE profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL, age INTEGER NOT NULL, ageAt INTEGER NOT NULL, work TEXT NOT NULL,
    dependents INTEGER NOT NULL, paydayDay INTEGER NOT NULL, stage TEXT NOT NULL,
    riskCapacity TEXT NOT NULL, riskTolerance TEXT NOT NULL, riskProfile TEXT NOT NULL,
    riskOverride TEXT, riskCheckedAt INTEGER, monthlyExpenses REAL NOT NULL, monthly REAL NOT NULL
  );
  CREATE TABLE assumptions (class TEXT PRIMARY KEY, returnPct REAL NOT NULL, volatilityPct REAL NOT NULL);
  CREATE TABLE goal (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, template TEXT NOT NULL, targetToday REAL NOT NULL,
    inflationPct REAL NOT NULL, date INTEGER NOT NULL, priority TEXT NOT NULL, monthly REAL NOT NULL,
    isSafetyNet INTEGER NOT NULL, isRetirement INTEGER NOT NULL, config_json TEXT, status TEXT NOT NULL,
    sortOrder INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL
  );
  CREATE TABLE flowRule (id TEXT PRIMARY KEY, "order" INTEGER NOT NULL, type TEXT NOT NULL, config_json TEXT NOT NULL, enabled INTEGER NOT NULL);
  CREATE TABLE holding (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, assetClass TEXT NOT NULL,
    isStock INTEGER NOT NULL, planned INTEGER NOT NULL, value REAL NOT NULL, valueAt INTEGER NOT NULL,
    autoMonthly REAL, sortOrder INTEGER NOT NULL DEFAULT 0, createdAt INTEGER NOT NULL
  );
  CREATE TABLE holdingGoal (holdingId TEXT NOT NULL, goalId TEXT NOT NULL, pct REAL NOT NULL, PRIMARY KEY (holdingId, goalId));
  CREATE TABLE loan (id TEXT PRIMARY KEY, name TEXT NOT NULL, ratePct REAL NOT NULL, emi REAL NOT NULL, balance REAL NOT NULL, endDate INTEGER NOT NULL);
  CREATE TABLE valueSnapshot (id INTEGER PRIMARY KEY AUTOINCREMENT, date INTEGER NOT NULL, holdingId TEXT, assetClass TEXT, value REAL NOT NULL);
  CREATE TABLE payday (id INTEGER PRIMARY KEY AUTOINCREMENT, month INTEGER NOT NULL UNIQUE, amount REAL NOT NULL, kind TEXT NOT NULL, placedAt INTEGER);
  CREATE TABLE move (id INTEGER PRIMARY KEY AUTOINCREMENT, paydayId INTEGER NOT NULL, holdingId TEXT, goalId TEXT, planned REAL NOT NULL, actual REAL, doneAt INTEGER);
  CREATE TABLE scenario (id TEXT PRIMARY KEY, name TEXT NOT NULL, changes_json TEXT NOT NULL, createdAt INTEGER NOT NULL);
  CREATE TABLE habit (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, data_json TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
];

export async function migrate(db: SqlDb): Promise<number> {
  await db.execAsync('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = await db.getFirstAsync<{ version: number }>('SELECT version FROM schema_version LIMIT 1', []);
  let version = row?.version ?? 0;
  if (!row) await db.runAsync('INSERT INTO schema_version (version) VALUES (0)', []);
  while (version < MIGRATIONS.length) {
    await db.execAsync(`BEGIN; ${MIGRATIONS[version]}; UPDATE schema_version SET version = ${version + 1}; COMMIT;`);
    version++;
  }
  return version;
}
