// The minimal SQL surface the data layer needs. expo-sqlite's SQLiteDatabase satisfies it on device;
// tests use an in-memory node:sqlite adapter with the same shape.
export type SqlValue = string | number | null;
export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: SqlValue[]): Promise<T | null>;
}
