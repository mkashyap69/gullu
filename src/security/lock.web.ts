// Web preview: no device authentication; the lock never engages.
import { create } from 'zustand';

export const RELOCK_AFTER_MS = 60_000;
type LockState = { locked: boolean; set: (locked: boolean) => void };
export const useLockStore = create<LockState>()((set) => ({ locked: false, set: (locked) => set({ locked }) }));
export const canLock = async () => false;
export const authenticate = async (_prompt?: string) => false;
