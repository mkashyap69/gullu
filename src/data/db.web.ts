/**
 * Web preview only (the product is iOS/Android). No SQLCipher in the browser, so the web preview
 * keeps data in memory: writes are accepted and dropped, and the layout loads demo data directly.
 */
import type { SqlDb } from './sql';

export const DB_NAME = 'moneyplan.db';
export const isMemoryDb = true;

const noop: SqlDb = {
  async execAsync() {},
  async runAsync() {
    return undefined;
  },
  async getAllAsync<T>() {
    return [] as T[];
  },
  async getFirstAsync<T>() {
    return null as T | null;
  },
};

export async function openDb(): Promise<SqlDb> {
  return noop;
}

export async function destroyDb(): Promise<void> {}
