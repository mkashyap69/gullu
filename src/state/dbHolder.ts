// The open database, shared by every store. Set once at launch (or by tests).
import type { SqlDb } from '../data/sql';

let db: SqlDb | null = null;
export const setDb = (d: SqlDb | null) => {
  db = d;
};
export const getDb = (): SqlDb => {
  if (!db) throw new Error('Database not open yet');
  return db;
};
export const hasDb = () => db != null;
