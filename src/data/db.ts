/**
 * Opens the encrypted database. expo-sqlite is built with SQLCipher (app.json plugin option
 * `useSQLCipher: true`); a random 256-bit key is generated on first launch and kept in
 * expo-secure-store, never on disk in the clear.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { migrate } from './migrations';
import type { SqlDb } from './sql';

export const DB_NAME = 'moneyplan.db';
const KEY_NAME = 'moneyplan.dbkey.v1';

let current: SQLite.SQLiteDatabase | null = null;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function getOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return existing;
  const key = toHex(Crypto.getRandomBytes(32));
  await SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return key;
}

export async function openDb(): Promise<SqlDb> {
  if (current) return current as unknown as SqlDb;
  const key = await getOrCreateKey();
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // Raw-key form: SQLCipher uses the 256-bit key as-is (no PBKDF2 pass).
  await db.execAsync(`PRAGMA key = "x'${key}'";`);
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await migrate(db as unknown as SqlDb);
  current = db;
  return db as unknown as SqlDb;
}

/** "Delete everything": drop the database and forget the key. */
export async function destroyDb(): Promise<void> {
  if (current) {
    await current.closeAsync();
    current = null;
  }
  await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => undefined);
  await SecureStore.deleteItemAsync(KEY_NAME);
}
